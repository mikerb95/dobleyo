import express from 'express';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../services/audit.js';

export const inventoryRouter = express.Router();

// Aplicar rate limiting y autenticación (solo admin)
inventoryRouter.use(apiLimiter);
inventoryRouter.use(authenticateToken);
inventoryRouter.use(requireRole('admin'));

// ============================================
// PRODUCTOS - CRUD
// ============================================

// Campos que se persisten como JSON en columnas TEXT. `null` debe guardarse como
// NULL y no como la cadena "null" (que corrompe el valor en lecturas posteriores).
function jsonOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() ? value : null;
  if (Array.isArray(value) && value.length === 0) return null;
  return JSON.stringify(value);
}

// Normaliza un slug a minúsculas sin acentos ni caracteres especiales.
function normalizeSlug(value) {
  if (!value) return null;
  const slug = String(value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

// Verifica que el slug no esté tomado por otro producto.
async function slugTaken(slug, excludeId = null) {
  if (!slug) return false;
  const result = excludeId
    ? await query('SELECT id FROM products WHERE slug = ? AND id != ?', [slug, excludeId])
    : await query('SELECT id FROM products WHERE slug = ?', [slug]);
  return result.rows.length > 0;
}

// GET - Listar todos los productos (con filtros)
inventoryRouter.get('/products', async (req, res) => {
  try {
    const { category, active, search, sortBy = 'name', order = 'ASC' } = req.query;

    let sql = `
      SELECT p.*,
             (SELECT COUNT(*)            FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_count,
             (SELECT SUM(v.stock_quantity) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_stock,
             (SELECT MIN(v.price_cop)    FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_min_price,
             (SELECT MAX(v.price_cop)    FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_max_price
      FROM products p WHERE 1=1`;
    const params = [];

    if (category) {
      sql += ' AND p.category = ?';
      params.push(category);
    }

    if (active === 'true' || active === 'false') {
      sql += ' AND p.is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Validar sortBy para evitar SQL injection
    const allowedSortFields = ['name', 'category', 'price', 'stock_quantity', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    sql += ` ORDER BY p.${sortField} ${sortOrder}`;

    const result = await query(sql, params);

    res.json({
      success: true,
      products: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    logger.error('Error listing products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener un producto por ID
inventoryRouter.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('SELECT * FROM products WHERE id = ?', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    // Obtener movimientos recientes
    const movements = await query(
      `SELECT * FROM inventory_movements 
       WHERE product_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [id]
    );

    // Obtener proveedores
    const suppliers = await query(
      `SELECT psp.*, ps.name as supplier_name 
       FROM product_supplier_prices psp
       JOIN product_suppliers ps ON psp.supplier_id = ps.id
       WHERE psp.product_id = ?
       ORDER BY psp.is_preferred DESC`,
      [id]
    );

    res.json({
      success: true,
      product: result.rows[0],
      recentMovements: movements.rows,
      suppliers: suppliers.rows
    });
  } catch (error) {
    logger.error('Error getting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Crear nuevo producto
inventoryRouter.post('/products', async (req, res) => {
  try {
    const {
      id, sku, name, description, category, subcategory,
      origin, process, roast, price, cost,
      is_deal, is_bestseller, is_new, is_fast, is_active,
      image_url, images, stock_quantity, stock_min,
      weight, weight_unit, dimensions,
      meta_keywords, meta_description
    } = req.body;

    // Validaciones básicas
    if (!id || !name || !category || !price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos requeridos: id, name, category, price' 
      });
    }

    // Verificar que el ID no exista
    const existing = await query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Ya existe un producto con ese ID' 
      });
    }

    const result = await query(
      `INSERT INTO products (
        id, sku, name, description, category, subcategory,
        origin, process, roast, price, cost,
        is_deal, is_bestseller, is_new, is_fast, is_active,
        image_url, images, stock_quantity, stock_min,
        weight, weight_unit, dimensions,
        meta_keywords, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, sku, name, description, category, subcategory,
        origin, process, roast, price, cost,
        is_deal ? 1 : 0, is_bestseller ? 1 : 0, is_new ? 1 : 0,
        is_fast ? 1 : 0, is_active !== false ? 1 : 0,
        image_url, images ? JSON.stringify(images) : null,
        stock_quantity || 0, stock_min || 0,
        weight, weight_unit || 'g', dimensions,
        meta_keywords, meta_description
      ]
    );

    // Registrar movimiento inicial si hay stock
    if (stock_quantity > 0) {
      await query(
        `INSERT INTO inventory_movements (
          product_id, movement_type, quantity, quantity_before, quantity_after,
          reason, reference
        ) VALUES (?, 'entrada', ?, 0, ?, 'Stock inicial', 'INIT')`,
        [id, stock_quantity, stock_quantity]
      );
    }

    res.status(201).json({
      success: true,
      productId: id,
      message: 'Producto creado exitosamente'
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Actualizar producto
inventoryRouter.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar que el producto existe
    const existing = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    // Construir query dinámicamente
    const allowedFields = [
      'sku', 'name', 'description', 'category', 'subcategory',
      'origin', 'process', 'roast', 'price', 'cost',
      'is_deal', 'is_bestseller', 'is_new', 'is_fast', 'is_active',
      'image_url', 'images', 'stock_min', 'rating',
      'weight', 'weight_unit', 'dimensions',
      'meta_keywords', 'meta_description'
    ];

    const updates = [];
    const values = [];

    const boolFields = new Set(['is_deal', 'is_bestseller', 'is_new', 'is_fast', 'is_active']);

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        let val = updateData[field];
        if (boolFields.has(field)) {
          val = val ? 1 : 0;
        } else if (field === 'images' && typeof val === 'object') {
          val = JSON.stringify(val);
        }
        values.push(val);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
    }

    values.push(id);

    await query(
      `UPDATE products SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente'
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Eliminar producto (soft delete)
inventoryRouter.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query; // ?hard=true para eliminación física

    const existing = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    if (hard === 'true') {
      // Eliminación física
      await query('DELETE FROM products WHERE id = ?', [id]);
    } else {
      // Soft delete
      await query('UPDATE products SET is_active = FALSE WHERE id = ?', [id]);
    }

    res.json({
      success: true,
      message: hard === 'true' ? 'Producto eliminado' : 'Producto desactivado'
    });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MOVIMIENTOS DE INVENTARIO
// ============================================

// POST - Registrar movimiento de inventario
inventoryRouter.post('/movements', async (req, res) => {
  try {
    const {
      product_id,
      movement_type, // entrada, salida, ajuste, merma, devolucion
      quantity,
      reason,
      reference,
      notes,
      user_id
    } = req.body;

    if (!product_id || !movement_type || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: product_id, movement_type, quantity'
      });
    }

    // Obtener stock actual
    const productResult = await query(
      'SELECT stock_quantity FROM products WHERE id = ?',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    const currentStock = productResult.rows[0].stock_quantity;
    let newStock = currentStock;

    // Calcular nuevo stock según tipo de movimiento
    switch (movement_type) {
      case 'entrada':
      case 'devolucion':
        newStock = currentStock + Math.abs(quantity);
        break;
      case 'salida':
      case 'merma':
        newStock = currentStock - Math.abs(quantity);
        break;
      case 'ajuste':
        newStock = quantity; // El quantity es el nuevo valor absoluto
        break;
      default:
        return res.status(400).json({ success: false, error: 'Tipo de movimiento inválido' });
    }

    // Validar que no quede stock negativo
    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        error: `Stock insuficiente. Stock actual: ${currentStock}, intentando restar: ${Math.abs(quantity)}`
      });
    }

    // Registrar movimiento
    await query(
      `INSERT INTO inventory_movements (
        product_id, movement_type, quantity, quantity_before, quantity_after,
        reason, reference, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id, movement_type,
        movement_type === 'ajuste' ? newStock - currentStock : quantity,
        currentStock, newStock,
        reason, reference, notes, user_id
      ]
    );

    // Actualizar stock del producto
    await query(
      'UPDATE products SET stock_quantity = ? WHERE id = ?',
      [newStock, product_id]
    );

    res.json({
      success: true,
      stockBefore: currentStock,
      stockAfter: newStock,
      message: 'Movimiento registrado exitosamente'
    });
  } catch (error) {
    logger.error('Error recording movement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Registrar movimiento de peso sobre un lote de café (kg, decimal)
// Ajusta lots.weight y deja traza en lot_movements. movement_type:
//   entrada → suma kg · salida/merma → resta kg · ajuste → fija el peso total.
inventoryRouter.post('/lots/:id/movement', async (req, res) => {
  try {
    const { id } = req.params;
    const { movement_type, quantity, reason, reference, notes } = req.body;

    const ALLOWED = ['entrada', 'salida', 'ajuste', 'merma'];
    if (!movement_type || !ALLOWED.includes(movement_type)) {
      return res.status(400).json({ success: false, error: 'Tipo de movimiento inválido' });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'La cantidad debe ser un número mayor a 0' });
    }

    const lotResult = await query('SELECT id, code, weight FROM lots WHERE id = ?', [id]);
    if (lotResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lote no encontrado' });
    }

    const lot = lotResult.rows[0];
    const before = Number(lot.weight) || 0;
    let after = before;

    switch (movement_type) {
      case 'entrada':       after = before + qty; break;
      case 'salida':
      case 'merma':         after = before - qty; break;
      case 'ajuste':        after = qty; break; // qty es el nuevo peso total
    }

    if (after < 0) {
      return res.status(400).json({
        success: false,
        error: `Peso insuficiente. Peso actual: ${before} kg, intentando restar: ${qty} kg`
      });
    }

    // Redondear a 2 decimales para evitar arrastre binario.
    after = Math.round(after * 100) / 100;

    await query(
      `INSERT INTO lot_movements (
        lot_id, movement_type, quantity, weight_before, weight_after,
        reason, reference, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, movement_type, qty, before, after,
        reason || null, reference || null, notes || null,
        req.user?.id || null
      ]
    );

    await query(
      'UPDATE lots SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [after, id]
    );

    await logAudit(req.user?.id, movement_type, 'lot', id, {
      code: lot.code, weight_before: before, weight_after: after, quantity: qty, reason
    });

    res.json({
      success: true,
      lot_id: Number(id),
      weight_before: before,
      weight_after: after,
      message: `Movimiento registrado en lote ${lot.code}. Peso: ${before} → ${after} kg`
    });
  } catch (error) {
    logger.error('[POST /inventory/lots/:id/movement] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// GET - Historial de movimientos
inventoryRouter.get('/movements', async (req, res) => {
  try {
    const { product_id, movement_type, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT im.*, p.name as product_name, u.name as user_name
      FROM inventory_movements im
      LEFT JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      sql += ' AND im.product_id = ?';
      params.push(product_id);
    }

    if (movement_type) {
      sql += ' AND im.movement_type = ?';
      params.push(movement_type);
    }

    sql += ' ORDER BY im.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    res.json({
      success: true,
      movements: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error listing movements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// INGRESO MANUAL DE UNIDADES
// ============================================

// POST - Ingreso manual de unidades (SAP-style)
inventoryRouter.post('/entrada', async (req, res) => {
  try {
    const {
      product_id,
      quantity,
      cost_unit,
      reason,
      reference,
      notes,
      // Campos café (trazabilidad)
      lot_code,
      lot_name,
      farm,
      producer,
      origin,
      altitude,
      variety,
      process,
      roast,
      harvest_date,
      roast_date,
      moisture,
      score,
      lot_weight,
      aroma,
      flavor_notes,
      acidity,
      body,
      shade_system,
    } = req.body;

    if (!product_id || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: product_id, quantity (mínimo 1)'
      });
    }

    const productResult = await query(
      'SELECT id, name, category, stock_quantity, cost FROM products WHERE id = ?',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    const product = productResult.rows[0];
    const currentStock = product.stock_quantity;
    const newStock = currentStock + parseInt(quantity);
    let lot_id = null;

    if (product.category === 'cafe') {
      if (!lot_code || !lot_name) {
        return res.status(400).json({
          success: false,
          error: 'Para café se requiere código y nombre del lote'
        });
      }

      const existingLot = await query('SELECT id FROM lots WHERE code = ?', [lot_code]);
      if (existingLot.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Ya existe un lote con código "${lot_code}"`
        });
      }

      const lotResult = await query(
        `INSERT INTO lots (
          code, name, origin, farm, producer, altitude, variety,
          shade_system, process, roast, harvest_date, roast_date,
          moisture, score, notes, product_id, weight, weight_unit,
          aroma, flavor_notes, acidity, body, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'kg', ?, ?, ?, ?, 'tostado')`,
        [
          lot_code, lot_name,
          origin || null, farm || null, producer || null,
          altitude || null, variety || null, shade_system || null,
          process || null, roast || null,
          harvest_date || null, roast_date || null,
          moisture || null, score || null,
          notes || null, product_id,
          lot_weight || null,
          aroma || null, flavor_notes || null,
          acidity || null, body || null
        ]
      );

      lot_id = Number(lotResult.lastInsertRowid);
    }

    await query(
      `INSERT INTO inventory_movements (
        product_id, movement_type, quantity, quantity_before, quantity_after,
        reason, reference, notes, user_id
      ) VALUES (?, 'entrada', ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id, parseInt(quantity),
        currentStock, newStock,
        reason || 'Ingreso manual',
        reference || (lot_id ? `LOTE-${lot_code}` : null),
        notes || null,
        req.user?.id || null
      ]
    );

    await query(
      'UPDATE products SET stock_quantity = ?, cost = COALESCE(?, cost), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStock, cost_unit || null, product_id]
    );

    res.status(201).json({
      success: true,
      product_id,
      lot_id,
      lot_code: lot_code || null,
      stock_before: currentStock,
      stock_after: newStock,
      units_added: parseInt(quantity),
      message: `Se ingresaron ${quantity} unidades de "${product.name}". Stock: ${currentStock} → ${newStock}`
    });
  } catch (error) {
    logger.error('[POST /inventory/entrada] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ============================================
// ALERTAS DE STOCK BAJO
// ============================================

// GET - Productos con stock bajo
inventoryRouter.get('/alerts/low-stock', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, sku, name, category, 
        stock_quantity, stock_min,
        (stock_quantity - stock_min) as difference
      FROM products
      WHERE is_active = TRUE 
        AND stock_quantity <= stock_min
        AND stock_min > 0
      ORDER BY difference ASC
    `);

    res.json({
      success: true,
      alerts: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    logger.error('Error getting low stock alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// VISTA OPERATIVA DE INVENTARIO  (consumida por src/components/InventarioApp.jsx)
// Envoltorio estándar: { success: true, data }
// Tabs: green / roast (tabla lots) · pack (products) · labels (generated_labels)
// ============================================================================

// Bodega única por ahora: el modelo de datos no segmenta almacenes.
const DEFAULT_WAREHOUSE = 'Principal';
// Categorías de products que se gestionan como insumos/empaque con stock por unidad.
const PACK_CATEGORIES = ['accesorio', 'merchandising'];

// Parsea humedad almacenada como texto ("11.5%", "11,5") a número.
function parseHumidity(raw) {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(',', '.').replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

// Días transcurridos desde una fecha ISO hasta hoy.
function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
}

// Estado de un lote de café verde.
function greenStatus(kg, days) {
  if (kg != null && kg < 30) return 'low';
  if (days != null && days > 180) return 'warn';
  return 'ok';
}
// Estado de un lote tostado (frescura).
function roastStatus(kg, days) {
  if (kg != null && kg < 10) return 'low';
  if (days != null && days > 14) return 'warn';
  return 'ok';
}
// Estado de un SKU con stock/mín.
function stockStatus(stock, min) {
  const s = Number(stock) || 0;
  const m = Number(min) || 0;
  if (m > 0 && s <= m) return 'low';
  if (m > 0 && s <= m * 1.5) return 'warn';
  return 'ok';
}

// GET - Resumen para tabs + KPIs
inventoryRouter.get('/summary', async (req, res) => {
  try {
    const packPlaceholders = PACK_CATEGORIES.map(() => '?').join(', ');

    const [green, roast, pack, labels] = await Promise.all([
      query(`SELECT
                COALESCE(SUM(weight), 0) AS total,
                COUNT(*) AS lots,
                SUM(CASE WHEN weight < 30
                          OR (julianday('now') - julianday(COALESCE(harvest_date, created_at))) > 180
                         THEN 1 ELSE 0 END) AS alerts
              FROM lots WHERE estado = 'verde'`),
      query(`SELECT
                COALESCE(SUM(weight), 0) AS total,
                COUNT(*) AS lots,
                SUM(CASE WHEN weight < 10
                          OR (julianday('now') - julianday(COALESCE(fecha_tostado, roast_date, created_at))) > 14
                         THEN 1 ELSE 0 END) AS alerts
              FROM lots WHERE estado = 'tostado'`),
      query(`SELECT
                COALESCE(SUM(stock_quantity), 0) AS total,
                COUNT(*) AS skus,
                SUM(CASE WHEN stock_min > 0 AND stock_quantity <= stock_min THEN 1 ELSE 0 END) AS below_min
              FROM products
              WHERE is_active = TRUE AND category IN (${packPlaceholders})`, PACK_CATEGORIES),
      query(`SELECT
                COUNT(*) AS total,
                COUNT(DISTINCT COALESCE(lot_code, label_code)) AS skus,
                SUM(CASE WHEN printed = 0 OR printed IS NULL THEN 1 ELSE 0 END) AS below_min
              FROM generated_labels`),
    ]);

    const suppliers = await query(
      `SELECT COUNT(DISTINCT psp.supplier_id) AS n
         FROM product_supplier_prices psp
         JOIN products p ON p.id = psp.product_id
        WHERE p.category IN (${packPlaceholders})`, PACK_CATEGORIES);

    const g = green.rows[0], r = roast.rows[0], pk = pack.rows[0], lb = labels.rows[0];

    res.json({
      success: true,
      data: {
        green: { total: Number(g.total) || 0, lots: Number(g.lots) || 0, reserved: 0, alerts: Number(g.alerts) || 0 },
        roast: { total: Number(r.total) || 0, lots: Number(r.lots) || 0, reserved: 0, alerts: Number(r.alerts) || 0 },
        pack: {
          total: Number(pk.total) || 0, skus: Number(pk.skus) || 0,
          below_min: Number(pk.below_min) || 0,
          suppliers: Number(suppliers.rows[0]?.n) || 0, in_transit: null,
        },
        labels: {
          total: Number(lb.total) || 0, skus: Number(lb.skus) || 0,
          below_min: Number(lb.below_min) || 0, qr_version: null, printer: null,
        },
      },
    });
  } catch (error) {
    logger.error('[GET /inventory/summary] Error:', error);
    res.status(500).json({ success: false, error: { code: 'summary_failed', message: error.message } });
  }
});

// GET - Ítems por tipo (green | roast | pack | labels)
// Cada item.id es compuesto: "<type>:<id real>" para que /items/:id sepa la tabla.
inventoryRouter.get('/items', async (req, res) => {
  const type = String(req.query.type || 'green');
  try {
    if (type === 'green' || type === 'roast') {
      const estado = type === 'green' ? 'verde' : 'tostado';
      const result = await query(
        `SELECT id, code, origin, producer, variety, roast, moisture, weight,
                harvest_date, roast_date, fecha_tostado, created_at
           FROM lots WHERE estado = ? ORDER BY created_at DESC`, [estado]);

      const data = result.rows.map((l) => {
        const kg = l.weight != null ? Number(l.weight) : null;
        if (type === 'green') {
          const days = daysSince(l.harvest_date || l.created_at);
          return {
            id: `green:${l.id}`, code: l.code, origin: l.origin, farmer: l.producer,
            warehouse: DEFAULT_WAREHOUSE, variety: l.variety, kg,
            days_in_storage: days, humidity_pct: parseHumidity(l.moisture),
            reserved_kg: 0, status: greenStatus(kg, days),
          };
        }
        const days = daysSince(l.fecha_tostado || l.roast_date || l.created_at);
        return {
          id: `roast:${l.id}`, code: l.code, origin: l.origin, farmer: l.producer,
          warehouse: DEFAULT_WAREHOUSE, profile: l.roast, kg,
          days_since_roast: days, reserved_kg: 0, reserved_for: null,
          status: roastStatus(kg, days),
        };
      });
      return res.json({ success: true, data });
    }

    if (type === 'pack') {
      const packPlaceholders = PACK_CATEGORIES.map(() => '?').join(', ');
      const result = await query(
        `SELECT p.id, p.sku, p.name, p.stock_quantity, p.stock_min,
                sup.name AS supplier_name, psp.lead_time_days,
                (SELECT MAX(created_at) FROM inventory_movements im
                  WHERE im.product_id = p.id AND im.movement_type IN ('entrada','devolucion')) AS last_in,
                (SELECT MAX(created_at) FROM inventory_movements im
                  WHERE im.product_id = p.id AND im.movement_type IN ('salida','merma')) AS last_out
           FROM products p
           LEFT JOIN product_supplier_prices psp
                  ON psp.product_id = p.id AND psp.is_preferred = TRUE
           LEFT JOIN product_suppliers sup ON sup.id = psp.supplier_id
          WHERE p.is_active = TRUE AND p.category IN (${packPlaceholders})
          ORDER BY p.name ASC`, PACK_CATEGORIES);

      const data = result.rows.map((p) => {
        const stock = Number(p.stock_quantity) || 0;
        const min = Number(p.stock_min) || 0;
        const max = min > 0 ? min * 5 : Math.max(stock, 100);
        return {
          id: `pack:${p.id}`, sku: p.sku || p.id, name: p.name,
          supplier: p.supplier_name, lead_days: p.lead_time_days,
          stock, min, max, last_in: p.last_in, last_out: p.last_out,
          status: stockStatus(stock, min),
        };
      });
      return res.json({ success: true, data });
    }

    if (type === 'labels') {
      // Agrupa etiquetas generadas por plantilla (lote de origen).
      const result = await query(
        `SELECT MIN(id) AS id,
                COALESCE(lot_code, label_code) AS template,
                origin, variety,
                COUNT(*) AS total,
                SUM(CASE WHEN printed = 1 THEN 1 ELSE 0 END) AS printed_count,
                MAX(printed_at) AS last_print
           FROM generated_labels
          GROUP BY COALESCE(lot_code, label_code)
          ORDER BY MAX(created_at) DESC`);

      const data = result.rows.map((g) => {
        const stock = Number(g.total) || 0;
        const min = 0;
        return {
          id: `labels:${g.id}`, sku: g.template,
          name: [g.origin, g.variety].filter(Boolean).join(' · ') || 'Etiqueta',
          qr_template: g.template, printer: null,
          stock, min, max: Math.max(stock, 1),
          last_print: g.last_print, status: stockStatus(stock, min),
        };
      });
      return res.json({ success: true, data });
    }

    return res.status(400).json({ success: false, error: { code: 'bad_type', message: 'Tipo inválido' } });
  } catch (error) {
    logger.error('[GET /inventory/items] Error:', error);
    res.status(500).json({ success: false, error: { code: 'items_failed', message: error.message } });
  }
});

// GET - Detalle de un ítem (id compuesto "<type>:<id>") + movimientos
inventoryRouter.get('/items/:id', async (req, res) => {
  try {
    const raw = String(req.params.id);
    const sep = raw.indexOf(':');
    const type = sep > 0 ? raw.slice(0, sep) : 'green';
    const realId = sep > 0 ? raw.slice(sep + 1) : raw;

    if (type === 'green' || type === 'roast') {
      const result = await query(`SELECT * FROM lots WHERE id = ?`, [realId]);
      if (!result.rows.length) {
        return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Lote no encontrado' } });
      }
      const l = result.rows[0];
      const kg = l.weight != null ? Number(l.weight) : null;
      const isGreen = type === 'green';
      const days = isGreen
        ? daysSince(l.harvest_date || l.created_at)
        : daysSince(l.fecha_tostado || l.roast_date || l.created_at);

      const item = isGreen
        ? {
            id: `green:${l.id}`, code: l.code, origin: l.origin, farmer: l.producer,
            warehouse: DEFAULT_WAREHOUSE, variety: l.variety, kg,
            days_in_storage: days, humidity_pct: parseHumidity(l.moisture),
            reserved_kg: 0, status: greenStatus(kg, days), note: l.notes,
          }
        : {
            id: `roast:${l.id}`, code: l.code, origin: l.origin, farmer: l.producer,
            warehouse: DEFAULT_WAREHOUSE, profile: l.roast, kg,
            days_since_roast: days, reserved_kg: 0, reserved_for: null,
            status: roastStatus(kg, days), note: l.notes,
          };

      // Movimientos de peso del lote (kg). El delta real se calcula con
      // weight_after - weight_before para que 'ajuste' muestre el signo correcto.
      const mv = await query(
        `SELECT id, movement_type, weight_before, weight_after, reason, created_at
           FROM lot_movements WHERE lot_id = ? ORDER BY created_at DESC LIMIT 10`, [realId]);
      const movements = mv.rows.map((m) => ({
        id: m.id, when: m.created_at, what: m.reason || m.movement_type,
        qty: Math.round((Number(m.weight_after) - Number(m.weight_before)) * 100) / 100,
        unit: 'kg',
      }));

      return res.json({ success: true, data: { item, movements } });
    }

    if (type === 'pack') {
      const result = await query(
        `SELECT p.*, sup.name AS supplier_name, psp.lead_time_days
           FROM products p
           LEFT JOIN product_supplier_prices psp ON psp.product_id = p.id AND psp.is_preferred = TRUE
           LEFT JOIN product_suppliers sup ON sup.id = psp.supplier_id
          WHERE p.id = ?`, [realId]);
      if (!result.rows.length) {
        return res.status(404).json({ success: false, error: { code: 'not_found', message: 'SKU no encontrado' } });
      }
      const p = result.rows[0];
      const stock = Number(p.stock_quantity) || 0;
      const min = Number(p.stock_min) || 0;
      const lastIn = await query(
        `SELECT MAX(created_at) AS t FROM inventory_movements WHERE product_id = ? AND movement_type IN ('entrada','devolucion')`, [realId]);
      const lastOut = await query(
        `SELECT MAX(created_at) AS t FROM inventory_movements WHERE product_id = ? AND movement_type IN ('salida','merma')`, [realId]);

      const item = {
        id: `pack:${p.id}`, sku: p.sku || p.id, name: p.name,
        supplier: p.supplier_name, lead_days: p.lead_time_days,
        stock, min, max: min > 0 ? min * 5 : Math.max(stock, 100),
        last_in: lastIn.rows[0]?.t, last_out: lastOut.rows[0]?.t,
        status: stockStatus(stock, min), note: p.description,
      };

      const mv = await query(
        `SELECT id, movement_type, quantity, reason, created_at
           FROM inventory_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 10`, [realId]);
      const movements = mv.rows.map((m) => ({
        id: m.id, when: m.created_at, what: m.reason || m.movement_type,
        qty: ['salida', 'merma'].includes(m.movement_type) ? -Math.abs(m.quantity) : Math.abs(m.quantity),
        unit: 'u',
      }));

      return res.json({ success: true, data: { item, movements } });
    }

    if (type === 'labels') {
      const result = await query(`SELECT * FROM generated_labels WHERE id = ?`, [realId]);
      if (!result.rows.length) {
        return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Etiqueta no encontrada' } });
      }
      const g = result.rows[0];
      const template = g.lot_code || g.label_code;
      const agg = await query(
        `SELECT COUNT(*) AS total, MAX(printed_at) AS last_print
           FROM generated_labels WHERE COALESCE(lot_code, label_code) = ?`, [template]);
      const stock = Number(agg.rows[0]?.total) || 1;

      const item = {
        id: `labels:${g.id}`, sku: template,
        name: [g.origin, g.variety].filter(Boolean).join(' · ') || 'Etiqueta',
        qr_template: template, printer: null,
        stock, min: 0, max: Math.max(stock, 1),
        last_print: agg.rows[0]?.last_print, status: 'ok',
        note: g.flavor_notes,
      };
      return res.json({ success: true, data: { item, movements: [] } });
    }

    return res.status(400).json({ success: false, error: { code: 'bad_type', message: 'Tipo inválido' } });
  } catch (error) {
    logger.error('[GET /inventory/items/:id] Error:', error);
    res.status(500).json({ success: false, error: { code: 'detail_failed', message: error.message } });
  }
});

// GET - Feed de movimientos recientes (últimas 72 h) para la vista operativa
inventoryRouter.get('/feed', async (req, res) => {
  try {
    const [prod, lots] = await Promise.all([
      query(
        `SELECT im.id, im.movement_type, im.quantity, im.reason, im.reference, im.created_at,
                p.name AS product_name, u.name AS user_name
           FROM inventory_movements im
           LEFT JOIN products p ON p.id = im.product_id
           LEFT JOIN users u ON u.id = im.user_id
          WHERE im.created_at >= datetime('now', '-3 days')
          ORDER BY im.created_at DESC LIMIT 50`),
      query(
        `SELECT lm.id, lm.movement_type, lm.weight_before, lm.weight_after, lm.reason, lm.created_at,
                l.code AS lot_code, u.name AS user_name
           FROM lot_movements lm
           LEFT JOIN lots l ON l.id = lm.lot_id
           LEFT JOIN users u ON u.id = lm.user_id
          WHERE lm.created_at >= datetime('now', '-3 days')
          ORDER BY lm.created_at DESC LIMIT 50`),
    ]);

    // Prefijo en el id para evitar colisión entre ambas tablas (ambas autoincrement).
    const prodItems = prod.rows.map((m) => {
      const out = ['salida', 'merma'].includes(m.movement_type);
      const adj = m.movement_type === 'ajuste';
      return {
        id: `p${m.id}`,
        type: adj ? 'mv' : out ? 'out' : 'in',
        when: m.created_at,
        what: m.reason || m.product_name || m.movement_type,
        qty: out ? -Math.abs(m.quantity) : Math.abs(m.quantity),
        unit: 'u',
        by: m.user_name || 'Sistema',
      };
    });

    const lotItems = lots.rows.map((m) => {
      const delta = Math.round((Number(m.weight_after) - Number(m.weight_before)) * 100) / 100;
      const adj = m.movement_type === 'ajuste';
      return {
        id: `l${m.id}`,
        type: adj ? 'mv' : delta < 0 ? 'out' : 'in',
        when: m.created_at,
        what: m.reason || (m.lot_code ? `Lote ${m.lot_code}` : m.movement_type),
        qty: delta,
        unit: 'kg',
        by: m.user_name || 'Sistema',
      };
    });

    const data = [...prodItems, ...lotItems]
      .sort((a, b) => new Date(b.when) - new Date(a.when))
      .slice(0, 50);

    res.json({ success: true, data });
  } catch (error) {
    logger.error('[GET /inventory/feed] Error:', error);
    res.status(500).json({ success: false, error: { code: 'feed_failed', message: error.message } });
  }
});

// ============================================
// ESTADÍSTICAS DE INVENTARIO
// ============================================

// GET - Dashboard de inventario
inventoryRouter.get('/stats/dashboard', async (req, res) => {
  try {
    // Total productos
    const totalProducts = await query(
      'SELECT COUNT(*) as total FROM products WHERE is_active = TRUE'
    );

    // Valor total del inventario
    const totalValue = await query(
      'SELECT SUM(stock_quantity * price) as total_value FROM products WHERE is_active = TRUE'
    );

    // Productos por categoría
    const byCategory = await query(`
      SELECT category, COUNT(*) as count, SUM(stock_quantity) as total_stock
      FROM products
      WHERE is_active = TRUE
      GROUP BY category
    `);

    // Alertas de stock bajo
    const lowStockCount = await query(`
      SELECT COUNT(*) as count
      FROM products
      WHERE is_active = TRUE AND stock_quantity <= stock_min AND stock_min > 0
    `);

    // Movimientos recientes (últimos 7 días)
    const recentMovements = await query(`
      SELECT movement_type, COUNT(*) as count, SUM(ABS(quantity)) as total_quantity
      FROM inventory_movements
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY movement_type
    `);

    res.json({
      success: true,
      stats: {
        totalProducts: totalProducts.rows[0]?.total || 0,
        totalValue: totalValue.rows[0]?.total_value || 0,
        byCategory: byCategory.rows,
        lowStockAlerts: lowStockCount.rows[0]?.count || 0,
        recentMovements: recentMovements.rows
      }
    });
  } catch (error) {
    logger.error('Error getting inventory stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default inventoryRouter;
