import React, { useState } from "react";
import styles from "../Dashboard.module.css";

const RANGES = [
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "12m", label: "12 meses" },
];

const fmtCOP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtCOPshort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${v}`;
};
const fmtNum = (n) => new Intl.NumberFormat("es-CO").format(n || 0);

export default function ExecutiveSummary({ data, loading, error, range, onRangeChange, onRetry }) {
  return (
    <section className={styles.exec} aria-label="Resumen ejecutivo">
      <header className={styles.exec__head}>
        <h2 className={styles.exec__title}>Resumen ejecutivo</h2>
        <div className={styles.exec__ranges} role="group" aria-label="Rango de tiempo">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={[styles.exec__range, range === r.id ? styles["exec__range--on"] : ""].filter(Boolean).join(" ")}
              aria-pressed={range === r.id}
              onClick={() => onRangeChange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className={styles.errorTile} role="alert">
          <span>No pudimos cargar el resumen ejecutivo.</span>
          <button type="button" className={styles.errorTile__btn} onClick={onRetry}>Reintentar</button>
        </div>
      ) : loading || !data ? (
        <div className={[styles.skel, styles["skel--chart"]].join(" ")} aria-busy="true" />
      ) : (
        <>
          <TrendCard sales={data.sales} range={range} />
          <div className={styles.exec__grid}>
            <BarList
              title="Top productos"
              subtitle="por ingresos"
              items={(data.top_products ?? []).map((p) => ({ label: p.title, value: p.revenue, meta: `${fmtNum(p.units)} u.` }))}
              format={fmtCOPshort}
              tone="primary"
              empty="Sin ventas en el período."
            />
            <BarList
              title="Top ciudades"
              subtitle="por ingresos"
              items={(data.top_cities ?? []).map((c) => ({ label: c.city, value: c.revenue, meta: `${fmtNum(c.orders)} ped.` }))}
              format={fmtCOPshort}
              tone="accent"
              empty="Sin envíos en el período."
            />
            <StatusBreakdown items={data.by_status ?? []} />
            <Snapshots production={data.production} inventory={data.inventory} />
          </div>
        </>
      )}
    </section>
  );
}

/* ── Tendencia de ventas ─────────────────────────────────────────── */
function TrendCard({ sales, range }) {
  const series = sales?.timeline ?? [];
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? "";
  return (
    <article className={styles.trend}>
      <div className={styles.trend__stats}>
        <div className={styles.trend__stat}>
          <span className={styles.trend__statLabel}>Ingresos · {rangeLabel}</span>
          <span className={styles.trend__statValue}>{fmtCOP(sales?.revenue)}</span>
          <Delta value={sales?.delta_revenue} />
        </div>
        <div className={styles.trend__stat}>
          <span className={styles.trend__statLabel}>Pedidos</span>
          <span className={styles.trend__statValue}>{fmtNum(sales?.orders)}</span>
          <Delta value={sales?.delta_orders} />
        </div>
        <div className={styles.trend__stat}>
          <span className={styles.trend__statLabel}>Ticket promedio</span>
          <span className={styles.trend__statValue}>{fmtCOP(sales?.aov)}</span>
        </div>
      </div>
      {series.length === 0 ? (
        <p className={styles.feed__empty}>Sin datos de ventas para graficar.</p>
      ) : (
        <AreaChart series={series} />
      )}
    </article>
  );
}

function AreaChart({ series }) {
  const w = 760, h = 160, padX = 4, padTop = 10, padBottom = 18;
  const values = series.map((d) => d.revenue);
  const max = Math.max(...values, 1);
  const step = (w - padX * 2) / Math.max(series.length - 1, 1);
  const x = (i) => padX + i * step;
  const y = (v) => padTop + (1 - v / max) * (h - padTop - padBottom);

  const line = series.map((d, i) => `${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join(" ");
  const area = `${padX},${(h - padBottom).toFixed(1)} ${line} ${(w - padX).toFixed(1)},${(h - padBottom).toFixed(1)}`;
  const peak = values.indexOf(max);

  return (
    <svg className={styles.trend__chart} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
         aria-label="Tendencia de ingresos">
      <defs>
        <linearGradient id="dyTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className={styles.trend__area} points={area} fill="url(#dyTrendFill)" />
      <polyline className={styles.trend__line} points={line} fill="none" strokeWidth="2" />
      {peak >= 0 && <circle className={styles.trend__peak} cx={x(peak)} cy={y(max)} r="3" />}
    </svg>
  );
}

/* ── Listas de barras (productos / ciudades) ─────────────────────── */
function BarList({ title, subtitle, items, format, tone = "primary", empty }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <article className={styles.card}>
      <header className={styles.card__head}>
        <h3 className={styles.card__title}>{title}</h3>
        {subtitle && <span className={styles.card__sub}>{subtitle}</span>}
      </header>
      {items.length === 0 ? (
        <p className={styles.feed__empty}>{empty}</p>
      ) : (
        <ul className={styles.bars}>
          {items.map((it, i) => (
            <li key={i} className={styles.bars__row}>
              <div className={styles.bars__top}>
                <span className={styles.bars__label} title={it.label}>{it.label}</span>
                <span className={styles.bars__value}>{format(it.value)}</span>
              </div>
              <div className={styles.bars__track}>
                <span className={[styles.bars__fill, styles[`bars__fill--${tone}`]].join(" ")}
                      style={{ width: `${Math.max((it.value / max) * 100, 2)}%` }} />
              </div>
              {it.meta && <span className={styles.bars__meta}>{it.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ── Desglose por estado del pedido ──────────────────────────────── */
const STATUS_LABELS = {
  paid: "Pagado", delivered: "Entregado", shipped: "Enviado",
  cancelled: "Cancelado", pending: "Pendiente", confirmed: "Confirmado",
  ready_to_ship: "Listo para envío", handling: "En preparación",
};
function StatusBreakdown({ items }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <article className={styles.card}>
      <header className={styles.card__head}>
        <h3 className={styles.card__title}>Estados de pedido</h3>
        <span className={styles.card__sub}>{fmtNum(total)} pedidos</span>
      </header>
      {items.length === 0 ? (
        <p className={styles.feed__empty}>Sin pedidos en el período.</p>
      ) : (
        <>
          <div className={styles.statusbar} role="img" aria-label="Distribución de estados">
            {items.map((s, i) => (
              <span key={s.status} className={[styles.statusbar__seg, styles[`statusbar__seg--${i % 5}`]].join(" ")}
                    style={{ width: `${(s.count / total) * 100}%` }}
                    title={`${STATUS_LABELS[s.status] ?? s.status}: ${s.count}`} />
            ))}
          </div>
          <ul className={styles.legend}>
            {items.map((s, i) => (
              <li key={s.status} className={styles.legend__item}>
                <span className={[styles.legend__dot, styles[`statusbar__seg--${i % 5}`]].join(" ")} aria-hidden="true" />
                <span className={styles.legend__label}>{STATUS_LABELS[s.status] ?? s.status}</span>
                <span className={styles.legend__count}>{fmtNum(s.count)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

/* ── Snapshots de producción e inventario ────────────────────────── */
function Snapshots({ production, inventory }) {
  return (
    <article className={styles.card}>
      <header className={styles.card__head}>
        <h3 className={styles.card__title}>Operación</h3>
        <span className={styles.card__sub}>producción e inventario</span>
      </header>
      <div className={styles.snap}>
        <Stat label="Lotes verdes" value={fmtNum(production?.green_lots)} href="/admin/inventory-storage" />
        <Stat label="Lotes tostados" value={fmtNum(production?.roasted_lots)} href="/admin/roasted-storage" />
        <Stat label="Puntaje SCA prom." value={production?.avg_score || "—"} href="/admin/cupping" />
        <Stat label="Valor inventario" value={fmtCOPshort(inventory?.inventory_value)} href="/admin/inventario-valor" />
        <Stat label="Productos activos" value={fmtNum(inventory?.total_products)} href="/admin/productos" />
        <Stat
          label="Stock bajo"
          value={fmtNum(inventory?.low_stock)}
          tone={inventory?.low_stock > 0 ? "warn" : undefined}
          href="/admin/inventario"
        />
      </div>
    </article>
  );
}

function Stat({ label, value, href, tone }) {
  const Tag = href ? "a" : "div";
  return (
    <Tag href={href} className={[styles.snap__item, tone ? styles[`snap__item--${tone}`] : ""].filter(Boolean).join(" ")}>
      <span className={styles.snap__value}>{value}</span>
      <span className={styles.snap__label}>{label}</span>
    </Tag>
  );
}

function Delta({ value }) {
  if (value == null) return null;
  const trend = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "─";
  return (
    <span className={[styles.kpi__delta, styles[`kpi__delta--${trend}`]].join(" ")} title="vs. período anterior">
      <span aria-hidden="true">{arrow}</span>
      {Math.abs(value).toFixed(1).replace(/\.0$/, "")}%
    </span>
  );
}
