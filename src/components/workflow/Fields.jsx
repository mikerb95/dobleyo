// Piezas de formulario del flujo guiado. Todas son controladas y accesibles
// con teclado: las "fichas" son radios/checkbox nativos con otra apariencia.

import React, { useId } from "react";
import s from "./workflow.module.css";
import { cop, num } from "./data.js";

export function Field({ label, hint, error, htmlFor, children, optional }) {
  return (
    <div className={s.field}>
      {label && (
        <label className={s.fieldLabel} htmlFor={htmlFor}>
          {label}
          {optional && <span className={s.optional}>opcional</span>}
        </label>
      )}
      {children}
      {error ? <p className={s.fieldError}>{error}</p> : hint ? <p className={s.fieldHint}>{hint}</p> : null}
    </div>
  );
}

/** Grupo de opciones excluyentes con apariencia de ficha. */
export function Chips({ label, options, value, onChange, hint, wide }) {
  const name = useId();
  return (
    <fieldset className={s.field}>
      {label && <legend className={s.fieldLabel}>{label}</legend>}
      <div className={wide ? `${s.chips} ${s.chipsWide}` : s.chips}>
        {options.map((o) => (
          <label key={o.value} className={s.chip} data-on={value === o.value || undefined}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className={s.chipText}>{o.label}</span>
            {o.hint && <span className={s.chipHint}>{o.hint}</span>}
          </label>
        ))}
      </div>
      {hint && <p className={s.fieldHint}>{hint}</p>}
    </fieldset>
  );
}

/** Varias opciones a la vez (casillas con apariencia de ficha). */
export function ChipsMulti({ label, options, value, onChange }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className={s.field}>
      {label && <legend className={s.fieldLabel}>{label}<span className={s.optional}>opcional</span></legend>}
      <div className={s.chips}>
        {options.map((o) => (
          <label key={o.value} className={s.chip} data-on={value.includes(o.value) || undefined}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
            <span className={s.chipText}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Campo numérico con unidad al lado ("kg", "°C"). */
export function Amount({ id, value, onChange, unit, placeholder, step = "0.1", min = "0", max, autoFocus, action }) {
  return (
    <div className={s.amount}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className={s.amountUnit}>{unit}</span>}
      {action}
    </div>
  );
}

export function DateField({ id, label = "Fecha", value, onChange, hint }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="date"
        className={s.input}
        value={value}
        max={todayMax()}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function todayMax() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sección plegable para lo opcional: no distrae del objetivo del paso. */
export function More({ summary, children, open }) {
  return (
    <details className={s.more} open={open}>
      <summary>{summary}</summary>
      <div className={s.moreBody}>{children}</div>
    </details>
  );
}

/**
 * Selector de ubicación de bodega. Muestra la ocupación de cada estante y
 * deshabilita los que no tienen espacio para lo que se va a guardar.
 */
export function LocationPicker({ label, locations, loading, error, value, onChange, neededKg }) {
  const name = useId();
  if (loading) return <Field label={label}><p className={s.fieldHint}>Cargando ubicaciones…</p></Field>;
  if (error) {
    return <Field label={label}><p className={s.fieldError}>No se pudieron cargar las ubicaciones: {error.message}</p></Field>;
  }
  if (!locations?.length) {
    return (
      <Field label={label}>
        <p className={s.fieldError}>
          No hay ubicaciones configuradas para este tipo de café. Créelas en{" "}
          <a href="/admin/ubicaciones">Ubicaciones</a>.
        </p>
      </Field>
    );
  }

  return (
    <fieldset className={s.field}>
      <legend className={s.fieldLabel}>{label}</legend>
      <div className={s.places}>
        {locations.map((l) => {
          const free = l.capacity_kg != null ? Math.max(0, l.capacity_kg - l.occupied_kg) : null;
          const tooSmall = free != null && neededKg > 0 && neededKg > free;
          return (
            <label
              key={l.code}
              className={s.place}
              data-on={value === l.code || undefined}
              data-off={tooSmall || undefined}
            >
              <input
                type="radio"
                name={name}
                value={l.code}
                checked={value === l.code}
                disabled={tooSmall}
                onChange={() => onChange(l.code)}
              />
              <span className={s.placeName}>{l.name}</span>
              <span className={s.placeCode}>{l.code}{l.zone_name ? `, ${l.zone_name}` : ""}</span>
              {l.capacity_kg != null ? (
                <>
                  <span className={s.placeFill} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, l.fill_pct ?? 0)}%` }} />
                  </span>
                  <span className={s.placeFree}>
                    {tooSmall ? "No alcanza" : `${num(free).toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg libres`}
                  </span>
                </>
              ) : (
                <span className={s.placeFree}>Sin límite de capacidad</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Escala de 1 a 5 con puntos, para el perfil de la etiqueta. */
export function DotScale({ label, value, onChange, low, high }) {
  const name = useId();
  return (
    <fieldset className={s.dotScale}>
      <legend>{label}</legend>
      <div className={s.dots}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={s.dot} data-on={n <= value || undefined} title={`${n} de 5`}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} />
            <span aria-hidden="true" />
            <span className={s.srOnly}>{n} de 5</span>
          </label>
        ))}
      </div>
      <span className={s.dotEnds}><span>{low}</span><span>{high}</span></span>
    </fieldset>
  );
}

const PAYMENT = [
  { value: "caja", label: "Efectivo" },
  { value: "banco", label: "Banco" },
  { value: "credito", label: "A crédito" },
];

/**
 * Costo del paso. Solo lo ve el admin; el backend descarta montos de otros
 * roles. Opcional: sin monto, el lote queda con costeo incompleto.
 */
export function CostBlock({ title, hint, cost, onChange }) {
  const id = useId();
  const digits = String(cost.amount ?? "").replace(/[^\d]/g, "");
  return (
    <div className={s.cost}>
      <div className={s.costHead}>
        <span className={s.costDot} aria-hidden="true" />
        <span className={s.costTitle}>{title}</span>
        <span className={s.optional}>opcional</span>
      </div>
      {hint && <p className={s.fieldHint}>{hint}</p>}
      <div className={s.costRow}>
        <div className={s.amount}>
          <span className={s.amountUnit}>$</span>
          <input
            id={`${id}-amount`}
            aria-label={`${title}, valor en pesos`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej: 250.000"
            value={digits ? Number(digits).toLocaleString("es-CO") : ""}
            onChange={(e) => onChange({ ...cost, amount: e.target.value })}
          />
        </div>
        <select
          aria-label="Forma de pago"
          className={s.input}
          value={cost.method}
          onChange={(e) => onChange({ ...cost, method: e.target.value })}
        >
          {PAYMENT.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export const emptyCost = () => ({ amount: "", method: "caja" });

export { cop };
