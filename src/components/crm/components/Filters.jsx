import React from "react";
import styles from "../CRM.module.css";
import { SEGMENTS, STAGES, COUNTRIES } from "./constants.js";

export default function Filters({ value, onChange, total }) {
  const toggle = (key, id) => {
    const current = new Set(value[key] ?? []);
    current.has(id) ? current.delete(id) : current.add(id);
    onChange({ ...value, [key]: [...current] });
  };

  return (
    <div className={styles.filters} role="search">
      <div className={styles.filters__row}>
        <span className={styles.filters__label}>Etapa</span>
        {STAGES.map((s) => (
          <button
            key={s.id} type="button"
            className={[styles.chip, (value.stages ?? []).includes(s.id) ? styles["chip--on"] : ""].join(" ")}
            onClick={() => toggle("stages", s.id)}
            aria-pressed={(value.stages ?? []).includes(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.filters__row}>
        <span className={styles.filters__label}>Segmento</span>
        {SEGMENTS.map((s) => (
          <button
            key={s.id} type="button"
            className={[styles.chip, (value.segments ?? []).includes(s.id) ? styles["chip--on"] : ""].join(" ")}
            onClick={() => toggle("segments", s.id)}
            aria-pressed={(value.segments ?? []).includes(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.filters__row}>
        <span className={styles.filters__label}>País</span>
        {COUNTRIES.map((c) => (
          <button
            key={c.id} type="button"
            className={[styles.chip, value.country === c.id ? styles["chip--on"] : ""].join(" ")}
            onClick={() => onChange({ ...value, country: value.country === c.id ? null : c.id })}
            aria-pressed={value.country === c.id}
          >
            {c.label}
          </button>
        ))}
        <input
          type="search"
          className={styles.search}
          placeholder="Buscar cuenta o contacto…"
          value={value.q ?? ""}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          aria-label="Buscar"
        />
        {total != null && (
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{total} resultados</span>
        )}
      </div>
    </div>
  );
}
