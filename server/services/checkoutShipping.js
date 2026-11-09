import crypto from 'crypto';
import { logger } from '../logger.js';
import { isEnviaConfigured, quoteEnvia } from './envia.js';
import { findMunicipality } from '../utils/coLocations.js';

/**
 * Costo de envío que paga el cliente en el checkout.
 *
 * - Desde FREE_SHIPPING_FROM_COP (después del cupón) el envío es gratis.
 * - Si no, se cotiza con Envia.com al DANE del destino y se cobra la oferta más
 *   barata (más la comisión de recaudo si es contraentrega).
 * - Si Envia no está configurado, no responde o no tiene cobertura, se cobra la
 *   tarifa fija FLAT_SHIPPING_COP para no bloquear la venta.
 *
 * El precio mostrado viaja firmado (HMAC) del checkout al POST /api/orders, así
 * el cliente paga exactamente lo que vio y el servidor no confía en un número
 * que venga del navegador.
 */

export const FREE_SHIPPING_FROM_COP = 120000;
export const FLAT_SHIPPING_COP = 12000;

// Misma caja que /admin/envios propone por defecto: lo cotizado en el checkout
// es lo que después cuesta la guía.
const BOX_CM = { width: 20, length: 30, height: 15 };
// Peso supuesto por unidad cuando el producto no tiene peso en la BD.
const FALLBACK_ITEM_KG = 0.5;
const MIN_WEIGHT_KG = 0.5;
const QUOTE_TTL_MS = 30 * 60 * 1000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const WEIGHT_UNIT_TO_KG = { g: 0.001, kg: 1, ml: 0.001, l: 1, unidad: 0 };

const cache = new Map();

function signingKey() {
    return process.env.SHIPPING_QUOTE_SECRET || process.env.JWT_SECRET || '';
}

/** Peso del paquete en kg a partir de [{ productId, quantity }] y las filas de products. */
export function packageWeightKg(items, products) {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    let kg = 0;
    for (const item of items) {
        const product = byId.get(String(item.productId));
        const qty = Number(item.quantity) || 0;
        const weight = Number(product?.weight);
        if (!product || !(weight > 0)) {
            kg += FALLBACK_ITEM_KG * qty;
            continue;
        }
        kg += weight * (WEIGHT_UNIT_TO_KG[product.weight_unit || 'g'] ?? 0.001) * qty;
    }
    return Math.max(MIN_WEIGHT_KG, Math.round(kg * 100) / 100);
}

function roundUpTo100(n) {
    return Math.ceil(n / 100) * 100;
}

function payload({ daneCode, weightKg, isCod, cost }) {
    return `${daneCode}|${Math.round(weightKg * 1000)}|${isCod ? 1 : 0}|${cost}`;
}

function sign(data, expiresAt) {
    return crypto.createHmac('sha256', signingKey()).update(`${data}|${expiresAt}`).digest('base64url');
}

export function signQuote(quote, now = Date.now()) {
    const expiresAt = now + QUOTE_TTL_MS;
    return `${quote.cost}.${expiresAt}.${sign(payload(quote), expiresAt)}`;
}

/** Devuelve el costo firmado si el token corresponde a este destino/peso/pago; si no, null. */
export function verifyQuoteToken(token, { daneCode, weightKg, isCod }, now = Date.now()) {
    if (!token || !signingKey()) return null;
    const [costStr, expStr, mac] = String(token).split('.');
    const cost = Number(costStr);
    const expiresAt = Number(expStr);
    if (!Number.isInteger(cost) || cost < 0 || !Number.isFinite(expiresAt) || expiresAt < now || !mac) return null;
    const expected = Buffer.from(sign(payload({ daneCode, weightKg, isCod, cost }), expiresAt));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    return cost;
}

/**
 * Cotiza el envío pagado (sin aplicar el umbral de envío gratis).
 * Devuelve { cost, source: 'envia' | 'flat', carrier, etaDays }.
 */
export async function quoteCheckoutShipping({ daneCode, weightKg, isCod = false, collectionCop = 0, declaredValueCop = 0 }) {
    const flat = { cost: FLAT_SHIPPING_COP, source: 'flat', carrier: null, etaDays: null };
    const origin = process.env.ENVIA_ORIGIN_DANE || process.env.MIPAQUETE_ORIGIN_DANE;
    if (!isEnviaConfigured() || !origin || !findMunicipality(daneCode)) return flat;

    const key = `${daneCode}|${Math.round(weightKg * 1000)}|${isCod ? Math.round(collectionCop / 10000) : 0}`;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    try {
        const offers = await quoteEnvia({
            originDaneCode: origin,
            destinyDaneCode: daneCode,
            weightKg,
            ...BOX_CM,
            declaredValue: Math.max(10000, declaredValueCop || collectionCop),
            codAmount: isCod ? collectionCop : 0,
        });
        const priced = offers
            .map((o) => ({ ...o, total: o.shippingCost + (isCod ? o.codCost : 0) }))
            .filter((o) => o.total > 0)
            .sort((a, b) => a.total - b.total);
        if (!priced.length) {
            logger.warn({ daneCode, weightKg, isCod }, '[Checkout] Envia sin ofertas, se cobra tarifa fija');
            return flat;
        }
        const best = priced[0];
        const value = {
            cost: roundUpTo100(best.total),
            source: 'envia',
            carrier: best.deliveryCompanyName,
            etaDays: best.shippingTime ? Math.max(1, Math.round(best.shippingTime / 1440)) : null,
        };
        cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    } catch (err) {
        logger.warn({ err: err.message, daneCode }, '[Checkout] Falló la cotización con Envia, se cobra tarifa fija');
        return flat;
    }
}

/**
 * Envío de un pedido en COP. Usa el token firmado si coincide; si no, cotiza.
 * Devuelve { shipping, source }.
 */
export async function resolveOrderShipping({ discountedSubtotal, daneCode, items, products, isCod, quoteToken }) {
    if (discountedSubtotal >= FREE_SHIPPING_FROM_COP) return { shipping: 0, source: 'free' };
    if (!daneCode) return { shipping: FLAT_SHIPPING_COP, source: 'flat' };

    const weightKg = packageWeightKg(items, products);
    const signed = verifyQuoteToken(quoteToken, { daneCode, weightKg, isCod });
    if (signed != null) return { shipping: signed, source: 'quote' };

    const quote = await quoteCheckoutShipping({
        daneCode, weightKg, isCod,
        collectionCop: discountedSubtotal + FLAT_SHIPPING_COP,
        declaredValueCop: discountedSubtotal,
    });
    return { shipping: quote.cost, source: quote.source };
}
