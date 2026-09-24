import React, { useState } from "react";
import { formatKg, todayISO } from "@dobleyo/shared";
import { StepForm, StepHead, Section } from "../Sheet.jsx";
import { Amount, CostBlock, DateField, Field, More, emptyCost } from "../Fields.jsx";
import { costPayload, num, postStep } from "../data.js";
import s from "../workflow.module.css";

/** El café verde sale hacia la maquila. */
export default function SendStep({ lot, role, onDone, onCancel }) {
  const isAdmin = role === "admin";
  const available = lot?.balance?.greenKg ?? 0;
  const [kg, setKg] = useState(available ? String(available) : "");
  const [date, setDate] = useState(todayISO);
  const [temp, setTemp] = useState("");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const qty = num(kg);
  const left = Math.max(0, Math.round((available - (qty || 0)) * 1000) / 1000);
  const partial = qty > 0 && qty < available;

  let consequence = null;
  if (qty > available) consequence = <>Solo hay {formatKg(available)} en bodega.</>;
  else if (qty > 0) consequence = left > 0
    ? <>Salen <strong>{formatKg(qty)}</strong> y quedan {formatKg(left)} en bodega verde.</>
    : <>Sale <strong>todo el café verde</strong> del lote ({formatKg(qty)}).</>;

  async function submit() {
    if (!(qty > 0)) return setError("Escriba cuántos kilos salen a la maquila.");
    if (qty > available) return setError(`No puede enviar más de lo que hay en bodega (${formatKg(available)}).`);
    const t = num(temp);
    if (temp && !(t >= 180 && t <= 230)) return setError("La temperatura objetivo debe estar entre 180 y 230 °C.");
    setBusy(true);
    setError(null);
    try {
      await postStep("/coffee/send-roasting", {
        lotId: lot.lotId,
        quantitySent: qty,
        targetTemp: temp ? t : undefined,
        notes: notes.trim() || undefined,
        recordedAt: date,
        ...(isAdmin ? { cost: costPayload(cost) } : {}),
      });
      onDone({
        lotId: lot.lotId,
        title: "Café enviado a la maquila",
        detail: `Salieron ${formatKg(qty)} de ${lot.farmName}. Cuando vuelva tostado, regístrelo desde Qué sigue; si tarda más de lo habitual, aparecerá como atrasado.`,
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
          title={`Enviar a la maquila el café de ${lot.farmName}`}
          intro={`Hay ${formatKg(available)} de café verde en bodega.`}
          onClose={onCancel}
        />
      }
      consequence={consequence}
      error={error}
      submitLabel="Enviar a la maquila"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="Qué sale">
        <Field label="Kilos que salen" htmlFor="sr-kg">
          <Amount
            id="sr-kg"
            value={kg}
            onChange={setKg}
            unit="kg"
            max={available}
            action={
              qty !== available && (
                <button type="button" className={s.inlineBtn} onClick={() => setKg(String(available))}>Todo</button>
              )
            }
          />
        </Field>
        {partial && (
          <p className={s.note}>
            Por ahora cada lote admite un solo envío a la maquila: los {formatKg(left)} que queden no se podrán
            enviar después con este mismo código. Si quiere tostarlo todo, envíelo completo.
          </p>
        )}
        <DateField id="sr-date" label="Fecha de salida" value={date} onChange={setDate} />
      </Section>

      {isAdmin && <CostBlock title="Transporte hasta la tostadora" cost={cost} onChange={setCost} />}

      <More summary="Indicaciones para la maquila (opcional)">
        <Field label="Temperatura objetivo" htmlFor="sr-temp" hint="Entre 180 y 230 °C.">
          <Amount id="sr-temp" value={temp} onChange={setTemp} unit="°C" step="1" min="180" max="230" placeholder="210" />
        </Field>
        <Field label="Nota para el tostador" htmlFor="sr-notes">
          <textarea id="sr-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Perfil deseado, fecha en que se necesita, contacto" />
        </Field>
      </More>
    </StepForm>
  );
}
