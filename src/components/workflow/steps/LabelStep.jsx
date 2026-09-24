import React, { useState } from "react";
import { StepForm, StepHead, Section } from "../Sheet.jsx";
import { Amount, Field } from "../Fields.jsx";
import { postStep } from "../data.js";
import { Missing } from "./ReceiveStep.jsx";
import s from "../workflow.module.css";

/** Bolsas empacadas que quedaron sin etiqueta (p. ej. si falló la generación). */
export default function LabelStep({ lot, onDone, onCancel }) {
  const task = lot.tasks.find((t) => t.kind === "label");
  const [qty, setQty] = useState(String(task?.ref.quantity ?? ""));
  const [withQr, setWithQr] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!task?.ref.packagedId) {
    return <Missing lot={lot} onCancel={onCancel} text="Este lote no tiene bolsas pendientes de etiqueta." />;
  }

  const n = parseInt(qty, 10);
  const max = task.ref.quantity;

  async function submit() {
    if (!(n > 0)) return setError("Escriba cuántas etiquetas necesita.");
    if (n > 1000) return setError("Se pueden generar hasta 1.000 etiquetas por vez.");
    setBusy(true);
    setError(null);
    try {
      await postStep("/labels/generate-from-lot", { lotId: task.ref.packagedId, quantity: n, includeQR: withQr });
      onDone({
        lotId: lot.lotId,
        title: "Etiquetas generadas",
        detail: `${n} ${n === 1 ? "etiqueta lista" : "etiquetas listas"} para las bolsas de ${lot.farmName}.`,
        printLabels: true,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <StepForm
      head={
        <StepHead
          lot={`Lote ${lot.lotId}`}
          title={`Etiquetar las bolsas de ${lot.farmName}`}
          intro={task.facts.missing === 1 ? "Hay 1 bolsa empacada sin etiqueta." : `Hay ${task.facts.missing} bolsas empacadas sin etiqueta.`}
          onClose={onCancel}
        />
      }
      consequence={n > 0 ? <>Se generarán <strong>{n}</strong> {n === 1 ? "etiqueta" : "etiquetas"} con el perfil del último empaque.</> : null}
      error={error}
      submitLabel="Generar etiquetas"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="Cuántas">
        <Field label="Etiquetas" htmlFor="lb-qty" hint={`Del último empaque faltan ${max}.`}>
          <Amount id="lb-qty" value={qty} onChange={setQty} step="1" min="1" max="1000" unit="etiquetas" autoFocus />
        </Field>
        <label className={s.check}>
          <input type="checkbox" checked={withQr} onChange={(e) => setWithQr(e.target.checked)} />
          <span>Con código QR de trazabilidad</span>
        </label>
      </Section>
    </StepForm>
  );
}
