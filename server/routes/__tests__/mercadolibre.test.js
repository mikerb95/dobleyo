// Rutas de MercadoLibre: seguridad del flujo OAuth, autenticación del cron y
// filtrado del webhook. Los servicios se mockean; aquí importa el contrato HTTP.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

process.env.ML_CLIENT_ID = '123456';

const session = { user: { id: 1, role: 'admin' } };
vi.mock('../../auth.js', () => ({
  requireAuth: (req, res, next) => { if (!session.user) return res.status(401).json({ error: 'Acceso denegado' }); req.user = session.user; next(); },
  requireAdmin: (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Permisos insuficientes' })),
  verifyToken: (t) => (t === 'admin-jwt' ? { id: 1, role: 'admin' } : (() => { throw new Error('bad'); })()),
}));
vi.mock('../../db.js', () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }));
vi.mock('../../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(null) }));

const exchangeCodeAndSave = vi.fn();
vi.mock('../../services/mlAuth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isOAuthConfigured: () => true,
    buildAuthorizationUrl: ({ state }) => `https://auth.mercadolibre.com.co/authorization?state=${state}`,
    exchangeCodeAndSave: (...a) => exchangeCodeAndSave(...a),
    getSellerId: async () => '999',
    getConnectionStatus: async () => ({ connected: true, source: 'oauth' }),
  };
});

const syncOrders = vi.fn().mockResolvedValue({ processed: 0, total_orders_fetched: 0 });
const fetchOrderDetails = vi.fn();
vi.mock('../../services/mercadolibre.js', () => ({
  default: class { syncOrders(...a) { return syncOrders(...a); } fetchOrderDetails(...a) { return fetchOrderDetails(...a); } },
}));
const pushListings = vi.fn().mockResolvedValue({ total: 0, pushed: 0, unchanged: 0, errors: 0 });
vi.mock('../../services/mlStock.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, pushListings: (...a) => pushListings(...a), applyOrdersStockAndPush: vi.fn() };
});

const { mercadolibreRouter } = await import('../mercadolibre.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/mercadolibre', mercadolibreRouter);
  return app;
}

beforeEach(() => {
  session.user = { id: 1, role: 'admin' };
  delete process.env.CRON_SECRET;
  exchangeCodeAndSave.mockReset();
  fetchOrderDetails.mockReset();
});

describe('OAuth', () => {
  it('should redirect to ML and set an HttpOnly state cookie', async () => {
    const res = await request(buildApp()).get('/api/mercadolibre/oauth/start');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/auth\.mercadolibre\.com\.co\/authorization\?state=[0-9a-f]{48}$/);
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/ml_oauth_state=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('should reject a callback whose state does not match', async () => {
    const res = await request(buildApp())
      .get('/api/mercadolibre/oauth/callback?code=abc&state=otro')
      .set('Cookie', ['auth_token=admin-jwt', `ml_oauth_state=j:${encodeURIComponent(JSON.stringify({ state: 'esperado', verifier: 'v' }))}`]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/mercadolibre?ml_error=ML_OAUTH_STATE');
    expect(exchangeCodeAndSave).not.toHaveBeenCalled();
  });

  it('should send a non-admin back to login before touching the code', async () => {
    const res = await request(buildApp()).get('/api/mercadolibre/oauth/callback?code=abc&state=x');
    expect(res.headers.location).toBe('/admin/login?redirect=/admin/mercadolibre');
  });

  it('should exchange the code when state matches', async () => {
    exchangeCodeAndSave.mockResolvedValue({ ml_user_id: '999', nickname: 'DOBLEYO' });
    const res = await request(buildApp())
      .get('/api/mercadolibre/oauth/callback?code=abc&state=esperado')
      .set('Cookie', ['auth_token=admin-jwt', `ml_oauth_state=j:${encodeURIComponent(JSON.stringify({ state: 'esperado', verifier: 'v' }))}`]);
    expect(res.headers.location).toBe('/admin/mercadolibre?ml=connected');
    expect(exchangeCodeAndSave).toHaveBeenCalledWith({ code: 'abc', codeVerifier: 'v', connectedBy: 1 });
  });
});

describe('cron-sync', () => {
  it('should be unavailable without CRON_SECRET', async () => {
    const res = await request(buildApp()).get('/api/mercadolibre/cron-sync');
    expect(res.status).toBe(503);
  });

  it('should reject a wrong secret', async () => {
    process.env.CRON_SECRET = 's3cret-largo';
    const res = await request(buildApp()).get('/api/mercadolibre/cron-sync').set('Authorization', 'Bearer otro');
    expect(res.status).toBe(401);
    expect(syncOrders).not.toHaveBeenCalled();
  });

  it('should sync orders and push pending stock with the Vercel header or x-cron-secret', async () => {
    process.env.CRON_SECRET = 's3cret-largo';
    const a = await request(buildApp()).get('/api/mercadolibre/cron-sync').set('Authorization', 'Bearer s3cret-largo');
    const b = await request(buildApp()).post('/api/mercadolibre/cron-sync').set('x-cron-secret', 's3cret-largo');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(pushListings).toHaveBeenCalledWith({});
  });
});

describe('webhook', () => {
  it('should answer 200 and ignore notifications from another application', async () => {
    const res = await request(buildApp()).post('/api/mercadolibre/webhook')
      .send({ topic: 'orders_v2', resource: '/orders/1', user_id: 999, application_id: 777 });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchOrderDetails).not.toHaveBeenCalled();
  });

  it('should ignore notifications for another seller', async () => {
    await request(buildApp()).post('/api/mercadolibre/webhook')
      .send({ topic: 'orders_v2', resource: '/orders/1', user_id: 111, application_id: 123456 });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchOrderDetails).not.toHaveBeenCalled();
  });
});

describe('admin guard', () => {
  it('should protect the stock endpoints', async () => {
    session.user = null;
    const res = await request(buildApp()).get('/api/mercadolibre/stock/listings');
    expect(res.status).toBe(401);
  });
});
