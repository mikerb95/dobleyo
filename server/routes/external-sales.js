import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import { query, withTransaction } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';
import { apiLimiter } from '../middleware/rateLimit.js';

export const externalSalesRouter = Router();

externalSalesRouter.use(apiLimiter);
externalSalesRouter.use(authenticateToken);
externalSalesRouter.use(requireRole('admin'));

// Generar número de venta correlativo: EXT-2026-0001
async function generateSaleNumber() {
  const year = new Date().getFullYear();
  const result = await query(
    `SELECT COUNT(*) as cnt FROM external_sales WHERE sale_number LIKE ?`,
    [`EXT-${year}-%`]
  );
  const seq = (result.rows[0].cnt || 0) + 1;
  return `EXT-${year}-${String(seq).padStart(4, '0')}`;
}

// GET / — listar ventas con filtros y paginación
externalSalesRouter.get('/', async (req, res) => {
  try {
    const { channel, status, search, from, to, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT
        es.*,
        u.first_name || ' ' || u.last_name AS registered_by_name
      FROM external_sales es
      LEFT JOIN users u ON es.registered_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (channel) { sql += ' AND es.channel = ?'; params.push(channel); }
    if (status)  { sql += ' AND es.status = ?';  params.push(status); }
    if (from)    { sql += ' AND es.sale_date >= ?'; params.push(from); }
    if (to)      { sql += ' AND es.sale_date <= ?'; params.push(to); }
    if (search) {
      sql += ' AND (es.sale_number LIKE ? OR es.customer_name LIKE ? OR es.customer_city LIKE ?)';
      const p = `%${search}%`;
      params.push(p, p, p);
    }

    sql += ' ORDER BY es.sale_date DESC, es.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [salesResult, countResult, statsResult] = await Promise.all([
      query(sql, params),
      query(
        `SELECT COUNT(*) as total FROM external_sales es WHERE 1=1
         ${channel ? ' AND es.channel = ?' : ''}
         ${status  ? ' AND es.status = ?'  : ''}
         ${from    ? ' AND es.sale_date >= ?' : ''}
         ${to      ? ' AND es.sale_date <= ?' : ''}
         ${search  ? ' AND (es.sale_number LIKE ? OR es.customer_name LIKE ? OR es.customer_city LIKE ?)' : ''}`,
        params.slice(0, -2)
      ),
      query(`
        SELECT
          COUNT(*) as total_sales,
          COALESCE(SUM(total), 0) as total_revenue,
          channel,
          COUNT(CASE WHEN status = 'completada' THEN 1 END) as completed
        FROM external_sales
        GROUP BY channel
        ORDER BY total_sales DESC
      `),
    ]);

    res.json({
      success: true,
      sales: salesResult.rows,
      total: countResult.rows[0].total,
      stats: statsResult.rows,
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/external-sales] Error:');
    res.status(500).json({ success: false, error: 'Error al obtener ventas externas' });
  }
});

// GET /:id — detalle de una venta con sus ítems
externalSalesRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [saleResult, itemsResult] = await Promise.all([
      query(
        `SELECT es.*, u.first_name || ' ' || u.last_name AS registered_by_name
         FROM external_sales es
         LEFT JOIN users u ON es.registered_by = u.id
         WHERE es.id = ?`,
        [id]
      ),
      query(
        `SELECT esi.*, p.name as product_name, p.sku, l.code as lot_code
         FROM external_sale_items esi
         JOIN products p ON esi.product_id = p.id
         LEFT JOIN lots l ON esi.lot_id = l.id
         WHERE esi.sale_id = ?
         ORDER BY esi.id`,
        [id]
      ),
    ]);

    if (!saleResult.rows[0]) {
      return res.status(404).json({ success: false, error: 'Venta no encontrada' });
    }

    res.json({ success: true, sale: saleResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/external-sales/:id] Error:');
    res.status(500).json({ success: false, error: 'Error al obtener la venta' });
  }
});

// POST / — registrar nueva venta externa + ajustar inventario
externalSalesRouter.post('/',
  [
    body('channel').isIn(['instagram','whatsapp','referido','tienda_fisica','telefono','otro']).withMessage('Canal inválido'),
    body('sale_date').isDate().withMessage('Fecha de venta inválida'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
    body('items.*.product_id').notEmpty().withMessage('ID de producto requerido'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Cantidad debe ser >= 1'),
    body('items.*.unit_price').isInt({ min: 0 }).withMessage('Precio unitario inválido'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const {
      channel, channel_detail, customer_name, customer_contact,
      customer_city, customer_state, sale_date, discount = 0,
      notes, status = 'completada', items,
    } = req.body;

    try {
      let saleId;

      await withTransaction(async (client) => {
        const sale_number = await generateSaleNumber();

        // Calcular totales
        const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
        const total = Math.max(0, subtotal - Number(discount));

        // Insertar cabecera
        const saleResult = await client.execute({
          sql: `INSERT INTO external_sales
                  (sale_number, channel, channel_detail, customer_name, customer_contact,
                   customer_city, customer_state, sale_date, subtotal, discount, total,
                   notes, status, registered_by)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            sale_number, channel, channel_detail || null, customer_name || null,
            customer_contact || null, customer_city || null, customer_state || null,
            sale_date, subtotal, Number(discount), total,
            notes || null, status, req.user.id,
          ],
        });

        saleId = Number(saleResult.lastInsertRowid);

        // Procesar cada ítem
        for (const item of items) {
          const { product_id, quantity, unit_price, lot_id } = item;
          const itemSubtotal = quantity * unit_price;

          // Obtener stock actual
          const prodResult = await client.execute({
            sql: 'SELECT stock_quantity FROM products WHERE id = ?',
            args: [product_id],
          });
          if (!prodResult.rows[0]) {
            throw new Error(`Producto no encontrado: ${product_id}`);
          }

          const stockBefore = prodResult.rows[0].stock_quantity || 0;
          const stockAfter = stockBefore - quantity;

          // Insertar ítem
          await client.execute({
            sql: `INSERT INTO external_sale_items (sale_id, product_id, quantity, unit_price, subtotal, lot_id)
                  VALUES (?,?,?,?,?,?)`,
            args: [saleId, product_id, quantity, unit_price, itemSubtotal, lot_id || null],
          });

          // Solo ajustar inventario si la venta está completada
          if (status === 'completada') {
            await client.execute({
              sql: `UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`,
              args: [stockAfter, product_id],
            });

            await client.execute({
              sql: `INSERT INTO inventory_movements
                      (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, user_id)
                    VALUES (?, 'salida', ?, ?, ?, 'venta_externa', ?, ?)`,
              args: [product_id, quantity, stockBefore, stockAfter, sale_number, req.user.id],
            });
          }
        }
      });

      await logAudit(req.user.id, 'create', 'external_sale', saleId, { channel, items: items.length, status });

      res.status(201).json({ success: true, id: saleId });
    } catch (err) {
      logger.error({ err }, '[POST /api/external-sales] Error:');
      res.status(500).json({ success: false, error: err.message || 'Error al registrar la venta' });
    }
  }
);

// PUT /:id/cancel — cancelar venta y revertir inventario
externalSalesRouter.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;

  try {
    const saleResult = await query('SELECT * FROM external_sales WHERE id = ?', [id]);
    const sale = saleResult.rows[0];

    if (!sale) return res.status(404).json({ success: false, error: 'Venta no encontrada' });
    if (sale.status === 'cancelada') {
      return res.status(400).json({ success: false, error: 'La venta ya está cancelada' });
    }

    const itemsResult = await query(
      'SELECT * FROM external_sale_items WHERE sale_id = ?', [id]
    );

    await withTransaction(async (client) => {
      // Revertir inventario solo si estaba completada
      if (sale.status === 'completada') {
        for (const item of itemsResult.rows) {
          const prodResult = await client.execute({
            sql: 'SELECT stock_quantity FROM products WHERE id = ?',
            args: [item.product_id],
          });
          const stockBefore = prodResult.rows[0]?.stock_quantity || 0;
          const stockAfter = stockBefore + item.quantity;

          await client.execute({
            sql: `UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`,
            args: [stockAfter, item.product_id],
          });

          await client.execute({
            sql: `INSERT INTO inventory_movements
                    (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, user_id)
                  VALUES (?, 'devolucion', ?, ?, ?, 'cancelacion_venta_externa', ?, ?)`,
            args: [item.product_id, item.quantity, stockBefore, stockAfter, sale.sale_number, req.user.id],
          });
        }
      }

      await client.execute({
        sql: `UPDATE external_sales SET status = 'cancelada', updated_at = datetime('now') WHERE id = ?`,
        args: [id],
      });
    });

    await logAudit(req.user.id, 'cancel', 'external_sale', id, { sale_number: sale.sale_number });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, '[PUT /api/external-sales/:id/cancel] Error:');
    res.status(500).json({ success: false, error: 'Error al cancelar la venta' });
  }
});
