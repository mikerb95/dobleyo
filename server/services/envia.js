import { logger } from '../logger.js';

/**
 * Cliente del API de Envia.com (agregador de transportadoras, docs.envia.com).
 * Autenticación con Bearer token creado en Developer → API Keys del panel de
 * Envia. El token de sandbox solo sirve en sandbox y viceversa: ENVIA_ENV elige
 * los hosts (por defecto sandbox, como Inter, para no generar guías reales).
 *
 * Particularidades de Colombia según la documentación:
 * - `city` y `postalCode` llevan el código DANE de 8 dígitos (11001000 = Bogotá).
 * - `state` es el código de 2 letras de Envia (DC, AN, VC...), que se deriva de
 *   los dos primeros dígitos del DANE.
 * - /ship/rate/ exige `shipment.carrier`, así que se cotiza una vez por
 *   transportadora (ENVIA_CARRIERS) y se juntan las ofertas.
 */

const IS_PRODUCTION = process.env.ENVIA_ENV === 'production';
const API_URL = process.env.ENVIA_API_URL || (IS_PRODUCTION ? 'https://api.envia.com' : 'https://api-test.envia.com');
const QUERIES_URL = process.env.ENVIA_QUERIES_URL || (IS_PRODUCTION ? 'https://queries.envia.com' : 'https://queries.test.envia.com');
const TOKEN = process.env.ENVIA_TOKEN;

const DEFAULT_CARRIERS = ['coordinadora', 'servientrega', 'interrapidisimo', 'tcc', 'deprisa'];

// Tipo de webhook "onShipmentStatusUpdate" (GET /webhook-types).
const WEBHOOK_TYPE_STATUS_UPDATE = 1;

export class EnviaConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EnviaConfigError';
    }
}

export class EnviaError extends Error {
    constructor(message, { status, body, retriable = false } = {}) {
        super(message);
        this.name = 'EnviaError';
        this.status = status;
        this.body = body;
        this.retriable = retriable;
    }
}

export function isEnviaConfigured() {
    return Boolean(TOKEN);
}

function assertConfigured() {
    if (!isEnviaConfigured()) {
        throw new EnviaConfigError(
            'ENVIA_TOKEN no está configurado. Créelo en Envia.com → Developer → API Keys.'
        );
    }
}

export function enviaCarriers() {
    const list = String(process.env.ENVIA_CARRIERS || '')
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
    return list.length ? list : DEFAULT_CARRIERS;
}

async function enviaFetch(url, { method = 'GET', body, timeoutMs = 20000 } = {}) {
    assertConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${TOKEN}`,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }

        // Envia a veces responde 200 con { meta: 'error', error: { message } }.
        const apiError = typeof data === 'object' && data?.meta === 'error';
        if (!res.ok || apiError) {
            logger.error({ url, status: res.status, body: data }, '[Envia] Error de API');
            const detail = typeof data === 'object'
                ? (data?.error?.message || data?.error?.description || data?.message)
                : data;
            throw new EnviaError(`Envia.com respondió ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`, {
                status: res.status, body: data, retriable: res.status >= 500,
            });
        }
        return data;
    } catch (err) {
        if (err.name === 'AbortError') throw new EnviaError('Timeout al contactar Envia.com', { retriable: true });
        if (err instanceof EnviaError || err instanceof EnviaConfigError) throw err;
        throw new EnviaError(err.message, { retriable: true });
    } finally {
        clearTimeout(timeout);
    }
}

// ─── Direcciones ────────────────────────────────────────────────────────────

// Prefijo DANE del departamento → código de estado de Envia (GET /state?country_code=CO).
const DANE_TO_STATE = {
    '05': 'AN', '08': 'AT', '11': 'DC', '13': 'BL', '15': 'BY', '17': 'CL', '18': 'CA',
    '19': 'CU', '20': 'CE', '23': 'CO', '25': 'CN', '27': 'CH', '41': 'HU', '44': 'LG',
    '47': 'MA', '50': 'ME', '52': 'NA', '54': 'NS', '63': 'QU', '66': 'RI', '68': 'SN',
    '70': 'SU', '73': 'TO', '76': 'VC', '81': 'AR', '85': 'CS', '86': 'PU', '88': 'SA',
    '91': 'AM', '94': 'GU', '95': 'GA', '97': 'VA', '99': 'VI',
};

/** DANE de municipio (5 dígitos) o de centro poblado (8) → 8 dígitos. */
export function normalizeDane(code) {
    const digits = String(code || '').replace(/\D/g, '');
    if (digits.length === 5) return `${digits}000`;
    return digits;
}

export function stateForDane(code) {
    return DANE_TO_STATE[normalizeDane(code).slice(0, 2)] || null;
}

function buildAddress({ name, company, email, phone, street, daneCode, identificationNumber, reference }) {
    const dane = normalizeDane(daneCode);
    return {
        name: String(name || '').slice(0, 60),
        company: company ? String(company).slice(0, 60) : '',
        email: email || '',
        phone_code: 'CO',
        phone: String(phone || '').replace(/\D/g, '').slice(-10),
        street: String(street || '').slice(0, 120),
        number: '',
        district: '',
        city: dane,
        state: stateForDane(dane),
        country: 'CO',
        postalCode: dane,
        reference: reference ? String(reference).slice(0, 120) : '',
        identificationNumber: identificationNumber ? String(identificationNumber).trim() : '',
    };
}

/** Remitente fijo de la tienda (variables ENVIA_SENDER_*). */
export function enviaOrigin(originDaneCode) {
    return buildAddress({
        name: process.env.ENVIA_SENDER_NAME || 'DobleYo Café',
        company: process.env.ENVIA_SENDER_COMPANY || 'DobleYo Café',
        email: process.env.ENVIA_SENDER_EMAIL || '',
        phone: process.env.ENVIA_SENDER_PHONE || '',
        street: process.env.ENVIA_SENDER_ADDRESS || '',
        daneCode: originDaneCode,
        identificationNumber: process.env.ENVIA_SENDER_NIT || '',
    });
}

export function enviaDestination(receiver) {
    return buildAddress(receiver);
}

function buildPackage({ weightKg, width, length, height, declaredValue, contents, codAmount }) {
    const pkg = {
        type: 'box',
        content: String(contents || 'Café').slice(0, 50),
        amount: 1,
        declaredValue: Math.round(declaredValue),
        lengthUnit: 'CM',
        weightUnit: 'KG',
        weight: weightKg,
        dimensions: { length, width, height },
    };
    if (codAmount > 0) {
        pkg.additionalServices = [{ service: 'cash_on_delivery', data: { amount: Math.round(codAmount) } }];
    }
    return pkg;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * Cotiza con todas las transportadoras de ENVIA_CARRIERS en paralelo. Una
 * transportadora sin cobertura o caída no tumba la cotización; solo se lanza
 * error si fallan todas. Devuelve el mismo formato que usa el panel con
 * Mipaquete/Inter (deliveryCompanyId, deliveryCompanyName, shippingCost,
 * shippingTime en minutos).
 */
export async function quoteEnvia({ originDaneCode, destinyDaneCode, weightKg, width, length, height, declaredValue, codAmount = 0 }) {
    assertConfigured();
    const base = {
        origin: enviaOrigin(originDaneCode),
        // Para cotizar basta la ciudad; nombre y dirección se completan al generar.
        destination: buildAddress({ name: 'Destinatario', phone: '3000000000', street: 'Por definir', daneCode: destinyDaneCode }),
        packages: [buildPackage({ weightKg, width, length, height, declaredValue, codAmount })],
        settings: { currency: 'COP' },
    };

    const carriers = enviaCarriers();
    const results = await Promise.allSettled(carriers.map((carrier) =>
        enviaFetch(`${API_URL}/ship/rate/`, {
            method: 'POST',
            body: { ...base, shipment: { type: 1, reverse_pickup: 0, import: 0, carrier } },
        })
    ));

    if (results.every((r) => r.status === 'rejected')) throw results[0].reason;
    results.forEach((r, i) => {
        if (r.status === 'rejected') logger.warn({ carrier: carriers[i], err: r.reason?.message }, '[Envia] Sin tarifa para esta transportadora');
    });

    return results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => normalizeEnviaRates(r.value));
}

export function normalizeEnviaRates(data) {
    const list = Array.isArray(data?.data) ? data.data : [];
    return list
        .filter((q) => q && q.carrier && q.service && Number(q.totalPrice) > 0)
        .map((q) => ({
            provider: 'envia',
            carrier: q.carrier,
            service: q.service,
            deliveryCompanyId: `envia:${q.carrier}:${q.service}`,
            deliveryCompanyName: `${q.carrierDescription || q.carrier} · ${q.serviceDescription || q.service}`.trim(),
            shippingCost: Math.round(Number(q.totalPrice)),
            codCost: Math.round(Number(q.cashOnDeliveryCommission) || 0),
            shippingTime: (Number(q.deliveryDate?.dateDifference) || 0) * 24 * 60,
            estimatedDelivery: q.deliveryDate?.date || null,
            message: q.deliveryEstimate || null,
        }));
}

/** `envia:coordinadora:ground` → { carrier, service }. */
export function parseEnviaCompanyId(deliveryCompanyId) {
    const [prefix, carrier, ...rest] = String(deliveryCompanyId || '').split(':');
    if (prefix !== 'envia' || !carrier || !rest.length) return null;
    return { carrier, service: rest.join(':') };
}

/**
 * Genera la guía. A diferencia de Mipaquete, la respuesta trae número de guía,
 * URL del PDF (`label`) y URL de rastreo en la misma llamada.
 */
export async function createEnviaLabel({
    carrier, service, originDaneCode, receiver, weightKg, width, length, height,
    declaredValue, contents, codAmount = 0, comments,
}) {
    const data = await enviaFetch(`${API_URL}/ship/generate/`, {
        method: 'POST',
        timeoutMs: 30000,
        body: {
            origin: enviaOrigin(originDaneCode),
            destination: enviaDestination(receiver),
            packages: [buildPackage({ weightKg, width, length, height, declaredValue, contents, codAmount })],
            settings: {
                currency: 'COP',
                printFormat: 'PDF',
                printSize: process.env.ENVIA_PRINT_SIZE || 'STOCK_4X6',
                comments: comments ? String(comments).slice(0, 200) : undefined,
            },
            shipment: { type: 1, reverse_pickup: 0, import: 0, carrier, service },
        },
    });
    const label = Array.isArray(data?.data) ? data.data[0] : null;
    if (!label?.trackingNumber) {
        throw new EnviaError('Envia.com no devolvió número de guía', { body: data });
    }
    return {
        trackingNumber: String(label.trackingNumber),
        labelUrl: label.label || null,
        trackUrl: label.trackUrl || null,
        totalPrice: Math.round(Number(label.totalPrice) || 0) || null,
        carrier: label.carrier || carrier,
        service: label.service || service,
    };
}

/**
 * Fecha de recogida: hoy si es antes de mediodía (hora Colombia), si no el
 * siguiente día hábil. Los domingos no hay recogidas.
 */
export function nextPickupDate(now = new Date()) {
    const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const date = new Date(Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate()));
    if (bogota.getUTCHours() >= 12) date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

/** Programa la recogida de una o varias guías de la misma transportadora. */
export async function requestEnviaPickup({ carrier, trackingNumbers, originDaneCode, totalWeightKg, totalPackages }) {
    const date = nextPickupDate();
    const data = await enviaFetch(`${API_URL}/ship/pickup/`, {
        method: 'POST',
        body: {
            origin: enviaOrigin(originDaneCode),
            shipment: {
                type: 1,
                carrier,
                pickup: {
                    weightUnit: 'KG',
                    totalWeight: totalWeightKg,
                    totalPackages,
                    date,
                    timeFrom: Number(process.env.ENVIA_PICKUP_FROM) || 9,
                    timeTo: Number(process.env.ENVIA_PICKUP_TO) || 17,
                    carrier,
                    trackingNumbers,
                },
            },
        },
    });
    const result = Array.isArray(data?.data) ? data.data[0] : data?.data;
    const confirmation = result?.confirmation || result?.pickupNumber || result?.folio || null;
    return { confirmation: confirmation ? String(confirmation) : null, date };
}

/** Estado y eventos de varias guías. Devuelve Map(trackingNumber → guía). */
export async function trackEnvia(trackingNumbers) {
    const data = await enviaFetch(`${API_URL}/ship/generaltrack/`, {
        method: 'POST',
        body: { trackingNumbers: trackingNumbers.map(String) },
    });
    const result = new Map();
    for (const guide of Array.isArray(data?.data) ? data.data : []) {
        if (guide?.trackingNumber) result.set(String(guide.trackingNumber), guide);
    }
    return result;
}

/** Anula la guía y solicita el reembolso del saldo. Falla si ya fue recogida. */
export async function cancelEnviaLabel({ carrier, trackingNumber }) {
    const data = await enviaFetch(`${API_URL}/ship/cancel/`, {
        method: 'POST',
        body: { carrier, trackingNumber: String(trackingNumber) },
    });
    return data?.data || null;
}

/** Suscribe la URL al webhook de cambios de estado. */
export async function registerEnviaWebhook(url) {
    const data = await enviaFetch(`${QUERIES_URL}/webhooks`, {
        method: 'POST',
        body: { type_id: WEBHOOK_TYPE_STATUS_UPDATE, url, active: 1 },
    });
    return data?.data || null;
}

export async function enviaHealthCheck() {
    if (!isEnviaConfigured()) return { ok: false, error: 'No configurado' };
    try {
        await enviaFetch(`${QUERIES_URL}/webhook-types`, { timeoutMs: 10000 });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// ─── Estados ────────────────────────────────────────────────────────────────

// Catálogo de estados de /ship/generaltrack/ (docs: Track Shipments).
const ENVIA_STATUS_ID_TO_STATUS = {
    1: 'created',          // Created
    2: 'in_transit',       // Shipped
    3: 'delivered',        // Delivered
    4: 'cancelled',        // Canceled
    7: 'created',          // Pending
    8: 'in_transit',       // Picked Up
    9: 'in_transit',       // Out for Delivery
    11: 'returned',        // Returned
    12: 'in_transit',      // Pickup at Office
    13: 'returned',        // Delivered at Origin
    15: 'in_transit',      // Redirected
    16: 'pickup_requested', // Out for Pickup
    17: 'in_transit',      // 1 delivery attempt
    18: 'in_transit',      // 2 delivery attempts
    19: 'in_transit',      // 3 delivery attempts
    21: 'in_transit',      // Address error
    23: 'in_transit',      // Delayed
    25: 'pickup_requested', // 1 pickup attempt
    28: 'in_transit',      // Delivery Attempt
};

const ENVIA_STATUS_NAME_TO_STATUS = {
    created: 'created',
    pending: 'created',
    shipped: 'in_transit',
    'picked up': 'in_transit',
    'out for delivery': 'in_transit',
    delivered: 'delivered',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    returned: 'returned',
    'delivered at origin': 'returned',
};

// Estados que piden gestión manual (se traducen para la alerta).
const ENVIA_ISSUE_STATUSES = {
    10: 'Perdido',
    14: 'Dañado',
    17: '1 intento de entrega',
    18: '2 intentos de entrega',
    19: '3 intentos de entrega',
    20: 'Problema en la devolución',
    21: 'Error en la dirección',
    22: 'No entregable',
    24: 'Rechazado por el destinatario',
    28: 'Intento de entrega',
};

/** Estado interno a partir de la guía de /ship/generaltrack/. */
export function mapEnviaStatus(guide) {
    if (!guide) return null;
    const byId = ENVIA_STATUS_ID_TO_STATUS[Number(guide.statusId ?? guide.status_id)];
    if (byId) return byId;
    return ENVIA_STATUS_NAME_TO_STATUS[String(guide.status || '').trim().toLowerCase()] || null;
}

/**
 * Convierte el historial de Envia al formato de eventos de shipping.js
 * ({ updateState, description, date }). Si la guía está en un estado de
 * novedad, la descripción lo dice en español para que la alerta lo detecte.
 */
export function enviaGuideToEvents(guide) {
    const history = Array.isArray(guide?.eventHistory) ? guide.eventHistory : [];
    const events = history.map((e) => ({
        updateState: e.event || e.status || 'Actualización',
        description: [e.description, e.location].filter(Boolean).join(' · ') || null,
        date: e.date || null,
    }));
    const issue = ENVIA_ISSUE_STATUSES[Number(guide?.statusId ?? guide?.status_id)];
    if (issue && !events.some((e) => e.updateState === `Novedad: ${issue}`)) {
        events.push({ updateState: `Novedad: ${issue}`, description: guide.information || null, date: null });
    }
    return events;
}
