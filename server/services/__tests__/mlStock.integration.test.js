// Centralizador de stock con MercadoLibre contra un SQLite real.
//
// Se verifica lo que de verdad importa para no sobrevender:
// - qué cantidad se le ofrece a ML (disponible, variantes, colchón, inactivos),
// - que una venta de ML descuente UNA sola vez y una cancelación reponga lo exacto,
// - que las órdenes previas al vínculo y las publicaciones Full no toquen el stock,
// - que un error de ML deje el vínculo pendiente y con el motivo a la vista.
// La API de ML se mockea (mlApi); todo lo demás es código real.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-mlstock-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

const mlApi = vi.fn();
vi.mock('../mlAuth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, mlApi: (...args) => mlApi(...args), getSellerId: async () => '999' };
});
vi.mock('../alerts.js', () => ({
  notifyOversold: vi.fn(), notifyStockDepleted: vi.fn(), notifyStockBelowMinimum: vi.fn(),
}));
vi.mock('../audit.js', () => ({ logSystemAudit: vi.fn().mockResolvedValue(null), logAudit: vi.fn() }));

let db, mlStock, alerts;

const stockOf = async (id) => Number((await db.query('SELECT stock_quantity FROM products WHERE id = ?', [id])).rows[0].stock_quantity);
const variantStock = async (id) => Number((await db.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [id])).rows[0].stock_quantity);

async function addListing({ productId, variantId = null, item, variation = '', buffer = 0, logistic = null, linkedAt = '2026-01-01 00:00:00' }) {
  const r = await db.query(
    `INSERT INTO ml_listings (product_id, variant_id, ml_item_id, ml_variation_id, stock_buffer, logistic_type, linked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [productId, variantId, item, variation, buffer, logistic, linkedAt],
  );
  return Number(r.lastInsertRowid);
}

const order = (id, status, items, date = '2026-11-01T10:00:00.000-05:00') => ({
  id, status, date_created: date,
  order_items: items.map(([itemId, quantity, variationId = null]) => ({ item: { id: itemId, variation_id: variationId }, quantity })),
});

beforeAll(async () => {
  db = await import('../../db.js');
  await db.query(`CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY, sku TEXT, name TEXT NOT NULL, is_active INTEGER DEFAULT 1,
    stock_quantity INTEGER NOT NULL DEFAULT 0, stock_reserved INTEGER NOT NULL DEFAULT 0,
    stock_min INTEGER DEFAULT 0, updated_at TEXT)`);
  await db.query(`CREATE TABLE product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id VARCHAR(50) NOT NULL, size_label TEXT, grind_label TEXT,
    price_cop INTEGER NOT NULL DEFAULT 0, stock_quantity INTEGER NOT NULL DEFAULT 0, sku_suffix TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0)`);
  await db.query(`CREATE TABLE inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id VARCHAR(50) NOT NULL, variant_id INTEGER,
    movement_type TEXT NOT NULL, quantity INTEGER NOT NULL, quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL, reason TEXT, reference TEXT, notes TEXT, user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  const { createMlStockSync } = await import('../../migrations/create_ml_stock_sync.js');
  await createMlStockSync();
  mlStock = await import('../mlStock.js');
  alerts = await import('../alerts.js');
});

beforeEach(async () => {
  mlApi.mockReset();
  mlApi.mockResolvedValue({});
  for (const t of ['ml_order_stock', 'ml_listings', 'inventory_movements', 'product_variants', 'products']) {
    await db.query(`DELETE FROM ${t}`);
  }
  await db.query(`INSERT INTO products (id, sku, name, stock_quantity, stock_reserved, stock_min) VALUES
    ('cf-sierra', 'SIERRA-250', 'Café Sierra', 10, 2, 3),
    ('cf-huila', 'HUILA', 'Café Huila', 0, 0, 0),
    ('cf-off', NULL, 'Café inactivo', 50, 0, 0)`);
  await db.query(`UPDATE products SET is_active = 0 WHERE id = 'cf-off'`);
  await db.query(`INSERT INTO product_variants (id, product_id, size_label, grind_label, stock_quantity, sku_suffix, is_active) VALUES
    (1, 'cf-huila', '250g', 'Grano', 7, '-250-G', 1),
    (2, 'cf-huila', '500g', 'Molido', 4, '-500-M', 1),
    (3, 'cf-huila', '1kg', 'Grano', 9, '-1K-G', 0)`);
});

describe('cantidad que se ofrece en ML', () => {
  it('should subtract the buffer and never go negative', () => {
    expect(mlStock.quantityForMl(10, 2)).toBe(8);
    expect(mlStock.quantityForMl(1, 5)).toBe(0);
    expect(mlStock.quantityForMl(-3, 0)).toBe(0);
  });

  it('should use stock minus reserved for a product without variants', async () => {
    expect(await mlStock.computeAvailable({ product_id: 'cf-sierra', variant_id: null })).toBe(8);
  });

  it('should sum active variants for a product with variants', async () => {
    expect(await mlStock.computeAvailable({ product_id: 'cf-huila', variant_id: null })).toBe(11);
    expect(await mlStock.computeAvailable({ product_id: 'cf-huila', variant_id: 2 })).toBe(4);
    expect(await mlStock.computeAvailable({ product_id: 'cf-huila', variant_id: 3 })).toBe(0); // variante inactiva
  });

  it('should offer 0 for an inactive product and null for a missing one', async () => {
    expect(await mlStock.computeAvailable({ product_id: 'cf-off', variant_id: null })).toBe(0);
    expect(await mlStock.computeAvailable({ product_id: 'no-existe', variant_id: null })).toBeNull();
  });
});

describe('pushListing', () => {
  it('should PUT available minus buffer on the item and mark it synced', async () => {
    const id = await addListing({ productId: 'cf-sierra', item: 'MCO111222333', buffer: 3 });
    const r = await mlStock.pushListing(id);

    expect(r).toMatchObject({ status: 'pushed', quantity: 5 });
    expect(mlApi).toHaveBeenCalledWith('/items/MCO111222333', { method: 'PUT', body: { available_quantity: 5 } });
    const row = (await db.query('SELECT * FROM ml_listings WHERE id = ?', [id])).rows[0];
    expect(row).toMatchObject({ pending_push: 0, last_pushed_qty: 5, ml_available_qty: 5, last_error: null });
  });

  it('should use the variation endpoint for a variation listing', async () => {
    const id = await addListing({ productId: 'cf-huila', variantId: 1, item: 'MCO222333444', variation: '1801' });
    await mlStock.pushListing(id);
    expect(mlApi).toHaveBeenCalledWith('/items/MCO222333444/variations/1801', { method: 'PUT', body: { available_quantity: 7 } });
  });

  it('should skip the API call when the value did not change', async () => {
    const id = await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    await mlStock.pushListing(id);
    mlApi.mockClear();
    const r = await mlStock.pushListing(id);
    expect(r.status).toBe('unchanged');
    expect(mlApi).not.toHaveBeenCalled();
  });

  it('should never touch Full (fulfillment) listings', async () => {
    const id = await addListing({ productId: 'cf-sierra', item: 'MCO333444555', logistic: 'fulfillment' });
    expect((await mlStock.pushListing(id)).status).toBe('skipped_full');
    expect(mlApi).not.toHaveBeenCalled();
  });

  it('should keep the listing pending with the ML error when the PUT fails', async () => {
    const id = await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    mlApi.mockRejectedValueOnce(new Error('Item is under review'));
    const r = await mlStock.pushListing(id);
    expect(r).toMatchObject({ status: 'error', error: 'Item is under review' });
    const row = (await db.query('SELECT pending_push, last_error FROM ml_listings WHERE id = ?', [id])).rows[0];
    expect(row).toMatchObject({ pending_push: 1, last_error: 'Item is under review' });
  });
});

describe('ventas de ML sobre el stock del sitio', () => {
  it('should deduct a paid order exactly once even if it arrives twice', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    const o = order(5001, 'paid', [['MCO111222333', 3]]);

    const first = await mlStock.applyMlOrderStock(o);
    const again = await mlStock.applyMlOrderStock(o);

    expect(first.applied).toBe(1);
    expect(again.applied).toBe(0);
    expect(await stockOf('cf-sierra')).toBe(7);
    const mov = (await db.query(`SELECT * FROM inventory_movements WHERE reference = 'ML-5001'`)).rows;
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ movement_type: 'salida', quantity: 3, quantity_before: 10, quantity_after: 7 });
  });

  it('should restore exactly what was deducted when the order is cancelled', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    await mlStock.applyMlOrderStock(order(5002, 'paid', [['MCO111222333', 4]]));
    expect(await stockOf('cf-sierra')).toBe(6);

    const r = await mlStock.applyMlOrderStock(order(5002, 'cancelled', [['MCO111222333', 4]]));
    const again = await mlStock.applyMlOrderStock(order(5002, 'cancelled', [['MCO111222333', 4]]));
    expect(r.reverted).toBe(1);
    expect(again.reverted).toBe(0);
    expect(await stockOf('cf-sierra')).toBe(10);
  });

  it('should not move stock for unpaid orders', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    await mlStock.applyMlOrderStock(order(5003, 'payment_required', [['MCO111222333', 2]]));
    expect(await stockOf('cf-sierra')).toBe(10);
  });

  it('should ignore orders created before the listing was linked', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333', linkedAt: '2026-11-02 00:00:00' });
    const r = await mlStock.applyMlOrderStock(order(5004, 'paid', [['MCO111222333', 2]], '2026-11-01T10:00:00.000-05:00'));
    expect(r.skipped).toBe(1);
    expect(await stockOf('cf-sierra')).toBe(10);
  });

  it('should deduct from the linked variant, not from the product row', async () => {
    await addListing({ productId: 'cf-huila', variantId: 2, item: 'MCO222333444', variation: '1802' });
    await mlStock.applyMlOrderStock(order(5005, 'paid', [['MCO222333444', 1, 1802]]));
    expect(await variantStock(2)).toBe(3);
    expect(await variantStock(1)).toBe(7);
    expect(await stockOf('cf-huila')).toBe(0);
  });

  it('should clamp to zero, flag the oversell and alert when ML sold more than the site had', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    await mlStock.applyMlOrderStock(order(5006, 'paid', [['MCO111222333', 15]]));
    expect(await stockOf('cf-sierra')).toBe(0);
    const row = (await db.query(`SELECT deducted_qty, oversold FROM ml_order_stock WHERE ml_order_id = '5006'`)).rows[0];
    expect(row).toMatchObject({ deducted_qty: 10, oversold: 1 });
    expect(alerts.notifyOversold).toHaveBeenCalled();

    // Al cancelar se repone lo que de verdad se descontó (10), no lo vendido (15).
    await mlStock.applyMlOrderStock(order(5006, 'cancelled', [['MCO111222333', 15]]));
    expect(await stockOf('cf-sierra')).toBe(10);
  });

  it('should not touch stock for Full listings or unlinked items', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO333444555', logistic: 'fulfillment' });
    const r = await mlStock.applyMlOrderStock(order(5007, 'paid', [['MCO333444555', 2], ['MCO999888777', 1]]));
    expect(r.skipped).toBe(2);
    expect(await stockOf('cf-sierra')).toBe(10);
  });

  it('should push the new stock to ML after applying orders', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    const total = await mlStock.applyOrdersStockAndPush([order(5008, 'paid', [['MCO111222333', 2]])]);
    expect(total).toMatchObject({ applied: 1, pushed: 1 });
    // 10 - 2 vendidas - 2 reservadas = 6
    expect(mlApi).toHaveBeenCalledWith('/items/MCO111222333', { method: 'PUT', body: { available_quantity: 6 } });
  });
});

describe('linkListing', () => {
  const item = (over = {}) => ({
    id: 'MCO444555666', title: 'Café Sierra 250 g', seller_id: 999, status: 'active', available_quantity: 20,
    permalink: 'https://articulo.mercadolibre.com.co/MCO-444555666', shipping: { logistic_type: 'xd_drop_off' },
    variations: [], ...over,
  });

  it('should create the link and push the stock right away', async () => {
    mlApi.mockImplementation(async (path, opts) => (opts?.method === 'PUT' ? {} : item()));
    const { listing, push } = await mlStock.linkListing({ productId: 'cf-sierra', mlItemId: 'https://articulo.mercadolibre.com.co/MCO-444555666-cafe', stockBuffer: 1 });
    expect(listing).toMatchObject({ ml_item_id: 'MCO444555666', ml_variation_id: '', stock_buffer: 1, title: 'Café Sierra 250 g' });
    expect(push).toMatchObject({ status: 'pushed', quantity: 7 });
  });

  it('should require a variant for a product sold by variants', async () => {
    await expect(mlStock.linkListing({ productId: 'cf-huila', mlItemId: 'MCO444555666' }))
      .rejects.toThrow(/variantes/);
  });

  it('should require choosing a variation when the publication has variations', async () => {
    mlApi.mockResolvedValue(item({ variations: [{ id: 1801, available_quantity: 3, attribute_combinations: [{ value_name: '250 g' }] }] }));
    await expect(mlStock.linkListing({ productId: 'cf-huila', variantId: 1, mlItemId: 'MCO444555666' }))
      .rejects.toMatchObject({ code: 'ML_VARIATION_REQUIRED' });
  });

  it('should reject a publication from another seller', async () => {
    mlApi.mockResolvedValue(item({ seller_id: 123 }));
    await expect(mlStock.linkListing({ productId: 'cf-sierra', mlItemId: 'MCO444555666' })).rejects.toMatchObject({ status: 403 });
  });

  it('should reject linking the same publication twice', async () => {
    mlApi.mockImplementation(async (path, opts) => (opts?.method === 'PUT' ? {} : item()));
    await mlStock.linkListing({ productId: 'cf-sierra', mlItemId: 'MCO444555666' });
    await expect(mlStock.linkListing({ productId: 'cf-sierra', mlItemId: 'MCO444555666' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('scheduleStockSync', () => {
  it('should not call ML when none of the products is linked', async () => {
    mlStock.scheduleStockSync(['cf-sierra']);
    await new Promise((r) => setTimeout(r, 50));
    expect(mlApi).not.toHaveBeenCalled();
  });

  it('should push linked products after a stock change', async () => {
    await addListing({ productId: 'cf-sierra', item: 'MCO111222333' });
    await db.query(`UPDATE products SET stock_quantity = 4 WHERE id = 'cf-sierra'`);
    mlStock.scheduleStockSync(['cf-sierra']);
    await vi.waitFor(() => expect(mlApi).toHaveBeenCalledWith('/items/MCO111222333', { method: 'PUT', body: { available_quantity: 2 } }));
  });
});

describe('normalizeItemId', () => {
  it('should accept ids, dashed ids and links', () => {
    expect(mlStock.normalizeItemId('MCO1234567890')).toBe('MCO1234567890');
    expect(mlStock.normalizeItemId('mco-1234567')).toBe('MCO1234567');
    expect(mlStock.normalizeItemId('https://articulo.mercadolibre.com.co/MCO-1234567-cafe-_JM')).toBe('MCO1234567');
    expect(mlStock.normalizeItemId('hola')).toBeNull();
  });
});
