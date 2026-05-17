import React from "react";
import styles from "../Dashboard.module.css";

export default function KPICard({
  label,
  value,
  delta = null,
  icon = null,
  tone = "primary",
  spark = null,
  loading = false,
  onClick,
}) {
  if (loading) return <KPICardSkeleton tone={tone} />;

  const trend = delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        styles.kpi,
        styles[`kpi--${tone}`],
        onClick ? styles["kpi--interactive"] : "",
      ].filter(Boolean).join(" ")}
      aria-label={`${label}: ${value}${delta != null ? `, ${trend} ${Math.abs(delta)}%` : ""}`}
    >
      <header className={styles.kpi__head}>
        <span className={styles.kpi__label}>{label}</span>
        {icon != null && <span className={styles.kpi__icon} aria-hidden="true">{icon}</span>}
      </header>
      <div className={styles.kpi__value}>{value}</div>
      <footer className={styles.kpi__foot}>
        {delta != null && (
          <span className={[styles.kpi__delta, styles[`kpi__delta--${trend}`]].join(" ")} title="vs. periodo anterior">
            <Arrow trend={trend} />
            {Math.abs(delta).toFixed(1).replace(/\.0$/, "")}%
          </span>
        )}
        {spark && spark.length > 0 && <Sparkline values={spark} className={styles.kpi__spark} />}
      </footer>
    </Tag>
  );
}

function Arrow({ trend }) {
  if (trend === "up")   return <span aria-hidden="true">▲</span>;
  if (trend === "down") return <span aria-hidden="true">▼</span>;
  return <span aria-hidden="true">─</span>;
}

function Sparkline({ values, className }) {
  const w = 88, h = 22, pad = 1;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="1.5" />
    </svg>
  );
}

function KPICardSkeleton({ tone }) {
  return (
    <div className={[styles.kpi, styles[`kpi--${tone}`]].join(" ")} aria-busy="true" aria-label="Cargando KPI">
      <header className={styles.kpi__head}>
        <span className={[styles.skel, styles["skel--label"]].join(" ")} />
        <span className={[styles.skel, styles["skel--icon"]].join(" ")} />
      </header>
      <div className={[styles.skel, styles["skel--value"]].join(" ")} />
      <footer className={styles.kpi__foot}>
        <span className={[styles.skel, styles["skel--delta"]].join(" ")} />
        <span className={[styles.skel, styles["skel--spark"]].join(" ")} />
      </footer>
    </div>
  );
}
