import { logger } from '../logger.js';

/**
 * Cliente directo de la API B2B de Interrapidísimo (cuenta de crédito corporativa).
 * No hay portal público: la documentación (Release 3.0, abril 2022) y las
 * credenciales (usuario, clave, firma x-app-signature, idCliente, sucursal) las
 * entrega el asesor comercial de Inter. Los hosts por defecto son los de
 * PRUEBAS (stgwww3); los de producción se configuran por variables de entorno.
 *
 * Inter usa códigos DANE de 8 dígitos (11001000 = Bogotá), igual que Mipaquete,
 * así que se reutiliza la cache dane_locations.
 */

const AUTH_URL = process.env.INTER_AUTH_URL || 'https://stgwww3.interrapidisimo.com/ApiVentaCreditostg/Autorizacion/token';
const VENTA_URL = process.env.INTER_VENTA_URL || 'https://stgwww3.interrapidisimo.com/ApiVentaCreditoStg';
const COTIZADOR_URL = process.env.INTER_COTIZADOR_URL || 'https://stgwww3.interrapidisimo.com/ApiServInterStg';

const USER = process.env.INTER_USER;
const PASSWORD = process.env.INTER_PASSWORD;
const SIGNATURE = process.env.INTER_SIGNATURE;
const CLIENT_ID = Number(process.env.INTER_CLIENT_ID) || null;
const BRANCH_ID = Number(process.env.INTER_BRANCH_ID) || 0;

// Tabla "Tipo de envío" del documento: 9 = Paquete.
const SHIPMENT_TYPE_PACKAGE = 9;
// Tabla "Forma de pago": 2 = CRÉDITO (única descrita para clientes corporativos).
const PAYMENT_FORM_CREDIT = 2;
// Tabla "Tipo de entrega": 1 = entrega en dirección, 2 = reclame en oficina.
export const INTER_DELIVERY_ADDRESS = 1;
export const INTER_DELIVERY_OFFICE = 2;

export const INTER_TRACKING_URL = 'https://www.interrapidisimo.com/sigue-tu-envio/?guia=';

export class InterConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InterConfigError';
    }
}

export class InterError extends Error {
    constructor(message, { status, body, retriable = false } = {}) {
        super(message);
        this.name = 'InterError';
        this.status = status;
        this.body = body;
        this.retriable = retriable;
    }
}

export function isInterConfigured() {
    return Boolean(USER && PASSWORD && SIGNATURE && CLIENT_ID);
}

function assertConfigured() {
    if (!isInterConfigured()) {
        throw new InterConfigError(
            'INTER_USER / INTER_PASSWORD / INTER_SIGNATURE / INTER_CLIENT_ID no están configurados. ' +
            'Solicite las credenciales de la API B2B a su asesor de Interrapidísimo.'
        );
    }
}

// ─── Token (vigencia ~24 h según el documento; se renueva 5 min antes) ─────

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getToken() {
    if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(AUTH_URL, {
            // El documento lo define como GET con body x-www-form-urlencoded; fetch
            // no permite body en GET, así que se usa POST (verificar en pruebas).
            method: process.env.INTER_AUTH_METHOD || 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-app-signature': SIGNATURE,
                Authorization: `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`,
            },
            body: 'grant_type=password',
            signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.access_token) {
            logger.error({ status: res.status, body: data }, '[Inter] Error obteniendo token');
            throw new InterError('No se pudo autenticar con Interrapidísimo (revise usuario, clave y firma)', {
                status: res.status, body: data, retriable: res.status >= 500,
            });
        }
        const ttlSeconds = Number(data.ExpiresIn || data.expires_in) || 3600;
        cachedToken = data.access_token;
        cachedTokenExpiresAt = Date.now() + Math.max(ttlSeconds - 300, 60) * 1000;
        return cachedToken;
    } catch (err) {
        if (err.name === 'AbortError') throw new InterError('Timeout autenticando con Interrapidísimo', { retriable: true });
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

async function interFetch(url, { method = 'GET', body, timeoutMs = 20000, retryOnAuth = true } = {}) {
    assertConfigured();
    const token = await getToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-app-signature': SIGNATURE,
                'x-app-security_token': `Bearer ${token}`,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }

        if (res.status === 401 && retryOnAuth) {
            // Token revocado antes de tiempo: forzar uno nuevo y reintentar una vez.
            cachedToken = null;
            return interFetch(url, { method, body, timeoutMs, retryOnAuth: false });
        }
        if (!res.ok) {
            logger.error({ url, status: res.status, body: data }, '[Inter] Error de API');
            const detail = typeof data === 'object' ? (data?.Message || data?.message || data?.Mensaje) : data;
            throw new InterError(`Interrapidísimo respondió ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`, {
                status: res.status, body: data, retriable: res.status >= 500,
            });
        }
        return data;
    } catch (err) {
        if (err.name === 'AbortError') throw new InterError('Timeout al contactar Interrapidísimo', { retriable: true });
        if (err instanceof InterError || err instanceof InterConfigError) throw err;
        throw new InterError(err.message, { retriable: true });
    } finally {
        clearTimeout(timeout);
    }
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

function formatQuoteDate(date = new Date()) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${date.getFullYear()}`;
}

/**
 * Cotiza un envío. Devuelve las ofertas normalizadas al mismo formato que usa
 * el panel con Mipaquete (deliveryCompanyId, deliveryCompanyName, shippingCost,
 * shippingTime en minutos) más provider/serviceId para crear la guía.
 */
export async function quoteInter({ originDaneCode, destinyDaneCode, weightKg, declaredValue, deliveryType = INTER_DELIVERY_ADDRESS }) {
    const path = [CLIENT_ID, originDaneCode, destinyDaneCode, weightKg, Math.round(declaredValue), deliveryType, formatQuoteDate()]
        .map((p) => encodeURIComponent(String(p)))
        .join('/');
    const data = await interFetch(`${COTIZADOR_URL}/api/Cotizadorcliente/ResultadoListaCotizar/${path}`);
    return normalizeInterQuotes(data);
}

export function normalizeInterQuotes(data) {
    const list = Array.isArray(data) ? data : (data ? [data] : []);
    return list
        .filter((q) => q && q.IdServicio != null && Number(q.Precio?.Valor) > 0)
        .map((q) => ({
            provider: 'interrapidisimo',
            serviceId: Number(q.IdServicio),
            deliveryCompanyId: `inter:${q.IdServicio}`,
            deliveryCompanyName: `Interrapidísimo directo · ${q.NombreServicio || `Servicio ${q.IdServicio}`}`,
            shippingCost: Math.round(Number(q.Precio.Valor)),
            codCost: Math.round(Number(q.Precio.ValorContraPago) || 0),
            shippingTime: (Number(q.TiempoEntrega) || 0) * 24 * 60,
            estimatedDelivery: q.FechaEntrega || null,
            message: q.Mensaje || null,
        }));
}

/**
 * Crea la admisión (pre-envío). numeroPreenvio es el número de guía (prefijo 24)
 * y queda disponible de inmediato, a diferencia de Mipaquete.
 */
export async function createInterAdmission({
    serviceId, weightKg, width, length, height, declaredValue, contents,
    applyCod, deliveryType = INTER_DELIVERY_ADDRESS, notes, receiver,
}) {
    const payload = {
        IdClienteCredito: CLIENT_ID,
        CodigoConvenioRemitente: BRANCH_ID,
        IdTipoEntrega: deliveryType,
        AplicaContrapago: Boolean(applyCod),
        IdServicio: serviceId,
        Peso: weightKg,
        Largo: length,
        Ancho: width,
        Alto: height,
        DiceContener: String(contents || 'Café').slice(0, 50),
        ValorDeclarado: Math.round(declaredValue),
        IdTipoEnvio: SHIPMENT_TYPE_PACKAGE,
        IdFormaPago: PAYMENT_FORM_CREDIT,
        NumeroPieza: 1,
        Destinatario: {
            tipoDocumento: receiver.documentType,
            numeroDocumento: receiver.documentNumber,
            nombre: String(receiver.name).slice(0, 50),
            primerApellido: receiver.documentType === 'NI' ? null : String(receiver.firstSurname || '').slice(0, 50),
            segundoApellido: String(receiver.secondSurname || '').slice(0, 50),
            telefono: receiver.phone,
            direccion: String(receiver.address).slice(0, 250),
            idDestinatario: 0,
            idRemitente: 0,
            idLocalidad: receiver.daneCode,
            CodigoConvenio: 0,
            ConvenioDestinatario: 0,
            correo: String(receiver.email || '').slice(0, 50),
        },
        DescripcionTipoEntrega: '',
        NombreTipoEnvio: 'PAQUETE',
        CodigoConvenio: 0,
        IdSucursal: 0,
        IdCliente: 0,
        Notificacion: null,
        RapiRadicado: null,
        Observaciones: String(notes || '').slice(0, 250),
    };
    return interFetch(`${VENTA_URL}/api/Admision/InsertarAdmision`, { method: 'POST', body: payload });
}

/** PDF de la guía (media carta o formato pequeño), decodificado a Buffer. */
export async function getInterGuidePdf(guideNumber, { small = false } = {}) {
    const endpoint = small ? 'ObtenerBase64PdfPreGuiaFormatoPeq' : 'ObtenerBase64PdfPreGuia';
    const data = await interFetch(`${VENTA_URL}/api/Admision/${endpoint}/${encodeURIComponent(guideNumber)}`);
    const base64 = typeof data === 'string' ? data : (data?.pdf || data?.Pdf || data?.base64 || '');
    if (!base64) throw new InterError('Interrapidísimo no devolvió el PDF de la guía', { body: data });
    return Buffer.from(base64.replace(/^data:application\/pdf;base64,/, ''), 'base64');
}

/** Estados de hasta 15 guías por llamada. Devuelve Map(numeroGuia → estados[]). */
export async function getInterStatuses(guideNumbers) {
    const result = new Map();
    for (let i = 0; i < guideNumbers.length; i += 15) {
        const chunk = guideNumbers.slice(i, i + 15);
        const data = await interFetch(`${VENTA_URL}/api/ClientesCredito/ConsultarEstadosGuiasCliente`, {
            method: 'POST',
            body: { idCliente: CLIENT_ID, numeroGuias: chunk.map((g) => Number(g)) },
        });
        for (const guide of data?.listadoGuias || []) {
            result.set(String(guide.numeroGuia), guide.estados || []);
        }
    }
    return result;
}

/** Programa la recogida de uno o varios pre-envíos en la sucursal del cliente. */
export async function requestInterPickup(guideNumbers, pickupDate = new Date()) {
    return interFetch(`${VENTA_URL}/api/Recogida/InsertarRecogidaCliente/`, {
        method: 'POST',
        body: {
            IdClienteCredito: CLIENT_ID,
            IdSucursalCliente: BRANCH_ID,
            listaNumPreenvios: guideNumbers.map((g) => Number(g)),
            fechaRecogida: pickupDate.toISOString(),
        },
    });
}

export async function interHealthCheck() {
    if (!isInterConfigured()) return { ok: false, error: 'No configurado' };
    try {
        cachedToken = null;
        await getToken();
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// ─── Estados ────────────────────────────────────────────────────────────────

// Tabla 3 del documento (estados de guía). El Anexo 1 usa otra numeración, por
// eso el fallback por texto en mapInterStatus cubre lo que no esté aquí.
const INTER_STATE_TO_STATUS = {
    1: 'created',        // Admitida
    2: 'in_transit',     // Centro de acopio
    3: 'in_transit',     // Tránsito nacional
    4: 'in_transit',     // Tránsito regional
    8: 'in_transit',     // Telemercadeo (novedad, sigue en gestión)
    10: 'returned',      // Devolución ratificada
    11: 'delivered',     // Entregada
    15: 'cancelled',     // Anulada
    18: 'in_transit',    // Tránsito urbano
    31: 'in_transit',    // Distribución
};

/**
 * Convierte los estados de Inter al formato de eventos que ya usa shipping.js
 * ({ updateState, description, date }) para reutilizar el guardado de eventos
 * y la detección de novedades.
 */
export function interStatesToEvents(estados) {
    return (estados || []).map((e) => ({
        updateState: e.nombreEstado || `Estado ${e.idEstadoGuia}`,
        description: [e.nombreCiudadOrigen, e.nombreCiudadDestino].filter(Boolean).join(' → ') || null,
        date: e.fechaEstado || null,
        stateId: e.idEstadoGuia,
    }));
}

/** Estado interno a partir del evento más reciente (por fecha, no por orden del array). */
export function mapInterStatus(estados) {
    if (!Array.isArray(estados) || !estados.length) return null;
    const latest = [...estados].sort((a, b) => new Date(b.fechaEstado || 0) - new Date(a.fechaEstado || 0))[0];
    const byId = INTER_STATE_TO_STATUS[Number(latest.idEstadoGuia)];
    if (byId) return byId;

    const text = String(latest.nombreEstado || '').toLowerCase();
    if (/devoluci|devuel/.test(text)) return 'returned';
    if (/anulad/.test(text)) return 'cancelled';
    if (/\bentrega\s+exitosa\b|\bentregad[ao]\b/.test(text) && !/no\s+entregad/.test(text)) return 'delivered';
    if (/transito|tránsito|acopio|distribuci|reparto/.test(text)) return 'in_transit';
    return null;
}
