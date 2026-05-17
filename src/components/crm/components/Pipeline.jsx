import React, { useMemo, useState } from "react";
import styles from "../CRM.module.css";
import { STAGES, formatCOP, stageIndex, timeAgo } from "./constants.js";
import { useApi, api } from "../../../lib/api.js";

export default function Pipeline({ onOpen }) {
  const { data, loading, error, refetch } = useApi("/crm/pipeline");
  const [optimistic, setOptimistic] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [overStage,  setOverStage]  = useState(null);

  const groups = useMemo(() => {
    if (!data) return null;
    const copy = Object.fromEntries(STAGES.map((s) => [s.id, []]));
    for (const stageId of Object.keys(data.groups ?? {})) {
      for (const acc of data.groups[stageId]) {
        const dest = optimistic[acc.id] ?? acc.pipeline_stage;
        if (copy[dest]) copy[dest].push({ ...acc, pipeline_stage: dest });
      }
    }
    return copy;
  }, [data, optimistic]);

  async function moveTo(accountId, toStage, fromStage) {
    if (!toStage || toStage === fromStage) return;
    setOptimistic((prev) => ({ ...prev, [accountId]: toStage }));
    try {
      await api.patch(`/crm/accounts/${accountId}/stage`, { to: toStage });
      await refetch();
      setOptimistic((prev) => { const c = { ...prev }; delete c[accountId]; return c; });
    } catch (e) {
      setOptimistic((prev) => { const c = { ...prev }; delete c[accountId]; return c; });
      alert(`No se pudo mover: ${e.message}`);
    }
  }

  if (loading) return <PipelineSkeleton />;
  if (error) return (
    <div className={styles.list__empty} style={{ color: "var(--danger)" }}>
      No pudimos cargar el pipeline.
      <button type="button" className={styles.btn} onClick={refetch} style={{ marginLeft: 12 }}>Reintentar</button>
    </div>
  );

  return (
    <div className={styles.pipeline}>
      {STAGES.map((stage) => {
        const list = groups?.[stage.id] ?? [];
        const total = list.reduce((sum, a) => sum + (a.pipeline_value || 0), 0);
        return (
          <section
            key={stage.id}
            className={[styles.column, overStage === stage.id ? styles["column--over"] : ""].join(" ")}
            onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
            onDragLeave={() => setOverStage((s) => s === stage.id ? null : s)}
            onDrop={(e) => {
              e.preventDefault();
              const id   = Number(e.dataTransfer.getData("text/plain"));
              const from = e.dataTransfer.getData("text/x-from");
              setOverStage(null);
              if (id) moveTo(id, stage.id, from);
            }}
            aria-label={`Etapa ${stage.label}`}
          >
            <header className={styles.column__head}>
              <div className={styles.column__title}>
                <span className={styles.column__name}>{stage.label}</span>
                <span className={styles.column__count}>{list.length}</span>
              </div>
              <div className={styles.column__total}>{formatCOP(total)}</div>
            </header>
            <div className={styles.column__body}>
              {list.length === 0 && (
                <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "12px 4px", textAlign: "center" }}>vacío</div>
              )}
              {list.map((a) => (
                <PipelineCard
                  key={a.id}
                  account={a}
                  ghost={draggingId === a.id}
                  onDragStart={(e) => {
                    setDraggingId(a.id);
                    e.dataTransfer.setData("text/plain", String(a.id));
                    e.dataTransfer.setData("text/x-from", a.pipeline_stage);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => { setDraggingId(null); setOverStage(null); }}
                  onOpen={() => onOpen(a.id)}
                  onPrev={() => moveTo(a.id, STAGES[stageIndex(a.pipeline_stage) - 1]?.id, a.pipeline_stage)}
                  onNext={() => moveTo(a.id, STAGES[stageIndex(a.pipeline_stage) + 1]?.id, a.pipeline_stage)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PipelineCard({ account, ghost, onDragStart, onDragEnd, onOpen, onPrev, onNext }) {
  const idx     = stageIndex(account.pipeline_stage);
  const canPrev = idx > 0;
  const canNext = idx < STAGES.length - 1 && account.pipeline_stage !== "lost";

  return (
    <article
      className={[styles.card, ghost ? styles["card--ghost"] : ""].join(" ")}
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
    >
      <div className={styles.card__top}>
        <button type="button" onClick={onOpen} className={styles.card__name}
                style={{ appearance: "none", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left", color: "inherit" }}>
          {account.display_name}
        </button>
        <span className={styles.card__country}>{account.country}</span>
      </div>
      <div className={styles.card__value}>
        <b>{formatCOP(account.pipeline_value)}</b>
        {account.primary_contact_name && (
          <span style={{ color: "var(--muted)" }}> · {account.primary_contact_name}</span>
        )}
      </div>
      <div className={styles.card__foot}>
        <span className={styles.card__when}>
          {account.last_interaction_at ? timeAgo(account.last_interaction_at) : "sin actividad"}
        </span>
        <div className={styles.card__nav}>
          <button type="button" disabled={!canPrev} onClick={onPrev} aria-label="Etapa anterior" title="Etapa anterior">←</button>
          <button type="button" disabled={!canNext} onClick={onNext} aria-label="Avanzar etapa"  title="Avanzar etapa">→</button>
        </div>
      </div>
    </article>
  );
}

function PipelineSkeleton() {
  return (
    <div className={styles.pipeline} aria-busy="true">
      {STAGES.map((s) => (
        <section key={s.id} className={styles.column}>
          <header className={styles.column__head}>
            <div className={styles.column__title}>
              <span className={styles.column__name}>{s.label}</span>
            </div>
            <span className={styles.skel} style={{ width: 70, height: 11 }} />
          </header>
          <div className={styles.column__body}>
            {[0, 1].map((i) => (
              <div key={i} className={styles.card} style={{ cursor: "default" }}>
                <span className={[styles.skel, styles["skel--name"]].join(" ")} />
                <span className={[styles.skel, styles["skel--meta"]].join(" ")} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
