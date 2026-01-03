import { Router } from 'express';
import * as db from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

// Obtener todo el stock (Publico o Privado?) - Dejemoslo publico para la tienda, pero solo lectura
export async function getStock() {
  const result = await db.query('SELECT sku, name, stock FROM products'); // Asumiendo que 'stock' existe en products o tabla separada
  // Nota: El schema.sql original no tenia columna 'stock' en 'products', 
  // deberiamos agregarla o usar una tabla de inventario. 
  // Por ahora simularemos con una query simple.
  return result.rows;
}

export async function getProductStock(sku) {
  if (!sku) return null;
  const result = await db.query('SELECT * FROM products WHERE slug = $1', [sku]); // Usando slug como SKU por ahora
  return result.rows[0] || null;
}

export async function updateStock(sku, quantity) {
  if (!sku) throw new Error('SKU requerido');
  // Actualizacion atomica en BD
  const result = await db.query(
    'UPDATE products SET stock = $1 WHERE slug = $2 RETURNING *',
    [quantity, sku]
  );
  return result.rows[0];
}

export function syncWithMercadoLibre(payload = {}) {
  console.log('[stock] sync mercadolibre placeholder', { payload, at: new Date().toISOString() });
  return { message: 'Sincronizacion con MercadoLibre encolada' };
}

export const stockRouter = Router();

stockRouter.get('/', async (req, res) => {
  try {
    // Si la tabla products no tiene columna stock aun, esto fallara hasta que se migre la BD.
    // Ajustar query segun schema real.
    const items = await db.query('SELECT id, slug, name, price_cop FROM products'); 
    res.json({ items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error de base de datos' });
  }
});

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

stockRouter.post('/update', (req, res) => {
  const { sku, quantity } = req.body || {};
  try {
    const record = updateStock(sku, quantity);
    res.json({ message: 'Stock actualizado', record });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error actualizando stock' });
  }
});

stockRouter.post('/sync/mercadolibre', (req, res) => {
  const result = syncWithMercadoLibre(req.body);
  res.json(result);
});

// TODO: Próximo paso: conectar con la API de MercadoLibre (OAuth2 + PUT /items/{item_id} para actualizar stock)
