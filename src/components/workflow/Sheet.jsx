// Hoja lateral donde se registra cada paso. En escritorio entra por la
// derecha sin tapar la bandeja; en celular ocupa la pantalla completa.

import React, { useEffect, useRef } from "react";
import s from "./workflow.module.css";

export function Sheet({ open, onClose, children, label }) {
  const ref = useRef(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={s.sheet}
      aria-label={label}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && children}
    </dialog>
  );
}

/** Encabezado del paso: el lote de contexto y el objetivo. */
export function StepHead({ lot, title, intro, onClose }) {
  return (
    <header className={s.sheetHead}>
      <div className={s.sheetHeadRow}>
        {lot ? <span className={s.sheetLot}>{lot}</span> : <span />}
        <button type="button" className={s.close} onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <h2 className={s.sheetTitle}>{title}</h2>
      {intro && <p className={s.sheetIntro}>{intro}</p>}
    </header>
  );
}

/**
 * Formulario del paso con pie fijo: la consecuencia de lo digitado ("quedarán
 * 12 kg en bodega") queda siempre a la vista junto al botón.
 */
export function StepForm({ head, children, consequence, error, submitLabel, busy, disabled, onSubmit, onCancel }) {
  return (
    <form
      className={s.sheetForm}
      noValidate
      onSubmit={(e) => { e.preventDefault(); if (!busy && !disabled) onSubmit(); }}
    >
      {head}
      <div className={s.sheetBody}>{children}</div>
      <footer className={s.sheetFoot}>
        {error && <p className={s.sheetError} role="alert">{error}</p>}
        {consequence && !error && <p className={s.consequence} aria-live="polite">{consequence}</p>}
        <div className={s.sheetActions}>
          <button type="button" className={s.btnGhost} onClick={onCancel}>Cancelar</button>
          <button type="submit" className={s.btnPrimary} disabled={busy || disabled} aria-busy={busy || undefined}>
            {busy ? "Guardando…" : submitLabel}
          </button>
        </div>
      </footer>
    </form>
  );
}

/** Sección con título dentro del formulario. */
export function Section({ title, children, aside }) {
  return (
    <section className={s.formSection}>
      <div className={s.formSectionHead}>
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
