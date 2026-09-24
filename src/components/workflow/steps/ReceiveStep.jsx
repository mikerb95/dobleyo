import React, { useState } from "react";
import {
  CONTAINERS, ROAST_LEVELS, ROAST_LOSS_RANGE, STORAGE_CONDITIONS, formatKg, formatNumber, todayISO,
} from "@dobleyo/shared";
import { StepForm, StepHead, Section } from "../Sheet.jsx";
import { Amount, Chips, ChipsMulti, CostBlock, DateField, Field, LocationPicker, More, emptyCost } from "../Fields.jsx";
import { StepError, costPayload, num, postStep, useLocations } from "../data.js";
import s from "../workflow.module.css";

// El servidor rechaza un tostado por debajo del 60 % de lo enviado.
const MAX_LOSS = 40;

/**
 * El café vuelve de la maquila: se pesa, se registra el tueste y se guarda.
 * Recibir y ubicar son un solo momento para el operario, aunque en el
 * servidor sean dos registros (roast-retrieval y roasted-storage).
 *
 * Con `roastedId` (tostado ya recibido sin ubicación) solo se pide la ubicación.
 */
export default function ReceiveStep({ lot, role, roastingId, roastedId: initialRoastedId, onDone, onCancel }) {
  const isAdmin = role === "admin";
  const locations = useLocations("roasted");

  const receiveTask = lot.tasks.find((t) => t.kind === "receive_roast" && t.ref.roastingId === roastingId);
  const storeTask = lot.tasks.find((t) => t.kind === "store_roasted" && t.ref.roastedId === initialRoastedId);
  const sentKg = receiveTask?.facts.sentKg ?? null;

  const [roastedId, setRoastedId] = useState(initialRoastedId ?? null);
  const [receivedKg, setReceivedKg] = useState(storeTask?.facts.kg ?? null);
  const [kg, setKg] = useState("");
  const [level, setLevel] = useState("");
  const [date, setDate] = useState(todayISO);
  const [temp, setTemp] = useState("");
  const [minutes, setMinutes] = useState("");
  const [observations, setObservations] = useState("");
  const [roastCost, setRoastCost] = useState(emptyCost);

  const [location, setLocation] = useState("");
  const [container, setContainer] = useState("BAG-5KG");
  const [count, setCount] = useState("");
  const [conditions, setConditions] = useState(["sealed", "cool", "dark"]);
  const [returnCost, setReturnCost] = useState(emptyCost);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onlyStore = roastedId != null;
  const weight = onlyStore ? receivedKg : num(kg);
  const loss = !onlyStore && sentKg > 0 && weight > 0 ? ((sentKg - weight) / sentKg) * 100 : null;
  const containerKg = CONTAINERS.find((c) => c.value === container)?.kg ?? 1;
  const suggestedCount = weight > 0 ? Math.ceil(weight / containerKg) : null;

  if (!onlyStore && !receiveTask) {
    return (
      <Missing onCancel={onCancel} lot={lot}
        text="Este envío ya fue recibido o no está en la maquila. Revise la historia del lote." />
    );
  }

  async function submit() {
    setError(null);
    if (!onlyStore) {
      if (!(weight > 0)) return setError("Escriba cuántos kilos volvieron tostados.");
      if (weight >= sentKg) return setError(`El tostado pesa menos que lo enviado (${formatKg(sentKg)}): siempre hay merma.`);
      if (loss > MAX_LOSS) return setError(`Una merma del ${formatNumber(loss)} % es demasiado alta. Revise el peso.`);
      if (!level) return setError("Elija el nivel de tueste.");
    }
    if (!location) return setError("Elija dónde queda guardado el tostado.");
    const n = parseInt(count || suggestedCount, 10);
    if (!(n > 0)) return setError("Indique cuántos contenedores quedan en la ubicación.");

    setBusy(true);
    let currentId = roastedId;
    try {
      if (!onlyStore) {
        const res = await postStep("/coffee/roast-retrieval", {
          roastingId,
          roastLevel: level,
          roastedWeight: weight,
          actualTemp: temp ? num(temp) : undefined,
          roastTime: minutes ? num(minutes) : undefined,
          observations: observations.trim() || undefined,
          recordedAt: date,
          ...(isAdmin ? { cost: costPayload(roastCost) } : {}),
        });
        currentId = res.roastedId;
        setRoastedId(currentId);
        setReceivedKg(weight);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
      return;
    }

    try {
      await postStep("/coffee/roasted-storage", {
        roastedId: currentId,
        location,
        container,
        containerCount: n,
        conditions,
        recordedAt: date,
        ...(isAdmin ? { cost: costPayload(returnCost) } : {}),
      });
      onDone({
        lotId: lot.lotId,
        title: onlyStore ? "Tostado ubicado en bodega" : "Tostado recibido y guardado",
        detail: onlyStore
          ? `${formatKg(weight)} quedaron en ${location}.`
          : `Volvieron ${formatKg(weight)} (merma del ${formatNumber(loss)} %) y quedaron en ${location}.`,
      });
    } catch (err) {
      // La recepción ya quedó guardada: el formulario pasa a pedir solo la ubicación.
      const msg = err instanceof StepError ? err.message : String(err);
      setError(onlyStore ? msg : `El tostado quedó registrado, pero no se pudo guardar la ubicación: ${msg}`);
      setBusy(false);
    }
  }

  const consequence = onlyStore
    ? (location ? <>Quedarán <strong>{formatKg(weight)}</strong> en {location}.</> : null)
    : (loss != null ? <LossReading loss={loss} /> : sentKg ? <>Se enviaron {formatKg(sentKg)} a la maquila.</> : null);

  return (
    <StepForm
      head={
        <StepHead
          lot={`Lote ${lot.lotId}`}
          title={onlyStore ? `Ubicar en bodega el tostado de ${lot.farmName}` : `Recibir el tostado de ${lot.farmName}`}
          intro={onlyStore
            ? `${formatKg(weight)} ya recibidos esperan un lugar en la bodega de tostado.`
            : `Salieron ${formatKg(sentKg)} de café verde ${receiveTask.ageDays > 0 ? `hace ${receiveTask.ageDays} días` : "hoy"}. Pese lo que volvió y guárdelo.`}
          onClose={onCancel}
        />
      }
      consequence={consequence}
      error={error}
      submitLabel={onlyStore ? "Asignar ubicación" : "Registrar recepción"}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      {!onlyStore && (
        <Section title="Lo que volvió">
          <Field label="Peso tostado" htmlFor="rr-kg">
            <Amount id="rr-kg" value={kg} onChange={setKg} unit="kg" placeholder={sentKg ? String(Math.round(sentKg * 0.84 * 10) / 10) : "84"} autoFocus />
          </Field>
          {loss != null && <LossGauge loss={loss} />}
          <Chips label="Nivel de tueste" options={ROAST_LEVELS} value={level} onChange={setLevel} />
          <DateField id="rr-date" label="Fecha de recepción" value={date} onChange={setDate} />
          {isAdmin && <CostBlock title="Valor de la maquila" cost={roastCost} onChange={setRoastCost} />}
          <More summary="Datos del perfil de tueste (opcional)">
            <div className={s.pair}>
              <Field label="Temperatura final" htmlFor="rr-temp">
                <Amount id="rr-temp" value={temp} onChange={setTemp} unit="°C" step="1" placeholder="205" />
              </Field>
              <Field label="Tiempo de tueste" htmlFor="rr-min">
                <Amount id="rr-min" value={minutes} onChange={setMinutes} unit="min" step="1" placeholder="12" />
              </Field>
            </div>
            <Field label="Observaciones" htmlFor="rr-obs">
              <textarea id="rr-obs" rows={3} value={observations} onChange={(e) => setObservations(e.target.value)}
                placeholder="Color, aroma, desarrollo del tueste" />
            </Field>
          </More>
        </Section>
      )}

      <Section title="Dónde queda">
        <LocationPicker
          label="Ubicación en bodega de tostado"
          locations={locations.data}
          loading={locations.loading}
          error={locations.error}
          value={location}
          onChange={setLocation}
          neededKg={weight}
        />
        <Chips label="Contenedor" options={CONTAINERS} value={container} onChange={setContainer} />
        <Field label="Cuántos contenedores" htmlFor="rr-count"
          hint={suggestedCount ? `Para ${formatKg(weight)} se necesitan ${suggestedCount}.` : undefined}>
          <Amount id="rr-count" value={count} onChange={setCount} step="1" min="1"
            placeholder={suggestedCount ? String(suggestedCount) : "4"} />
        </Field>
        <ChipsMulti label="Condiciones" options={STORAGE_CONDITIONS} value={conditions} onChange={setConditions} />
        {isAdmin && <CostBlock title="Transporte de regreso a bodega" cost={returnCost} onChange={setReturnCost} />}
      </Section>
    </StepForm>
  );
}

function lossVerdict(loss) {
  if (loss < ROAST_LOSS_RANGE.min) return { tone: "warn", text: "Merma baja: confirme el peso antes de guardar." };
  if (loss <= ROAST_LOSS_RANGE.max) return { tone: "ok", text: "Dentro de lo normal." };
  if (loss <= MAX_LOSS) return { tone: "warn", text: "Merma alta: conviene revisarla con la maquila." };
  return { tone: "bad", text: "No es posible: revise el peso." };
}

function LossReading({ loss }) {
  const v = lossVerdict(loss);
  return <>Merma del <strong>{formatNumber(loss)} %</strong>. {v.text}</>;
}

/** Regla de 0 a 40 % con la franja habitual marcada y la merma de este tueste. */
function LossGauge({ loss }) {
  const pct = (x) => `${Math.min(100, Math.max(0, (x / MAX_LOSS) * 100))}%`;
  const v = lossVerdict(loss);
  return (
    <div className={s.gauge} data-tone={v.tone} aria-hidden="true">
      <div className={s.gaugeTrack}>
        <span className={s.gaugeBand} style={{ left: pct(ROAST_LOSS_RANGE.min), width: `calc(${pct(ROAST_LOSS_RANGE.max)} - ${pct(ROAST_LOSS_RANGE.min)})` }} />
        <span className={s.gaugeMark} style={{ left: pct(loss) }} />
      </div>
      <div className={s.gaugeScale}>
        <span>0 %</span>
        <span style={{ left: pct(ROAST_LOSS_RANGE.min) }}>{ROAST_LOSS_RANGE.min} %</span>
        <span style={{ left: pct(ROAST_LOSS_RANGE.max) }}>{ROAST_LOSS_RANGE.max} %</span>
        <span>{MAX_LOSS} %</span>
      </div>
    </div>
  );
}

export function Missing({ lot, text, onCancel }) {
  return (
    <div className={s.sheetForm}>
      <StepHead lot={lot ? `Lote ${lot.lotId}` : null} title="Este paso ya no está pendiente" onClose={onCancel} />
      <div className={s.sheetBody}><p className={s.note}>{text}</p></div>
      <footer className={s.sheetFoot}>
        <div className={s.sheetActions}>
          <button type="button" className={s.btnPrimary} onClick={onCancel}>Volver</button>
        </div>
      </footer>
    </div>
  );
}
