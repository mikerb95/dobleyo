/**
 * Calendario de una suscripción de café, sin DOM (lo usan el servidor y el
 * navegador). Refleja cómo cobra el backend (server/routes/subscriptions.js):
 * el primer cobro es el día de la suscripción y cada cobro aprobado crea un
 * pedido; el siguiente queda `frequency_days` después.
 */

export const SUBSCRIPTION_FREQUENCIES = [15, 30] as const;

/** Días (desde hoy) en que sale un pedido dentro del horizonte, empezando en 0. */
export function orderDays(frequencyDays: number, horizonDays = 90): number[] {
  const freq = Math.floor(frequencyDays);
  if (!Number.isFinite(freq) || freq < 1) return [0];
  const days: number[] = [];
  for (let d = 0; d <= horizonDays; d += freq) days.push(d);
  return days;
}

/** Fecha del pedido a `days` días de `start`, en fecha local (sin hora). */
export function addDays(start: Date, days: number): Date {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  d.setDate(d.getDate() + days);
  return d;
}
