import React, { useEffect, useState } from "react";
import styles from "./ProductionPipeline.module.css";
import { useApi, api } from "../../lib/api.js";

const STAGES = [
  { id: "harvest", label: "Cosecha",         shortLabel: "Cos."       },
  { id: "green",   label: "Almacén verde",   shortLabel: "Verde"      },
  { id: "roast",   label: "Tostión",         shortLabel: "Tost."      },
  { id: "roasted", label: "Almacén tostado", shortLabel: "Tost.almt." },
  { id: "pack",    label: "Empaque",         shortLabel: "Emp."       },
  { id: "label",   label: "Etiquetado",      shortLabel: "Etiq."      },
];

export default function ProductionPipeline({ initialLotId = null }) {
  const lots = useApi("/production/lots");
  const [lotId,    setLotId]    = useState(initialLotId ?? null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!lotId && lots.data?.length) {
      const inFlight = lots.data.find((l) => !["label", "done"].includes(l.current_stage));
      setLotId((inFlight ?? lots.data[0]).id);
    }
  }, [lots.data, lotId]);

  const trail = useApi(lotId ? `/production/lots/${lotId}` : null, {
    deps: [lotId],
    enabled: !!lotId,
  });

  useEffect(() => {
    if (!trail.data) return;
    const inProg = STAGES.find((s) => trail.data.stages?.[s.id]?.status === "in_progress");
    setExpanded(inProg?.id ?? null);
  }, [trail.data]);

  return (
    <main className={styles.shell}>
      <header className={styles.head}>
        <h1 className={styles.head__title}>Línea de producción</h1>
        <p className={styles.head__sub}>Trazabilidad por lote · cosecha → etiquetado</p>
      </header>

      <LotPicker lots={lots.data} loading={lots.loading} selected={lotId} onSelect={setLotId} />

      {trail.error && (
        <div className={styles.error} role="alert">
          <span>No se pudo cargar el lote: {trail.error.message}</span>
          <button type="button" className={styles.btn} onClick={trail.refetch}>Reintentar</button>
        </div>
      )}

      <LotCard lot={trail.data?.lot} loading={trail.loading} />

      <Stepper
        stages={trail.data?.stages}
        loading={trail.loading}
        expanded={expanded}
        onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
      />

      {expanded && trail.data?.stages?.[expanded] && (
        <StageDetail
          stageId={expanded}
          data={trail.data.stages[expanded]}
          lot={trail.data.lot}
          onAdvance={async () => {
            try {
              await api.post(`/production/lots/${lotId}/advance`, { from: expanded });
              trail.refetch();
              lots.refetch();
            } catch (e) {
              alert(`No se pudo avanzar: ${e.message}`);
            }
          }}
        />
      )}
    </main>
  );
}

function LotPicker({ lots, loading, selected, onSelect }) {
  if (loading) {
    return (
      <div className={styles.picker} aria-busy="true">
        <span className={styles.picker__label}>Lote</span>
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className={styles.skel} style={{ width: 90, height: 26, borderRadius: 999 }} />
        ))}
      </div>
    );
  }
  if (!lots?.length) return <div className={styles.picker}>No hay lotes activos.</div>;
  return (
    <div className={styles.picker} role="tablist" aria-label="Seleccionar lote">
      <span className={styles.picker__label}>Lote</span>
      {lots.map((l) => {
        const stage = STAGES.find((s) => s.id === l.current_stage);
        return (
          <button key={l.id} type="button" role="tab"
                  aria-selected={l.id === selected}
                  className={[styles.lotchip, l.id === selected ? styles["lotchip--on"] : ""].join(" ")}
                  onClick={() => onSelect(l.id)}>
            {l.code}
            {stage && <span className={styles.lotchip__stage}>{stage.shortLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}

function LotCard({ lot, loading }) {
  if (loading) {
    return (
      <div className={styles.lotcard} aria-busy="true">
        <span className={styles.skel} style={{ width: 180, height: 22 }} />
        <span className={styles.skel} style={{ width: 260, height: 12, marginTop: 8 }} />
        <div className={styles.lotcard__meta}>
          {Array.from({ length: 4 }).map((_, i) => <span key={i} className={styles.skel} style={{ height: 28 }} />)}
        </div>
      </div>
    );
  }
  if (!lot) return null;
  return (
    <section className={styles.lotcard}>
      <div className={styles.lotcard__top}>
        <div>
          <div className={styles.lotcard__code}>{lot.code}</div>
          <div className={styles.lotcard__origin}>
            {[lot.origin_farm, lot.caficultor, lot.region].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <dl className={styles.lotcard__meta}>
        <Field label="Variedad" value={lot.variety} />
        <Field label="Altitud"  value={lot.altitude ? `${lot.altitude} m s.n.m.` : null} />
        <Field label="Cereza"   value={fmtKg(lot.cherry_kg)} />
        <Field label="Cata SCA" value={lot.cup_score ? `${lot.cup_score} pts` : "pendiente"} />
      </dl>
    </section>
  );
}

function Field({ label, value }) {
  return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>;
}

function Stepper({ stages, loading, expanded, onToggle }) {
  return (
    <ol className={styles.stepper}>
      {STAGES.map((s, i) => {
        const data   = stages?.[s.id];
        const status = data?.status ?? "pending";
        return (
          <Step
            key={s.id}
            index={i + 1}
            stage={s}
            data={data}
            status={status}
            loading={loading}
            expanded={expanded === s.id}
            onToggle={() => onToggle(s.id)}
          />
        );
      })}
    </ol>
  );
}

const STATUS_LABEL = {
  pending:     "Pendiente",
  in_progress: "En proceso",
  completed:   "Completado",
};

function Step({ index, stage, data, status, loading, expanded, onToggle }) {
  return (
    <li className={[
      styles.step,
      styles[`step--${status}`],
      expanded ? styles["step--expanded"] : "",
    ].join(" ")}>
      <div className={styles.step__node} aria-hidden="true">
        {status === "completed" ? "✓" : index}
      </div>
      <button type="button" className={styles.step__body}
              onClick={onToggle} aria-expanded={expanded} aria-controls={`detail-${stage.id}`}>
        <div className={styles.step__name}>
          {stage.label}
          <span className={[styles.statePill, styles[`statePill--${status}`]].join(" ")}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        {loading ? (
          <span className={styles.skel} style={{ width: 140, height: 12 }} />
        ) : (
          <div className={styles.step__meta}>
            {data?.kg   != null && <span><b>{fmtKg(data.kg)}</b></span>}
            {data?.when &&         <span>{fmtDate(data.when)}</span>}
          </div>
        )}
        {data?.responsible && <div className={styles.step__resp}>{data.responsible}</div>}
        {status === "in_progress" && data?.progress != null && (
          <div className={styles.progress} aria-label={`Progreso ${Math.round(data.progress * 100)}%`}>
            <div className={styles.progress__bar} style={{ width: `${Math.round(data.progress * 100)}%` }} />
          </div>
        )}
      </button>
      <span className={styles.step__toggle} aria-hidden="true">›</span>
    </li>
  );
}

function StageDetail({ stageId, data, lot, onAdvance }) {
  const stage  = STAGES.find((s) => s.id === stageId);
  const fields = buildFields(stageId, data, lot);

  return (
    <section className={styles.detail} id={`detail-${stageId}`}>
      <h2 className={styles.detail__title}>
        {stage.label}
        <small>{STATUS_LABEL[data.status]}</small>
      </h2>
      <dl className={styles.detail__grid}>
        {fields.map(({ label, value }) => (
          <div key={label} className={styles.detail__field}>
            <dt>{label}</dt><dd>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {data.notes && <p className={styles.detail__note}>{data.notes}</p>}
      <div className={styles.detail__actions}>
        {data.status === "completed" && (
          <button type="button" className={styles.btn}>Ver registro</button>
        )}
        {data.status === "in_progress" && (
          <>
            <button type="button" className={[styles.btn, styles["btn--primary"]].join(" ")} onClick={onAdvance}>
              Marcar como completado
            </button>
            <button type="button" className={styles.btn}>Pausar</button>
          </>
        )}
        {data.status === "pending" && (
          <button type="button" className={[styles.btn, styles["btn--primary"]].join(" ")} onClick={onAdvance}>
            Iniciar etapa
          </button>
        )}
      </div>
    </section>
  );
}

function buildFields(stageId, data, lot) {
  const common = [
    { label: "Cantidad",    value: data.kg != null ? fmtKg(data.kg) : null },
    { label: "Inicio",      value: fmtDateTime(data.started_at) },
    { label: "Fin",         value: fmtDateTime(data.ended_at) },
    { label: "Responsable", value: data.responsible },
  ];
  switch (stageId) {
    case "harvest":
      return [...common,
        { label: "Variedad",        value: data.details?.variety ?? lot?.variety },
        { label: "Altitud",         value: data.details?.altitude ? `${data.details.altitude} m` : null },
        { label: "Humedad",         value: data.details?.humidity_pct != null ? `${data.details.humidity_pct} %` : null },
        { label: "Defectos/300g",   value: data.details?.defects_per_300g },
      ];
    case "green":
      return [...common,
        { label: "Bodega",          value: data.details?.warehouse },
        { label: "Merma vs cereza", value: data.details?.merma_pct != null ? `${data.details.merma_pct} %` : null },
        { label: "Humedad",         value: data.details?.humidity_pct != null ? `${data.details.humidity_pct} %` : null },
        { label: "Días almac.",     value: data.details?.days_in_storage },
      ];
    case "roast":
      return [...common,
        { label: "Tostador",        value: data.details?.roaster },
        { label: "Perfil",          value: data.details?.profile },
        { label: "Drop temp",       value: data.details?.drop_temp_c ? `${data.details.drop_temp_c} °C` : null },
        { label: "Duración",        value: data.details?.duration_min ? `${data.details.duration_min} min` : null },
        { label: "Merma",           value: data.details?.merma_pct != null ? `${data.details.merma_pct} %` : null },
        { label: "ETA",             value: data.details?.eta ? fmtDateTime(data.details.eta) : null },
      ];
    case "roasted":
      return [...common,
        { label: "Bodega",          value: data.details?.warehouse },
        { label: "Días post-tostión", value: data.details?.days_since_roast },
      ];
    case "pack":
      return [...common,
        { label: "SKUs",            value: data.details?.skus?.join(", ") },
        { label: "Unidades",        value: data.details?.total_units?.toLocaleString("es-CO") },
        { label: "Línea",           value: data.details?.line },
      ];
    case "label":
      return [...common,
        { label: "Etiquetas",       value: data.details?.label_count?.toLocaleString("es-CO") },
        { label: "Plantilla QR",    value: data.details?.qr_template },
        { label: "URL traza",       value: data.details?.trace_url },
      ];
    default:
      return common;
  }
}

function fmtKg(n) {
  if (n == null) return null;
  return `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg`;
}
function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}
function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
