// Servicio ePayco: Smart Checkout v2 (sesiones), confirmación de pagos y cobros
// recurrentes con tarjeta tokenizada.
//
// Docs: https://docs.epayco.com (Checkout > Implementación y Páginas de
// Respuesta y Confirmación). Los cobros con token usan la API que consume el
// SDK oficial (epayco-sdk-node): api.secure.payco.co.
//
// Regla de seguridad: la firma de la confirmación (x_signature) cubre la
// referencia, la transacción, el monto y la moneda, pero NO el estado del pago.
// Por eso el estado nunca se toma del cuerpo de la confirmación: siempre se
// vuelve a consultar la transacción en ePayco (fetchVerifiedTransaction).
import crypto from 'crypto';
import { logger } from '../logger.js';

const PUBLIC_KEY  = process.env.EPAYCO_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.EPAYCO_PRIVATE_KEY || '';
// "P_CUST_ID_CLIENTE" y "P_KEY" del panel de ePayco: firman las confirmaciones.
const CUSTOMER_ID = process.env.EPAYCO_CUSTOMER_ID || '';
const P_KEY       = process.env.EPAYCO_P_KEY || '';
const TEST        = String(process.env.EPAYCO_TEST || '').toLowerCase() === 'true';

const APIFY_BASE      = process.env.EPAYCO_APIFY_BASE || 'https://apify.epayco.co';
const SECURE_API_BASE = process.env.EPAYCO_SECURE_API_BASE || 'https://api.secure.payco.co';
const VALIDATION_BASE = process.env.EPAYCO_VALIDATION_BASE || 'https://secure.epayco.co/validation/v1/reference';

const TIMEOUT_MS = 12000;
const TOKEN_TTL_MS = 10 * 60 * 1000;

export const epaycoConfig = {
  publicKey: PUBLIC_KEY,
  test: TEST,
  configured: Boolean(PUBLIC_KEY && PRIVATE_KEY),
  canVerifySignature: Boolean(CUSTOMER_ID && P_KEY),
};

export class EpaycoError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'EpaycoError';
    this.status = status;
    this.body = body;
  }
}

async function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json == null) {
    logger.error({ status: res.status, url: url.split('?')[0] }, '[ePayco] Respuesta con error');
    throw new EpaycoError(`ePayco respondió ${res.status}`, { status: res.status, body: json });
  }
  return json;
}

// ─── Autenticación ─────────────────────────────────────────────────────────
// Dos API, dos tokens. Se guardan unos minutos para no pedir uno por petición.

const tokenCache = { apify: null, secure: null };

async function cachedToken(kind, load) {
  const hit = tokenCache[kind];
  if (hit && hit.expiresAt > Date.now()) return hit.token;
  const token = await load();
  if (!token) throw new EpaycoError('ePayco no entregó un token de acceso');
  tokenCache[kind] = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

function apifyToken() {
  return cachedToken('apify', async () => {
    const basic = Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString('base64');
    const json = await requestJson(`${APIFY_BASE}/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
    });
    return json.token;
  });
}

function secureToken() {
  return cachedToken('secure', async () => {
    const json = await requestJson(`${SECURE_API_BASE}/v1/auth/login`, {
      method: 'POST',
      body: { public_key: PUBLIC_KEY, private_key: PRIVATE_KEY },
    });
    return json.bearer_token || json.token;
  });
}

// ─── Smart Checkout v2 ─────────────────────────────────────────────────────

// Tipos de documento del checkout del sitio → los de ePayco.
const DOC_TYPE = { CC: 'CC', CE: 'CE', NI: 'NIT', TI: 'TI', PA: 'PPN' };

function billingFor({ email, name, address, docType, docNumber, phone }) {
  const billing = {};
  if (email) billing.email = email;
  if (name) billing.name = name;
  if (address) billing.address = address;
  if (docNumber && DOC_TYPE[docType]) {
    billing.typeDoc = DOC_TYPE[docType];
    billing.numberDoc = String(docNumber);
  }
  // Solo celulares colombianos: con otro indicativo no se envía para que un
  // formato inesperado no haga fallar la sesión.
  const digits = String(phone || '').replace(/\D/g, '');
  const local = digits.startsWith('57') && digits.length === 12 ? digits.slice(2) : digits;
  if (/^3\d{9}$/.test(local)) {
    billing.callingCode = '+57';
    billing.mobilePhone = local;
  }
  return billing;
}

/**
 * Crea la sesión de pago. El navegador solo recibe el sessionId: monto,
 * referencia y URL de confirmación quedan fijados aquí, en el servidor.
 *
 * @returns {Promise<string>} sessionId
 */
export async function createCheckoutSession({ reference, amount, description, lang = 'es', responseUrl, confirmationUrl, customer = {} }) {
  if (!epaycoConfig.configured) throw new EpaycoError('ePayco no configurado');

  const base = {
    checkout_version: '2',
    name: 'DobleYo Café',
    description: String(description || `Pedido ${reference}`).slice(0, 200),
    currency: 'COP',
    amount,
    // No responsable de IVA: sin base ni impuesto.
    taxBase: 0,
    tax: 0,
    taxIco: 0,
    lang: lang === 'en' ? 'EN' : 'ES',
    country: 'CO',
    invoice: reference,
    response: responseUrl,
    confirmation: confirmationUrl,
    method: 'POST',
    // La referencia viaja también en extra1 por si el invoice no vuelve.
    extras: { extra1: reference },
  };
  const billing = billingFor(customer);

  const create = async (body) => {
    const token = await apifyToken();
    const json = await requestJson(`${APIFY_BASE}/payment/session/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const sessionId = json?.data?.sessionId;
    if (!json?.success || !sessionId) {
      throw new EpaycoError(json?.textResponse || 'ePayco no creó la sesión de pago', { body: json });
    }
    return String(sessionId);
  };

  if (!Object.keys(billing).length) return create(base);
  try {
    return await create({ ...base, billing });
  } catch (err) {
    // Si los datos del comprador no pasan la validación de ePayco, el pago no
    // se bloquea: el cliente los completa en el checkout.
    logger.warn({ err: err.message, reference }, '[ePayco] Sesión rechazada con datos de facturación; se reintenta sin ellos');
    return create(base);
  }
}

// ─── Confirmación y consulta de transacciones ──────────────────────────────

/**
 * Firma de la confirmación:
 * SHA256(p_cust_id_cliente^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code)
 */
export function verifyConfirmationSignature(p) {
  if (!epaycoConfig.canVerifySignature || !p?.x_signature) return false;
  const expected = crypto
    .createHash('sha256')
    .update(`${CUSTOMER_ID}^${P_KEY}^${p.x_ref_payco}^${p.x_transaction_id}^${p.x_amount}^${p.x_currency_code}`, 'utf8')
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(p.x_signature).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Estados de ePayco → vocabulario interno (el mismo de Wompi, que ya entiende
// orderPayments.js): APPROVED | DECLINED | VOIDED | PENDING | ERROR.
const STATUS_BY_CODE = {
  1: 'APPROVED',  // Aceptada
  2: 'DECLINED',  // Rechazada
  3: 'PENDING',   // Pendiente
  4: 'ERROR',     // Fallida
  6: 'VOIDED',    // Reversada
  7: 'PENDING',   // Retenida
  8: 'PENDING',   // Iniciada
  9: 'DECLINED',  // Expirada
  10: 'DECLINED', // Abandonada
  11: 'DECLINED', // Cancelada
};
const STATUS_BY_TEXT = {
  aceptada: 'APPROVED', aprobada: 'APPROVED',
  rechazada: 'DECLINED', expirada: 'DECLINED', abandonada: 'DECLINED', cancelada: 'DECLINED',
  pendiente: 'PENDING', retenida: 'PENDING', iniciada: 'PENDING',
  fallida: 'ERROR',
  reversada: 'VOIDED',
};

export function epaycoStatus(code, text) {
  const byCode = STATUS_BY_CODE[Number(code)];
  if (byCode) return byCode;
  return STATUS_BY_TEXT[String(text || '').trim().toLowerCase()] || 'ERROR';
}

const isTrue = (v) => v === true || ['true', '1'].includes(String(v ?? '').toLowerCase());

/**
 * Lleva los campos x_* de ePayco a la forma que consume applyPaymentTransaction
 * (la misma de una transacción de Wompi).
 */
export function normalizeEpaycoTransaction(d) {
  if (!d || typeof d !== 'object') return null;
  const id = d.x_ref_payco ?? d.ref_payco;
  if (id == null || id === '') return null;
  const amount = Number(d.x_amount);
  return {
    provider: 'epayco',
    id: String(id),
    reference: String(d.x_id_invoice || d.x_extra1 || ''),
    status: epaycoStatus(d.x_cod_response ?? d.x_cod_transaction_state, d.x_response ?? d.x_transaction_state),
    amount_in_cents: Number.isFinite(amount) ? Math.round(amount * 100) : NaN,
    currency: d.x_currency_code ? String(d.x_currency_code).toUpperCase() : undefined,
    payment_method_type: d.x_franchise ? String(d.x_franchise) : 'epayco',
    test: isTrue(d.x_test_request),
    raw: d,
  };
}

const REF_PAYCO_RE = /^[A-Za-z0-9]{4,40}$/;
export const isEpaycoRef = (v) => REF_PAYCO_RE.test(String(v ?? '')) && !/^\d+-\d+-\d+$/.test(String(v));

/**
 * Consulta una transacción en ePayco por su ref_payco y la devuelve
 * normalizada. Es la ÚNICA fuente del estado de un pago de ePayco.
 *
 * Devuelve null si no existe o si es una transacción de prueba con el sitio en
 * producción (cualquiera puede abrir el checkout en modo de pruebas y "pagar"
 * con una tarjeta de prueba). Lanza si ePayco no responde.
 */
export async function fetchVerifiedTransaction(refPayco) {
  if (!isEpaycoRef(refPayco)) return null;
  const json = await requestJson(`${VALIDATION_BASE}/${encodeURIComponent(refPayco)}`);
  if (!json?.success || !json.data) return null;

  const tx = normalizeEpaycoTransaction(json.data);
  if (!tx) return null;
  if (tx.test && !TEST) {
    logger.warn({ refPayco, reference: tx.reference }, '[ePayco] Transacción de PRUEBA recibida en producción; se ignora');
    return null;
  }
  return tx;
}

// ─── Cobros recurrentes (suscripciones) ────────────────────────────────────
// La tarjeta se tokeniza en el navegador (epayco.min.js): nunca pasa por este
// servidor. Aquí se asocia el token a un cliente y se cobra contra él.

async function securePost(path, data) {
  const token = await secureToken();
  const json = await requestJson(`${SECURE_API_BASE}${path}`, {
    method: 'POST',
    // Mismas cabeceras que el SDK oficial.
    headers: { Authorization: `Bearer ${token}`, type: 'sdk-jwt', lang: 'NODE' },
    body: { ...data, test: TEST ? 'TRUE' : 'FALSE' },
  });
  return json;
}

const failureMessage = (json) =>
  json?.data?.description || json?.data?.errors?.[0]?.errorMessage || json?.message || json?.text_response || 'ePayco rechazó la operación';

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { name: parts[0] || 'Cliente', last_name: parts[0] || 'Cliente' };
  const cut = parts.length > 2 ? Math.ceil(parts.length / 2) : 1;
  return { name: parts.slice(0, cut).join(' '), last_name: parts.slice(cut).join(' ') };
}

/** Crea el cliente en ePayco con la tarjeta tokenizada como predeterminada. @returns {Promise<string>} customerId */
export async function createCardCustomer({ tokenCard, fullName, email, city, address, phone, ip }) {
  const json = await securePost('/payment/v1/customer/create', {
    token_card: tokenCard,
    ...splitName(fullName),
    email,
    default: true,
    city: city || undefined,
    address: address || undefined,
    phone: phone || undefined,
    cell_phone: phone || undefined,
    ip: ip || undefined,
  });
  const customerId = json?.data?.customerId || json?.data?.customer_id || json?.customerId;
  if (!customerId || json?.status === false || json?.success === false) {
    throw new EpaycoError(failureMessage(json), { body: json });
  }
  return String(customerId);
}

/**
 * Cobra contra la tarjeta guardada de un cliente. Devuelve la transacción
 * normalizada: { id (ref_payco), status, reference, amount_in_cents, ... }.
 */
export async function chargeCardCustomer({
  tokenCard, customerId, docType, docNumber, fullName, email, city, address, phone,
  reference, description, amountCop, ip, responseUrl, confirmationUrl,
}) {
  const json = await securePost('/payment/v1/charge/create', {
    token_card: tokenCard,
    customer_id: customerId,
    doc_type: DOC_TYPE[docType] || 'CC',
    doc_number: String(docNumber || ''),
    ...splitName(fullName),
    email,
    city: city || undefined,
    address: address || undefined,
    phone: phone || undefined,
    cell_phone: phone || undefined,
    bill: reference,
    description: String(description || reference).slice(0, 200),
    value: String(amountCop),
    tax: '0',
    tax_base: '0',
    currency: 'COP',
    dues: '1',
    ip: ip || '127.0.0.1',
    url_response: responseUrl,
    url_confirmation: confirmationUrl,
    method_confirmation: 'POST',
    use_default_card_customer: true,
    extras: { extra1: reference },
  });

  const d = json?.data;
  if (!d || typeof d !== 'object' || json?.status === false || json?.success === false) {
    throw new EpaycoError(failureMessage(json), { body: json });
  }
  const id = d.ref_payco ?? d.x_ref_payco;
  if (id == null) throw new EpaycoError(failureMessage(json), { body: json });

  return {
    provider: 'epayco',
    id: String(id),
    reference,
    status: epaycoStatus(d.cod_respuesta ?? d.x_cod_response, d.estado ?? d.x_response),
    amount_in_cents: amountCop * 100,
    currency: 'COP',
    payment_method_type: d.franquicia || d.x_franchise || 'epayco',
    raw: d,
  };
}
