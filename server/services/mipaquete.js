import crypto from 'crypto';
import { logger } from '../logger.js';
import { query } from '../db.js';

/**
 * Cliente del API v2 de Mipaquete.com (agregador de transportadoras Colombia).
 * Headers requeridos en toda llamada: session-tracker + apikey.
 * https://api.documentacion.mipaquete.com/
 */

const API_URL = process.env.MIPAQUETE_API_URL || 'https://api-v2.mipaquete.com';
const API_KEY = process.env.MIPAQUETE_API_KEY;
const SESSION_TRACKER = process.env.MIPAQUETE_SESSION_TRACKER;

// paymentType 101 = pago anticipado (visto en ejemplo oficial). El código de
// contraentrega debe confirmarse en sandbox antes de habilitar COD en producción.
export const MP_PAYMENT_TYPE_PREPAID = 101;
export const MP_PAYMENT_TYPE_COD = Number(process.env.MIPAQUETE_PAYMENT_TYPE_COD) || 102;

export class MipaqueteConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MipaqueteConfigError';
    }
}

export class MipaqueteError extends Error {
    constructor(message, { status, body, retriable = false } = {}) {
        super(message);
        this.name = 'MipaqueteError';
        this.status = status;
        this.body = body;
        this.retriable = retriable;
    }
}

function assertConfigured() {
    if (!API_KEY || !SESSION_TRACKER) {
        throw new MipaqueteConfigError(
            'MIPAQUETE_API_KEY / MIPAQUETE_SESSION_TRACKER no están configurados. ' +
            'Genere el apikey con POST /generateapikey y configure las variables de entorno.'
        );
    }
}

async function mpFetch(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
    assertConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${API_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'session-tracker': SESSION_TRACKER,
                apikey: API_KEY,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }

        if (!res.ok) {
            // Nunca loguear el apikey; solo path/status/body de la respuesta.
            logger.error({ path, status: res.status, body: data }, '[Mipaquete] Error de API');
            if (res.status === 401 || res.status === 403) {
                throw new MipaqueteError(
                    'MIPAQUETE_API_KEY inválida o expirada — regenere con POST /generateapikey',
                    { status: res.status, body: data, retriable: false }
                );
            }
            throw new MipaqueteError(`Mipaquete respondió ${res.status}`, {
                status: res.status,
                body: data,
                retriable: res.status >= 500,
            });
        }

        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new MipaqueteError('Timeout al contactar Mipaquete', { retriable: true });
        }
        if (err instanceof MipaqueteError || err instanceof MipaqueteConfigError) throw err;
        throw new MipaqueteError(err.message, { retriable: true });
    } finally {
        clearTimeout(timeout);
    }
}

// ─── Endpoints Mipaquete ────────────────────────────────────────────────────

export async function generateApiKey(email, password) {
    // Utilidad de setup único; no usar en runtime normal (no persiste credenciales).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(`${API_URL}/generateapikey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'session-tracker': SESSION_TRACKER || crypto.randomUUID() },
            body: JSON.stringify({ email, password }),
            signal: controller.signal,
        });
        return res.json();
    } finally {
        clearTimeout(timeout);
    }
}

export async function getLocations(locationCode) {
    const qs = locationCode ? `?locationCode=${encodeURIComponent(locationCode)}` : '';
    return mpFetch(`/getLocations${qs}`);
}

export async function quoteShipping({ originDaneCode, destinyDaneCode, quantity, width, length, height, weight, declaredValue }) {
    return mpFetch('/quoteShipping', {
        method: 'POST',
        body: {
            originLocationCode: originDaneCode,
            destinyLocationCode: destinyDaneCode,
            quantity,
            width,
            length,
            height,
            weight,
            declaredValue,
        },
    });
}

export async function createSending(payload) {
    return mpFetch('/createSending', { method: 'POST', body: payload });
}

export async function getSendings({ page = 1, pageSize = 10, mpCode } = {}) {
    return mpFetch(`/getSendings/${page}`, {
        method: 'POST',
        body: { pageSize, ...(mpCode ? { mpCode } : {}) },
    });
}

// La API no documenta un filtro por referencia propia (productReference), así
// que para reconciliar un envío huérfano (createSending exitoso pero el mpCode
// nunca se persistió localmente) se pagina getSendings y se busca el envío cuya
// referencia coincida con la de la orden. Nombres de campo tolerantes porque la
// respuesta de Mipaquete no tiene un contrato estable documentado.
export async function findSendingByReference(reference, { maxPages = 3, pageSize = 20 } = {}) {
    for (let page = 1; page <= maxPages; page++) {
        const result = await getSendings({ page, pageSize });
        const list = result?.sendings || [];
        if (!list.length) break;
        const match = list.find((s) =>
            [s.productReference, s.reference, s['Referencia'], s.description]
                .some((v) => v && String(v).includes(reference))
        );
        if (match) return match;
        if (list.length < pageSize) break;
    }
    return null;
}

export async function getTracking(mpCode) {
    return mpFetch(`/getSendingTracking?mpCode=${encodeURIComponent(mpCode)}`);
}

export async function cancelSending(mpCode) {
    return mpFetch('/cancelSending', { method: 'PUT', body: { mpCode } });
}

export async function registerWebhook({ guidesUrl, statesUrl }) {
    return mpFetch('/createWebHook', {
        method: 'POST',
        body: {
            urlForGuides: { urlClient: guidesUrl, enabled: !!guidesUrl },
            urlForStates: { urlClient: statesUrl, enabled: !!statesUrl },
        },
    });
}

export async function healthCheck() {
    try {
        await getLocations(process.env.MIPAQUETE_ORIGIN_DANE || '05001000');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// ─── Resolución de ciudad → código DANE ────────────────────────────────────

function normalizeKey(city, department) {
    const strip = (s) => String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();
    return `${strip(city)}|${strip(department)}`;
}

/**
 * Resuelve ciudad+departamento (texto libre, como se captura en checkout) a un
 * código DANE. Nunca autoselecciona ante homónimos: la UI admin debe decidir.
 * Devuelve { code } | { candidates: [...] } | { notFound: true }.
 */
export async function resolveDaneCode(city, department) {
    const key = normalizeKey(city, department);

    const cached = await query(
        `SELECT location_code, location_name, department_name FROM dane_locations WHERE normalized_key = ?`,
        [key]
    );
    if (cached.rows.length === 1) {
        return { code: cached.rows[0].location_code };
    }
    if (cached.rows.length > 1) {
        return { candidates: cached.rows };
    }

    // No cacheado: buscar por nombre de ciudad (sin departamento) y cachear resultados.
    let results;
    try {
        results = await getLocations(city);
    } catch (err) {
        logger.error({ err, city, department }, '[Mipaquete] Error resolviendo DANE');
        return { notFound: true, error: err.message };
    }

    const list = Array.isArray(results) ? results : (results?.data || []);
    if (!list.length) return { notFound: true };

    for (const loc of list) {
        const code = loc.locationCode || loc.code || loc.location_code;
        const name = loc.name || loc.locationName || loc.location_name || city;
        const dept = loc.department || loc.departmentName || loc.department_name || '';
        if (!code) continue;
        await query(
            `INSERT INTO dane_locations (location_code, location_name, department_name, normalized_key, raw_json)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(location_code) DO UPDATE SET
               location_name = excluded.location_name,
               department_name = excluded.department_name,
               normalized_key = excluded.normalized_key,
               raw_json = excluded.raw_json,
               updated_at = datetime('now')`,
            [code, name, dept, normalizeKey(name, dept), JSON.stringify(loc)]
        );
    }

    const refreshed = await query(
        `SELECT location_code, location_name, department_name FROM dane_locations WHERE normalized_key = ?`,
        [key]
    );
    if (refreshed.rows.length === 1) return { code: refreshed.rows[0].location_code };
    if (refreshed.rows.length > 1) return { candidates: refreshed.rows };

    // Homónimos entre ciudades distintas (misma ciudad, distinto departamento):
    // buscar todas las que coincidan solo por nombre de ciudad.
    const cityOnly = await query(
        `SELECT location_code, location_name, department_name FROM dane_locations WHERE normalized_key LIKE ?`,
        [`${normalizeKey(city, '').split('|')[0]}|%`]
    );
    if (cityOnly.rows.length === 1) return { code: cityOnly.rows[0].location_code };
    if (cityOnly.rows.length > 1) return { candidates: cityOnly.rows };

    return { notFound: true };
}

const WEIGHT_UNIT_TO_KG = { g: 0.001, kg: 1, ml: 0.001, l: 1, unidad: 0 };

/**
 * Calcula peso/valor declarado del paquete a partir de los ítems de la orden.
 * Nunca falla por falta de peso: reporta missingWeights para que el admin lo
 * complete manualmente en el formulario (products.dimensions es texto libre,
 * no se intenta parsear).
 */
export function computePackageFromOrder(items, products) {
    const productMap = new Map(products.map((p) => [String(p.id), p]));
    let weightKg = 0;
    const missingWeights = [];

    for (const item of items) {
        const product = productMap.get(String(item.product_id));
        const weight = product?.weight;
        const unit = product?.weight_unit || 'g';
        if (weight == null || Number(weight) <= 0) {
            missingWeights.push(item.product_name);
            continue;
        }
        const factor = WEIGHT_UNIT_TO_KG[unit] ?? 0.001;
        weightKg += Number(weight) * factor * Number(item.quantity);
    }

    return {
        weightKg: Math.round(weightKg * 100) / 100,
        missingWeights,
        declaredValueCop: items.reduce((sum, i) => sum + Number(i.subtotal_cop || 0), 0),
    };
}
