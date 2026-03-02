// Componente de Mapa de Calor de Ventas — Fase 8
// Combina ventas web directas + MercadoLibre con filtros de período, canal y producto
import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

/* ────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────── */
const copFormat = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);

const HEAT_COLORS = ['#FFE4B5', '#FFA07A', '#FF6347', '#DC143C', '#8B0000'];

/** Convertir datos a CSV y descargarlo */
function downloadCSV(data) {
  const rows = [
    ['Ciudad', 'Departamento', 'Pedidos', 'Total ventas COP', 'Canal Web', 'Canal ML', 'Latitud', 'Longitud'],
    ...data.map((d) => [
      d.city, d.state, d.order_count,
      Math.round(d.total_sales),
      d.channels?.web ?? 0, d.channels?.ml ?? 0,
      d.latitude, d.longitude,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas-heatmap-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* Estilos inline reutilizables */
const selectStyle = {
  padding: '0.5rem 0.75rem',
  border: '1.5px solid #d0c8c0',
  borderRadius: '7px',
  fontSize: '0.88rem',
  background: '#fff',
  color: '#251a14',
  minHeight: '38px',
};
const btnPrimary = {
  padding: '0.5rem 1.2rem',
  background: '#251a14',
  color: '#f7f3ef',
  border: 'none',
  borderRadius: '7px',
  fontWeight: 700,
  fontSize: '0.875rem',
  cursor: 'pointer',
  minHeight: '38px',
};
const btnOutline = {
  padding: '0.5rem 0.9rem',
  background: 'transparent',
  color: '#251a14',
  border: '1.5px solid #d0c8c0',
  borderRadius: '7px',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  minHeight: '38px',
};

export default function SalesHeatmap() {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null); // evita crear múltiples instancias de mapa

  const [leafletReady, setLeafletReady] = useState(false);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros del formulario (pendientes de aplicar)
  const [period, setPeriod] = useState('30');
  const [channel, setChannel] = useState('all');
  const [product, setProduct] = useState('');

  // Filtros activos (los que se enviaron a la API)
  const [applied, setApplied] = useState({ period: '30', channel: 'all', product: '' });

  /* ── Cargar Leaflet dinámicamente ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const leafletMod = await import('leaflet');
        window.L = leafletMod.default;
        await new Promise((r) => setTimeout(r, 0));
        await import('leaflet.heat');
        setLeafletReady(true);
      } catch (err) {
        setError('Error cargando las librerías de mapas');
        console.error(err);
      }
    })();
  }, []);

  /* ── Inicializar mapa ── */
  useEffect(() => {
    if (!mapRef.current || !leafletReady || !window.L || mapObjRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([4.5, -74], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapObjRef.current = map;
    return () => { map.remove(); mapObjRef.current = null; };
  }, [leafletReady]);

  /* ── Fetch datos cuando cambian filtros aplicados ── */
  const fetchData = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: filters.period, channel: filters.channel });
      if (filters.product) params.set('product', filters.product);
      const res = await fetch(`/api/heatmap?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? []);
      setStats(json.stats ?? null);
    } catch (err) {
      setError('No se pudo cargar el mapa de calor. Verifica tu sesión de administrador.');
      console.error('[SalesHeatmap]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(applied); }, [applied, fetchData]);

  /* ── Actualizar capas del mapa cuando llegan datos ── */
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !leafletReady || !window.L) return;
    const L = window.L;

    // Limpiar capas anteriores (excepto tiles)
    map.eachLayer((layer) => { if (!(layer instanceof L.TileLayer)) map.removeLayer(layer); });
    if (!data.length) return;

    const maxOrders = Math.max(...data.map((d) => d.order_count));

    // Heatmap layer
    if (L.heatLayer) {
      const heatData = data
        .filter((d) => d.latitude && d.longitude)
        .map((d) => [d.latitude, d.longitude, d.order_count / maxOrders]);
      L.heatLayer(heatData, {
        radius: 50, blur: 30, maxZoom: 17,
        gradient: { 0.0: HEAT_COLORS[0], 0.25: HEAT_COLORS[1], 0.5: HEAT_COLORS[2], 0.75: HEAT_COLORS[3], 1.0: HEAT_COLORS[4] },
      }).addTo(map);
    }

    // Circle markers con popup
    data.forEach((loc) => {
      if (!loc.latitude || !loc.longitude) return;
      const radius = 5 + (loc.order_count / maxOrders) * 18;
      const channels = Object.entries(loc.channels ?? {})
        .map(([c, n]) => `<span style="background:${c === 'web' ? '#c67b4e' : '#2d5016'};color:#fff;padding:2px 7px;border-radius:999px;font-size:11px;margin-right:4px">${c.toUpperCase()} ${n}</span>`)
        .join('');
      L.circleMarker([loc.latitude, loc.longitude], {
        radius, fillColor: '#c67b4e', color: '#8b6f47', weight: 1.5, fillOpacity: 0.65,
      }).bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:180px">
          <strong style="font-size:1.05em">${loc.city}</strong><br>
          <span style="color:#666;font-size:.85em">${loc.state ?? ''}</span>
          <hr style="margin:.4em 0;border:none;border-top:1px solid #eee">
          <div style="margin:.3em 0;font-size:.9em"><strong>Pedidos:</strong> ${loc.order_count}</div>
          <div style="margin:.3em 0;font-size:.9em"><strong>Ventas:</strong> ${copFormat(loc.total_sales)}</div>
          <div style="margin:.4em 0">${channels}</div>
        </div>
      `).addTo(map);
    });
  }, [data, leafletReady]);

  /* ── Handlers ── */
  const handleApply = (e) => {
    e.preventDefault();
    setApplied({ period, channel, product });
  };
  const handleReset = () => {
    setPeriod('30'); setChannel('all'); setProduct('');
    setApplied({ period: '30', channel: 'all', product: '' });
  };

  /* ────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────── */
  return (
    <div style={{ width: '100%', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Panel de filtros ── */}
      <form onSubmit={handleApply} style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end',
        background: '#f9f7f4', border: '1px solid #e0d9d2',
        borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '140px' }}>
          <label style={{ fontSize: '0.77rem', fontWeight: 600, color: '#555' }}>Período</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectStyle}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Último año</option>
            <option value="all">Todo el tiempo</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '155px' }}>
          <label style={{ fontSize: '0.77rem', fontWeight: 600, color: '#555' }}>Canal de venta</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={selectStyle}>
            <option value="all">Todos los canales</option>
            <option value="web">Solo tienda web</option>
            <option value="ml">Solo MercadoLibre</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '160px' }}>
          <label style={{ fontSize: '0.77rem', fontWeight: 600, color: '#555' }}>Producto (opcional)</label>
          <input
            type="text" value={product} onChange={(e) => setProduct(e.target.value)}
            placeholder="Ej: Geisha, Bourbon…"
            style={{ ...selectStyle, fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
          <button type="button" onClick={handleReset} style={btnOutline}>Limpiar</button>
          {data.length > 0 && (
            <button type="button" onClick={() => downloadCSV(data)} style={btnOutline} title="Exportar CSV">
              ↓ CSV
            </button>
          )}
        </div>
      </form>

      {/* ── Stats bar ── */}
      {stats && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { icon: '📦', label: 'Pedidos', value: stats.total_orders.toLocaleString('es-CO') },
            { icon: '💰', label: 'Ventas', value: copFormat(stats.total_sales) },
            { icon: '🌆', label: 'Ciudades', value: stats.cities_count.toLocaleString('es-CO') },
            { icon: '🛒', label: 'Tienda web', value: stats.web_orders.toLocaleString('es-CO') },
            { icon: '🏪', label: 'MercadoLibre', value: stats.ml_orders.toLocaleString('es-CO') },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e0d9d2', borderRadius: '8px', padding: '0.8rem 1rem' }}>
              <div style={{ fontSize: '1.15rem' }}>{icon}</div>
              <div style={{ fontSize: '0.74rem', color: '#777', marginTop: '0.15rem' }}>{label}</div>
              <strong style={{ fontSize: '0.93rem', color: '#251a14' }}>{value}</strong>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{ background: '#fee', border: '1px solid #f99', color: '#c00', padding: '0.9rem 1rem', borderRadius: '6px', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Skeleton / vacío ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa', background: '#f9f7f4', borderRadius: '8px', marginBottom: '1rem' }}>
          ⏳ Cargando datos del mapa…
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999', background: '#f5f5f5', borderRadius: '8px', marginBottom: '1rem' }}>
          ℹ️ No hay ventas con coordenadas para este período / filtro.<br />
          <span style={{ fontSize: '0.85rem' }}>Geocodifica las órdenes existentes con el botón "Geocodificar" del panel.</span>
        </div>
      )}

      {/* ── Mapa ── */}
      <div ref={mapRef} style={{
        width: '100%', height: '520px', borderRadius: '10px',
        overflow: 'hidden', border: '1px solid #ddd',
        display: loading ? 'none' : 'block', marginBottom: '1.5rem',
      }} />

      {/* ── Leyenda ── */}
      {!loading && data.length > 0 && (
        <div style={{ background: '#f9f7f4', borderRadius: '8px', border: '1px solid #e6e6e6', padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.9rem', color: '#251a14' }}>Intensidad de ventas</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Pocas</span>
            {HEAT_COLORS.map((c, i) => (
              <div key={i} style={{ width: 34, height: `${16 + i * 7}px`, background: c, borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)' }} />
            ))}
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Muchas</span>
          </div>
        </div>
      )}

      {/* ── Top 10 Ciudades ── */}
      {!loading && data.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem', color: '#251a14' }}>Top 10 ciudades</h3>
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e6e6e6' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f9f7f4', borderBottom: '2px solid #e0d9d2' }}>
                  {['#', 'Ciudad', 'Dpto.', 'Pedidos', 'Ventas', 'Web', 'ML'].map((h, i) => (
                    <th key={h} style={{ padding: '0.7rem 0.85rem', textAlign: i > 2 ? 'right' : 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((loc, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee', background: i % 2 ? '#fff' : '#fafaf8' }}>
                    <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#c67b4e' }}>#{i + 1}</td>
                    <td style={{ padding: '0.6rem 0.85rem', fontWeight: 600 }}>{loc.city}</td>
                    <td style={{ padding: '0.6rem 0.85rem', color: '#666' }}>{loc.state ?? '—'}</td>
                    <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontWeight: 700 }}>{Number(loc.order_count).toLocaleString('es-CO')}</td>
                    <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontWeight: 600, color: '#2d5016' }}>{copFormat(loc.total_sales)}</td>
                    <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>{loc.channels?.web ?? 0}</td>
                    <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>{loc.channels?.ml ?? 0}</td>
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
