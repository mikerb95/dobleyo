import React from "react";
import styles from "../Dashboard.module.css";

export const fmtCOP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
export const fmtCOPshort = (n) => {
  const v = Number(n) || 0;
  const f = (x) => x.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  if (v >= 1e9) return `$${f(v / 1e9)} mil M`;
  if (v >= 1e6) return `$${f(v / 1e6)} M`;
  if (v >= 1e3) return `$${f(v / 1e3)} mil`;
  return `$${v}`;
};
export const fmtNum = (n) => new Intl.NumberFormat("es-CO").format(n || 0);

const STATUS = {
  paid:             { label: "Pagado", cls: "status--paid" },
  delivered:        { label: "Entregado", cls: "status--paid" },
  confirmed:        { label: "Confirmado", cls: "status--confirmed" },
  shipped:          { label: "Enviado", cls: "status--confirmed" },
  ready_to_ship:    { label: "Listo para envío", cls: "status--confirmed" },
  handling:         { label: "En preparación", cls: "status--confirmed" },
  pending:          { label: "Pendiente", cls: "status--pending" },
  payment_required: { label: "Pago requerido", cls: "status--pending" },
  cancelled:        { label: "Cancelado", cls: "status--cancelled" },
};
const STATUS_VAR = {
  "status--paid": "var(--st-paid)",
  "status--confirmed": "var(--st-confirmed)",
  "status--pending": "var(--st-pending)",
  "status--cancelled": "var(--st-cancelled)",
};

export default function ExecutiveSummary({ data, loading, error, onRetry }) {
  if (error) {
    return (
      <div className={styles.errorTile} role="alert">
        <span>No se pudo cargar el resumen de ventas.</span>
        <button type="button" className="btn btn-sm" onClick={onRetry}>Reintentar</button>
      </div>
    );
  }
  return (
    <>
      <div className={styles.cols21}>
        <RevenuePanel series={data?.sales?.timeline} loading={loading} />
        <StatusPanel items={data?.by_status} loading={loading} />
      </div>
      <div className={styles.cols11}>
        <RankTable
          id="dash-products"
          title="Productos"
          hint="por ingresos"
          loading={loading}
          head={["Producto", "Unid.", "Ingresos"]}
          rows={(data?.top_products ?? []).map((p) => [p.title, fmtNum(p.units), fmtCOP(p.revenue)])}
          empty="Sin ventas en el periodo."
        />
        <RankTable
          id="dash-cities"
          title="Ciudades"
          hint="por ingresos"
          action={{ href: "/admin/sales-map", label: "Abrir mapa" }}
          loading={loading}
          head={["Ciudad", "Pedidos", "Ingresos"]}
          rows={(data?.top_cities ?? []).map((c) => [
            c.state ? `${c.city}, ${c.state}` : c.city, fmtNum(c.orders), fmtCOP(c.revenue),
          ])}
          empty="Sin envíos en el periodo."
        />
      </div>
    </>
  );
}

/* ── Ingresos por periodo ──────────────────────────────────────────── */
function periodLabel(p) {
  if (!p) return "";
  if (/^\d{4}-W\d{2}$/.test(p)) return `Sem. ${Number(p.slice(6))}`;
  const [y, m, d] = p.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  return d
    ? date.toLocaleDateString("es-CO", { timeZone: "UTC", day: "numeric", month: "short" })
    : date.toLocaleDateString("es-CO", { timeZone: "UTC", month: "short", year: "2-digit" });
}

function RevenuePanel({ series, loading }) {
  const data = series ?? [];
  return (
    <section className="panel" aria-labelledby="dash-revenue">
      <div className="panel-header">
        <h2 id="dash-revenue" className="panel-title">Ingresos por periodo</h2>
        <a className="card-action" href="/admin/ventas">Ver análisis de ventas</a>
      </div>
      {loading ? (
        <div className={styles.panelMsg}><span className="skeleton" style={{ width: "100%", height: 200 }} /></div>
      ) : data.length < 2 ? (
        <p className="empty-state">Aún no hay suficientes ventas en el periodo para graficar.</p>
      ) : (
        <AreaChart series={data} />
      )}
    </section>
  );
}

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function AreaChart({ series }) {
  const w = 600, h = 200;
  const max = niceMax(Math.max(...series.map((d) => d.revenue), 1));
  const step = w / (series.length - 1);
  const pts = series.map((d, i) => `${(i * step).toFixed(1)} ${(h - (d.revenue / max) * h).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const xIdx = [...new Set([0, Math.round((series.length - 1) / 2), series.length - 1])];
  const total = series.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className={styles.chart}>
      <div className={`mono ${styles.yAxis}`} aria-hidden="true">
        {ticks.map((t) => <span key={t}>{fmtCOPshort(max * t)}</span>)}
      </div>
      <div>
        <div className={styles.plot}>
          {ticks.map((t) => <div key={t} className={styles.grid} style={{ top: `${(1 - t) * 100}%` }} />)}
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
               aria-label={`Ingresos por periodo, total ${fmtCOP(total)}`}>
            <path d={area} className={styles.area} />
            <path d={line} className={styles.line} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className={`mono ${styles.xAxis}`} aria-hidden="true">
          {xIdx.map((i) => <span key={i}>{periodLabel(series[i].period)}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ── Estado de los pedidos ─────────────────────────────────────────── */
function StatusPanel({ items, loading }) {
  const list = items ?? [];
  const total = list.reduce((s, i) => s + i.count, 0);
  return (
    <section className="panel" aria-labelledby="dash-status">
      <div className="panel-header">
        <h2 id="dash-status" className="panel-title">Estado de los pedidos</h2>
        {!loading && <span className="mono card-subtitle">{fmtNum(total)} pedidos</span>}
      </div>
      {loading ? (
        <div className={styles.panelMsg}><span className="skeleton" style={{ width: "100%" }} /></div>
      ) : list.length === 0 ? (
        <p className="empty-state">Sin pedidos en el periodo.</p>
      ) : (
        <div className={styles.statusBody}>
          <div className={styles.stackBar} role="img"
               aria-label={list.map((s) => `${STATUS[s.status]?.label ?? s.status}: ${s.count}`).join(", ")}>
            {list.map((s) => (
              <span key={s.status}
                    style={{ width: `${(s.count / total) * 100}%`, background: STATUS_VAR[STATUS[s.status]?.cls] ?? "var(--st-neutral)" }} />
            ))}
          </div>
          <table className="erp-table">
            <tbody>
              {list.map((s) => (
                <tr key={s.status}>
                  <td><span className={`status ${STATUS[s.status]?.cls ?? ""}`}>{STATUS[s.status]?.label ?? s.status}</span></td>
                  <td className="num mono">{fmtNum(s.count)}</td>
                  <td className={`num mono ${styles.muted}`}>{((s.count / total) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Tabla de ranking ──────────────────────────────────────────────── */
function RankTable({ id, title, hint, action, loading, head, rows, empty }) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-header">
        <div className={styles.titleRow}>
          <h2 id={id} className="panel-title">{title}</h2>
          {hint && <span className="card-subtitle">{hint}</span>}
        </div>
        {action && <a className="card-action" href={action.href}>{action.label}</a>}
      </div>
      {loading ? (
        <div className={styles.panelMsg}><span className="skeleton" style={{ width: "80%" }} /></div>
      ) : rows.length === 0 ? (
        <p className="empty-state">{empty}</p>
      ) : (
        <div className="table-wrapper">
          <table className="erp-table">
            <thead>
              <tr>{head.map((h, i) => <th key={h} className={i ? "num" : undefined}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className={styles.ellipsis} title={r[0]}>{r[0]}</td>
                  {r.slice(1).map((c, j) => <td key={j} className="num mono">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Piezas compartidas ────────────────────────────────────────────── */
export function Delta({ value }) {
  if (value == null) return null;
  const trend = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "=";
  return (
    <span className={`mono ${styles[`delta_${trend}`]}`}>
      <span aria-hidden="true">{arrow} </span>
      {trend === "down" ? "-" : trend === "up" ? "+" : ""}
      {Math.abs(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Sparkline({ values, className }) {
  const w = 100, h = 28;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
