import React, { useState } from "react";
import styles from "../CRM.module.css";
import StageChip from "./StageChip.jsx";
import { STAGES, SEGMENTS, KINDS, formatCOP, formatPesos, timeAgo, stageIndex } from "./constants.js";
import { useApi, api } from "../../../lib/api.js";

export default function ClientCard({ accountId, onBack, onStageChange }) {
  const { data, loading, error, refetch } = useApi(`/crm/accounts/${accountId}`, { deps: [accountId] });

  if (loading) return <DetailSkeleton onBack={onBack} />;
  if (error)   return <DetailError onBack={onBack} onRetry={refetch} />;
  if (!data)   return null;

  const { account, contacts, interactions, sales = [] } = data;
  const seg = SEGMENTS.find((s) => s.id === account.segment);
  const idx = stageIndex(account.pipeline_stage);

  const moveStage = async (to) => {
    try {
      await api.patch(`/crm/accounts/${accountId}/stage`, { to });
      onStageChange?.(accountId, to);
      refetch();
    } catch (e) {
      alert(`No se pudo cambiar de etapa: ${e.message}`);
    }
  };

  return (
    <div className={styles.detail}>
      <button type="button" className={styles.detail__back} onClick={onBack}>‹ Volver a la lista</button>

      <section className={styles.detail__hero}>
        <div className={styles.detail__heroTop}>
          <div>
            <h1 className={styles.detail__name}>{account.display_name}</h1>
            <div className={styles.detail__legal}>
              {account.legal_name} · {seg?.label} · {account.city ?? account.country}
            </div>
          </div>
          <div className={styles.detail__actions}>
            <StageChip stage={account.pipeline_stage} />
            <StageMenu current={account.pipeline_stage} onPick={moveStage} />
          </div>
        </div>

        <div className={styles.stepper}>
          {STAGES.filter((s) => s.id !== "lost").map((s, i) => {
            const mod = account.pipeline_stage === "lost"
              ? ""
              : i < idx ? styles["stepper__step--done"]
              : i === idx ? styles["stepper__step--current"]
              : "";
            return (
              <div key={s.id} className={[styles.stepper__step, mod].join(" ")}>{s.label}</div>
            );
          })}
          {account.pipeline_stage === "lost" && (
            <div className={[styles.stepper__step, styles["stepper__step--lost"]].join(" ")}>Perdido</div>
          )}
        </div>

        <dl className={styles.detail__meta}>
          <MetaItem label="Valor pipeline" value={formatCOP(account.pipeline_value)} />
          <MetaItem label="LTV"            value={formatCOP(account.lifetime_value_cents)} />
          <MetaItem label="País / NIT"     value={`${account.country}${account.tax_id ? ` · ${account.tax_id}` : ""}`} />
          <MetaItem label="Origen"         value={account.source ?? "—"} />
        </dl>
      </section>

      <div className={styles.detail__split}>
        <Timeline interactions={interactions} />
        <aside style={{ display: "grid", gap: 16, gridAutoRows: "min-content" }}>
          <Contacts contacts={contacts} />
          <LinkedSales accountId={accountId} sales={sales} onChange={refetch} />
          <Datos account={account} />
        </aside>
      </div>
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className={styles.detail__metaItem}><dt>{label}</dt><dd>{value}</dd></div>
  );
}

function StageMenu({ current, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className={[styles.btn, styles["btn--primary"]].join(" ")}
              onClick={() => setOpen((v) => !v)}>
        Cambiar etapa ▾
      </button>
      {open && (
        <div role="menu" style={{
          position: "absolute", right: 0, top: "100%", marginTop: 4,
          background: "white", border: "1px solid var(--rule)",
          borderRadius: 8, padding: 6, minWidth: 180, zIndex: 5,
          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)",
        }}>
          {STAGES.map((s) => (
            <button key={s.id} type="button" role="menuitem"
                    disabled={s.id === current}
                    onClick={() => { onPick(s.id); setOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      appearance: "none", background: "transparent", border: 0,
                      font: "inherit", fontSize: 13, padding: "6px 10px",
                      borderRadius: 6, cursor: s.id === current ? "default" : "pointer",
                      color: s.id === current ? "var(--muted)" : "var(--color-text)",
                    }}>
              {s.label}{s.id === current ? "  (actual)" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Timeline({ interactions }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panel__title}>Timeline · {interactions.length} interacciones</h2>
      {interactions.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Aún no hay interacciones registradas.</p>
      ) : (
        <ol className={styles.timeline}>
          {interactions.map((i) => <TimelineItem key={i.id} entry={i} />)}
        </ol>
      )}
    </section>
  );
}

function TimelineItem({ entry }) {
  const def = KINDS[entry.kind] ?? { label: entry.kind, icon: "·", tone: "primary" };
  return (
    <li className={styles.tl}>
      <span className={[styles.tl__icon, styles[`tl__icon--${def.tone}`]].join(" ")} aria-hidden="true">
        {def.icon}
      </span>
      <div className={styles.tl__head}>
        <span className={styles.tl__subject}>{entry.subject}</span>
        <time className={styles.tl__when} dateTime={entry.occurred_at}
              title={new Date(entry.occurred_at).toLocaleString("es-CO")}>
          {timeAgo(entry.occurred_at)}
        </time>
      </div>
      {entry.body && <div className={styles.tl__body}>{entry.body}</div>}
      <div className={styles.tl__author}>
        {def.label}
        {entry.contact_name && ` · con ${entry.contact_name}`}
        {entry.author_name  && ` · por ${entry.author_name}`}
      </div>
    </li>
  );
}

function Contacts({ contacts }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panel__title}>Contactos · {contacts.length}</h2>
      <div>
        {contacts.map((c) => (
          <div key={c.id} className={styles.contact}>
            <div className={styles.contact__top}>
              <div>
                <div className={styles.contact__name}>{c.full_name}</div>
                {c.role && <div className={styles.contact__role}>{c.role}</div>}
              </div>
              {c.is_primary ? <span className={styles.contact__primary}>PRIMARIO</span> : null}
            </div>
            {c.email && <div className={styles.contact__line}><a href={`mailto:${c.email}`}>{c.email}</a></div>}
            {c.phone && <div className={styles.contact__line}>{c.phone}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Datos({ account }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panel__title}>Datos</h2>
      <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", margin: 0, fontSize: 13 }}>
        <MetaItem label="Ciudad"     value={account.city ?? "—"} />
        <MetaItem label="Región"     value={account.region ?? "—"} />
        <MetaItem label="País"       value={account.country} />
        <MetaItem label="ID fiscal"  value={account.tax_id ?? "—"} />
        <MetaItem label="Origen"     value={account.source ?? "—"} />
        <MetaItem label="Creada"     value={new Date(account.created_at).toLocaleDateString("es-CO")} />
      </dl>
      {account.notes && (
        <p style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>{account.notes}</p>
      )}
    </section>
  );
}

function DetailSkeleton({ onBack }) {
  return (
    <div className={styles.detail} aria-busy="true">
      <button type="button" className={styles.detail__back} onClick={onBack}>‹ Volver</button>
      <section className={styles.detail__hero}>
        <span className={[styles.skel, styles["skel--name"]].join(" ")} style={{ width: 240, height: 24 }} />
        <span className={styles.skel} style={{ width: "100%", height: 36 }} />
      </section>
      <section className={styles.panel}>
        {[70, 85, 60].map((w, i) => (
          <span key={i} className={[styles.skel, styles["skel--meta"]].join(" ")} style={{ width: `${w}%` }} />
        ))}
      </section>
    </div>
  );
}

function DetailError({ onBack, onRetry }) {
  return (
    <div className={styles.detail}>
      <button type="button" className={styles.detail__back} onClick={onBack}>‹ Volver</button>
      <div className={styles.list__empty} style={{ color: "var(--danger)" }}>
        No se pudo cargar la cuenta.
        <button type="button" className={styles.btn} onClick={onRetry} style={{ marginLeft: 12 }}>Reintentar</button>
      </div>
    </div>
  );
}
