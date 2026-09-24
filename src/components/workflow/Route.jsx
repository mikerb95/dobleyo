// "La ruta del grano": dónde está el lote en sus seis estaciones y dónde
// está cada uno de sus kilos. Es la pieza visual que identifica el flujo.

import React from "react";
import { STATION_LABELS, formatKg } from "@dobleyo/shared";
import s from "./workflow.module.css";

const STATIONS = ["harvest", "green", "roast", "roasted", "pack", "label"];

// Estación en la que se trabaja cada tipo de tarea.
export const TASK_STATION = {
  store_green: "green",
  send_roasting: "roast",
  receive_roast: "roast",
  store_roasted: "roasted",
  pack: "pack",
  label: "label",
  cupping: "roasted",
};

const STATE_TEXT = { done: "completa", active: "en curso", next: "sigue", pending: "pendiente" };

/**
 * Seis cuentas enhebradas. La estación de la tarea se marca con un anillo.
 * `size="lg"` agrega los nombres debajo (ficha del lote).
 */
export function StationThread({ stations, focus, size = "sm" }) {
  if (!stations) return null;
  const summary = STATIONS.map((k) => `${STATION_LABELS[k]}: ${STATE_TEXT[stations[k]]}`).join(". ");
  return (
    <ol className={size === "lg" ? `${s.thread} ${s.threadLg}` : s.thread} aria-label={`Recorrido del lote. ${summary}`}>
      {STATIONS.map((k) => (
        <li key={k} className={s.bead} data-state={stations[k]} data-focus={focus === k || undefined}>
          <span className={s.beadDot} aria-hidden="true" />
          {size === "lg" && <span className={s.beadLabel}>{STATION_LABELS[k]}</span>}
        </li>
      ))}
    </ol>
  );
}

const FLOW = [
  { key: "greenKg", label: "Verde en bodega", cls: "green" },
  { key: "maquilaKg", label: "En maquila", cls: "maquila" },
  { key: "roastedKg", label: "Tostado en bodega", cls: "roasted" },
  { key: "packedKg", label: "Empacado", cls: "packed" },
  { key: "lossKg", label: "Merma", cls: "loss" },
];

/**
 * Barra de masa: el lote como un solo cuerpo repartido entre estados.
 * La merma (secado + tueste) va al final, rayada, porque ya no es café.
 */
export function MassFlow({ balance, compact }) {
  if (!balance) return null;
  const values = {
    ...balance,
    lossKg: (balance.roastLossKg || 0) + (balance.dryingLossKg || 0),
  };
  const total = FLOW.reduce((sum, f) => sum + (values[f.key] || 0), 0);
  if (total <= 0) {
    return compact ? null : <p className={s.flowEmpty}>Todavía no hay kilos registrados en bodega.</p>;
  }

  const parts = FLOW.filter((f) => values[f.key] > 0);
  const label = parts.map((f) => `${f.label}: ${formatKg(values[f.key])}`).join(", ");

  return (
    <div className={compact ? `${s.flow} ${s.flowCompact}` : s.flow}>
      <div className={s.flowBar} role="img" aria-label={label}>
        {parts.map((f) => (
          <span
            key={f.key}
            className={s[`flow_${f.cls}`]}
            style={{ flexGrow: values[f.key] }}
            title={`${f.label}: ${formatKg(values[f.key])}`}
          />
        ))}
      </div>
      {!compact && (
        <ul className={s.flowLegend}>
          {parts.map((f) => (
            <li key={f.key}>
              <span className={`${s.flowSwatch} ${s[`flow_${f.cls}`]}`} aria-hidden="true" />
              <span className={s.flowName}>{f.label}</span>
              <span className={s.flowKg}>{formatKg(values[f.key])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
