/**
 * Centralizador de stock entre el sitio y MercadoLibre.
 *
 * La fuente de verdad es el inventario del sitio (`products.stock_quantity` y
 * `product_variants.stock_quantity`). MercadoLibre es un canal más:
 *
 *   sitio ──(PUT available_quantity)──▶ ML     cada vez que cambia el stock local
 *   ML ──(orden pagada / cancelada)──▶ sitio   descuenta o repone el stock local
 *
 * Reglas:
 * - El disponible de un producto con variantes activas es la suma de sus
 *   variantes (igual que en /api/inventory). Por eso un producto con variantes
 *   solo se puede vincular por variante: así una venta en ML sabe qué descontar.
 * - A ML se le ofrece `disponible - stock_buffer` (nunca negativo). El colchón
 *   sirve para no vender en ML las últimas unidades.
 * - Publicaciones Full (`logistic_type = 'fulfillment'`) quedan fuera: ese stock
 *   está en la bodega de ML, no en la nuestra. Ni se envía ni se descuenta.
 * - Una venta de ML descuenta una sola vez (clave única en `ml_order_stock`) y
 *   solo si la orden es posterior al vínculo (`linked_at`). Una cancelación
 *   repone exactamente lo que se descontó.
 * - Si el envío a ML falla, la publicación queda con `pending_push = 1` y el
 *   error visible en el panel. "Enviar pendientes" (o el cron) la reintenta.
 * - Nada de este módulo bloquea una venta del sitio: `scheduleStockSync()`
 *   nunca lanza y corre después de responder.
 */

import { waitUntil } from '@vercel/functions';
import * as db from '../db.js';
import { logger } from '../logger.js';
import { logSystemAudit } from './audit.js';
import { notifyOversold, notifyStockBelowMinimum, notifyStockDepleted } from './alerts.js';
import { mlApi, getSellerId, MlApiError, MlAuthError } from './mlAuth.js';

/** Estados de orden ML que consumen stock y los que lo devuelven. */
const ORDER_PAID = new Set(['paid']);
const ORDER_VOID = new Set(['cancelled', 'invalid']);

const isMissingTable = (err) => /no such table/i.test(err?.message || '');

function parseUtc(value) {
  if (!value) return null;
  const s = String(value);
  // datetime('now') no trae zona; las fechas de ML sí (ISO con offset).
  const d = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? new Date(s) : new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cantidad que se publica en ML: disponible menos colchón, nunca negativa. */
export function quantityForMl(available, buffer = 0) {
  const a = Math.floor(Number(available) || 0);
  const b = Math.max(0, Math.floor(Number(buffer) || 0));
  return Math.max(0, a - b);
}

export const isFulfillment = (listing) => listing?.logistic_type === 'fulfillment';

// ── Disponible local ───────────────────────────────────────────────────────

/**
 * Disponible del sitio para lo que representa el vínculo.
 * @param {{ product_id: string, variant_id: number|null }} listing
 * @param {{ query: Function }} [conn]  Conexión (para leer dentro de una transacción).
 * @returns {Promise<number|null>} null si el producto o la variante ya no existen.
 */
export async function computeAvailable(listing, conn = db) {
  if (listing.variant_id != null) {
    const r = await conn.query(
      `SELECT v.stock_quantity, v.is_active AS variant_active, p.is_active AS product_active
         FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE v.id = ? AND v.product_id = ?`,
      [listing.variant_id, listing.product_id],
    );
    const row = r.rows[0];
    if (!row) return null;
    if (!Number(row.variant_active) || !Number(row.product_active)) return 0;
    return Math.max(0, Number(row.stock_quantity) || 0);
  }

  const r = await conn.query(
    `SELECT p.is_active, p.stock_quantity, p.stock_reserved,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_count,
            (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_stock
       FROM products p WHERE p.id = ?`,
    [listing.product_id],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (!Number(row.is_active)) return 0;
  const available = Number(row.variant_count) > 0
    ? Number(row.variant_stock)
    : Number(row.stock_quantity) - Number(row.stock_reserved || 0);
  return Math.max(0, available || 0);
}

// ── Envío de stock a ML ────────────────────────────────────────────────────

async function getListing(id) {
  const r = await db.query('SELECT * FROM ml_listings WHERE id = ?', [id]);
  return r.rows[0] || null;
}

async function recordPushError(listingId, message) {
  await db.query(
    `UPDATE ml_listings SET pending_push = 1, last_error = ?, last_error_at = datetime('now') WHERE id = ?`,
    [String(message).slice(0, 500), listingId],
  );
}

/**
 * Envía a ML el disponible de un vínculo.
 * @param {object|number} listingOrId
 * @param {{ force?: boolean }} [opts]  force: enviar aunque el valor no haya cambiado.
 * @returns {Promise<{ listing_id: number, status: 'pushed'|'unchanged'|'skipped_full'|'inactive'|'orphan'|'not_found'|'error', quantity?: number, error?: string }>}
 */
export async function pushListing(listingOrId, { force = false } = {}) {
  const listing = typeof listingOrId === 'object' ? listingOrId : await getListing(listingOrId);
  if (!listing) return { listing_id: Number(listingOrId), status: 'not_found' };
  const id = Number(listing.id);

  if (!Number(listing.is_active)) return { listing_id: id, status: 'inactive' };
  if (isFulfillment(listing)) {
    await db.query('UPDATE ml_listings SET pending_push = 0 WHERE id = ?', [id]);
    return { listing_id: id, status: 'skipped_full' };
  }

  const available = await computeAvailable(listing);
  if (available === null) {
    const error = 'El producto o la variante vinculada ya no existe en el sitio';
    await recordPushError(id, error);
    return { listing_id: id, status: 'orphan', error };
  }
  const quantity = quantityForMl(available, listing.stock_buffer);

  if (!force && listing.last_pushed_qty != null && Number(listing.last_pushed_qty) === quantity && !listing.last_error) {
    await db.query('UPDATE ml_listings SET pending_push = 0 WHERE id = ?', [id]);
    return { listing_id: id, status: 'unchanged', quantity };
  }

  try {
    const itemId = encodeURIComponent(listing.ml_item_id);
    if (listing.ml_variation_id) {
      await mlApi(`/items/${itemId}/variations/${encodeURIComponent(listing.ml_variation_id)}`, {
        method: 'PUT', body: { available_quantity: quantity },
      });
    } else {
      await mlApi(`/items/${itemId}`, { method: 'PUT', body: { available_quantity: quantity } });
    }
    await db.query(
      `UPDATE ml_listings
          SET pending_push = 0, last_pushed_qty = ?, last_pushed_at = datetime('now'),
              ml_available_qty = ?, ml_checked_at = datetime('now'),
              last_error = NULL, last_error_at = NULL, updated_at = datetime('now')
        WHERE id = ?`,
      [quantity, quantity, id],
    );
    logger.info({ listingId: id, item: listing.ml_item_id, variation: listing.ml_variation_id || null, quantity },
      '[mlStock] stock enviado a MercadoLibre');
    return { listing_id: id, status: 'pushed', quantity };
  } catch (err) {
    await recordPushError(id, err.message).catch(() => {});
    logger.warn({ listingId: id, item: listing.ml_item_id, err: err.message }, '[mlStock] no se pudo enviar el stock');
    return { listing_id: id, status: 'error', quantity, error: err.message, fatal: err instanceof MlAuthError };
  }
}

function summarize(results) {
  const summary = { total: results.length, pushed: 0, unchanged: 0, skipped_full: 0, errors: 0, results };
  for (const r of results) {
    if (r.status === 'pushed') summary.pushed++;
    else if (r.status === 'unchanged') summary.unchanged++;
    else if (r.status === 'skipped_full') summary.skipped_full++;
    else if (r.status === 'error' || r.status === 'orphan') summary.errors++;
  }
  return summary;
}

/**
 * Envía en serie (ML limita la tasa) los vínculos activos.
 * @param {{ all?: boolean, force?: boolean, productIds?: string[] }} [opts]
 *   all: todos los activos (no solo los pendientes). productIds: solo esos productos.
 */
export async function pushListings({ all = false, force = false, productIds = null } = {}) {
  const where = ['is_active = 1'];
  const params = [];
  if (!all) where.push('pending_push = 1');
  if (productIds) {
    if (!productIds.length) return summarize([]);
    where.push(`product_id IN (${productIds.map(() => '?').join(',')})`);
    params.push(...productIds);
  }
  const r = await db.query(`SELECT * FROM ml_listings WHERE ${where.join(' AND ')} ORDER BY id`, params);
  const results = [];
  for (const listing of r.rows) {
    results.push(await pushListing(listing, { force }));
    // Sin conexión válida no tiene sentido seguir golpeando la API: el resto queda pendiente.
    if (results[results.length - 1].fatal) break;
  }
  return summarize(results);
}

/** Marca como pendientes los vínculos de esos productos. */
export async function markProductsDirty(productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean).map(String))];
  if (!ids.length) return 0;
  const r = await db.query(
    `UPDATE ml_listings SET pending_push = 1 WHERE is_active = 1 AND product_id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  return r.rowCount || 0;
}

/**
 * Avisa que cambió el stock de estos productos: marca sus vínculos y los envía
 * a ML después de responder (waitUntil en Vercel). Nunca lanza ni bloquea.
 * @param {Array<string|number>} productIds
 */
export function scheduleStockSync(productIds) {
  const ids = [...new Set((productIds || []).filter((x) => x != null && x !== '').map(String))];
  if (!ids.length) return;
  const task = (async () => {
    try {
      const marked = await markProductsDirty(ids);
      if (!marked) return; // ningún producto de estos está publicado en ML
      await pushListings({ productIds: ids });
    } catch (err) {
      if (!isMissingTable(err)) logger.warn({ err: err.message, productIds: ids }, '[mlStock] sync programado falló');
    }
  })();
  try { waitUntil(task); } catch { /* fuera de Vercel la promesa ya está corriendo */ }
}

// ── Ventas de ML → stock local ─────────────────────────────────────────────

async function findListingForOrderItem(itemId, variationId) {
  const r = await db.query(
    `SELECT * FROM ml_listings
      WHERE ml_item_id = ? AND ml_variation_id IN (?, '') AND is_active = 1
      ORDER BY CASE WHEN ml_variation_id = ? THEN 0 ELSE 1 END
      LIMIT 1`,
    [String(itemId), variationId ? String(variationId) : '', variationId ? String(variationId) : ''],
  );
  return r.rows[0] || null;
}

async function readStock(tx, productId, variantId) {
  if (variantId != null) {
    const r = await tx.query(
      `SELECT v.stock_quantity AS stock, p.name, p.stock_min,
              TRIM(COALESCE(v.size_label, '') || ' ' || COALESCE(v.grind_label, '')) AS variant_label
         FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`,
      [variantId],
    );
    return r.rows[0] || null;
  }
  const r = await tx.query('SELECT stock_quantity AS stock, name, stock_min FROM products WHERE id = ?', [productId]);
  return r.rows[0] || null;
}

async function writeStock(tx, productId, variantId, value) {
  if (variantId != null) {
    await tx.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [value, variantId]);
  } else {
    await tx.query("UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?", [value, productId]);
  }
}

/**
 * Aplica al stock local una orden de ML (detalle de GET /orders/:id).
 * Pagada → descuenta. Cancelada/inválida → repone lo descontado. Idempotente.
 * @returns {Promise<{ applied: number, reverted: number, skipped: number, productIds: string[] }>}
 */
export async function applyMlOrderStock(order) {
  const out = { applied: 0, reverted: 0, skipped: 0, productIds: [] };
  if (!order?.id) return out;
  const orderId = String(order.id);
  const status = String(order.status || '').toLowerCase();
  const reference = `ML-${orderId}`;
  const orderDate = parseUtc(order.date_created);
  const alerts = [];

  if (ORDER_VOID.has(status)) {
    const rows = await db.query(
      'SELECT * FROM ml_order_stock WHERE ml_order_id = ? AND reverted_at IS NULL',
      [orderId],
    );
    for (const entry of rows.rows) {
      const done = await db.withTransaction(async (tx) => {
        const claimed = await tx.query(
          `UPDATE ml_order_stock SET reverted_at = datetime('now') WHERE id = ? AND reverted_at IS NULL`,
          [entry.id],
        );
        if (!claimed.rowCount) return false;
        const qty = Number(entry.deducted_qty) || 0;
        if (qty > 0) {
          const current = await readStock(tx, entry.product_id, entry.variant_id);
          if (current) {
            const before = Number(current.stock) || 0;
            await writeStock(tx, entry.product_id, entry.variant_id, before + qty);
            await tx.query(
              `INSERT INTO inventory_movements
                 (product_id, variant_id, movement_type, quantity, quantity_before, quantity_after, reason, reference)
               VALUES (?, ?, 'devolucion', ?, ?, ?, 'Cancelación MercadoLibre', ?)`,
              [entry.product_id, entry.variant_id ?? null, qty, before, before + qty, reference],
            );
          }
        }
        return true;
      });
      if (done) { out.reverted++; out.productIds.push(String(entry.product_id)); }
    }
    out.productIds = [...new Set(out.productIds)];
    return out;
  }

  if (!ORDER_PAID.has(status)) return out; // pendiente de pago u otro estado: no mueve stock

  for (const line of order.order_items || []) {
    const itemId = line?.item?.id;
    const variationId = line?.item?.variation_id ? String(line.item.variation_id) : '';
    const quantity = Math.floor(Number(line?.quantity) || 0);
    if (!itemId || quantity <= 0) { out.skipped++; continue; }

    const listing = await findListingForOrderItem(itemId, variationId);
    if (!listing || isFulfillment(listing)) { out.skipped++; continue; }
    // Órdenes anteriores al vínculo ya estaban reflejadas en el stock que se contó a mano.
    const linkedAt = parseUtc(listing.linked_at);
    if (orderDate && linkedAt && orderDate < linkedAt) { out.skipped++; continue; }

    const productId = String(listing.product_id);
    const variantId = listing.variant_id ?? null;

    const result = await db.withTransaction(async (tx) => {
      const ins = await tx.query(
        `INSERT INTO ml_order_stock (ml_order_id, listing_id, ml_item_id, ml_variation_id, product_id, variant_id, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (ml_order_id, ml_item_id, ml_variation_id) DO NOTHING`,
        [orderId, listing.id, String(itemId), variationId, productId, variantId, quantity],
      );
      if (!ins.rowCount) {
        // Ya existía: solo se reaplica si se había repuesto (orden reactivada).
        const again = await tx.query(
          `UPDATE ml_order_stock SET reverted_at = NULL, applied_at = datetime('now'), quantity = ?
            WHERE ml_order_id = ? AND ml_item_id = ? AND ml_variation_id = ? AND reverted_at IS NOT NULL`,
          [quantity, orderId, String(itemId), variationId],
        );
        if (!again.rowCount) return null;
      }

      const current = await readStock(tx, productId, variantId);
      if (!current) return null;
      const before = Math.max(0, Number(current.stock) || 0);
      const deducted = Math.min(quantity, before);
      const after = before - deducted;
      const oversold = deducted < quantity;

      await writeStock(tx, productId, variantId, after);
      if (deducted > 0) {
        await tx.query(
          `INSERT INTO inventory_movements
             (product_id, variant_id, movement_type, quantity, quantity_before, quantity_after, reason, reference)
           VALUES (?, ?, 'salida', ?, ?, ?, 'Venta MercadoLibre', ?)`,
          [productId, variantId, deducted, before, after, reference],
        );
      }
      await tx.query(
        `UPDATE ml_order_stock SET deducted_qty = ?, oversold = ?
          WHERE ml_order_id = ? AND ml_item_id = ? AND ml_variation_id = ?`,
        [deducted, oversold ? 1 : 0, orderId, String(itemId), variationId],
      );
      const name = current.variant_label ? `${current.name} (${current.variant_label})` : current.name;
      return { after, oversold, quantity, name: name || `Producto #${productId}`, minimum: Number(current.stock_min ?? 0) };
    });

    if (!result) { out.skipped++; continue; }
    out.applied++;
    out.productIds.push(productId);
    alerts.push({ ...result, productId });
  }

  // Alertas y auditoría fuera de la transacción (logAudit dentro bloquea la escritura).
  for (const a of alerts) {
    if (a.oversold) {
      notifyOversold({ productName: a.name, quantity: a.quantity, reference });
      logSystemAudit('oversold', 'products', a.productId, { reference, quantity: a.quantity, channel: 'mercadolibre' }).catch(() => {});
    } else if (a.after <= 0) {
      notifyStockDepleted({ productName: a.name, reference });
    } else if (a.minimum > 0 && a.after <= a.minimum) {
      notifyStockBelowMinimum({ productName: a.name, remaining: a.after, minimum: a.minimum });
    }
  }

  out.productIds = [...new Set(out.productIds)];
  return out;
}

/**
 * Aplica varias órdenes y al final envía a ML el stock de los productos tocados
 * (para corregir cualquier diferencia que ML haya calculado por su lado).
 * Nunca lanza: un error de stock no debe tumbar el sync de órdenes.
 */
export async function applyOrdersStockAndPush(orders) {
  const total = { applied: 0, reverted: 0, skipped: 0, errors: 0, pushed: 0 };
  const touched = new Set();
  for (const order of orders || []) {
    try {
      const r = await applyMlOrderStock(order);
      total.applied += r.applied;
      total.reverted += r.reverted;
      total.skipped += r.skipped;
      r.productIds.forEach((id) => touched.add(id));
    } catch (err) {
      if (isMissingTable(err)) return total; // migración pendiente
      total.errors++;
      logger.error({ err: err.message, orderId: order?.id }, '[mlStock] no se pudo aplicar la orden al stock');
    }
  }
  if (touched.size) {
    try {
      await markProductsDirty([...touched]);
      const s = await pushListings({ productIds: [...touched] });
      total.pushed = s.pushed;
    } catch (err) {
      logger.warn({ err: err.message }, '[mlStock] no se pudo reenviar el stock tras aplicar órdenes');
    }
  }
  return total;
}

// ── Vínculos ───────────────────────────────────────────────────────────────

/** Normaliza un ID de publicación: acepta "MCO123", "mco-123" o un enlace de ML. */
export function normalizeItemId(raw) {
  const s = String(raw || '').trim().toUpperCase();
  const m = s.match(/\b(M[A-Z]{2})-?(\d{6,})\b/);
  return m ? `${m[1]}${m[2]}` : null;
}

function skuOf(entity) {
  if (!entity) return null;
  if (entity.seller_custom_field) return String(entity.seller_custom_field).trim();
  const attr = (entity.attributes || []).find((a) => a?.id === 'SELLER_SKU');
  return attr?.value_name ? String(attr.value_name).trim() : null;
}

function variationLabel(variation) {
  const combos = (variation.attribute_combinations || [])
    .map((c) => c?.value_name).filter(Boolean);
  return combos.join(' · ') || `Variación ${variation.id}`;
}

/** Resume una publicación de ML con lo que el panel necesita. */
export function summarizeItem(item) {
  return {
    id: item.id,
    title: item.title,
    permalink: item.permalink || null,
    thumbnail: item.thumbnail || item.secure_thumbnail || null,
    status: item.status || null,
    available_quantity: item.available_quantity ?? null,
    logistic_type: item.shipping?.logistic_type || null,
    seller_id: item.seller_id != null ? String(item.seller_id) : null,
    sku: skuOf(item),
    variations: (item.variations || []).map((v) => ({
      id: String(v.id),
      label: variationLabel(v),
      available_quantity: v.available_quantity ?? null,
      sku: skuOf(v),
    })),
  };
}

export class MlStockError extends Error {
  constructor(message, status = 422, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

/** Trae una publicación con sus variaciones y atributos. */
export async function fetchItem(itemId) {
  try {
    return await mlApi(`/items/${encodeURIComponent(itemId)}?include_attributes=all`);
  } catch (err) {
    if (err instanceof MlApiError && err.status === 404) {
      throw new MlStockError(`La publicación ${itemId} no existe en MercadoLibre`, 404);
    }
    throw err;
  }
}

/**
 * Crea el vínculo publicación ↔ producto/variante y envía el stock de inmediato.
 * @returns {Promise<{ listing: object, push: object }>}
 */
export async function linkListing({ productId, variantId = null, mlItemId, mlVariationId = '', stockBuffer = 0, userId = null }) {
  const itemId = normalizeItemId(mlItemId);
  if (!itemId) throw new MlStockError('El ID de la publicación no es válido. Use el formato MCO1234567890.');

  const prod = await db.query('SELECT id, name FROM products WHERE id = ?', [productId]);
  if (!prod.rows.length) throw new MlStockError('El producto no existe', 404);

  const activeVariants = await db.query(
    'SELECT id FROM product_variants WHERE product_id = ? AND is_active = 1',
    [productId],
  );
  if (variantId != null) {
    const v = await db.query('SELECT id FROM product_variants WHERE id = ? AND product_id = ?', [variantId, productId]);
    if (!v.rows.length) throw new MlStockError('La variante no pertenece a ese producto', 422);
  } else if (activeVariants.rows.length) {
    throw new MlStockError('Este producto se vende por variantes: elija la variante que corresponde a la publicación.');
  }

  const item = summarizeItem(await fetchItem(itemId));
  const sellerId = await getSellerId();
  if (sellerId && item.seller_id && item.seller_id !== String(sellerId)) {
    throw new MlStockError('Esa publicación pertenece a otro vendedor de MercadoLibre', 403);
  }

  const variation = String(mlVariationId || '');
  if (item.variations.length) {
    if (!variation) {
      throw new MlStockError('La publicación tiene variaciones: elija cuál corresponde a este producto.', 422,
        { code: 'ML_VARIATION_REQUIRED', variations: item.variations });
    }
    if (!item.variations.some((v) => v.id === variation)) {
      throw new MlStockError('Esa variación no existe en la publicación', 422, { variations: item.variations });
    }
  } else if (variation) {
    throw new MlStockError('La publicación no tiene variaciones', 422);
  }

  const mlQty = variation
    ? item.variations.find((v) => v.id === variation)?.available_quantity ?? null
    : item.available_quantity;

  let listingId;
  try {
    const ins = await db.query(
      `INSERT INTO ml_listings
         (product_id, variant_id, ml_item_id, ml_variation_id, title, permalink, logistic_type,
          stock_buffer, ml_available_qty, ml_status, ml_checked_at, created_by, pending_push)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 1)`,
      [productId, variantId, itemId, variation, item.title || null, item.permalink, item.logistic_type,
        Math.max(0, Math.floor(Number(stockBuffer) || 0)), mlQty, item.status, userId],
    );
    listingId = Number(ins.lastInsertRowid);
  } catch (err) {
    if (/UNIQUE/i.test(err.message)) {
      throw new MlStockError('Esa publicación (o variación) ya está vinculada a otro producto', 409);
    }
    throw err;
  }

  const push = await pushListing(listingId, { force: true });
  return { listing: await getListing(listingId), push };
}

/** Cambia colchón o estado activo. Deja el vínculo pendiente de envío. */
export async function updateListing(id, { stockBuffer, isActive }) {
  const sets = [];
  const params = [];
  if (stockBuffer !== undefined) { sets.push('stock_buffer = ?'); params.push(Math.max(0, Math.floor(Number(stockBuffer) || 0))); }
  if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (!sets.length) throw new MlStockError('No hay campos para actualizar', 400);
  const r = await db.query(
    `UPDATE ml_listings SET ${sets.join(', ')}, pending_push = 1, updated_at = datetime('now') WHERE id = ?`,
    [...params, id],
  );
  if (!r.rowCount) throw new MlStockError('Vínculo no encontrado', 404);
  return getListing(id);
}

/** Borra el vínculo. ML conserva la última cantidad enviada. */
export async function unlinkListing(id) {
  const existing = await getListing(id);
  if (!existing) throw new MlStockError('Vínculo no encontrado', 404);
  await db.query('DELETE FROM ml_listings WHERE id = ?', [id]);
  return existing;
}

/**
 * Antes de borrar un producto o una variante: deja sus publicaciones en 0 en ML
 * y quita los vínculos, para que ML no siga vendiendo algo que ya no existe.
 * Nunca lanza; si ML no responde, el vínculo queda con el error a la vista.
 * @param {{ productId?: string, variantId?: number }} target
 */
export async function retireListings({ productId = null, variantId = null }) {
  try {
    const where = variantId != null ? 'variant_id = ?' : 'product_id = ?';
    const r = await db.query(`SELECT * FROM ml_listings WHERE ${where}`, [variantId != null ? variantId : productId]);
    for (const l of r.rows) {
      if (Number(l.is_active) && !isFulfillment(l)) {
        try {
          const itemId = encodeURIComponent(l.ml_item_id);
          const path = l.ml_variation_id
            ? `/items/${itemId}/variations/${encodeURIComponent(l.ml_variation_id)}`
            : `/items/${itemId}`;
          await mlApi(path, { method: 'PUT', body: { available_quantity: 0 } });
        } catch (err) {
          // Se conserva el vínculo (inactivo) para que el panel muestre que ML quedó con stock.
          await db.query(
            `UPDATE ml_listings SET is_active = 0, last_error = ?, last_error_at = datetime('now') WHERE id = ?`,
            [`No se pudo poner en 0 al borrar: ${String(err.message).slice(0, 400)}`, l.id],
          );
          logger.warn({ listingId: l.id, err: err.message }, '[mlStock] no se pudo poner en 0 la publicación al borrar');
          continue;
        }
      }
      await db.query('DELETE FROM ml_listings WHERE id = ?', [l.id]);
    }
  } catch (err) {
    if (!isMissingTable(err)) logger.warn({ err: err.message }, '[mlStock] retireListings falló');
  }
}

/** Vínculos con el disponible local calculado, para el panel. */
export async function listListingsWithStock() {
  const r = await db.query(
    `SELECT l.*, p.name AS product_name, p.sku AS product_sku,
            TRIM(COALESCE(v.size_label, '') || ' ' || COALESCE(v.grind_label, '')) AS variant_label
       FROM ml_listings l
       JOIN products p ON p.id = l.product_id
  LEFT JOIN product_variants v ON v.id = l.variant_id
   ORDER BY p.name, variant_label, l.id`,
  );
  const rows = [];
  for (const l of r.rows) {
    const available = await computeAvailable(l);
    rows.push({
      ...l,
      local_available: available,
      target_qty: available === null ? null : quantityForMl(available, l.stock_buffer),
      is_fulfillment: isFulfillment(l),
    });
  }
  return rows;
}

/**
 * Actualiza lo que ML reporta de una publicación (webhook de topic "items").
 * No envía nada: solo deja visible si ML se desvió del valor del sitio.
 */
export async function refreshListingFromMl(itemId) {
  const id = normalizeItemId(itemId);
  if (!id) return 0;
  const linked = await db.query('SELECT id, ml_variation_id FROM ml_listings WHERE ml_item_id = ?', [id]);
  if (!linked.rows.length) return 0;
  const item = summarizeItem(await fetchItem(id));
  for (const l of linked.rows) {
    const qty = l.ml_variation_id
      ? item.variations.find((v) => v.id === String(l.ml_variation_id))?.available_quantity ?? null
      : item.available_quantity;
    await db.query(
      `UPDATE ml_listings SET ml_available_qty = ?, ml_status = ?, logistic_type = ?, title = COALESCE(?, title),
              ml_checked_at = datetime('now') WHERE id = ?`,
      [qty, item.status, item.logistic_type, item.title || null, l.id],
    );
  }
  return linked.rows.length;
}

/**
 * Publicaciones del vendedor para elegir al vincular. Marca las ya vinculadas
 * y sugiere producto/variante cuando el SKU de ML coincide con el del sitio.
 * @param {{ status?: string, offset?: number, limit?: number, search?: string }} opts
 */
export async function listSellerItems({ status = 'active', offset = 0, limit = 50, search = '' } = {}) {
  const sellerId = await getSellerId();
  if (!sellerId) throw new MlAuthError('No hay vendedor de MercadoLibre conectado', 'ML_NOT_CONNECTED', 409);

  const params = new URLSearchParams({ limit: String(Math.min(50, limit)), offset: String(Math.max(0, offset)) });
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  const page = await mlApi(`/users/${encodeURIComponent(sellerId)}/items/search?${params}`);
  const ids = page?.results || [];

  const items = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const multi = await mlApi(`/items?ids=${chunk.map(encodeURIComponent).join(',')}&include_attributes=all`);
    for (const entry of multi || []) {
      if (entry?.code === 200 && entry.body) items.push(summarizeItem(entry.body));
    }
  }

  // Vínculos existentes y catálogo de SKUs del sitio para sugerir.
  const linked = await db.query('SELECT id, ml_item_id, ml_variation_id, product_id, variant_id FROM ml_listings');
  const linkedKey = new Map(linked.rows.map((l) => [`${l.ml_item_id}|${l.ml_variation_id}`, l]));
  const skus = await db.query(
    `SELECT p.id AS product_id, NULL AS variant_id, p.sku FROM products p WHERE p.sku IS NOT NULL AND p.sku != ''
     UNION ALL
     SELECT p.id, v.id, p.sku || COALESCE(v.sku_suffix, '') FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.sku IS NOT NULL AND p.sku != '' AND v.sku_suffix IS NOT NULL AND v.sku_suffix != ''`,
  );
  const bySku = new Map(skus.rows.map((s) => [String(s.sku).trim().toUpperCase(), s]));
  const suggest = (sku) => {
    const hit = sku ? bySku.get(String(sku).trim().toUpperCase()) : null;
    return hit ? { product_id: hit.product_id, variant_id: hit.variant_id ?? null } : null;
  };

  for (const item of items) {
    item.link = linkedKey.get(`${item.id}|`) || null;
    item.suggestion = item.link ? null : suggest(item.sku);
    for (const v of item.variations) {
      v.link = linkedKey.get(`${item.id}|${v.id}`) || null;
      v.suggestion = v.link ? null : suggest(v.sku);
    }
  }

  return { items, paging: page?.paging || { total: items.length, offset, limit } };
}
