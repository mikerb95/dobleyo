// Servicio Wompi — API para pagos con fuente de pago (suscripciones recurrentes).
// Wompi no tiene suscripciones nativas: se tokeniza la tarjeta, se crea un
// payment_source y se cobra con transacciones contra ese payment_source_id.
// Docs: https://docs.wompi.co/docs/colombia/fuentes-de-pago/
import crypto from 'crypto';
import { logger } from '../logger.js';

const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
// Con llaves de prueba (pub_test_) la API es la de sandbox, salvo que se indique otra.
const WOMPI_API_BASE = process.env.WOMPI_API_BASE
  || (WOMPI_PUBLIC_KEY.startsWith('pub_test_') ? 'https://sandbox.wompi.co' : 'https://production.wompi.co');
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';

/** Firma de integridad: SHA256(reference + amountInCents + currency + integritySecret). */
export function integrityHash(reference, amountCents, currency = 'COP') {
  return crypto
    .createHash('sha256')
    .update(`${reference}${amountCents}${currency}${WOMPI_INTEGRITY_SECRET}`, 'utf8')
    .digest('hex');
}

async function wompiFetch(path, { method = 'GET', key = WOMPI_PRIVATE_KEY, body } = {}) {
  const res = await fetch(`${WOMPI_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    // Sin tope, una API colgada dejaría colgado el webhook o el checkout.
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ status: res.status, path, error: json?.error }, '[Wompi API] Error');
    const err = new Error(json?.error?.reason || json?.error?.messages || `Wompi ${res.status}`);
    err.wompi = json?.error;
    err.status = res.status;
    throw err;
  }
  return json.data;
}

/**
 * Obtiene los tokens de aceptación vigentes del comercio.
 * Necesarios para crear una fuente de pago. Usa la public key.
 */
export async function getAcceptanceTokens() {
  const data = await wompiFetch(`/v1/merchants/${WOMPI_PUBLIC_KEY}`, { key: WOMPI_PUBLIC_KEY });
  return {
    acceptance_token: data?.presigned_acceptance?.acceptance_token ?? null,
    accept_personal_auth: data?.presigned_personal_data_auth?.acceptance_token ?? null,
    permalink: data?.presigned_acceptance?.permalink ?? null,
  };
}

/**
 * Crea una fuente de pago (tarjeta tokenizada) para cobros recurrentes.
 * @returns {Promise<object>} payment source con { id, status, ... }
 */
export async function createCardPaymentSource({ cardToken, customerEmail, acceptanceToken, acceptPersonalAuth }) {
  return wompiFetch('/v1/payment_sources', {
    method: 'POST',
    body: {
      type: 'CARD',
      token: cardToken,
      customer_email: customerEmail,
      acceptance_token: acceptanceToken,
      accept_personal_auth: acceptPersonalAuth,
    },
  });
}

/**
 * Cobra una transacción contra una fuente de pago existente (sin cliente presente).
 * @returns {Promise<object>} transacción con { id, status, ... }
 */
export async function chargePaymentSource({ amountCents, customerEmail, reference, paymentSourceId, installments = 1 }) {
  return wompiFetch('/v1/transactions', {
    method: 'POST',
    body: {
      amount_in_cents: amountCents,
      currency: 'COP',
      customer_email: customerEmail,
      reference,
      payment_source_id: paymentSourceId,
      payment_method: { installments },
      recurrent: true,
      signature: integrityHash(reference, amountCents, 'COP'),
    },
  });
}

/** Consulta el estado de una transacción. */
export async function getTransaction(id) {
  return wompiFetch(`/v1/transactions/${encodeURIComponent(id)}`, { key: WOMPI_PRIVATE_KEY || WOMPI_PUBLIC_KEY });
}

/**
 * Transacciones registradas en Wompi para una referencia de pago (requiere la
 * llave privada). Sirve para conciliar pedidos cuyo evento nunca llegó.
 * @returns {Promise<object[]>}
 */
export async function findTransactionsByReference(reference) {
  if (!WOMPI_PRIVATE_KEY) return [];
  const data = await wompiFetch(`/v1/transactions?reference=${encodeURIComponent(reference)}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Verifica la firma de un evento (webhook) de Wompi.
 * checksum = SHA256( valores_de_properties (en orden) + timestamp + eventsSecret ).
 * `properties` son rutas relativas a `data`, p. ej. "transaction.id": la firma
 * queda atada al contenido del evento, no solo al timestamp.
 * https://docs.wompi.co/docs/colombia/eventos/
 */
export function verifyEventSignature(event) {
  const checksum = event?.signature?.checksum;
  const properties = event?.signature?.properties;
  const tsStr = event?.timestamp;
  if (!checksum || !tsStr || !Array.isArray(properties)) return false;

  const concatenated = properties
    .map((path) => String(path).split('.').reduce((obj, key) => obj?.[key], event.data))
    .map((v) => (v == null ? '' : String(v)))
    .join('');

  const expected = crypto
    .createHash('sha256')
    .update(`${concatenated}${tsStr}${WOMPI_EVENTS_SECRET}`, 'utf8')
    .digest('hex');

  // Comparación en tiempo constante para evitar timing attacks.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(checksum), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const wompiConfig = {
  apiBase: WOMPI_API_BASE,
  publicKey: WOMPI_PUBLIC_KEY,
  configured: Boolean(WOMPI_PRIVATE_KEY && WOMPI_PUBLIC_KEY),
  // Consultar una transacción por id solo necesita la llave pública.
  canQuery: Boolean(WOMPI_PRIVATE_KEY || WOMPI_PUBLIC_KEY),
  eventsSecret: WOMPI_EVENTS_SECRET,
};
