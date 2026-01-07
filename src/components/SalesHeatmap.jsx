import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

let L;

export default function SalesHeatmap() {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maxOrders, setMaxOrders] = useState(1);

  // Importar leaflet dinámicamente
  useEffect(() => {
    if (typeof window !== 'undefined' && !L) {
      import('leaflet').then(module => {
        L = module.default;
      });
    }
  }, []);

  // Fetch heatmap data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/mercadolibre/heatmap-data', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch heatmap data');
        }

        const result = await response.json();
        setData(result.data || []);

        // Find max order count for color scaling
        if (result.data && result.data.length > 0) {
          const max = Math.max(...result.data.map(d => d.order_count));
          setMaxOrders(max);
        }
      } catch (err) {
        setError(err.message);
        console.error('Error fetching heatmap data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create map instance - Centrado en Colombia
    const map = L.map(mapRef.current).setView([4.5, -74], 6);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    setMapInstance(map);

    // Cleanup
    return () => {
      map.remove();
    };
  }, []);

  // Add markers and circles when data is loaded
  useEffect(() => {
    if (!mapInstance || data.length === 0) return;

    // Clear existing layers (except tile layer)
    mapInstance.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Popup) {
        mapInstance.removeLayer(layer);
      }
    });

    // Function to get color based on order count
    const getColor = (count) => {
      const ratio = count / maxOrders;
      if (ratio > 0.8) return '#8B0000'; // Dark red
      if (ratio > 0.6) return '#DC143C'; // Crimson
      if (ratio > 0.4) return '#FF6347'; // Tomato
      if (ratio > 0.2) return '#FFA07A'; // Light salmon
      return '#FFE4B5'; // Moccasin
    };

    // Add circle markers for each city
    data.forEach((location) => {
      if (location.latitude && location.longitude) {
        const circle = L.circleMarker([location.latitude, location.longitude], {
          radius: Math.sqrt(location.order_count) * 3,
          fillColor: getColor(location.order_count),
          color: '#000',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7
        }).addTo(mapInstance);

        // Create popup content
        const popupContent = `
          <div style="font-family: Arial, sans-serif; min-width: 200px;">
            <strong style="font-size: 1.1em;">${location.city}</strong><br/>
            <span style="color: #666; font-size: 0.9em;">${location.state}</span>
            <hr style="margin: 0.5em 0; border: none; border-top: 1px solid #ddd;">
            <div style="margin: 0.5em 0;">
              <div><strong>Pedidos:</strong> ${location.order_count}</div>
              <div><strong>Total ventas:</strong> $${parseFloat(location.total_sales).toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP</div>
            </div>
          </div>
        `;

        circle.bindPopup(popupContent);

        // Click to open popup
        circle.on('click', function() {
          this.openPopup();
        });
      }
    });
  }, [mapInstance, data, maxOrders]);

  return (
    <div style={{ width: '100%' }}>
      {error && (
        <div style={{
          background: '#fee',
          border: '1px solid #f99',
          color: '#c00',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          Error: {error}
        </div>
      )}

      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#999'
        }}>
          Cargando mapa...
        </div>
      )}

      {!loading && data.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#999'
        }}>
          No hay datos de ventas disponibles
        </div>
      )}

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '600px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #ddd',
          display: loading || data.length === 0 ? 'none' : 'block'
        }}
      />

      {/* Legend */}
      {!loading && data.length > 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#f9f7f4',
          borderRadius: '8px',
          border: '1px solid #e6e6e6'
        }}>
          <h3 style={{ marginTop: 0 }}>Leyenda</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#8B0000',
                border: '1px solid #000'
              }} />
              <span>Muy alto (80%+)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#DC143C',
                border: '1px solid #000'
              }} />
              <span>Alto (60-80%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#FF6347',
                border: '1px solid #000'
              }} />
              <span>Medio (40-60%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#FFA07A',
                border: '1px solid #000'
              }} />
              <span>Bajo (20-40%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#FFE4B5',
                border: '1px solid #000'
              }} />
              <span>Muy bajo (&lt;20%)</span>
            </div>
          </div>
          <p style={{
            fontSize: '0.9rem',
            color: '#666',
            marginTop: '1rem',
            marginBottom: 0
          }}>
            El tamaño del círculo representa la cantidad de pedidos. El color representa la intensidad de ventas en esa zona.
            Haz clic en cualquier círculo para ver detalles.
          </p>
        </div>
      )}

      {/* Stats table */}
      {!loading && data.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Top 10 Ciudades</h3>
          <div style={{
            overflowX: 'auto',
            border: '1px solid #e6e6e6',
            borderRadius: '8px'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white'
            }}>
              <thead>
                <tr style={{ background: '#f9f7f4', borderBottom: '2px solid #e6e6e6' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Rank</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Ciudad</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Provincia</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Pedidos</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Total Ventas</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((location, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: index % 2 === 0 ? '#fafaf8' : 'white'
                    }}
                  >
                    <td style={{ padding: '1rem', fontWeight: 600, color: '#c67b4e' }}>
                      #{index + 1}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>
                      {location.city}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {location.state}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                      {location.order_count}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#2d5016' }}>
                      ARS {parseFloat(location.total_sales).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
