// Rutas de /api/stock contra SQLite real.
// Cubre el bug histórico: POST /update quedaba tapado por POST /:sku porque se
// declaraba después, así que Express tomaba "update" como SKU y respondía 400.
// También verifica el disponible (variantes y reservas) y que cada cambio de
// stock avise al centralizador de MercadoLibre.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-stock-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

vi.mock('../../auth.js', () => ({
  authenticateToken: (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
  requireRole: () => (_req, _res, next) => next(),
}));
vi.mock('../../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(null) }));
const scheduleStockSync = vi.fn();
const pushListings = vi.fn().mockResolvedValue({ total: 1, pushed: 1, unchanged: 0, skipped_full: 0, errors: 0, results: [] });
vi.mock('../../services/mlStock.js', () => ({
  scheduleStockSync: (...a) => scheduleStockSync(...a),
  pushListings: (...a) => pushListings(...a),
}));

let db, app;

beforeAll(async () => {
  db = await import('../../db.js');
  await db.query(`CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY, slug TEXT, name TEXT NOT NULL, category TEXT, origin TEXT, process TEXT, roast TEXT,
    price INTEGER NOT NULL DEFAULT 0, image_url TEXT, is_active INTEGER DEFAULT 1,
    stock_quantity INTEGER NOT NULL DEFAULT 0, stock_reserved INTEGER NOT NULL DEFAULT 0, updated_at TEXT)`);
  await db.query(`CREATE TABLE product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id VARCHAR(50) NOT NULL, stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1)`);
  await db.query(`CREATE TABLE inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id VARCHAR(50) NOT NULL, variant_id INTEGER, movement_type TEXT,
    quantity INTEGER, quantity_before INTEGER, quantity_after INTEGER, reason TEXT, reference TEXT, user_id INTEGER)`);
  const { stockRouter } = await import('../stock.js');
  app = express();
  app.use(express.json());
  app.use('/api/stock', stockRouter);
});

beforeEach(async () => {
  scheduleStockSync.mockClear();
  pushListings.mockClear();
  await db.query('DELETE FROM inventory_movements');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM products');
  await db.query(`INSERT INTO products (id, slug, name, price, stock_quantity, stock_reserved) VALUES
    ('cf-sierra', 'cafe-sierra', 'Café Sierra', 42000, 10, 3),
    ('cf-huila', 'cafe-huila', 'Café Huila', 48000, 99, 0)`);
  await db.query(`INSERT INTO product_variants (product_id, stock_quantity, is_active) VALUES
    ('cf-huila', 5, 1), ('cf-huila', 2, 1), ('cf-huila', 40, 0)`);
});

describe('POST /api/stock/update', () => {
  it('should reach the handler (not be swallowed by /:sku) and record the movement', async () => {
    const res = await request(app).post('/api/stock/update').send({ sku: 'cf-sierra', quantity: 4 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { sku: 'cf-sierra', stock: 4, before: 10 } });

    const mov = (await db.query('SELECT * FROM inventory_movements')).rows;
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ movement_type: 'ajuste', quantity: -6, quantity_before: 10, quantity_after: 4 });
    expect(scheduleStockSync).toHaveBeenCalledWith(['cf-sierra']);
  });

  it('should validate the payload', async () => {
    const res = await request(app).post('/api/stock/update').send({ sku: 'cf-sierra', quantity: -1 });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should 404 for an unknown product and not schedule a sync', async () => {
    const res = await request(app).post('/api/stock/update').send({ sku: 'nope', quantity: 1 });
    expect(res.status).toBe(404);
    expect(scheduleStockSync).not.toHaveBeenCalled();
  });
});

describe('POST /api/stock/:sku', () => {
  it('should set the stock and notify the ML centralizer', async () => {
    const res = await request(app).post('/api/stock/cf-sierra').send({ stock: 12 });
    expect(res.status).toBe(200);
    expect(res.body.data.stock).toBe(12);
    expect(scheduleStockSync).toHaveBeenCalledWith(['cf-sierra']);
  });

  it('should not schedule a sync when the value did not change', async () => {
    await request(app).post('/api/stock/cf-sierra').send({ stock: 10 });
    expect(scheduleStockSync).not.toHaveBeenCalled();
  });
});

describe('GET /api/stock', () => {
  it('should report available stock (reserved discounted, active variants summed)', async () => {
    const res = await request(app).get('/api/stock');
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map((r) => [r.id, r.available]));
    expect(byId).toEqual({ 'cf-sierra': 7, 'cf-huila': 7 });
    // Forma anterior conservada para integraciones viejas.
    expect(res.body.items.find((i) => i.slug === 'cafe-sierra').stock).toBe(7);
  });

  it('should find a product by slug', async () => {
    const res = await request(app).get('/api/stock/cafe-huila');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'cf-huila', available: 7 });
  });
});

describe('POST /api/stock/sync/mercadolibre', () => {
  it('should push to ML through the centralizer instead of logging a placeholder', async () => {
    const res = await request(app).post('/api/stock/sync/mercadolibre').send({ all: true });
    expect(res.status).toBe(200);
    expect(pushListings).toHaveBeenCalledWith({ all: true, force: false });
    expect(res.body.data.pushed).toBe(1);
  });
});
