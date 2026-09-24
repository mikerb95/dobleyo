import React, { useMemo, useState } from "react";
import { VARIETY_LABELS, PROCESS_LABELS, CLIMATE_LABELS, todayISO, formatKg } from "@dobleyo/shared";
import { StepForm, StepHead, Section } from "../Sheet.jsx";
import { Amount, Chips, CostBlock, DateField, Field, More, emptyCost } from "../Fields.jsx";
import { cop, costPayload, num, postStep, useFarms } from "../data.js";
import s from "../workflow.module.css";

const toOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));
const VARIETIES = toOptions(VARIETY_LABELS);
const PROCESSES = [
  { value: "HUM", label: "Lavado" },
  { value: "NAT", label: "Natural", hint: "secado en cereza" },
  { value: "ANH", label: "Anaeróbico" },
];
const CLIMATES = toOptions(CLIMATE_LABELS);

/** Primer paso: el café llega de la finca y nace el lote. */
export default function HarvestStep({ role, onDone, onCancel }) {
  const isAdmin = role === "admin";
  const farms = useFarms(role);
  const [form, setForm] = useState({
    date: todayISO(), farm: "", variety: "", process: "", climate: "", kg: "", aroma: "", notes: "",
  });
  const [cost, setCost] = useState(emptyCost);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const farmList = farms.data ?? [];
  const farm = farmList.find((f) => f.slug === form.farm) ?? (farmList.length === 1 ? farmList[0] : null);

  const farmOptions = farmList.map((f) => ({
    value: f.slug,
    label: f.name,
    hint: [f.municipality, f.altitude_min ? `${f.altitude_min} m` : null].filter(Boolean).join(", "),
  }));

  // El código se arma igual que en el servidor; el sufijo se asigna al guardar.
  const preview = useMemo(() => {
    if (!farm) return null;
    const parts = ["COL", farm.region || "COL", farm.altitude_min || "", form.variety, form.process].filter(Boolean);
    return `${parts.join("-")}-XXXX`;
  }, [farm, form.variety, form.process]);

  const kgNum = num(form.kg);
  const paid = costPayload(cost)?.amount ?? 0;
  const pricePerKg = kgNum > 0 && paid > 0 ? Math.round(paid / kgNum) : null;

  const missing = [
    !farm && "la finca",
    !form.variety && "la variedad",
    !form.process && "el proceso",
    !form.climate && "el clima",
  ].filter(Boolean);

  async function submit() {
    if (missing.length) return setError(`Falta elegir ${missing.join(", ")}.`);
    const kg = num(form.kg);
    if (form.kg && !(kg > 0)) return setError("Los kilos comprados deben ser un número mayor que cero.");
    setBusy(true);
    setError(null);
    try {
      const res = await postStep("/coffee/harvest", {
        farm: farm.slug,
        region: farm.region || undefined,
        altitude: farm.altitude_min || undefined,
        variety: form.variety,
        process: form.process,
        climate: form.climate,
        aroma: form.aroma.trim() || undefined,
        tasteNotes: form.notes.trim() || undefined,
        recordedAt: form.date,
        ...(isAdmin && kg > 0 ? { harvestWeightKg: kg } : {}),
        ...(isAdmin ? { cost: costPayload(cost) } : {}),
      });
      onDone({
        lotId: res.lotId,
        title: "Lote creado",
        detail: `El café de ${farm.name} ya tiene código: ${res.lotId}.`,
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
          title="Registrar una cosecha"
          intro="El café que llega de la finca abre un lote nuevo. Con él se sigue el grano hasta la bolsa."
          onClose={onCancel}
        />
      }
      consequence={preview ? <>Se creará el lote <strong>{preview}</strong></> : "Elija la finca para ver el código del lote."}
      error={error}
      submitLabel="Crear lote"
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Section title="De dónde viene">
        {farms.loading ? (
          <p className={s.fieldHint}>Cargando fincas…</p>
        ) : (
          <Chips label="Finca" options={farmOptions} value={farm?.slug ?? ""} onChange={set("farm")} wide />
        )}
        <DateField id="hv-date" label="Fecha de recolección" value={form.date} onChange={set("date")}
          hint="Si registra una cosecha de días anteriores, cambie la fecha." />
      </Section>

      <Section title="Qué café es">
        <Chips label="Variedad" options={VARIETIES} value={form.variety} onChange={set("variety")} />
        <Chips label="Proceso" options={PROCESSES} value={form.process} onChange={set("process")} />
        <Chips label="Clima durante la recolección" options={CLIMATES} value={form.climate} onChange={set("climate")} />
      </Section>

      {isAdmin && (
        <Section title="Compra al caficultor">
          <Field label="Kilos comprados" htmlFor="hv-kg" optional
            hint="Es el peso entregado. Lo que entre a bodega será menor por secado y selección.">
            <Amount id="hv-kg" value={form.kg} onChange={set("kg")} unit="kg" placeholder="125" />
          </Field>
          <CostBlock title="Pago al caficultor" cost={cost} onChange={setCost}
            hint={pricePerKg
              ? `Equivale a ${cop.format(pricePerKg)} por kilo comprado (${formatKg(kgNum)}).`
              : "El costo por kilo se recalcula con el peso que entre a bodega."} />
        </Section>
      )}

      <More summary="Perfil sensorial (opcional)">
        <p className={s.fieldHint}>Si prefiere, descríbalo al catar el tostado; la catación alimenta la etiqueta.</p>
        <Field label="Aroma" htmlFor="hv-aroma">
          <input id="hv-aroma" className={s.input} value={form.aroma} placeholder="Chocolate, frutal, floral"
            onChange={(e) => set("aroma")(e.target.value)} />
        </Field>
        <Field label="Notas de sabor" htmlFor="hv-notes">
          <textarea id="hv-notes" className={s.input} rows={3} value={form.notes}
            placeholder="Chocolate amargo, cereza, avellana" onChange={(e) => set("notes")(e.target.value)} />
        </Field>
      </More>
    </StepForm>
  );
}
