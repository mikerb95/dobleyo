import React, { useEffect, useState } from "react";
import {
  GRIND_SIZES, PACKAGE_SIZES, formatKg, formatLongDate, formatNumber, formatShortDate, todayISO, unitsLabel,
} from "@dobleyo/shared";
import { StepForm, StepHead, Section } from "../Sheet.jsx";
import { Amount, Chips, DateField, DotScale, Field, More } from "../Fields.jsx";
import { cop, postStep, useSupplies } from "../data.js";
import { Missing } from "./ReceiveStep.jsx";
import s from "../workflow.module.css";

const MIN_PACKAGE_KG = 0.1;

/**
 * El tostado se empaca y, en el mismo movimiento, se generan sus etiquetas.
 * Son dos registros en el servidor (packaging y labels) y un solo momento en
 * la mesa de empaque: las etiquetas se imprimen al empacar.
 */
export default function PackStep({ lot, role, roastedStorageId, onDone, onCancel }) {
  const isAdmin = role === "admin";
  const supplies = useSupplies(isAdmin);
  const task = lot.tasks.find((t) => t.kind === "pack" && t.ref.roastedStorageId === roastedStorageId);
  const available = task?.facts.kg ?? 0;
  const profile = lot.suggestedProfile;

  const [presentation, setPresentation] = useState("GRANO");
  const [grind, setGrind] = useState("");
  const [size, setSize] = useState("250g");
  const [units, setUnits] = useState("");
  const [acidity, setAcidity] = useState(profile?.acidity ?? 3);
  const [body, setBody] = useState(profile?.body ?? 3);
  const [balance, setBalance] = useState(profile?.balance ?? 3);
  const [toStore, setToStore] = useState(true);
  const [withLabels, setWithLabels] = useState(true);
  const [withQr, setWithQr] = useState(true);
  const [bag, setBag] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const bulk = size === "bulk";
  const sizeKg = PACKAGE_SIZES.find((p) => p.value === size)?.kg ?? 1;
  const maxUnits = Math.floor((available + 1e-9) / sizeKg);
  const n = parseInt(units, 10);
  const consumed = n > 0 ? Math.round(n * sizeKg * 1000) / 1000 : 0;
  const remaining = Math.max(0, Math.round((available - consumed) * 1000) / 1000);

  // Bolsa sugerida según el tamaño elegido.
  const bagOptions = (supplies.data ?? []).filter((x) => x.type === "bolsa");
  const labelOptions = (supplies.data ?? []).filter((x) => x.type === "etiqueta");
  useEffect(() => {
    const match = bagOptions.find((b) => b.size_label === size);
    setBag(match ? String(match.id) : "");
    if (!label && labelOptions.length === 1) setLabel(String(labelOptions[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, supplies.data]);

  if (!task) {
    return <Missing lot={lot} onCancel={onCancel} text="Este tostado ya no tiene peso disponible para empacar." />;
  }

  const unitCost = (id, list) => Number(list.find((x) => String(x.id) === id)?.unit_cost_cop || 0);
  const suppliesCost = !bulk && n > 0 ? n * (unitCost(bag, bagOptions) + unitCost(label, labelOptions)) : 0;

  let consequence = null;
  if (n > maxUnits) {
    consequence = <>Con {formatKg(available)} alcanzan como máximo {maxUnits} {bulk ? "kg" : "bolsas"}.</>;
  } else if (n > 0) {
    const tail = remaining >= MIN_PACKAGE_KG
      ? <>Quedan {formatKg(remaining)} para otro empaque.</>
      : remaining > 0
        ? <>El sobrante ({formatNumber(remaining * 1000)} g) no alcanza para otra bolsa y el tostado se da por terminado.</>
        : <>Se empaca todo el tostado.</>;
    consequence = <><strong>{unitsLabel(n, size)}</strong>{bulk ? "" : `, ${formatKg(consumed)}`}. {tail}</>;
  }

  async function submit() {
    setError(null);
    if (presentation === "MOLIDO" && !grind) return setError("Elija el tipo de molienda.");
    if (!(n > 0)) return setError(bulk ? "Escriba cuántos kilos se despachan a granel." : "Escriba cuántas bolsas se empacan.");
    if (n > maxUnits) return setError(`Con ${formatKg(available)} alcanzan como máximo ${maxUnits} ${bulk ? "kg" : "bolsas"}.`);

    setBusy(true);
    let packed;
    try {
      packed = await postStep("/coffee/packaging", {
        roastedStorageId,
        acidity, body, balance,
        presentation,
        grindSize: presentation === "MOLIDO" ? grind : undefined,
        packageSize: size,
        unitCount: n,
        notes: notes.trim() || undefined,
        addToInventory: toStore,
        recordedAt: date,
        ...(isAdmin && !bulk ? { bagSupplyId: bag ? Number(bag) : null, labelSupplyId: label ? Number(label) : null } : {}),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
      return;
    }

    // Las etiquetas son un segundo registro: si fallan, el empaque ya quedó
    // guardado y la bandeja mostrará la tarea "Etiquetar" para reintentarlo.
    let labelNote = null;
    let printable = false;
    if (withLabels && !bulk) {
      try {
        await postStep("/labels/generate-from-lot", { lotId: packed.packagedId, quantity: n, includeQR: withQr });
        labelNote = `Se generaron ${n} ${n === 1 ? "etiqueta" : "etiquetas"}.`;
        printable = true;
      } catch (err) {
        labelNote = `No se generaron las etiquetas (${err.message}). Quedan pendientes en Qué sigue.`;
      }
    }

    const style = bulk ? "" : presentation === "MOLIDO" ? ", molido" : ", en grano";
    onDone({
      lotId: lot.lotId,
      title: "Café empacado",
      detail: [`${unitsLabel(n, size)}${style} del lote de ${lot.farmName}.`, labelNote].filter(Boolean).join(" "),
      printLabels: printable,
    });
  }

  const presentationOptions = [
    { value: "GRANO", label: "En grano" },
    { value: "MOLIDO", label: "Molido" },
  ];
  const sizeOptions = PACKAGE_SIZES.map((p) => ({ value: p.value, label: p.label }));

  return (
    <StepForm
      head={
        <StepHead
          lot={`Lote ${lot.lotId}`}
          title={`Empacar el tostado de ${lot.farmName}`}
          intro={`${formatKg(available)} listos${task.facts.location ? ` en ${task.facts.location}` : ""}, tostado ${task.ageDays > 0 ? `hace ${task.ageDays} días` : "hoy"}.`}
          onClose={onCancel}
        />
      }
      consequence={consequence}
      error={error}
      submitLabel={withLabels && !bulk ? "Empacar y generar etiquetas" : "Empacar"}
      busy={busy}
      onSubmit={submit}
      onCancel={onCancel}
    >
      {task.urgency === "waiting" && (
        <p className={s.note}>
          Este tostado sigue en reposo. Para que el café desgasifique, lo ideal es empacarlo desde el{" "}
          {formatShortDate(task.facts.readyAt)}.
        </p>
      )}

      <Section title="Cómo se presenta">
        <Chips label="Presentación" options={presentationOptions} value={presentation} onChange={setPresentation} />
        {presentation === "MOLIDO" && (
          <Chips label="Molienda" options={GRIND_SIZES} value={grind} onChange={setGrind} />
        )}
        <Chips label="Tamaño" options={sizeOptions} value={size} onChange={(v) => { setSize(v); setUnits(""); }} />
        <Field label={bulk ? "Kilos a granel" : "Cuántas bolsas"} htmlFor="pk-units"
          hint={maxUnits > 0 ? `Alcanza para ${maxUnits} ${bulk ? "kg" : maxUnits === 1 ? "bolsa" : "bolsas"}.` : "No alcanza para este tamaño."}>
          <Amount
            id="pk-units"
            value={units}
            onChange={setUnits}
            step="1"
            min="1"
            max={maxUnits}
            unit={bulk ? "kg" : "bolsas"}
            autoFocus
            action={maxUnits > 0 && n !== maxUnits && (
              <button type="button" className={s.inlineBtn} onClick={() => setUnits(String(maxUnits))}>Todo</button>
            )}
          />
        </Field>
      </Section>

      <Section
        title="Perfil de la etiqueta"
        aside={profile
          ? <span className={s.sectionAside}>De la catación del {formatLongDate(profile.cuppedAt)}{profile.score ? `, ${formatNumber(profile.score)} puntos` : ""}</span>
          : <span className={s.sectionAside}>Sin catación: ajústelo a mano</span>}
      >
        <div className={s.profile}>
          <DotScale label="Acidez" value={acidity} onChange={setAcidity} low="Suave" high="Brillante" />
          <DotScale label="Cuerpo" value={body} onChange={setBody} low="Ligero" high="Denso" />
          <DotScale label="Balance" value={balance} onChange={setBalance} low="Marcado" high="Redondo" />
        </div>
      </Section>

      {!bulk && (
        <Section title="Etiquetas">
          <label className={s.check}>
            <input type="checkbox" checked={withLabels} onChange={(e) => setWithLabels(e.target.checked)} />
            <span>Generar {n > 0 ? n : "las"} {n === 1 ? "etiqueta" : "etiquetas"} al empacar</span>
          </label>
          {withLabels && (
            <label className={s.check}>
              <input type="checkbox" checked={withQr} onChange={(e) => setWithQr(e.target.checked)} />
              <span>Con código QR de trazabilidad</span>
            </label>
          )}
        </Section>
      )}

      {isAdmin && !bulk && (bagOptions.length > 0 || labelOptions.length > 0) && (
        <Section title="Insumos" aside={suppliesCost > 0 && <span className={s.sectionAside}>{cop.format(suppliesCost)} en total</span>}>
          <div className={s.stack}>
            <Field label="Bolsa" htmlFor="pk-bag">
              <select id="pk-bag" value={bag} onChange={(e) => setBag(e.target.value)}>
                <option value="">Sin registrar</option>
                {bagOptions.map((b) => <option key={b.id} value={b.id}>{b.name}, {cop.format(b.unit_cost_cop)}</option>)}
              </select>
            </Field>
            <Field label="Etiqueta" htmlFor="pk-label">
              <select id="pk-label" value={label} onChange={(e) => setLabel(e.target.value)}>
                <option value="">Sin registrar</option>
                {labelOptions.map((b) => <option key={b.id} value={b.id}>{b.name}, {cop.format(b.unit_cost_cop)}</option>)}
              </select>
            </Field>
          </div>
        </Section>
      )}

      <label className={s.check}>
        <input type="checkbox" checked={toStore} onChange={(e) => setToStore(e.target.checked)} />
        <span>Agregar las unidades al inventario de la tienda</span>
      </label>

      <More summary="Fecha y notas del empaque">
        <DateField id="pk-date" label="Fecha de empaque" value={date} onChange={setDate} />
        <Field label="Nota" htmlFor="pk-notes">
          <textarea id="pk-notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Válvula, sellado, observaciones" />
        </Field>
      </More>
    </StepForm>
  );
}
