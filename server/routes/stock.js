import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import * as db from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';
import { pushListings, scheduleStockSync } from '../services/mlStock.js';

/**
 * Stock del catálogo.
 *
 * El disponible se calcula igual que en /api/inventory: un producto con
 * variantes activas vende por variante, así que su disponible es la suma de
 * ellas; sin variantes es stock_quantity - stock_reserved. Un producto inactivo
 * tiene disponible 0.
 *
 * Cada cambio de stock hecho aquí se propaga a MercadoLibre con
 * scheduleStockSync() (services/mlStock.js), después de responder.
 */

const AVAILABLE_SQL = `
  SELECT p.id, p.slug, p.name, p.image_url, p.price, p.is_active,
         p.stock_quantity, p.stock_reserved,
         CASE
           WHEN p.is_active = 0 THEN 0
           WHEN (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) > 0
             THEN COALESCE((SELECT SUM(v.stock_quantity) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1), 0)
           ELSE MAX(p.stock_quantity - p.stock_reserved, 0)
         END AS available
    FROM products p`;

/** Disponible de todos los productos. */
export async function getStock() {
  const result = await db.query(`${AVAILABLE_SQL} ORDER BY p.name ASC`);
  return result.rows;
}

/** Disponible de un producto (por id o slug), o null si no existe. */
export async function getProductStock(sku) {
  if (!sku) return null;
  const result = await db.query(`${AVAILABLE_SQL} WHERE p.id = ? OR p.slug = ? LIMIT 1`, [sku, sku]);
  return result.rows[0] || null;
}

/**
 * Fija el stock físico de un producto dejando el movimiento en el libro.
 * @returns {Promise<{ before: number, after: number }|null>} null si no existe.
 */
export async function updateStock(sku, quantity, { userId = null, reason = 'Ajuste de stock' } = {}) {
  if (!sku) throw new Error('SKU requerido');
  const after = Number(quantity);
  const result = await db.withTransaction(async (tx) => {
    const cur = await tx.query('SELECT stock_quantity FROM products WHERE id = ?', [sku]);
    if (!cur.rows.length) return null;
    const before = Number(cur.rows[0].stock_quantity) || 0;
    if (before !== after) {
      await tx.query("UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?", [after, sku]);
      await tx.query(
        `INSERT INTO inventory_movements
           (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, user_id)
         VALUES (?, 'ajuste', ?, ?, ?, ?, 'API-STOCK', ?)`,
        [sku, after - before, before, after, reason, userId],
      );
    }
    return { before, after };
  });
  if (result && result.before !== result.after) scheduleStockSync([sku]);
  return result;
}

export const stockRouter = Router();

const adminOnly = [authenticateToken, requireRole('admin')];

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(422).json({ success: false, error: errors.array()[0].msg, errors: errors.array() });
  return false;
}

const toPublic = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  image_url: r.image_url,
  price_cop: r.price,
  available: Number(r.available) || 0,
});

// GET /api/stock: disponible público de todo el catálogo.
// `data` es el contrato de packages/shared (StockItem); `items` se conserva con
// la forma anterior ({ slug, stock }) para no romper integraciones viejas.
stockRouter.get('/', async (req, res) => {
  try {
    const rows = await getStock();
    res.json({
      success: true,
      data: rows.map(toPublic),
      items: rows.map((r) => ({ slug: r.slug || r.id, stock: Number(r.available) || 0, name: r.name, image_url: r.image_url, price_cop: r.price })),
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/stock] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// POST /api/stock: crear producto (solo admin).
stockRouter.post('/', ...adminOnly,
  [
    body('id').isString().trim().notEmpty().withMessage('id requerido'),
    body('name').isString().trim().notEmpty().withMessage('name requerido'),
    body('price').isInt({ min: 0 }).withMessage('price debe ser un entero positivo').toInt(),
    body('stock').optional().isInt({ min: 0 }).withMessage('stock debe ser un entero positivo').toInt(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { id, name, category, origin, process: proc, roast, price, stock, image_url } = req.body;

      const existing = await db.query('SELECT id FROM products WHERE id = ?', [id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'El producto con este ID ya existe' });
      }

      await db.query(
        'INSERT INTO products (id, name, category, origin, process, roast, price, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, name, category || 'cafe', origin || null, proc || null, roast || null, price, stock || 0, image_url || null],
      );
      await logAudit(req.user.id, 'create', 'product', id, { name, price, stock: stock || 0 });

      const result = await db.query('SELECT * FROM products WHERE id = ?', [id]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      logger.error({ err }, '[POST /api/stock] Error:');
      res.status(500).json({ success: false, error: 'Error creando producto' });
    }
  });

// POST /api/stock/sync/mercadolibre: envía a ML el stock de los productos
// vinculados. { all: true } revisa todos; por defecto solo los pendientes.
// Va antes de las rutas con :sku para que Express no lo tome como un SKU.
stockRouter.post('/sync/mercadolibre', ...adminOnly,
  [body('all').optional().isBoolean().toBoolean(), body('force').optional().isBoolean().toBoolean()],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const summary = await pushListings({ all: Boolean(req.body.all), force: Boolean(req.body.force) });
      res.json({ success: true, data: summary });
    } catch (err) {
      if (err.code && err.status) {
        return res.status(err.status).json({ success: false, error: err.message, code: err.code });
      }
      logger.error({ err }, '[POST /api/stock/sync/mercadolibre] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  });

// POST /api/stock/update: { sku, quantity }. Antes quedaba tapado por POST /:sku
// (Express tomaba "update" como SKU); ahora se declara primero.
stockRouter.post('/update', ...adminOnly,
  [
    body('sku').isString().trim().notEmpty().withMessage('sku requerido'),
    body('quantity').isInt({ min: 0 }).withMessage('quantity debe ser un entero de 0 en adelante').toInt(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const updated = await updateStock(req.body.sku, req.body.quantity, { userId: req.user.id });
      if (!updated) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
      await logAudit(req.user.id, 'ajuste', 'product', req.body.sku, { stockBefore: updated.before, stockAfter: updated.after });
      res.json({ success: true, data: { sku: req.body.sku, stock: updated.after, before: updated.before } });
    } catch (err) {
      logger.error({ err }, '[POST /api/stock/update] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  });

// POST /api/stock/:sku: { stock }. Fija el stock físico del producto.
stockRouter.post('/:sku', ...adminOnly,
  [
    param('sku').isString().trim().notEmpty(),
    body('stock').isInt({ min: 0 }).withMessage('stock debe ser un entero de 0 en adelante').toInt(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const updated = await updateStock(req.params.sku, req.body.stock, { userId: req.user.id });
      if (!updated) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
      await logAudit(req.user.id, 'ajuste', 'product', req.params.sku, { stockBefore: updated.before, stockAfter: updated.after });
      res.json({ success: true, data: { sku: req.params.sku, stock: updated.after, before: updated.before } });
    } catch (err) {
      logger.error({ err }, '[POST /api/stock/:sku] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  });

// GET /api/stock/:sku: disponible de un producto (por id o slug).
stockRouter.get('/:sku', async (req, res) => {
  try {
    const record = await getProductStock(req.params.sku?.trim());
    if (!record) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    res.json({ success: true, data: toPublic(record), stock: Number(record.available) || 0 });
  } catch (err) {
    logger.error({ err }, '[GET /api/stock/:sku] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});
