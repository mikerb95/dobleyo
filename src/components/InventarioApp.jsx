import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ── API Layer ────────────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, signal, credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network_error', e.message);
  }
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, json?.error?.code, json?.error?.message ?? res.statusText);
  if (!json || json.success !== true) throw new ApiError(res.status, 'bad_envelope', 'Envoltorio inválido');
  return json.data;
}

const api = {
  get: (p, o) => request(p, { ...o, method: 'GET' }),
  post: (p, body) => request(p, { method: 'POST', body }),
};

// Lista de productos para el selector de movimientos.
// /inventory/products usa el envoltorio { success, products }, no { success, data },
// por eso no pasa por request().
async function fetchProducts() {
  let res;
  try {
    res = await fetch('/api/inventory/products?active=true', {
      credentials: 'include', headers: { Accept: 'application/json' },
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor.');
  }
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'No se pudieron cargar los productos.');
  }
  return json.products || [];
}

function useApi(path, { deps = [], enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!enabled });
  const reqIdRef = useRef(0);
  const run = useCallback(() => {
    if (!enabled || !path) { setState({ data: null, error: null, loading: false }); return () => {}; }
    const ctrl = new AbortController();
    const reqId = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path, { signal: ctrl.signal })
      .then((data) => { if (reqId === reqIdRef.current) setState({ data, error: null, loading: false }); })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (reqId === reqIdRef.current) setState({ data: null, error: err, loading: false });
      });
    return () => ctrl.abort();
  }, [path, enabled]);
  useEffect(() => run(), [run, ...deps]);
  return { ...state, refetch: run };
}

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtN = (n, opts = {}) =>
  n == null ? '—' : n.toLocaleString('es-CO', { maximumFractionDigits: 1, ...opts });
const fmtKg  = (n) => n == null ? '—' : `${fmtN(n)} kg`;
const fmtU   = (n) => n == null ? '—' : `${fmtN(n)} u`;
const fmtDate = (iso) => !iso ? '—' : new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
const fmtTime = (iso) => !iso ? '—' : new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso) => !iso ? '—' : new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const ageLabel = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h} h`;
  return `${Math.floor(h / 24)} d`;
};

// ── CSV export ─────────────────────────────────────────────────────────────────
function downloadCSV(filename, rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.get(r))).join(',')).join('\n');
  const csv = '﻿' + header + '\n' + body; // BOM para que Excel respete UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'green',  label: 'Café verde',   unit: 'kg' },
  { id: 'roast',  label: 'Café tostado', unit: 'kg' },
  { id: 'pack',   label: 'Empaque',      unit: 'u'  },
  { id: 'labels', label: 'Etiquetas',    unit: 'u'  },
];

const STATUS_PILL = {
  ok:   { label: 'En rango',   cls: 'inv-pill--ok'   },
  warn: { label: 'Atención',   cls: 'inv-pill--warn' },
  low:  { label: 'Bajo stock', cls: 'inv-pill--low'  },
};

const statusLabel = (s) => STATUS_PILL[s]?.label ?? s ?? '';

// Columnas de exportación CSV por tab (usa los mismos campos que la lista).
const CSV_COLUMNS = {
  green: [
    { label: 'Lote',            get: (r) => r.code },
    { label: 'Origen',          get: (r) => r.origin },
    { label: 'Caficultor',      get: (r) => r.farmer },
    { label: 'Bodega',          get: (r) => r.warehouse },
    { label: 'Variedad',        get: (r) => r.variety },
    { label: 'Kg',              get: (r) => r.kg },
    { label: 'Días almacenado', get: (r) => r.days_in_storage },
    { label: 'Humedad %',       get: (r) => r.humidity_pct },
    { label: 'Estado',          get: (r) => statusLabel(r.status) },
  ],
  roast: [
    { label: 'Lote',         get: (r) => r.code },
    { label: 'Origen',       get: (r) => r.origin },
    { label: 'Caficultor',   get: (r) => r.farmer },
    { label: 'Bodega',       get: (r) => r.warehouse },
    { label: 'Perfil',       get: (r) => r.profile },
    { label: 'Kg',           get: (r) => r.kg },
    { label: 'Días tostión', get: (r) => r.days_since_roast },
    { label: 'Estado',       get: (r) => statusLabel(r.status) },
  ],
  pack: [
    { label: 'SKU',       get: (r) => r.sku },
    { label: 'Nombre',    get: (r) => r.name },
    { label: 'Proveedor', get: (r) => r.supplier },
    { label: 'Lead días', get: (r) => r.lead_days },
    { label: 'Stock',     get: (r) => r.stock },
    { label: 'Mínimo',    get: (r) => r.min },
    { label: 'Máximo',    get: (r) => r.max },
    { label: 'Estado',    get: (r) => statusLabel(r.status) },
  ],
  labels: [
    { label: 'SKU',         get: (r) => r.sku },
    { label: 'Nombre',      get: (r) => r.name },
    { label: 'Plantilla QR', get: (r) => r.qr_template },
    { label: 'Stock',       get: (r) => r.stock },
    { label: 'Estado',      get: (r) => statusLabel(r.status) },
  ],
};

const MOVEMENT_TYPES = [
  { value: 'entrada',    label: 'Entrada' },
  { value: 'salida',     label: 'Salida' },
  { value: 'ajuste',     label: 'Ajuste' },
  { value: 'merma',      label: 'Merma' },
  { value: 'devolucion', label: 'Devolución' },
];

// ── Primitives ────────────────────────────────────────────────────────────────
function Skel({ width, height = 14, style = {} }) {
  return <span className="inv-skel" style={{ width, height, ...style }} />;
}

function StatusPill({ status }) {
  const s = STATUS_PILL[status] || STATUS_PILL.ok;
  return <span className={`inv-pill ${s.cls}`}>{s.label}</span>;
}

function StockBar({ pct, status }) {
  const cls = status === 'low' ? 'inv-stockbar--low' : status === 'warn' ? 'inv-stockbar--warn' : 'inv-stockbar--ok';
  return (
    <div className={`inv-stockbar ${cls}`} aria-label={`Stock ${Math.round(pct * 100)}%`}>
      <div className="inv-stockbar__fill" style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function Tabs({ value, onChange, summary }) {
  return (
    <div className="inv-tabs" role="tablist">
      {TABS.map((t) => {
        const s = summary?.[t.id];
        const count = s
          ? (t.id === 'green' || t.id === 'roast' ? `${s.lots} lotes` : `${s.skus} SKU`)
          : '…';
        return (
          <button key={t.id} type="button" role="tab" aria-selected={value === t.id}
            className={`inv-tab${value === t.id ? ' inv-tab--on' : ''}`}
            onClick={() => onChange(t.id)}>
            {t.label}
            <span className="inv-tab__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, variant }) {
  return (
    <div className={`inv-kpi${variant ? ` inv-kpi--${variant}` : ''}`}>
      <div className="inv-kpi__label">{label}</div>
      <div className="inv-kpi__value">{value}</div>
      <div className="inv-kpi__sub">{sub}</div>
    </div>
  );
}

function Kpis({ tab, summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="inv-kpis" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="inv-kpi">
            <Skel width={80} height={11} />
            <Skel width={110} height={22} style={{ marginTop: 6 }} />
            <Skel width={90} height={11} style={{ marginTop: 4 }} />
          </div>
        ))}
      </div>
    );
  }
  const s = summary[tab];
  if (!s) return null;

  if (tab === 'green') return (
    <div className="inv-kpis">
      <Kpi label="En stock"   value={fmtKg(s.total)}               sub={<><b>{s.lots}</b> lotes activos</>}      variant="accent" />
      <Kpi label="Reservado"  value={fmtKg(s.reserved)}            sub={<>para tostión programada</>} />
      <Kpi label="Disponible" value={fmtKg(s.total - s.reserved)}  sub={<>libre para asignar</>}                 variant="ok" />
      <Kpi label="Alertas"    value={s.alerts}                     sub={<>lotes fuera de rango</>}               variant={s.alerts ? 'warn' : 'ok'} />
    </div>
  );
  if (tab === 'roast') return (
    <div className="inv-kpis">
      <Kpi label="En stock"   value={fmtKg(s.total)}               sub={<><b>{s.lots}</b> lotes tostados</>}     variant="accent" />
      <Kpi label="Reservado"  value={fmtKg(s.reserved)}            sub={<>asignado a empaque</>} />
      <Kpi label="Disponible" value={fmtKg(s.total - s.reserved)}  sub={<>listo para vender</>}                  variant="ok" />
      <Kpi label="Frescura"   value={s.alerts}                     sub={<>lotes &gt;14 d desde tostión</>}       variant={s.alerts ? 'warn' : 'ok'} />
    </div>
  );
  if (tab === 'pack') return (
    <div className="inv-kpis">
      <Kpi label="Unidades"         value={fmtN(s.total)}    sub={<><b>{s.skus}</b> SKU en catálogo</>}  variant="accent" />
      <Kpi label="Bajo mínimo"      value={s.below_min}      sub={<>requieren reposición</>}              variant={s.below_min ? 'warn' : 'ok'} />
      <Kpi label="Proveedores"      value={s.suppliers ?? '—'} sub={<>activos</>} />
      <Kpi label="En tránsito"      value={s.in_transit ?? '—'} sub={<>pedidos pendientes</>} />
    </div>
  );
  return (
    <div className="inv-kpis">
      <Kpi label="Etiquetas"    value={fmtN(s.total)}   sub={<><b>{s.skus}</b> plantillas</>}         variant="accent" />
      <Kpi label="Bajo mínimo"  value={s.below_min}     sub={<>requieren reimpresión</>}               variant={s.below_min ? 'warn' : 'ok'} />
      <Kpi label="Plantilla QR" value={s.qr_version ?? '—'} sub={<>versión vigente</>} />
      <Kpi label="Impresora"    value={s.printer ?? '—'}    sub={<>activa</>}                          variant="ok" />
    </div>
  );
}

// ── Item List ─────────────────────────────────────────────────────────────────
function ItemList({ tab, items, loading, selected, onSelect }) {
  if (loading) {
    return (
      <div className={`inv-list inv-list--${tab}`} aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="inv-list__row">
            <Skel width={60} /><Skel width={180} /><Skel width={80} />
            <Skel width={60} /><Skel width={80} /><Skel width={60} />
          </div>
        ))}
      </div>
    );
  }
  if (!items?.length) {
    return (
      <div className={`inv-list inv-list--${tab}`}>
        <div className="inv-list__row" style={{ color: 'var(--muted)' }}>Sin ítems registrados.</div>
      </div>
    );
  }

  if (tab === 'green' || tab === 'roast') {
    return (
      <div className={`inv-list inv-list--${tab}`} role="table">
        <div className="inv-list__head">
          <span>Lote</span>
          <span>Origen</span>
          <span>{tab === 'green' ? 'Bodega · variedad' : 'Bodega · perfil'}</span>
          <span className="inv-cell--right">kg</span>
          <span>{tab === 'green' ? 'Edad · humedad' : 'Días tostión'}</span>
          <span>Estado</span>
        </div>
        {items.map((it) => {
          const pct = (it.kg ?? 0) / 260;
          return (
            <div key={it.id} role="row"
              className={`inv-list__row${selected === it.id ? ' inv-list__row--on' : ''}`}
              onClick={() => onSelect(it.id)}>
              <span className="inv-cell--mono">{it.code}</span>
              <span>
                <div className="inv-cell--strong">{it.origin}</div>
                <div className="inv-cell--muted" style={{ fontSize: 11.5 }}>{it.farmer}</div>
              </span>
              <span>
                <div>Bodega {it.warehouse}</div>
                <div className="inv-cell--muted" style={{ fontSize: 11.5 }}>
                  {tab === 'green' ? it.variety : it.profile}
                </div>
              </span>
              <span className="inv-cell--right inv-cell--strong">
                {fmtN(it.kg)}
                <StockBar pct={pct} status={it.status} />
              </span>
              <span className="inv-cell--muted">
                {tab === 'green'
                  ? <>{it.days_in_storage} d · {it.humidity_pct} %</>
                  : <>{it.days_since_roast} d</>}
              </span>
              <span><StatusPill status={it.status} /></span>
            </div>
          );
        })}
      </div>
    );
  }

  // pack / labels
  return (
    <div className={`inv-list inv-list--${tab}`} role="table">
      <div className="inv-list__head">
        <span>SKU</span>
        <span>{tab === 'pack' ? 'Proveedor' : 'Plantilla'}</span>
        <span className="inv-cell--right">Stock</span>
        <span>Mín · Máx</span>
        <span>Estado · cobertura</span>
      </div>
      {items.map((it) => {
        const pct = it.stock / (it.max || 1);
        return (
          <div key={it.id} role="row"
            className={`inv-list__row${selected === it.id ? ' inv-list__row--on' : ''}`}
            onClick={() => onSelect(it.id)}>
            <span>
              <div className="inv-cell--mono">{it.sku}</div>
              <div className="inv-cell--muted" style={{ fontSize: 11.5 }}>{it.name}</div>
            </span>
            <span className="inv-cell--muted">
              {tab === 'pack'
                ? <>{it.supplier}<br /><small>lead {it.lead_days} d</small></>
                : <>{it.qr_template}<br /><small>{it.printer}</small></>}
            </span>
            <span className="inv-cell--right inv-cell--strong">
              {fmtN(it.stock)} u
              <StockBar pct={pct} status={it.status} />
            </span>
            <span className="inv-cell--muted">{fmtN(it.min)} · {fmtN(it.max)}</span>
            <span>
              <StatusPill status={it.status} />
              <div className="inv-cell--muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                {tab === 'pack'
                  ? <>últ. salida {ageLabel(it.last_out)}</>
                  : <>últ. impresión {ageLabel(it.last_print)}</>}
              </div>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function buildDetailFields(tab, item) {
  if (tab === 'green') return [
    { label: 'Bodega',      value: item.warehouse },
    { label: 'Variedad',    value: item.variety },
    { label: 'Caficultor',  value: item.farmer },
    { label: 'Cantidad',    value: fmtKg(item.kg) },
    { label: 'Humedad',     value: `${item.humidity_pct} %` },
    { label: 'Días almac.', value: `${item.days_in_storage} d` },
    { label: 'Reservado',   value: item.reserved_kg ? fmtKg(item.reserved_kg) : '—' },
    { label: 'Disponible',  value: fmtKg((item.kg ?? 0) - (item.reserved_kg ?? 0)) },
  ];
  if (tab === 'roast') return [
    { label: 'Bodega',       value: item.warehouse },
    { label: 'Perfil',       value: item.profile },
    { label: 'Caficultor',   value: item.farmer },
    { label: 'Cantidad',     value: fmtKg(item.kg) },
    { label: 'Días tostión', value: `${item.days_since_roast} d` },
    { label: 'Reservado',    value: item.reserved_kg ? fmtKg(item.reserved_kg) : '—' },
    { label: 'Disponible',   value: fmtKg((item.kg ?? 0) - (item.reserved_kg ?? 0)) },
    { label: 'Asignación',   value: item.reserved_for ?? 'libre' },
  ];
  if (tab === 'pack') return [
    { label: 'Stock actual', value: fmtU(item.stock) },
    { label: 'Mínimo',       value: fmtU(item.min) },
    { label: 'Máximo',       value: fmtU(item.max) },
    { label: 'Proveedor',    value: item.supplier },
    { label: 'Lead time',    value: `${item.lead_days} d` },
    { label: 'Últ. entrada', value: fmtDateTime(item.last_in) },
    { label: 'Últ. salida',  value: fmtDateTime(item.last_out) },
  ];
  return [
    { label: 'Stock actual',   value: fmtU(item.stock) },
    { label: 'Mínimo',         value: fmtU(item.min) },
    { label: 'Máximo',         value: fmtU(item.max) },
    { label: 'Plantilla QR',   value: item.qr_template },
    { label: 'Impresora',      value: item.printer },
    { label: 'Últ. impresión', value: fmtDateTime(item.last_print) },
  ];
}

function DetailPanel({ tab, detail, loading, hasSelection }) {
  if (!hasSelection) {
    return (
      <aside className="inv-detail inv-detail--empty">
        <span>Seleccione un ítem<br />para ver su ficha y movimientos.</span>
      </aside>
    );
  }
  if (loading || !detail) {
    return (
      <aside className="inv-detail" aria-busy="true">
        <Skel width={120} height={14} />
        <Skel width={160} height={22} />
        <Skel width={220} height={12} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skel key={i} height={30} />)}
        </div>
      </aside>
    );
  }
  const { item, movements } = detail;
  const fields = buildDetailFields(tab, item);
  const code = item.code || item.sku;
  const subtitle = item.origin ? `${item.origin} · ${item.farmer}` : item.name;

  const ctaLabel = tab === 'green'  ? 'Programar tostión'
                 : tab === 'roast'  ? 'Asignar a empaque'
                 : tab === 'pack'   ? 'Reponer stock'
                 : 'Reimprimir etiquetas';

  return (
    <aside className="inv-detail">
      <h3 className="inv-detail__title">
        Detalle <small>{TABS.find(t => t.id === tab)?.label}</small>
      </h3>
      <div>
        <p className="inv-detail__code">{code}</p>
        <div className="inv-detail__sub">{subtitle}</div>
        <div style={{ marginTop: 8 }}>
          <StatusPill status={item.status} />
        </div>
      </div>

      <dl className="inv-detail__grid">
        {fields.map((f) => (
          <div key={f.label} className="inv-detail__field">
            <dt>{f.label}</dt>
            <dd>{f.value ?? '—'}</dd>
          </div>
        ))}
      </dl>

      {item.note && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5 }}>
          {item.note}
        </p>
      )}

      {movements?.length > 0 && (
        <div className="inv-detail__section">
          <h4>Movimientos recientes</h4>
          <ul className="inv-detail__movs">
            {movements.map((m) => (
              <li key={m.id}>
                <time>{ageLabel(m.when)}</time>
                <span>{m.what}</span>
                <span className={`inv-mov__qty${m.qty > 0 ? ' inv-mov__qty--in' : m.qty < 0 ? ' inv-mov__qty--out' : ''}`}>
                  {m.qty > 0 ? '+' : ''}{fmtN(m.qty)} {m.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="inv-detail__actions">
        <button type="button" className="inv-btn inv-btn--primary">{ctaLabel}</button>
        <button type="button" className="inv-btn">Ver trazabilidad</button>
      </div>
    </aside>
  );
}

// ── Movements Feed ─────────────────────────────────────────────────────────────
function MovementsFeed({ data, loading }) {
  return (
    <section className="inv-feed">
      <div className="inv-feed__head">
        <h2>Movimientos · últimas 72 h</h2>
        <small>actualizado en vivo</small>
      </div>
      {loading || !data ? (
        <ul className="inv-feed__list">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="inv-feed__item">
              <Skel width={18} height={18} style={{ borderRadius: 999 }} />
              <Skel width={70} />
              <Skel />
              <Skel width={60} />
              <Skel width={90} />
            </li>
          ))}
        </ul>
      ) : !data.length ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '16px 0 0' }}>Sin movimientos registrados.</p>
      ) : (
        <ul className="inv-feed__list">
          {data.map((m) => (
            <li key={m.id} className="inv-feed__item">
              <span className={`inv-feed__icon inv-feed__icon--${m.type}`}>
                {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '↔'}
              </span>
              <span className="inv-feed__when">{fmtDate(m.when)} · {fmtTime(m.when)}</span>
              <span className="inv-feed__what">{m.what}</span>
              <span className={`inv-feed__qty${m.qty > 0 ? ' inv-mov__qty--in' : m.qty < 0 ? ' inv-mov__qty--out' : ''}`}>
                {m.qty > 0 ? '+' : ''}{fmtN(m.qty)} {m.unit}
              </span>
              <span className="inv-feed__by">{m.by}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── New Movement Modal ──────────────────────────────────────────────────────────
function NewMovementModal({ onClose, onDone, initialProductId }) {
  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({
    product_id: initialProductId || '',
    movement_type: 'entrada',
    quantity: '',
    reason: '',
    reference: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((list) => { if (active) setProducts(list); })
      .catch((e) => { if (active) setLoadError(e.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isAdjust = form.movement_type === 'ajuste';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const qty = Number(form.quantity);
    if (!form.product_id) { setError('Seleccione un producto.'); return; }
    if (!Number.isFinite(qty) || qty < 1) {
      setError('Ingrese una cantidad válida (mínimo 1).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/movements', {
        product_id: form.product_id,
        movement_type: form.movement_type,
        quantity: qty,
        reason: form.reason.trim() || null,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      });
      onDone();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el movimiento.');
      setSubmitting(false);
    }
  };

  return (
    <div className="inv-modal" role="dialog" aria-modal="true" aria-label="Nuevo movimiento"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="inv-modal__card" onSubmit={submit}>
        <div className="inv-modal__head">
          <h2 className="inv-modal__title">Nuevo movimiento</h2>
          <button type="button" className="inv-modal__close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>

        <div className="inv-modal__body">
          <label className="inv-field">
            <span>Producto</span>
            {loadError ? (
              <span className="inv-modal__error" style={{ margin: 0 }}>{loadError}</span>
            ) : (
              <select className="inv-input" value={form.product_id} onChange={set('product_id')}
                disabled={!products} required>
                <option value="">{products ? 'Seleccione un producto…' : 'Cargando…'}</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — stock {fmtN(p.stock_quantity)}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="inv-field-row">
            <label className="inv-field">
              <span>Tipo</span>
              <select className="inv-input" value={form.movement_type} onChange={set('movement_type')}>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="inv-field">
              <span>Cantidad</span>
              <input className="inv-input" type="number" min="1" step="1"
                value={form.quantity} onChange={set('quantity')} required />
            </label>
          </div>
          {isAdjust && (
            <p className="inv-hint">En un ajuste, la cantidad es el nuevo stock total del producto.</p>
          )}

          <label className="inv-field">
            <span>Motivo</span>
            <input className="inv-input" type="text" value={form.reason} onChange={set('reason')}
              placeholder="Ej.: Recepción de pedido, conteo físico…" />
          </label>

          <div className="inv-field-row">
            <label className="inv-field">
              <span>Referencia</span>
              <input className="inv-input" type="text" value={form.reference} onChange={set('reference')}
                placeholder="N.° de factura, orden…" />
            </label>
          </div>

          <label className="inv-field">
            <span>Notas</span>
            <textarea className="inv-input" rows={2} value={form.notes} onChange={set('notes')} />
          </label>

          {error && <p className="inv-modal__error">{error}</p>}
        </div>

        <div className="inv-modal__foot">
          <button type="button" className="inv-btn" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
            {submitting ? 'Registrando…' : 'Registrar movimiento'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function InventarioApp() {
  const [tab, setTab]       = useState('green');
  const [q, setQ]           = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [movOpen, setMovOpen] = useState(false);

  const summary = useApi('/inventory/summary');
  const items   = useApi(`/inventory/items?type=${tab}`, { deps: [tab] });
  const detail  = useApi(selected ? `/inventory/items/${selected}` : null,
    { deps: [selected], enabled: !!selected });
  const movs    = useApi('/inventory/feed');

  useEffect(() => { setSelected(null); }, [tab]);

  useEffect(() => {
    if (!selected && items.data?.length) setSelected(items.data[0].id);
  }, [items.data]);

  const filtered = useMemo(() => {
    if (!items.data) return null;
    return items.data.filter((it) => {
      if (filter === 'alerts' && it.status === 'ok') return false;
      if (!q) return true;
      const hay = [it.code, it.sku, it.name, it.origin, it.farmer, it.variety, it.profile, it.warehouse]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [items.data, q, filter]);

  const placeholder = tab === 'green'  ? 'Buscar lote, finca, caficultor…'
                    : tab === 'roast'  ? 'Buscar lote, perfil…'
                    : 'Buscar SKU, nombre, proveedor…';

  return (
    <main className="inv-shell">
      <header className="inv-head">
        <div>
          <h1 className="inv-head__title">Inventario</h1>
          <p className="inv-head__sub">
            Café verde, café tostado, empaque y etiquetas · stock y movimientos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="inv-btn">Exportar CSV</button>
          <button type="button" className="inv-btn inv-btn--primary">+ Nuevo movimiento</button>
        </div>
      </header>

      <Tabs value={tab} onChange={setTab} summary={summary.data} />

      <Kpis tab={tab} summary={summary.data} loading={summary.loading} />

      <div className="inv-toolbar">
        <label className="inv-search">
          <span>⌕</span>
          <input type="search" placeholder={placeholder}
            value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="inv-filters">
          <button type="button"
            className={`inv-chip${filter === 'all' ? ' inv-chip--on' : ''}`}
            onClick={() => setFilter('all')}>Todos</button>
          <button type="button"
            className={`inv-chip${filter === 'alerts' ? ' inv-chip--on' : ''}`}
            onClick={() => setFilter('alerts')}>Solo alertas</button>
        </div>
      </div>

      {items.error && (
        <div className="inv-error" role="alert">
          <span>No se pudo cargar: {items.error.message}</span>
          <button type="button" className="inv-btn" onClick={items.refetch}>Reintentar</button>
        </div>
      )}

      <div className="inv-workspace">
        <ItemList tab={tab} items={filtered} loading={items.loading}
          selected={selected} onSelect={setSelected} />
        <DetailPanel tab={tab} detail={detail.data}
          loading={detail.loading} hasSelection={!!selected} />
      </div>

      <MovementsFeed data={movs.data} loading={movs.loading} />
    </main>
  );
}
