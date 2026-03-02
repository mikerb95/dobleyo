import { Router } from 'express';
import * as db from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

// Obtener todo el stock
export async function getStock() {
  // Retorna lista de { sku, stock }
  const result = await db.query('SELECT id as sku, stock FROM products');
  return result.rows;
}

export async function getProductStock(sku) {
  if (!sku) return null;
  const result = await db.query('SELECT stock FROM products WHERE id = ?', [sku]);
  return result.rows[0] || null;
}

export async function updateStock(sku, quantity) {
  if (!sku) throw new Error('SKU requerido');
  // Actualizacion atomica en BD (MySQL no soporta RETURNING en UPDATE)
  await db.query(
    'UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?',
    [quantity, sku]
  );
  // Fetch updated record
  const result = await db.query('SELECT id as sku, stock FROM products WHERE id = ?', [sku]);
  return result.rows[0];
}

export function syncWithMercadoLibre(payload = {}) {
  console.log('[stock] sync mercadolibre placeholder', { payload, at: new Date().toISOString() });
  return { message: 'Sincronizacion con MercadoLibre encolada' };
}

export const stockRouter = Router();

// Endpoint publico para consultar stock (usado por el frontend)
stockRouter.get('/', async (req, res) => {
  try {
    const items = await db.query('SELECT id as slug, stock, name, image_url, price as price_cop FROM products ORDER BY name ASC'); 
    res.json({ items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error de base de datos' });
  }
});

// Crear nuevo producto (solo admin)
stockRouter.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id, name, category, origin, process, roast, price, stock, image_url } = req.body;
    
    if (!id || !name || price === undefined) {
      return res.status(400).json({ error: 'id, name y price son requeridos' });
    }

    // Verificar que no existe ya
    const existing = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El producto con este ID ya existe' });
    }

    // Insertar
    await db.query(
      'INSERT INTO products (id, name, category, origin, process, roast, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, category || null, origin || null, process || null, roast || null, price, stock || 0, image_url || null]
    );

    // Retornar el producto creado
    const result = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando producto: ' + err.message });
  }
});

// Endpoint protegido para actualizar stock (usado por admin o integraciones)
stockRouter.post('/:sku', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { sku } = req.params;
    const { stock } = req.body;
    
    if (stock === undefined) {
      return res.status(400).json({ error: 'Stock quantity required' });
    }

    const updated = await updateStock(sku, stock);
    
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true, product: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating stock' });
  }
});

// Endpoint para obtener stock de un producto específico
stockRouter.get('/:sku', async (req, res) => {
  try {
    const sku = req.params.sku?.trim();
    const record = await getProductStock(sku);
    if (!record) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// Proteger rutas de escritura
stockRouter.post('/update', authenticateToken, requireRole('admin'), async (req, res) => {
    const { sku, quantity } = req.body;
    try {
        const updated = await updateStock(sku, quantity);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sincronizar con MercadoLibre (solo admin)
stockRouter.post('/sync/mercadolibre', authenticateToken, requireRole('admin'), (req, res) => {
  const result = syncWithMercadoLibre(req.body);
  res.json(result);
});

// TODO: Próximo paso: conectar con la API de MercadoLibre (OAuth2 + PUT /items/{item_id} para actualizar stock)
