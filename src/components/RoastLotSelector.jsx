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
          max-width: 1000px;
          margin: 2rem auto;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        h2 {
          margin-top: 0;
          color: #2c1810;
          text-align: center;
        }

        .lots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }

        .lot-card {
          padding: 1.5rem;
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .lot-card:hover {
          border-color: #8b6f47;
          box-shadow: 0 4px 12px rgba(139, 111, 71, 0.15);
          transform: translateY(-2px);
        }

        .lot-card.selected {
          border-color: #8b6f47;
          background: rgba(139, 111, 71, 0.05);
          box-shadow: 0 4px 12px rgba(139, 111, 71, 0.2);
        }

        .lot-card h3 {
          margin: 0 0 1rem 0;
          color: #2c1810;
        }

        .lot-info {
          margin: 0;
        }

        .lot-info p {
          margin: 0.5rem 0;
          color: #666;
          font-size: 0.95rem;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 2rem;
        }

        button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-select {
          background: linear-gradient(135deg, #8b6f47 0%, #6b5635 100%);
          color: white;
        }

        .btn-select:hover:not(:disabled) {
          background: linear-gradient(135deg, #6b5635 0%, #4a3a23 100%);
          box-shadow: 0 4px 12px rgba(139, 111, 71, 0.2);
        }

        .btn-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-cancel {
          background: #ddd;
          color: #333;
        }

        .btn-cancel:hover {
          background: #ccc;
        }

        .error {
          color: #c33;
          padding: 1rem;
          background: #fee;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
