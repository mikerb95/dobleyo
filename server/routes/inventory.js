import express from 'express';
import { query } from '../db.js';

export const inventoryRouter = express.Router();

// Middleware de autenticación (solo admin)
const authMiddleware = async (req, res, next) => {
  // TODO: Verificar token y rol de admin
  next();
};

inventoryRouter.use(authMiddleware);

// ============================================
// PRODUCTOS - CRUD
// ============================================

// GET - Listar todos los productos (con filtros)
inventoryRouter.get('/products', async (req, res) => {
  try {
    const { category, active, search, sortBy = 'name', order = 'ASC' } = req.query;
    
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Validar sortBy para evitar SQL injection
    const allowedSortFields = ['name', 'category', 'price', 'stock_quantity', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    const result = await query(sql, params);
    
    res.json({
      success: true,
      products: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error listing products:', error);
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
    console.error('Error getting product:', error);
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
        is_deal || false, is_bestseller || false, is_new || false, 
        is_fast || false, is_active !== false,
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
    console.error('Error creating product:', error);
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

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(field === 'images' && typeof updateData[field] === 'object' 
          ? JSON.stringify(updateData[field]) 
          : updateData[field]
        );
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
    console.error('Error updating product:', error);
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
    console.error('Error deleting product:', error);
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
    console.error('Error recording movement:', error);
    res.status(500).json({ success: false, error: error.message });
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
    console.error('Error listing movements:', error);
    res.status(500).json({ success: false, error: error.message });
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
    console.error('Error getting low stock alerts:', error);
    res.status(500).json({ success: false, error: error.message });
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
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
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
    console.error('Error getting inventory stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default inventoryRouter;
