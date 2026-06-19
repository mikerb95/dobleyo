// Componente de Mapa de Calor de Ventas — Fase 8
// Combina ventas web directas + MercadoLibre con filtros de período, canal y producto
import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

/* ────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────── */
const copFormat = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);

const numFormat = (n) => Number(n ?? 0).toLocaleString('es-CO');

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
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas-heatmap-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([4.6, -74.1], 5.4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    // Habilitar zoom con rueda solo al enfocar el mapa
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    mapObjRef.current = map;

    // Recalcular tamaño cuando el contenedor ya tiene dimensiones reales
    // (corrige los "tiles recortados" al montar dentro de layouts/flex/grid).
    requestAnimationFrame(() => map.invalidateSize());
    const t1 = setTimeout(() => map.invalidateSize(), 250);
    const t2 = setTimeout(() => map.invalidateSize(), 800);

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      map.remove();
      mapObjRef.current = null;
    };
  }, [leafletReady]);

  /* ── Observar cambios de tamaño del contenedor (sidebar colapsa, resize…) ── */
  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (mapObjRef.current) mapObjRef.current.invalidateSize();
    });
    ro.observe(mapRef.current);
    return () => ro.disconnect();
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

    // Asegurar dimensiones correctas antes de pintar
    map.invalidateSize();

    if (!data.length) {
      map.setView([4.6, -74.1], 5.4);
      return;
    }

    const valid = data.filter((d) => d.latitude && d.longitude);
    const maxOrders = Math.max(1, ...data.map((d) => d.order_count));

    // Heatmap layer
    if (L.heatLayer) {
      const heatData = valid.map((d) => [d.latitude, d.longitude, d.order_count / maxOrders]);
      L.heatLayer(heatData, {
        radius: 50, blur: 30, maxZoom: 17,
        gradient: { 0.0: HEAT_COLORS[0], 0.25: HEAT_COLORS[1], 0.5: HEAT_COLORS[2], 0.75: HEAT_COLORS[3], 1.0: HEAT_COLORS[4] },
      }).addTo(map);
    }

    // Circle markers con popup
    valid.forEach((loc) => {
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

    // Ajustar la vista a los puntos (evita el mapa "descentrado")
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 9);
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(valid.map((d) => [d.latitude, d.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    }
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

  const STAT_TILES = stats ? [
    { cls: 'brand',   label: 'Pedidos totales', value: numFormat(stats.total_orders) },
    { cls: 'success', label: 'Ventas',          value: copFormat(stats.total_sales) },
    { cls: 'info',    label: 'Ciudades',        value: numFormat(stats.cities_count) },
    { cls: 'warning', label: 'Tienda web',      value: numFormat(stats.web_orders) },
    { cls: 'brand',   label: 'MercadoLibre',    value: numFormat(stats.ml_orders) },
  ] : [];

  /* ────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────── */
  return (
    <div className="hm-root">

      {/* ── Panel de filtros ── */}
      <form onSubmit={handleApply} className="hm-filters">
        <div className="form-group hm-field">
          <label>Período</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Último año</option>
            <option value="all">Todo el tiempo</option>
          </select>
        </div>
        <div className="form-group hm-field">
          <label>Canal de venta</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="all">Todos los canales</option>
            <option value="web">Solo tienda web</option>
            <option value="ml">Solo MercadoLibre</option>
          </select>
        </div>
        <div className="form-group hm-field hm-field--grow">
          <label>Producto (opcional)</label>
          <input type="text" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ej.: Geisha, Bourbon…" />
        </div>
        <div className="hm-filter-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Cargando…' : 'Aplicar filtros'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>Limpiar</button>
          {data.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => downloadCSV(data)} title="Exportar CSV">
              ↓ CSV
            </button>
          )}
        </div>
      </form>

      {/* ── Stats / KPIs ── */}
      {stats && (
        <div className="kpi-grid hm-kpis">
          {STAT_TILES.map(({ cls, label, value }) => (
            <div key={label} className={`kpi-tile ${cls}`}>
              <div className="kpi-label">{label}</div>
              <div className="kpi-value hm-kpi-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="alert alert--error" style={{ marginBottom: '14px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Mapa (siempre montado; overlay para loading/vacío) ── */}
      <div className="card hm-map-card">
        <div className="hm-map-wrap">
          <div ref={mapRef} className="hm-map" />
          {(loading || (!error && data.length === 0)) && (
            <div className="hm-map-overlay">
              {loading ? (
                <><span className="loading-spinner" /> <span>Cargando datos del mapa…</span></>
              ) : (
                <div className="hm-empty">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <p><b>Sin ventas geolocalizadas</b><br />No hay datos con coordenadas para este período o filtro. Geocodifique las órdenes pendientes desde el panel superior.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="hm-legend">
          <span className="hm-legend-label">Intensidad de ventas</span>
          <div className="hm-legend-scale">
            <span>Pocas</span>
            {HEAT_COLORS.map((c, i) => (
              <span key={i} className="hm-legend-swatch" style={{ background: c }} />
            ))}
            <span>Muchas</span>
          </div>
        </div>
      </div>

      {/* ── Top 10 Ciudades ── */}
      {!loading && data.length > 0 && (
        <div className="card hm-table-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Top ciudades</h3>
              <div className="card-subtitle">Ordenadas por número de pedidos</div>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Ciudad</th>
                  <th>Departamento</th>
                  <th style={{ textAlign: 'right' }}>Pedidos</th>
                  <th style={{ textAlign: 'right' }}>Ventas</th>
                  <th style={{ textAlign: 'right' }}>Web</th>
                  <th style={{ textAlign: 'right' }}>ML</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((loc, i) => (
                  <tr key={i}>
                    <td className="hm-rank">{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{loc.city}</td>
                    <td style={{ color: 'var(--muted)' }}>{loc.state ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{numFormat(loc.order_count)}</td>
                    <td className="hm-sales">{copFormat(loc.total_sales)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{loc.channels?.web ?? 0}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{loc.channels?.ml ?? 0}</td>
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
