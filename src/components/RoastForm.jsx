import React, { useState, useEffect } from 'react';

export default function RoastForm({ lotId, onRoastSuccess }) {
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [maxWeight, setMaxWeight] = useState(0);

  useEffect(() => {
    if (lotId) {
      fetchLotWeight();
    }
  }, [lotId]);

  const fetchLotWeight = async () => {
    try {
      const response = await fetch(`/api/lots/${lotId}`);
      if (!response.ok) throw new Error('Error obteniendo lote');
      const lot = await response.json();
      setMaxWeight(lot.weight_kg || 0);
    } catch (err) {
      setError('Error obteniendo información del lote');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!weight || !date) {
      setError('Completa todos los campos');
      return;
    }

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setError('El peso debe ser un número positivo');
      return;
    }

    if (weightNum > maxWeight) {
      setError(`No puedes tostar ${weightNum}kg, el lote solo tiene ${maxWeight}kg`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/lots/roast/${lotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          weight_kg: weightNum,
          fecha_tostado: date
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error tostando café');
      }

      const result = await response.json();
      setSuccess(`✓ Café tostado exitosamente. Lote: ${result.roasted_lot.code}`);
      setWeight('');
      setDate('');
      
      if (onRoastSuccess) {
        onRoastSuccess(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="roast-form">
      <div className="form-group">
        <label>Peso a Tostar (kg) *</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max={maxWeight}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={`Máximo: ${maxWeight}kg`}
          disabled={loading}
        />
        <small>Disponible: {maxWeight}kg</small>
      </div>

      <div className="form-group">
        <label>Fecha de Tostado *</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Tostando...' : 'Tostar Café'}
      </button>

      <style>{`
        .roast-form {
          width: 100%;
          padding: 2.5rem;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(44, 24, 16, 0.06);
          border: 1px solid rgba(139, 111, 71, 0.1);
        }

        .form-group {
          margin-bottom: 2rem;
        }

        label {
          display: block;
          margin-bottom: 0.75rem;
          font-weight: 600;
          color: #2c1810;
          font-size: 0.95rem;
          letter-spacing: 0.02em;
        }

        input {
          width: 100%;
          padding: 1rem;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background: #fcfcfc;
          color: #2c1810;
        }

        input:focus {
          outline: none;
          border-color: #8b6f47;
          background: white;
          box-shadow: 0 0 0 4px rgba(139, 111, 71, 0.1);
        }

        input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
          color: #999;
        }

        small {
          display: block;
          margin-top: 0.5rem;
          color: #666;
          font-size: 0.85rem;
          text-align: right;
        }

        .alert {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-weight: 500;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
        }

        .alert-error {
          background: #ffebee;
          color: #d32f2f;
          border: 1px solid #ffcdd2;
        }

        .alert-success {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #c8e6c9;
        }

        button {
          width: 100%;
          padding: 1rem 1.5rem;
          background: #2c1810;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.02em;
          margin-top: 1rem;
        }

        button:hover:not(:disabled) {
          background: #4a2c20;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(44, 24, 16, 0.2);
        }

        button:disabled {
          background: #e0e0e0;
          color: #999;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>
    </form>
  );
}
