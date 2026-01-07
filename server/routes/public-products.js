import express from 'express';
import { query } from '../db.js';

export const publicProductsRouter = express.Router();

// GET - Obtener un producto por ID (público, para frontend)
publicProductsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Solo productos activos
    const result = await query(
      'SELECT * FROM products WHERE id = ? AND is_active = 1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Producto no encontrado o no disponible' 
      });
    }

    const product = result.rows[0];

    // Si es café, intentar obtener información del lote
    let lotInfo = null;
    if (product.category === 'cafe') {
      try {
        const lotResult = await query(
          `SELECT * FROM lots 
           WHERE product_id = ? 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [id]
        );
        
        if (lotResult.rows.length > 0) {
          lotInfo = lotResult.rows[0];
        }
      } catch (lotError) {
        console.error('Error fetching lot info:', lotError);
        // Continuar sin información del lote
      }
    }

    res.json({
      success: true,
      product: product,
      lot: lotInfo
    });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener el producto' 
    });
  }
});

// GET - Listar productos activos (público, para catálogo)
publicProductsRouter.get('/', async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    
    let sql = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_bestseller DESC, is_new DESC, name ASC LIMIT ?';
    params.push(parseInt(limit));

    const result = await query(sql, params);
    
    res.json({
      success: true,
      products: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error listing products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al listar productos' 
    });
  }
});

export default publicProductsRouter;
