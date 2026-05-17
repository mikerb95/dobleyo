import React, { useMemo } from "react";
import styles from "../Dashboard.module.css";

export default function ActivityFeed({ items, limit = 10, loading }) {
  const list = useMemo(() => (items ?? []).slice(0, limit), [items, limit]);

  return (
    <section className={styles.feed} aria-label="Actividad reciente">
      <header className={styles.feed__head}>
        <h2 className={styles.feed__title}>Actividad reciente</h2>
        <a href="/admin/auditoria" className={styles.feed__more}>Ver auditoría ›</a>
      </header>
      {loading ? (
        <FeedSkeleton rows={limit} />
      ) : list.length === 0 ? (
        <p className={styles.feed__empty}>Aún no hay actividad registrada.</p>
      ) : (
        <ol className={styles.feed__list}>
          {list.map((e) => <FeedItem key={e.id} entry={e} />)}
        </ol>
      )}
    </section>
  );
}

function FeedItem({ entry }) {
  const verb = VERBS[entry.action] ?? { text: entry.action, kind: "neutral" };
  return (
    <li className={styles.feed__item}>
      <span className={[styles.feed__dot, styles[`feed__dot--${verb.kind}`]].join(" ")} aria-hidden="true" />
      <div className={styles.feed__line}>
        <span className={styles.feed__actor}>
          {entry.actor?.name ?? entry.user_name ?? "Sistema"}
          {(entry.actor?.role ?? entry.user_role) && (
            <span className={styles.feed__role}> · {entry.actor?.role ?? entry.user_role}</span>
          )}
        </span>
        {" "}
        <span className={styles.feed__verb}>{verb.text}</span>
        {" "}
        {entry.target?.href ? (
          <a className={styles.feed__target} href={entry.target.href}>{entry.target.label ?? entry.entity_type}</a>
        ) : (
          <span className={styles.feed__target}>{entry.target?.label ?? entry.entity_type ?? "—"}</span>
        )}
        <div className={styles.feed__meta}>
          <time dateTime={entry.at ?? entry.created_at}
                title={new Date(entry.at ?? entry.created_at).toLocaleString("es-CO")}>
            {timeAgo(entry.at ?? entry.created_at)}
          </time>
        </div>
      </div>
    </li>
  );
}

const VERBS = {
  create:  { text: "creó",               kind: "accent"  },
  update:  { text: "actualizó",          kind: "neutral" },
  delete:  { text: "eliminó",            kind: "danger"  },
  login:   { text: "inició sesión en",   kind: "neutral" },
  roast:   { text: "inició tostión de",  kind: "accent"  },
  pack:    { text: "empacó",             kind: "accent"  },
  label:   { text: "etiquetó",           kind: "accent"  },
  sale:    { text: "registró venta a",   kind: "primary" },
  payment: { text: "recibió pago de",    kind: "primary" },
  receive: { text: "recibió cosecha de", kind: "accent"  },
  approve: { text: "aprobó",             kind: "primary" },
};

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function FeedSkeleton({ rows }) {
  return (
    <ol className={styles.feed__list} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className={styles.feed__item}>
          <span className={[styles.feed__dot, styles["feed__dot--neutral"]].join(" ")} aria-hidden="true" />
          <div className={styles.feed__line}>
            <span className={[styles.skel, styles["skel--line"]].join(" ")} />
            <span className={[styles.skel, styles["skel--line"], styles[`skel--w${i % 2 ? 60 : 80}`]].join(" ")} />
          </div>
        </li>
      ))}
    </ol>
  );
}
