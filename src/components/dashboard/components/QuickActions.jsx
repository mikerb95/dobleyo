import React from "react";
import styles from "../Dashboard.module.css";

export default function QuickActions({ actions, loading, onAction }) {
  if (loading) return <QuickActionsSkeleton />;

  return (
    <section className={styles.qa} aria-label="Accesos rápidos">
      <header className={styles.qa__head}>
        <h2 className={styles.qa__title}>Accesos rápidos</h2>
      </header>
      <div className={styles.qa__grid}>
        {actions.map((a) => (
          <a
            key={a.id}
            href={a.href || "#"}
            className={[styles.qa__item, styles[`qa__item--${a.tone || "neutral"}`]].join(" ")}
            onClick={(e) => { if (onAction) { e.preventDefault(); onAction(a); } }}
          >
            <span className={styles.qa__icon} aria-hidden="true">{a.icon ?? "+"}</span>
            <span className={styles.qa__text}>
              <span className={styles.qa__label}>{a.label}</span>
              {a.hint && <span className={styles.qa__hint}>{a.hint}</span>}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function QuickActionsSkeleton() {
  return (
    <section className={styles.qa} aria-busy="true">
      <header className={styles.qa__head}>
        <span className={[styles.skel, styles["skel--label"]].join(" ")} />
      </header>
      <div className={styles.qa__grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={[styles.qa__item, styles["qa__item--neutral"]].join(" ")}>
            <span className={[styles.skel, styles["skel--icon"]].join(" ")} />
            <span className={[styles.skel, styles["skel--line"]].join(" ")} />
          </div>
        ))}
      </div>
    </section>
  );
}
