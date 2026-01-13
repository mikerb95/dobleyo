import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export default function SalesHeatmap() {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Cargar leaflet.heat después de que el componente esté listo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Asignar L globalmente para leaflet.heat
      window.L = L;
      
      import('leaflet.heat').then(() => {
        setLeafletReady(true);
      }).catch(err => {
        console.error('Error loading leaflet.heat:', err);
        setError('Error cargando el mapa de calor');
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
    if (!mapRef.current || !leafletReady || !window.L) return;

    const L = window.L;

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
  }, [leafletReady]);

  // Add heatmap layer when data is loaded
  useEffect(() => {
    if (!mapInstance || data.length === 0 || !leafletReady || !window.L) return;

    const L = window.L;

    // Convert data to heatmap format: [[lat, lng, intensity], ...]
    // Normalize intensity based on order count
    const maxOrders = Math.max(...data.map(d => d.order_count));
    const heatmapData = data.map(location => [
      location.latitude,
      location.longitude,
      location.order_count / maxOrders // Normalize to 0-1
    ]);

    // Add heatmap layer
    if (window.L && window.L.heatLayer) {
      window.L.heatLayer(heatmapData, {
        radius: 50,
        blur: 25,
        maxZoom: 17,
        gradient: {
          0.0: '#FFE4B5',   // Very light (moccasin) - few orders
          0.25: '#FFA07A',  // Light salmon
          0.5: '#FF6347',   // Tomato
          0.75: '#DC143C',  // Crimson
          1.0: '#8B0000'    // Dark red - many orders
        }
      }).addTo(mapInstance);
    }

    // Also add city markers for reference
    data.forEach((location) => {
      if (location.latitude && location.longitude) {
        const circle = L.circleMarker([location.latitude, location.longitude], {
          radius: 5,
          fillColor: '#c67b4e',
          color: '#8b6f47',
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.5
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
      }
    });
  }, [mapInstance, data, leafletReady]);

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
          color: '#999',
          background: '#f5f5f5',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          ℹ️ No hay datos de ventas disponibles en este momento
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
          display: loading ? 'none' : 'block'
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
          <h3 style={{ marginTop: 0 }}>Leyenda - Mapa de Calor</h3>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.5rem',
            justifyContent: 'space-between',
            background: 'white',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid #ddd'
          }}>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Pocas ventas</span>
            {[0, 0.25, 0.5, 0.75, 1.0].map((value, idx) => {
              const colors = ['#FFE4B5', '#FFA07A', '#FF6347', '#DC143C', '#8B0000'];
              return (
                <div
                  key={idx}
                  style={{
                    width: '40px',
                    height: `${20 + value * 30}px`,
                    backgroundColor: colors[idx],
                    borderRadius: '2px',
                    border: '1px solid #999'
                  }}
                />
              );
            })}
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Muchas ventas</span>
          </div>
          <p style={{
            fontSize: '0.9rem',
            color: '#666',
            marginTop: '1rem',
            marginBottom: 0
          }}>
            El mapa de calor muestra la intensidad de ventas en cada zona de Colombia.
            Las áreas más rojas indican mayor volumen de pedidos. Los pequeños puntos marcan las ciudades con datos detallados.
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
