import React, { useEffect, useRef, useState } from "react";
import styles from "../CRM.module.css";
import { STAGES, SEGMENTS, COUNTRIES } from "./constants.js";
import { api } from "../../../lib/api.js";

const EMPTY = {
  legal_name: "", display_name: "", segment: "", country: "CO",
  city: "", region: "", tax_id: "", pipeline_stage: "prospect",
  pipeline_value: "", source: "", notes: "",
  contact_full_name: "", contact_role: "", contact_email: "", contact_phone: "",
};

/**
 * Modal de creación de cuenta B2B.
 * El backend guarda `pipeline_value` en centavos; aquí se captura en pesos.
 */
export default function NewAccountModal({ open, onClose, onCreated }) {
  const [form,  setForm]  = useState(EMPTY);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState(null);

  const firstFieldRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError(null);
    setBusy(false);
    restoreFocusRef.current = document.activeElement;
    firstFieldRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => { if (!busy) onClose(); };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const pesos = form.pipeline_value.trim() === "" ? 0 : Number(form.pipeline_value);
    if (!Number.isFinite(pesos) || pesos < 0) {
      setError("El valor del pipeline debe ser un número no negativo.");
      return;
    }

    const payload = {
      legal_name: form.legal_name,
      display_name: form.display_name.trim() || form.legal_name,
      segment: form.segment,
      country: form.country,
      city: form.city,
      region: form.region,
      tax_id: form.tax_id,
      pipeline_stage: form.pipeline_stage,
      pipeline_value: Math.round(pesos * 100),
      source: form.source,
      notes: form.notes,
    };
    if (form.contact_full_name.trim()) {
      payload.contact = {
        full_name: form.contact_full_name,
        role:      form.contact_role,
        email:     form.contact_email,
        phone:     form.contact_phone,
      };
    }

    setBusy(true);
    try {
      const account = await api.post("/crm/accounts", payload);
      onCreated?.(account);
    } catch (e2) {
      setError(
        e2.isAuth
          ? "Su sesión expiró. Vuelva a ingresar para crear la cuenta."
          : e2.isNetwork
            ? "No hay conexión con el servidor. Intente de nuevo."
            : e2.message || "No se pudo crear la cuenta."
      );
      setBusy(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      onKeyDown={onKeyDown}
    >
      <form
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-new-title"
        onSubmit={submit}
      >
        <header className={styles.modal__head}>
          <div>
            <h2 id="crm-new-title" className={styles.modal__title}>Nueva cuenta B2B</h2>
            <div className={styles.modal__sub}>
              Registre un cliente o prospecto que no proviene de MercadoLibre.
            </div>
          </div>
          <button type="button" className={styles.modal__close} onClick={close} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className={styles.modal__body}>
          {error && <p className={styles.formError} role="alert">{error}</p>}

          <label className={styles.field}>
            <span className={styles.field__label}>
              Razón social <span className={styles.field__req} aria-hidden="true">*</span>
            </span>
            <input
              ref={firstFieldRef}
              className={styles.input}
              value={form.legal_name}
              onChange={set("legal_name")}
              required
              maxLength={160}
              autoComplete="organization"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.field__label}>Nombre comercial</span>
            <input
              className={styles.input}
              value={form.display_name}
              onChange={set("display_name")}
              maxLength={160}
              placeholder="Si lo deja vacío se usa la razón social"
            />
          </label>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.field__label}>
                Segmento <span className={styles.field__req} aria-hidden="true">*</span>
              </span>
              <select className={styles.select} value={form.segment} onChange={set("segment")} required>
                <option value="">Seleccione…</option>
                {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>Etapa</span>
              <select className={styles.select} value={form.pipeline_stage} onChange={set("pipeline_stage")}>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>País</span>
              <select className={styles.select} value={form.country} onChange={set("country")}>
                {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>Ciudad</span>
              <input className={styles.input} value={form.city} onChange={set("city")} maxLength={80} />
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>Departamento o estado</span>
              <input className={styles.input} value={form.region} onChange={set("region")} maxLength={80} />
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>NIT o Tax ID</span>
              <input className={styles.input} value={form.tax_id} onChange={set("tax_id")} maxLength={40} />
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>Valor del pipeline (COP)</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="1000"
                inputMode="numeric"
                value={form.pipeline_value}
                onChange={set("pipeline_value")}
                placeholder="0"
              />
              <span className={styles.field__hint}>Negocio estimado, en pesos.</span>
            </label>

            <label className={styles.field}>
              <span className={styles.field__label}>Origen</span>
              <input
                className={styles.input}
                value={form.source}
                onChange={set("source")}
                maxLength={80}
                placeholder="Feria, referido, web…"
              />
            </label>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.fieldset__legend}>Contacto principal (opcional)</legend>
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span className={styles.field__label}>Nombre</span>
                <input
                  className={styles.input}
                  value={form.contact_full_name}
                  onChange={set("contact_full_name")}
                  maxLength={120}
                  autoComplete="name"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.field__label}>Cargo</span>
                <input
                  className={styles.input}
                  value={form.contact_role}
                  onChange={set("contact_role")}
                  maxLength={80}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.field__label}>Correo</span>
                <input
                  className={styles.input}
                  type="email"
                  value={form.contact_email}
                  onChange={set("contact_email")}
                  maxLength={160}
                  autoComplete="email"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.field__label}>Teléfono</span>
                <input
                  className={styles.input}
                  type="tel"
                  value={form.contact_phone}
                  onChange={set("contact_phone")}
                  maxLength={40}
                  autoComplete="tel"
                />
              </label>
            </div>
          </fieldset>

          <label className={styles.field}>
            <span className={styles.field__label}>Notas</span>
            <textarea
              className={styles.textarea}
              value={form.notes}
              onChange={set("notes")}
              maxLength={2000}
              rows={3}
            />
          </label>
        </div>

        <footer className={styles.modal__foot}>
          <button type="button" className={styles.btn} onClick={close} disabled={busy}>
            Cancelar
          </button>
          <button
            type="submit"
            className={[styles.btn, styles["btn--primary"]].join(" ")}
            disabled={busy}
          >
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </footer>
      </form>
    </div>
  );
}
