import React, { useMemo, useState } from "react";
import styles from "../Dashboard.module.css";

export default function AlertsBanner({ alerts, loading, onDismiss, onAction }) {
  const [expanded, setExpanded] = useState(true);

  if (loading) return <AlertsBannerSkeleton />;
  if (!alerts || alerts.length === 0) return null;

  const sorted = useMemo(() => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return [...alerts].sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
  }, [alerts]);

  const visible = expanded ? sorted : sorted.slice(0, 1);
  const hidden  = sorted.length - visible.length;
  const top     = sorted[0]?.severity || "info";

  return (
    <section className={[styles.alerts, styles[`alerts--${top}`]].join(" ")} aria-label={`Alertas (${alerts.length})`}>
      <header className={styles.alerts__head}>
        <span className={styles.alerts__title}>
          Alertas <span className={styles.alerts__count}>{alerts.length}</span>
        </span>
        {sorted.length > 1 && (
          <button type="button" className={styles.alerts__toggle}
                  onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Contraer" : `Ver ${hidden} más`}
          </button>
        )}
      </header>
      <ul className={styles.alerts__list}>
        {visible.map((a) => (
          <li key={a.id} className={[styles.alert, styles[`alert--${a.severity}`]].join(" ")}>
            <span className={styles.alert__mark} aria-hidden="true" />
            <div className={styles.alert__body}>
              <div className={styles.alert__title}>{a.title}</div>
              {a.description && <div className={styles.alert__desc}>{a.description}</div>}
            </div>
            <div className={styles.alert__actions}>
              {a.action && (
                <a href={a.action.href || "#"} className={styles.alert__cta}
                   onClick={(e) => { if (onAction) { e.preventDefault(); onAction(a); } }}>
                  {a.action.label} ›
                </a>
              )}
              {onDismiss && (
                <button type="button" className={styles.alert__dismiss}
                        onClick={() => onDismiss(a.id)} aria-label="Marcar como leída">
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlertsBannerSkeleton() {
  return (
    <section className={[styles.alerts, styles["alerts--warning"]].join(" ")} aria-busy="true">
      <header className={styles.alerts__head}>
        <span className={[styles.skel, styles["skel--label"]].join(" ")} />
      </header>
      <ul className={styles.alerts__list}>
        {[0, 1].map((i) => (
          <li key={i} className={[styles.alert, styles["alert--warning"]].join(" ")}>
            <span className={styles.alert__mark} aria-hidden="true" />
            <div className={styles.alert__body}>
              <span className={[styles.skel, styles["skel--line"]].join(" ")} />
              <span className={[styles.skel, styles["skel--line"], styles["skel--w60"]].join(" ")} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
