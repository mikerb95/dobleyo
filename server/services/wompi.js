// Servicio Wompi — API para pagos con fuente de pago (suscripciones recurrentes).
// Wompi no tiene suscripciones nativas: se tokeniza la tarjeta, se crea un
// payment_source y se cobra con transacciones contra ese payment_source_id.
// Docs: https://docs.wompi.co/docs/colombia/fuentes-de-pago/
import crypto from 'crypto';
import { logger } from '../logger.js';

const WOMPI_API_BASE = process.env.WOMPI_API_BASE || 'https://production.wompi.co';
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';

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
  return wompiFetch(`/v1/transactions/${id}`, { key: WOMPI_PRIVATE_KEY });
}

export const wompiConfig = {
  apiBase: WOMPI_API_BASE,
  publicKey: WOMPI_PUBLIC_KEY,
  configured: Boolean(WOMPI_PRIVATE_KEY && WOMPI_PUBLIC_KEY),
};
