// Fecha editable para los registros de producción.
//
// Los pasos del pipeline (cosecha, almacenamiento, tostión, empaque) suelen
// digitarse días después de haber ocurrido. Estas utilidades convierten la
// fecha que digita el operario en el formato que usa SQLite para created_at
// (`YYYY-MM-DD HH:MM:SS` en UTC, igual que `datetime('now')`).

/** Días hacia atrás permitidos al retrodatar un registro. */
export const MAX_BACKDATE_DAYS = 730;

function dateError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Normaliza la fecha de un registro de producción.
 *
 * Acepta `YYYY-MM-DD` (input date del formulario) o un ISO completo
 * (cola offline de la app móvil). Devuelve `null` cuando no se envía nada,
 * para que la consulta caiga en `datetime('now')`.
 *
 * A las fechas sin hora se les asigna el mediodía UTC, de modo que al
 * renderizarlas en zona horaria colombiana sigan cayendo en el mismo día.
 * Si la fecha es la de hoy, se conserva la hora real del registro.
 *
 * @param {string|Date|null|undefined} value
 * @returns {string|null} `YYYY-MM-DD HH:MM:SS` en UTC, o `null`
 */
export function resolveRecordedAt(value) {
  if (value == null || value === '') return null;

  const now = new Date();
  let stamp;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw dateError('Fecha de registro inválida');
    stamp = value;
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const day = value.trim();
    const todayUtc = now.toISOString().slice(0, 10);
    const time = day === todayUtc ? now.toISOString().slice(11, 19) : '12:00:00';
    stamp = new Date(`${day}T${time}Z`);
    if (Number.isNaN(stamp.getTime())) throw dateError('Fecha de registro inválida');
  } else if (typeof value === 'string') {
    stamp = new Date(value.trim());
    if (Number.isNaN(stamp.getTime())) throw dateError('Fecha de registro inválida');
  } else {
    throw dateError('Fecha de registro inválida');
  }

  // Tolerancia de un día: el navegador puede ir adelante de UTC según la zona.
  const maxAhead = now.getTime() + 24 * 60 * 60 * 1000;
  if (stamp.getTime() > maxAhead) {
    throw dateError('La fecha de registro no puede ser futura');
  }

  const minAllowed = now.getTime() - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000;
  if (stamp.getTime() < minAllowed) {
    throw dateError(`La fecha de registro no puede ser anterior a ${MAX_BACKDATE_DAYS} días`);
  }

  const iso = stamp.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/**
 * Fecha (solo día, `YYYY-MM-DD`) derivada de una fecha de registro ya
 * normalizada. Útil para columnas DATE como `storage_date`.
 */
export function recordedDay(recordedAt) {
  return recordedAt ? recordedAt.slice(0, 10) : null;
}
