import React, { useState, useEffect } from 'react';

export default function RoastLotSelector({ onLotSelect, onCancel }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);

  useEffect(() => {
    fetchGreenLots();
  }, []);

  const fetchGreenLots = async () => {
    try {
      const response = await fetch('/api/lots/status/verde');
      if (!response.ok) throw new Error('Error obteniendo lotes verdes');
      const data = await response.json();
      setLots(data.lots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (lot) => {
    if (onLotSelect) {
      onLotSelect(lot);
    }
  };

  if (loading) {
    return <div className="selector-container"><p>Cargando lotes verdes...</p></div>;
  }

  if (error) {
    return <div className="selector-container"><p className="error">Error: {error}</p></div>;
  }

  if (lots.length === 0) {
    return (
      <div className="selector-container">
        <p>No hay lotes verdes disponibles para tostar</p>
        {onCancel && <button onClick={onCancel}>Atrás</button>}
      </div>
    );
  }

  return (
    <div className="selector-container">
      <h2>Selecciona un Lote Verde para Tostar</h2>
      <div className="lots-grid">
        {lots.map((lot) => (
          <div
            key={lot.id}
            className={`lot-card ${selectedLot?.id === lot.id ? 'selected' : ''}`}
            onClick={() => setSelectedLot(lot)}
          >
            <h3>{lot.code}</h3>
            <div className="lot-info">
              <p><strong>Finca:</strong> {lot.farm || 'N/A'}</p>
              <p><strong>Variedad:</strong> {lot.variety || 'N/A'}</p>
              <p><strong>Altura:</strong> {lot.altitude || 'N/A'}</p>
              <p><strong>Peso:</strong> {lot.weight_kg || 0}kg</p>
            </div>
          </div>
        ))}
      </div>

      <div className="button-group">
        <button
          onClick={() => selectedLot && handleSelect(selectedLot)}
          disabled={!selectedLot}
          className="btn-select"
        >
          Tostar Café Seleccionado
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn-cancel">
            Cancelar
          </button>
        )}
      </div>

      <style>{`
        .selector-container {
          width: 100%;
          padding: 2.5rem;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(44, 24, 16, 0.06);
          border: 1px solid rgba(139, 111, 71, 0.1);
        }

        h2 {
          margin-top: 0;
          color: #2c1810;
          text-align: left;
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #f3efe6;
        }

        .lots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }

        .lot-card {
          padding: 1.5rem;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #fff;
          position: relative;
        }

        .lot-card:hover {
          border-color: #8b6f47;
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(139, 111, 71, 0.12);
        }

        .lot-card.selected {
          border-color: #8b6f47;
          background: #fdfbf7;
          box-shadow: 0 0 0 2px #8b6f47;
        }

        .lot-card h3 {
          margin: 0 0 1rem 0;
          color: #2c1810;
          font-size: 1.2rem;
          font-weight: 700;
        }

        .lot-info {
          margin: 0;
        }

        .lot-info p {
          margin: 0.5rem 0;
          color: #555;
          font-size: 0.95rem;
          display: flex;
          justify-content: space-between;
        }
        
        .lot-info strong {
          color: #8b6f47;
          font-weight: 600;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #f3efe6;
        }

        button {
          padding: 0.875rem 2rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.02em;
        }

        .btn-select {
          background: #2c1810;
          color: white;
        }

        .btn-select:hover:not(:disabled) {
          background: #4a2c20;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(44, 24, 16, 0.2);
        }

        .btn-select:disabled {
          background: #e0e0e0;
          color: #999;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-cancel {
          background: transparent;
          color: #666;
          border: 1px solid #ddd;
        }

        .btn-cancel:hover {
          background: #f5f5f5;
          color: #333;
          border-color: #ccc;
        }

        .error {
          color: #d32f2f;
          padding: 1rem;
          background: #ffebee;
          border-radius: 8px;
          border: 1px solid #ffcdd2;
        }
      `}</style>
    </div>
  );
}
