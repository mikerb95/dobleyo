import { Router } from 'express';

// Inventario en memoria (estructura simple)
export const inventory = {
  SKU001: { sku: 'SKU001', name: 'Café Doble Yo 250g', stock: 10 },
  SKU002: { sku: 'SKU002', name: 'Café Doble Yo 500g', stock: 5 }
};

export function getStock() {
  return Object.values(inventory);
}

export function getProductStock(sku) {
  if (!sku) return null;
  return inventory[sku] || null;
}

export function updateStock(sku, quantity) {
  if (!sku) throw new Error('SKU requerido');
  const normalizedSku = String(sku).trim();
  const safeQty = Number.isFinite(Number(quantity)) ? Number(quantity) : null;
  if (safeQty === null || safeQty < 0) {
    throw new Error('Cantidad invalida');
  }
  const current = inventory[normalizedSku] || { sku: normalizedSku, name: normalizedSku };
  const nextRecord = { ...current, stock: safeQty };
  inventory[normalizedSku] = nextRecord;
  return nextRecord;
}

export function syncWithMercadoLibre(payload = {}) {
  console.log('[stock] sync mercadolibre placeholder', { payload, at: new Date().toISOString() });
  return { message: 'Sincronizacion con MercadoLibre encolada' };
}

export const stockRouter = Router();

stockRouter.get('/', (req, res) => {
  res.json({ items: getStock() });
});

stockRouter.get('/:sku', (req, res) => {
  const sku = req.params.sku?.trim();
  const record = getProductStock(sku);
  if (!record) {
    return res.status(404).json({ error: 'SKU no encontrado' });
  }
  res.json(record);
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
