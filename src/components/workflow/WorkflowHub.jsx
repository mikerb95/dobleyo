// "Qué sigue": la entrada a la línea de producción.
//
// En lugar de siete pantallas, una por tabla, la persona ve el trabajo que
// hay pendiente redactado como objetivos ("Recoger de la maquila el café de
// La Sierra"), ordenado por urgencia. Cada tarea abre su formulario con el
// lote ya elegido y, al guardar, ofrece el siguiente paso del mismo lote.

import React, { useCallback, useEffect, useState } from "react";
import "@fontsource-variable/fraunces";
import {
  URGENCY_LABELS, describeEvent, describeQueue, describeTask, formatKg, formatShortDate, formatLongDate,
  greeting, processLabel, regionLabel, varietyLabel,
} from "@dobleyo/shared";
import { useLot, useQueue, useRole } from "./data.js";
import { MassFlow, StationThread, TASK_STATION } from "./Route.jsx";
import { Sheet } from "./Sheet.jsx";
import StepHost from "./StepHost.jsx";
import s from "./workflow.module.css";

const GROUPS = ["late", "now", "waiting", "anytime"];

const GROUP_HINT = {
  late: "Llevan más tiempo del normal.",
  now: "Conviene hacerlas hoy.",
  waiting: "Dependen de otros; se registran cuando ocurran.",
  anytime: "Pueden esperar a que usted decida.",
};

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  return { lotId: p.get("lote"), newHarvest: p.get("nueva") === "cosecha" };
}

export default function WorkflowHub() {
  const { role, firstName } = useRole();
  const queue = useQueue();
  const [lotId, setLotId] = useState(() => readUrl().lotId);
  const [sheet, setSheet] = useState(() => (readUrl().newHarvest ? { kind: "harvest" } : null));
  const [version, setVersion] = useState(0);

  // Navegación con el botón atrás del navegador entre la bandeja y un lote.
  useEffect(() => {
    const onPop = () => setLotId(readUrl().lotId);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Al volver a la pestaña (p. ej. tras imprimir etiquetas) se refresca.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") queue.refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queue.refetch]);

  const openLot = useCallback((id) => {
    const url = id ? `${window.location.pathname}?lote=${encodeURIComponent(id)}` : window.location.pathname;
    window.history.pushState(null, "", url);
    setLotId(id);
    setSheet(null);
    window.scrollTo({ top: 0 });
  }, []);

  const openTask = useCallback((task) => {
    // La catación tiene su propia página con el formulario SCA completo.
    if (task.kind === "cupping") {
      window.location.href = `/admin/cupping?tostado=${encodeURIComponent(task.ref.roastedId)}`;
      return;
    }
    setSheet({ kind: task.kind, lotId: task.lotId, ref: task.ref, key: `${task.id}:${Date.now()}` });
  }, []);

  const onStepDone = useCallback(() => {
    queue.refetch();
    setVersion((v) => v + 1);
    // Limpia ?nueva=cosecha para que recargar no reabra el formulario.
    if (readUrl().newHarvest) window.history.replaceState(null, "", window.location.pathname);
  }, [queue.refetch]);

  return (
    <div className={s.hub}>
      {lotId ? (
        <LotView lotId={lotId} version={version} onBack={() => openLot(null)} onOpenTask={openTask} />
      ) : (
        <Board
          queue={queue}
          role={role}
          firstName={firstName}
          onOpenLot={openLot}
          onOpenTask={openTask}
          onNewHarvest={() => setSheet({ kind: "harvest", key: `harvest:${Date.now()}` })}
        />
      )}

      <Sheet open={!!sheet} onClose={() => setSheet(null)} label="Registrar un paso de producción">
        {sheet && (
          <StepHost
            key={sheet.key ?? sheet.kind}
            sheet={sheet}
            role={role}
            onClose={() => setSheet(null)}
            onDone={onStepDone}
            onNext={openTask}
            onOpenLot={openLot}
          />
        )}
      </Sheet>
    </div>
  );
}

// ── Bandeja ────────────────────────────────────────────────────────────────

function Board({ queue, role, firstName, onOpenLot, onOpenTask, onNewHarvest }) {
  const data = queue.data;
  const tasks = data?.tasks ?? [];

  return (
    <>
      <header className={s.hubHead}>
        <div className={s.hubHeadText}>
          <h1 className={s.hello}>{greeting()}{firstName ? `, ${firstName}` : ""}.</h1>
          <p className={s.summary}>
            {data ? describeQueue(data) : queue.error ? "No se pudo cargar el trabajo pendiente." : "Revisando la línea de producción…"}
          </p>
        </div>
        <button type="button" className={s.btnPrimary} onClick={onNewHarvest}>Registrar cosecha</button>
      </header>

      <div className={s.hubGrid}>
        <main className={s.board} aria-busy={queue.loading || undefined}>
          {queue.error && (
            <div className={s.alert} role="alert">
              <p>{queue.error.message || "Error de conexión."}</p>
              <button type="button" className={s.btnGhost} onClick={queue.refetch}>Intentar de nuevo</button>
            </div>
          )}

          {queue.loading && !data && <BoardSkeleton />}

          {data && tasks.length === 0 && (
            <div className={s.empty}>
              <p className={s.emptyTitle}>La línea está al día.</p>
              <p>Cada cosecha que registre aparecerá aquí con lo que falta para llevarla hasta la bolsa.</p>
              <button type="button" className={s.btnPrimary} onClick={onNewHarvest}>Registrar cosecha</button>
            </div>
          )}

          {GROUPS.map((g) => {
            const list = tasks.filter((t) => t.urgency === g);
            if (!list.length) return null;
            return (
              <section key={g} className={s.group} data-urgency={g} aria-labelledby={`grp-${g}`}>
                <header className={s.groupHead}>
                  <h2 id={`grp-${g}`}>
                    {URGENCY_LABELS[g]} <span className={s.count}>{list.length}</span>
                  </h2>
                  <p>{GROUP_HINT[g]}</p>
                </header>
                <ul className={s.tasks}>
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onOpenLot={onOpenLot} onOpenTask={onOpenTask} />
                  ))}
                </ul>
              </section>
            );
          })}
        </main>

        <aside className={s.aside} aria-label="Lotes en curso">
          <LotsInFlight lots={data?.lots} loading={queue.loading && !data} onOpenLot={onOpenLot} />
          {role === "caficultor" && (
            <p className={s.asideNote}>
              Aquí ve los lotes de sus fincas. La tostión y el empaque los registra DobleYo.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function TaskRow({ task, onOpenLot, onOpenTask, compact }) {
  const copy = describeTask(task);
  const lot = task.lot;
  const primary = task.urgency !== "waiting";
  return (
    <li className={s.task} data-urgency={task.urgency}>
      <button type="button" className={s.taskMain} onClick={() => onOpenLot?.(task.lotId)} disabled={!onOpenLot}>
        {!compact && <StationThread stations={lot?.stations} focus={TASK_STATION[task.kind]} />}
        <span className={s.taskTitle}>{copy.title}</span>
        <span className={s.taskDetail}>{copy.detail}</span>
        {!compact && lot && (
          <span className={s.taskLot}>
            {varietyLabel(lot.variety)} {processLabel(lot.process).toLowerCase()}, lote {task.lotId}
          </span>
        )}
      </button>
      <button
        type="button"
        className={primary ? s.btnPrimary : s.btnGhost}
        onClick={() => onOpenTask(task)}
      >
        {copy.action}
      </button>
    </li>
  );
}

function BoardSkeleton() {
  return (
    <div className={s.group} aria-hidden="true">
      <div className={s.skeleton} style={{ width: "30%" }} />
      <div className={s.skeletonRow} />
      <div className={s.skeletonRow} />
      <div className={s.skeletonRow} />
    </div>
  );
}

function LotsInFlight({ lots, loading, onOpenLot, selected }) {
  return (
    <section className={s.inflight}>
      <h2 className={s.asideTitle}>Lotes en curso</h2>
      {loading && <div className={s.skeletonRow} />}
      {lots && lots.length === 0 && <p className={s.asideNote}>No hay lotes en proceso.</p>}
      <ul>
        {(lots ?? []).map((l) => (
          <li key={l.lotId}>
            <button
              type="button"
              className={s.lotLink}
              data-on={selected === l.lotId || undefined}
              onClick={() => onOpenLot(l.lotId)}
            >
              <span className={s.lotLinkName}>{l.farmName}</span>
              <span className={s.lotLinkMeta}>
                {varietyLabel(l.variety)} {processLabel(l.process).toLowerCase()}
                {l.openTasks > 0 && <span className={s.pill}>{l.openTasks} {l.openTasks === 1 ? "pendiente" : "pendientes"}</span>}
              </span>
              <MassFlow balance={l.balance} compact />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Ficha del lote ─────────────────────────────────────────────────────────

function LotView({ lotId, version, onBack, onOpenTask }) {
  const lot = useLot(lotId);
  const { refetch } = lot;
  useEffect(() => { if (version) refetch(); }, [version, refetch]);

  const data = lot.data;

  return (
    <div className={s.lotView}>
      <button type="button" className={s.back} onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Qué sigue
      </button>

      {lot.error && (
        <div className={s.alert} role="alert">
          <p>{lot.error.status === 404 ? "Este lote no existe o no pertenece a sus fincas." : lot.error.message}</p>
          <button type="button" className={s.btnGhost} onClick={onBack}>Volver a Qué sigue</button>
        </div>
      )}
      {lot.loading && !data && <BoardSkeleton />}

      {data && (
        <>
          <header className={s.lotHead}>
            <p className={s.lotCode}>Lote {data.lotId}</p>
            <h1 className={s.lotName}>
              {varietyLabel(data.variety)} {processLabel(data.process).toLowerCase()} de {data.farmName}
            </h1>
            <ul className={s.lotFacts}>
              {data.region && <li>{regionLabel(data.region)}</li>}
              {data.altitude ? <li>{data.altitude.toLocaleString("es-CO")} m de altura</li> : null}
              {data.harvestedAt && <li>Cosechado el {formatLongDate(data.harvestedAt)}</li>}
              {data.harvestKg ? <li>{formatKg(data.harvestKg)} comprados</li> : null}
            </ul>
            <StationThread stations={data.stations} size="lg" />
          </header>

          <div className={s.lotGrid}>
            <div>
              <section className={s.lotSection}>
                <h2 className={s.sectionTitle}>Lo que sigue</h2>
                {data.tasks.length === 0 ? (
                  <p className={s.asideNote}>Este lote no tiene pasos pendientes.</p>
                ) : (
                  <ul className={s.tasks}>
                    {data.tasks.map((t) => (
                      <TaskRow key={t.id} task={{ ...t, lot: data }} onOpenTask={onOpenTask} compact />
                    ))}
                  </ul>
                )}
                {data.strandedGreenKg > 0 && (
                  <p className={s.note}>
                    Quedan {formatKg(data.strandedGreenKg)} de café verde en bodega. Por ahora un lote admite un solo
                    envío a la maquila, así que ese remanente no aparece como tarea.
                  </p>
                )}
              </section>

              <section className={s.lotSection}>
                <h2 className={s.sectionTitle}>Historia del lote</h2>
                <ol className={s.story}>
                  {data.events.map((e, i) => {
                    const c = describeEvent(e);
                    return (
                      <li key={`${e.kind}-${i}`} className={s.storyItem}>
                        <time className={s.storyDate} dateTime={e.at}>{formatShortDate(e.at)}</time>
                        <div>
                          <p className={s.storyTitle}>{c.title}</p>
                          <p className={s.storyDetail}>{c.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            <aside className={s.lotAside}>
              <section className={s.lotSection}>
                <h2 className={s.sectionTitle}>Dónde está cada kilo</h2>
                <MassFlow balance={data.balance} />
              </section>
              {(data.aroma || data.tasteNotes) && (
                <section className={s.lotSection}>
                  <h2 className={s.sectionTitle}>Notas de la finca</h2>
                  {data.aroma && <p className={s.storyDetail}>Aroma: {data.aroma}</p>}
                  {data.tasteNotes && <p className={s.storyDetail}>{data.tasteNotes}</p>}
                </section>
              )}
              <a className={s.linkBtn} href={data.traceUrl} target="_blank" rel="noopener">
                Ver la trazabilidad como la ve el cliente
              </a>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
