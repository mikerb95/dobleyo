import React from "react";
import { verbOf, entityOf, parseDbDate } from "../../../lib/auditLabels.js";
import styles from "../Dashboard.module.css";

const TZ = "America/Bogota";

export default function ActivityFeed({ items, loading, error, onRetry }) {
  const list = items ?? [];
  return (
    <section className="panel" aria-labelledby="dash-activity">
      <div className="panel-header">
        <h2 id="dash-activity" className="panel-title">Actividad</h2>
        <a href="/admin/auditoria" className="card-action">Abrir auditoría</a>
      </div>
      {error ? (
        <div className={styles.panelMsg}>
          No se pudo cargar la actividad.{" "}
          <button type="button" className="btn btn-sm" onClick={onRetry}>Reintentar</button>
        </div>
      ) : loading ? (
        <div className={styles.panelMsg}><span className="skeleton" style={{ width: "80%" }} /></div>
      ) : list.length === 0 ? (
        <p className="empty-state">Aún no hay actividad registrada.</p>
      ) : (
        <ol className={styles.feed}>
          {list.map((e) => <FeedItem key={e.id} entry={e} />)}
        </ol>
      )}
    </section>
  );
}

function FeedItem({ entry }) {
  const date = parseDbDate(entry.created_at);
  const [verb] = verbOf(entry.action);
  const actor = entry.user_id == null ? "Sistema" : entry.user_name || "Usuario";
  return (
    <li className={styles.feedItem}>
      <time className={`mono ${styles.feedTime}`} dateTime={date.toISOString()}
            title={date.toLocaleString("es-CO", { timeZone: TZ })}>
        {stamp(date)}
      </time>
      <div>
        <span className={styles.feedActor}>{actor}</span>{" "}
        {verb.toLowerCase()} {entityOf(entry.entity_type).toLowerCase()}{" "}
        {entry.entity_id && <span className="mono">{entry.entity_id}</span>}
      </div>
    </li>
  );
}

// Hora sola si fue hoy; día y hora si no.
function stamp(d) {
  const key = (x) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  if (key(d) === key(new Date())) return time;
  return `${d.toLocaleDateString("es-CO", { timeZone: TZ, day: "numeric", month: "short" })} ${time}`;
}
