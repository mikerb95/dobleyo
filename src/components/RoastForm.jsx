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
          max-width: 500px;
          margin: 2rem auto;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          color: #333;
        }

        input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        input:focus {
          outline: none;
          border-color: #8b6f47;
          box-shadow: 0 0 0 3px rgba(139, 111, 71, 0.1);
        }

        input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        small {
          display: block;
          margin-top: 0.25rem;
          color: #666;
          font-size: 0.9rem;
        }

        .alert {
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-weight: 500;
        }

        .alert-error {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }

        .alert-success {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }

        button {
          width: 100%;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #8b6f47 0%, #6b5635 100%);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        button:hover:not(:disabled) {
          background: linear-gradient(135deg, #6b5635 0%, #4a3a23 100%);
          box-shadow: 0 4px 12px rgba(139, 111, 71, 0.2);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}
