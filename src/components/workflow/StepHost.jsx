// Decide qué paso mostrar en la hoja y, al terminar, qué sigue con ese lote.
// Como casi siempre es una sola persona la que registra, el cierre de un paso
// ofrece el siguiente del mismo lote en vez de devolverla a la lista.

import React, { useState } from "react";
import { describeTask } from "@dobleyo/shared";
import { useLot } from "./data.js";
import { StepHead } from "./Sheet.jsx";
import HarvestStep from "./steps/HarvestStep.jsx";
import GreenStep from "./steps/GreenStep.jsx";
import SendStep from "./steps/SendStep.jsx";
import ReceiveStep from "./steps/ReceiveStep.jsx";
import PackStep from "./steps/PackStep.jsx";
import LabelStep from "./steps/LabelStep.jsx";
import s from "./workflow.module.css";

export default function StepHost({ sheet, role, onClose, onDone, onNext, onOpenLot }) {
  const [result, setResult] = useState(null);

  const finish = (r) => {
    setResult(r);
    onDone?.(r);
  };

  if (result) {
    return <DoneView result={result} onClose={onClose} onNext={onNext} onOpenLot={onOpenLot} />;
  }
  if (sheet.kind === "harvest") {
    return <HarvestStep role={role} onDone={finish} onCancel={onClose} />;
  }
  return <LotStep sheet={sheet} role={role} onDone={finish} onCancel={onClose} />;
}

/** Pasos que parten de un lote existente: primero se carga su estado actual. */
function LotStep({ sheet, role, onDone, onCancel }) {
  const lot = useLot(sheet.lotId);

  if (lot.loading && !lot.data) {
    return (
      <div className={s.sheetForm}>
        <StepHead lot={`Lote ${sheet.lotId}`} title="Cargando el lote…" onClose={onCancel} />
        <div className={s.sheetBody}><div className={s.skeleton} /><div className={s.skeleton} /></div>
      </div>
    );
  }
  if (lot.error) {
    return (
      <div className={s.sheetForm}>
        <StepHead lot={`Lote ${sheet.lotId}`} title="No se pudo abrir el lote" onClose={onCancel} />
        <div className={s.sheetBody}>
          <p className={s.sheetError} role="alert">{lot.error.message}</p>
          <button type="button" className={s.btnGhost} onClick={lot.refetch}>Intentar de nuevo</button>
        </div>
      </div>
    );
  }

  const props = { lot: lot.data, role, onDone, onCancel };
  switch (sheet.kind) {
    case "store_green": return <GreenStep {...props} />;
    case "send_roasting": return <SendStep {...props} />;
    case "receive_roast": return <ReceiveStep {...props} roastingId={sheet.ref.roastingId} />;
    case "store_roasted": return <ReceiveStep {...props} roastedId={sheet.ref.roastedId} />;
    case "pack": return <PackStep {...props} roastedStorageId={sheet.ref.roastedStorageId} />;
    case "label": return <LabelStep {...props} />;
    default: return null;
  }
}

/** Cierre del paso: qué se guardó y qué sigue con el mismo lote. */
function DoneView({ result, onClose, onNext, onOpenLot }) {
  const lot = useLot(result.lotId);
  const tasks = lot.data?.tasks ?? [];
  const ready = tasks.filter((t) => t.urgency !== "waiting");
  const waiting = tasks.filter((t) => t.urgency === "waiting");
  const [next, ...others] = ready;
  const copy = (t) => describeTask({ ...t, lot: lot.data });
  const nextCopy = next ? copy(next) : null;

  return (
    <div className={s.sheetForm}>
      <StepHead lot={result.lotId ? `Lote ${result.lotId}` : null} title={result.title} onClose={onClose} />
      <div className={s.sheetBody}>
        <div className={s.done}>
          <svg className={s.doneMark} width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="20" />
            <path d="M13 22.5l6 6 12-13" />
          </svg>
          <p className={s.doneText}>{result.detail}</p>
          {result.printLabels && (
            <a className={s.btnGhost} href={`/admin/etiquetas?imprimir=${encodeURIComponent(result.lotId)}`}
              target="_blank" rel="noopener">
              Imprimir etiquetas
            </a>
          )}
        </div>

        <h3 className={s.nextHead}>Lo que sigue con este lote</h3>
        {lot.loading && !lot.data ? (
          <div className={s.skeleton} />
        ) : next ? (
          <div className={s.nextCard}>
            <p className={s.nextTitle}>{nextCopy.title}</p>
            <p className={s.nextDetail}>{nextCopy.detail}</p>
            <button type="button" className={s.btnPrimary} onClick={() => onNext(next)}>
              {nextCopy.action}
            </button>
          </div>
        ) : (
          <p className={s.nextNone}>
            {waiting.length
              ? copy(waiting[0]).detail
              : "Este lote no tiene más pasos por ahora."}
          </p>
        )}
        {next && waiting.length > 0 && (
          <ul className={s.nextWaiting}>
            {waiting.map((t) => <li key={t.id}>{copy(t).detail}</li>)}
          </ul>
        )}
        {others.length > 0 && (
          <ul className={s.nextMore}>
            {others.map((t) => (
              <li key={t.id}>
                <button type="button" className={s.linkBtn} onClick={() => onNext(t)}>
                  {copy(t).title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className={s.sheetFoot}>
        <div className={s.sheetActions}>
          {result.lotId && (
            <button type="button" className={s.btnGhost} onClick={() => onOpenLot(result.lotId)}>Ver la historia del lote</button>
          )}
          <button type="button" className={next ? s.btnGhost : s.btnPrimary} onClick={onClose}>Volver a Qué sigue</button>
        </div>
      </footer>
    </div>
  );
}
