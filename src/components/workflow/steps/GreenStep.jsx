import React, { useState } from "react";
import { formatKg, formatNumber, todayISO } from "@dobleyo/shared";
import { StepForm, StepHead, Section } from "../Sheet.jsx";
import { Amount, CostBlock, DateField, Field, LocationPicker, More, emptyCost } from "../Fields.jsx";
import { costPayload, num, postStep, useLocations } from "../data.js";

/** El café de finca entra a la bodega de café verde. */
export default function GreenStep({ lot, role, onDone, onCancel }) {
  const isAdmin = role === "admin";
  const locations = useLocations("green");
  const [kg, setKg] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const weight = num(kg);
  const bought = lot?.harvestKg;
  const shrink = bought > 0 && weight > 0 ? ((bought - weight) / bought) * 100 : null;

  let consequence = null;
  if (weight > 0 && shrink != null && shrink >= 0) {
    consequence = <>De {formatKg(bought)} comprados entran {formatKg(weight)}: merma de secado y selección del <strong>{formatNumber(shrink)} %</strong>.</>;
  } else if (weight > 0 && shrink != null) {
    consequence = <>Entra más de lo comprado ({formatKg(bought)}). Revise el peso antes de guardar.</>;
  } else if (weight > 0) {
    consequence = <>Entrarán <strong>{formatKg(weight)}</strong>{location ? ` a ${location}` : ""}.</>;
  }

  async function submit() {
    if (!(weight > 0)) return setError("Escriba cuántos kilos entran a bodega.");
    if (!location) return setError("Elija dónde queda guardado.");
    setBusy(true);
    setError(null);
    try {
      await postStep("/coffee/inventory-storage", {
        lotId: lot.lotId,
        weight,
        weightUnit: "kg",
        location,
        storageDate: date,
        recordedAt: date,
        notes: notes.trim() || undefined,
        ...(isAdmin ? { cost: costPayload(cost) } : {}),
      });
      onDone({
        lotId: lot.lotId,
        title: "Café guardado en bodega",
        detail: `${formatKg(weight)} de ${lot.farmName} quedaron en ${location}.`,
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
          title={`Guardar en bodega el café de ${lot.farmName}`}
          intro="Pese lo que llega y elija el estante. Desde aquí el café ya se puede enviar a la maquila."
          onClose={onCancel}
        />
      }
      consequence={consequence}
      error={error}
      submitLabel="Ingresar a bodega"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="Cuánto entra">
        <Field label="Peso en báscula" htmlFor="gs-kg"
          hint={bought ? `Se compraron ${formatKg(bought)} al caficultor.` : "Peso del café verde que entra a la bodega."}>
          <Amount id="gs-kg" value={kg} onChange={setKg} unit="kg" placeholder={bought ? String(Math.round(bought * 0.9)) : "110"} autoFocus />
        </Field>
        <DateField id="gs-date" label="Fecha de ingreso" value={date} onChange={setDate} />
      </Section>

      <Section title="Dónde queda">
        <LocationPicker
          label="Ubicación"
          locations={locations.data}
          loading={locations.loading}
          error={locations.error}
          value={location}
          onChange={setLocation}
          neededKg={weight}
        />
      </Section>

      {isAdmin && (
        <CostBlock title="Transporte de finca a bodega" cost={cost} onChange={setCost} />
      )}

      <More summary="Agregar una nota">
        <Field label="Nota" htmlFor="gs-notes">
          <textarea id="gs-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Humedad, estado de los sacos, observaciones del recibo" />
        </Field>
      </More>
    </StepForm>
  );
}
