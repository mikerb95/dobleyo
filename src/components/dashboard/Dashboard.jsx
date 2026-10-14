import React, { useEffect, useRef, useState } from "react";
import ExecutiveSummary, { fmtCOP, fmtCOPshort, fmtNum, Delta, Sparkline } from "./components/ExecutiveSummary.jsx";
import ActivityFeed from "./components/ActivityFeed.jsx";
import { useApi } from "../../lib/api.js";
import styles from "./Dashboard.module.css";

const RANGES = [
  { id: "30d", label: "30 d", long: "Últimos 30 días" },
  { id: "90d", label: "90 d", long: "Últimos 90 días" },
  { id: "12m", label: "12 m", long: "Últimos 12 meses" },
];

const TZ = "America/Bogota";

export default function Dashboard({ user: userProp = null }) {
  const [user, setUser] = useState(userProp);
  const [range, setRange] = useState("30d");
  const [cutoff] = useState(() => new Date());
  const summary = useApi(`/dashboard/summary?range=${range}`, { deps: [range] });
  const alerts  = useApi("/dashboard/alerts");
  const feed    = useApi("/dashboard/activity?limit=8");

  useEffect(() => {
    if (user) return;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data); })
      .catch(() => {});
  }, []);

  const rangeInfo = RANGES.find((r) => r.id === range);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <div className="page-breadcrumb">Principal / Resumen</div>
          <h1 className="page-title">Resumen operativo</h1>
          <div className="page-meta">
            {formatToday(cutoff)} · Corte {cutoff.toLocaleTimeString("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })} COT · {rangeInfo?.long} vs. periodo anterior
          </div>
        </div>
        <div className={styles.headActions}>
          <div className="seg" role="group" aria-label="Periodo">
            {RANGES.map((r) => (
              <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <NewMenu role={user?.role ?? "admin"} />
        </div>
      </header>

      <StatStrip data={summary.data} loading={summary.loading} error={summary.error} onRetry={summary.refetch} />

      <div className={styles.cols21}>
        <Attention items={alerts.data} loading={alerts.loading} error={alerts.error} onRetry={alerts.refetch} />
        <Operation data={summary.data} loading={summary.loading} />
      </div>

      <ExecutiveSummary data={summary.data} loading={summary.loading} error={summary.error} onRetry={summary.refetch} />

      <div className={styles.cols12}>
        <ProductionPanel timeline={summary.data?.production?.timeline} loading={summary.loading} />
        <ActivityFeed items={feed.data} loading={feed.loading} error={feed.error} onRetry={feed.refetch} />
      </div>
    </div>
  );
}

function formatToday(d) {
  const s = d.toLocaleDateString("es-CO", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Franja de indicadores ─────────────────────────────────────────── */
function StatStrip({ data, loading, error, onRetry }) {
  if (error) {
    return (
      <div className={styles.errorTile} role="alert">
        <span>No se pudieron cargar los indicadores.</span>
        <button type="button" className="btn btn-sm" onClick={onRetry}>Reintentar</button>
      </div>
    );
  }
  const s = data?.sales;
  const inv = data?.inventory;
  const tiles = [
    { label: "Ingresos", value: fmtCOP(s?.revenue), delta: s?.delta_revenue, spark: s?.timeline?.map((p) => p.revenue) },
    { label: "Pedidos", value: fmtNum(s?.orders), delta: s?.delta_orders, spark: s?.timeline?.map((p) => p.orders) },
    { label: "Ticket promedio", value: fmtCOP(s?.aov), note: "por pedido" },
    { label: "Valor de inventario", value: fmtCOPshort(inv?.inventory_value), note: `${fmtNum(inv?.total_products)} productos activos` },
    {
      label: "Stock bajo",
      value: fmtNum(inv?.low_stock),
      note: inv?.out_of_stock ? `${fmtNum(inv.out_of_stock)} agotados` : "sin agotados",
      tone: inv?.low_stock > 0 ? "warn" : null,
    },
  ];
  return (
    <section className="kpi-grid" aria-label="Indicadores del periodo" aria-busy={loading || undefined}>
      {tiles.map((t) => (
        <div key={t.label} className="kpi-tile">
          <div className={styles.tileHead}>
            <span className="kpi-label">{t.label}</span>
            {!loading && t.spark?.length > 1 && <Sparkline values={t.spark} className={styles.spark} />}
          </div>
          <div className="kpi-value">
            {loading ? <span className="skeleton" style={{ width: "60%" }} /> : t.value}
          </div>
          <div className="kpi-sub">
            {loading ? " " : t.delta != null
              ? <><Delta value={t.delta} /> vs. periodo anterior</>
              : <span className={t.tone ? styles.warnText : undefined}>{t.note}</span>}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── Requiere atención ─────────────────────────────────────────────── */
const PRIORITY = {
  critical: { label: "Alta", cls: "status--error", rank: 0 },
  warning:  { label: "Media", cls: "status--warn", rank: 1 },
  info:     { label: "Baja", cls: "", rank: 2 },
};

function Attention({ items, loading, error, onRetry }) {
  const list = [...(items ?? [])].sort((a, b) => (PRIORITY[a.severity]?.rank ?? 9) - (PRIORITY[b.severity]?.rank ?? 9));
  return (
    <section className="panel" aria-labelledby="dash-attention">
      <div className="panel-header">
        <div className={styles.titleRow}>
          <h2 id="dash-attention" className="panel-title">Requiere atención</h2>
          {!loading && !error && <span className="count">{list.length} {list.length === 1 ? "abierta" : "abiertas"}</span>}
        </div>
      </div>
      {error ? (
        <div className={styles.panelMsg}>
          No se pudieron cargar los pendientes.{" "}
          <button type="button" className="btn btn-sm" onClick={onRetry}>Reintentar</button>
        </div>
      ) : loading ? (
        <div className={styles.panelMsg}><span className="skeleton" style={{ width: "70%" }} /></div>
      ) : list.length === 0 ? (
        <p className="empty-state">No hay pendientes. El inventario y los ingresos de cosecha están al día.</p>
      ) : (
        <div className="table-wrapper">
          <table className="erp-table">
            <thead>
              <tr><th>Prioridad</th><th>Asunto</th><th className="num"><span className={styles.srOnly}>Acción</span></th></tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const p = PRIORITY[a.severity] ?? PRIORITY.info;
                return (
                  <tr key={a.id}>
                    <td><span className={`status ${p.cls}`}>{p.label}</span></td>
                    <td className={styles.subject}>
                      <div>{a.title}</div>
                      {a.description && <div className={styles.subjectMeta}>{a.description}</div>}
                    </td>
                    <td className="num">
                      {a.action?.href && <a className="btn btn-sm" href={a.action.href}>{a.action.label}</a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Operación: producción e inventario ───────────────────────────── */
function Operation({ data, loading }) {
  const prod = data?.production;
  const inv = data?.inventory;
  const rows = [
    { label: "Lotes en verde", value: fmtNum(prod?.green_lots), href: "/admin/inventory-storage" },
    { label: "Lotes tostados", value: fmtNum(prod?.roasted_lots), href: "/admin/roasted-storage" },
    { label: "Puntaje SCA promedio", value: prod?.avg_score ? String(prod.avg_score).replace(".", ",") : "Sin catación", href: "/admin/cupping" },
    { label: "Productos agotados", value: fmtNum(inv?.out_of_stock), href: "/admin/inventario" },
  ];
  return (
    <section className="panel" aria-labelledby="dash-ops">
      <div className="panel-header">
        <h2 id="dash-ops" className="panel-title">Operación</h2>
        <a className="card-action" href="/admin/produccion">Abrir Qué sigue</a>
      </div>
      <dl className={styles.opsList}>
        {rows.map((r) => (
          <div key={r.label} className={styles.opsRow}>
            <dt><a href={r.href}>{r.label}</a></dt>
            <dd className="mono">{loading ? <span className="skeleton" style={{ width: 40 }} /> : r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ── Producción de lotes por periodo ──────────────────────────────── */
function ProductionPanel({ timeline, loading }) {
  const data = timeline ?? [];
  const reg = data.reduce((s, p) => s + (p.registered || 0), 0);
  const roast = data.reduce((s, p) => s + (p.roasted || 0), 0);
  const max = Math.max(...data.flatMap((d) => [d.registered || 0, d.roasted || 0]), 1);
  return (
    <section className="panel" aria-labelledby="dash-prod">
      <div className="panel-header">
        <h2 id="dash-prod" className="panel-title">Producción de lotes</h2>
        <div className={styles.legend}>
          <span><i className={styles.swReg} aria-hidden="true" />Registrados <b className="mono">{fmtNum(reg)}</b></span>
          <span><i className={styles.swRoast} aria-hidden="true" />Tostados <b className="mono">{fmtNum(roast)}</b></span>
        </div>
      </div>
      {loading ? (
        <div className={styles.panelMsg}><span className="skeleton" style={{ width: "100%", height: 120 }} /></div>
      ) : data.length === 0 ? (
        <p className="empty-state">Sin lotes registrados en el periodo.</p>
      ) : (
        <div className={styles.gbars} role="img" aria-label={`Lotes por periodo: ${reg} registrados y ${roast} tostados`}>
          {data.map((d) => (
            <div key={d.period} className={styles.gbarsCol} title={`${d.period}: ${d.registered} registrados, ${d.roasted} tostados`}>
              <span className={styles.gbarReg} style={{ height: `${((d.registered || 0) / max) * 100}%` }} />
              <span className={styles.gbarRoast} style={{ height: `${((d.roasted || 0) / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Botón "Nuevo" con las acciones frecuentes ────────────────────── */
const NEW_ACTIONS = [
  { id: "harvest", label: "Registrar cosecha", hint: "Caficultor y lote", href: "/admin/harvest", roles: ["admin", "caficultor"] },
  { id: "roast", label: "Enviar a tostión", hint: "Asignar perfil", href: "/admin/send-roasting", roles: ["admin", "caficultor"] },
  { id: "pack", label: "Registrar empaque", hint: "250 g, 500 g, 1 kg", href: "/admin/packaging", roles: ["admin"] },
  { id: "order", label: "Revisar pedidos", hint: "Tienda y B2B", href: "/admin/pedidos", roles: ["admin"] },
  { id: "crm", label: "Cuenta B2B", hint: "CRM", href: "/admin/crm", roles: ["admin"] },
];

function NewMenu({ role }) {
  const ref = useRef(null);
  const actions = NEW_ACTIONS.filter((a) => a.roles.includes(role));
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    const esc = (e) => { if (e.key === "Escape" && ref.current) ref.current.open = false; };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, []);
  if (!actions.length) return null;
  return (
    <details ref={ref} className={styles.newMenu}>
      <summary className="btn btn-primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Nuevo
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <ul className={styles.newList}>
        {actions.map((a) => (
          <li key={a.id}>
            <a href={a.href} className={styles.newItem}>
              <span>{a.label}</span>
              <span className={styles.newHint}>{a.hint}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
