// Piezas comunes de las herramientas del asistente.
//
// Reglas (skill `panel-ia`, docs/plan-asistente.md):
//  - Columnas nombradas en cada SELECT (nunca `select *`): lo que no se nombra
//    no viaja a la API.
//  - Dinero ya sumado y formateado: { valor, moneda, texto }. El modelo cita
//    `texto` y no hace cuentas.
//  - Fechas en hora de Colombia (AAAA-MM-DD).
//  - Texto escrito por clientes dentro de `escritoPorTerceros`, limpio y
//    recortado.
//  - Una herramienta nunca lanza: devuelve { ok: false, error }.

import { query } from '../../../db.js';
import { logger } from '../../../logger.js';
import { textoSeguro } from '../limpieza.js';

export const ZONA = 'America/Bogota';

/** @returns {{ ok: true, datos: unknown }} */
export const ok = (datos) => ({ ok: true, datos });
/** @returns {{ ok: false, error: string }} */
export const fallo = (error) => ({ ok: false, error });

const MILES = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Monto en pesos ya redondeado y con su texto: el modelo cita `texto`. */
export function dinero(valor) {
  const n = Math.round(Number(valor) || 0);
  return { valor: n, moneda: 'COP', texto: `$${MILES.format(n)}` };
}

/** Número de kilos con hasta 2 decimales, para no mandar ruido de coma flotante. */
export const kg = (n) => (n == null ? null : Math.round(Number(n) * 100) / 100);

/** Convierte una fecha de SQLite ('AAAA-MM-DD HH:MM:SS', UTC) a Date. */
export function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const s = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** AAAA-MM-DD en hora de Colombia. */
export function fecha(valor) {
  const d = aFecha(valor);
  return d ? DIA.format(d) : null;
}

/** Hoy en Colombia (AAAA-MM-DD). */
export const hoy = (ahora = new Date()) => DIA.format(ahora);

/** Primer día del mes en curso en Colombia. */
export const inicioDeMes = (ahora = new Date()) => `${hoy(ahora).slice(0, 8)}01`;

/** Días completos entre una fecha y ahora. */
export function diasDesde(valor, ahora = new Date()) {
  const d = aFecha(valor);
  return d ? Math.floor((ahora.getTime() - d.getTime()) / 86_400_000) : null;
}

/**
 * Límite de UTC para comparar con columnas `datetime('now')`: el día AAAA-MM-DD
 * de Colombia empieza a las 05:00 UTC.
 */
export const desdeUtc = (dia) => `${dia} 05:00:00`;
export function hastaUtc(dia) {
  const d = new Date(`${dia}T05:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Consulta tolerante: una tabla o columna que aún no existe devuelve []. */
export async function filas(sql, args = []) {
  try {
    const { rows } = await query(sql, args);
    return rows;
  } catch (err) {
    if (/no such table|no such column/i.test(err.message)) return [];
    throw err;
  }
}

/** Texto de un tercero, listo para la API. */
export const deTercero = (texto, max = 600) => textoSeguro(texto, max);

/** Ejecuta la herramienta sin dejar escapar excepciones. */
export function seguro(nombre, fn) {
  return async (args, ctx) => {
    try {
      return await fn(args ?? {}, ctx);
    } catch (err) {
      logger.error({ err, herramienta: nombre }, '[asistente] Error en herramienta');
      return fallo(`No se pudo consultar (${nombre}). Intente de nuevo en un momento.`);
    }
  };
}

export const ESTADO_PEDIDO = {
  pending_payment: 'Pendiente de pago',
  paid: 'Pagado',
  processing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export const ESTADO_ENVIO = {
  created: 'Guía creada',
  pending: 'Pendiente',
  in_transit: 'En tránsito',
  delivered: 'Entregado',
  returned: 'Devuelto',
  cancelled: 'Cancelado',
  error: 'Con error',
};

/** Estados en los que un pedido ya cuenta como venta. */
export const ESTADOS_VENDIDOS = ['paid', 'processing', 'shipped', 'delivered'];
