// Tests de integración para server/routes/orders.js
// Prueba creación de órdenes y endpoint de webhook Wompi

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({ query: vi.fn() }));

vi.mock('../../auth.js', () => ({
    authenticateToken: (req, _res, next) => { req.user = null; next(); },
    requireRole: () => (_req, _res, next) => next(),
}));

vi.mock('../../services/audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/email.js', () => ({
    sendOrderConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../services/geocoding.js', () => ({
    geocodeOrderAsync: vi.fn().mockResolvedValue(null),
}));

import { ordersRouter } from '../orders.js';
import { query } from '../../db.js';

// App Express mínima
function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders', ordersRouter);
    return app;
}

// Payload de orden válida
const validOrderPayload = {
    customerName: 'María García',
    customerEmail: 'maria@test.com',
    customerPhone: '3001234567',
    shippingAddress: 'Calle 123 #45-67',
    shippingCity: 'Bogotá',
    items: [
        { productId: 'cf-sierra', productName: 'Sierra Nevada', unitPrice: 42000, quantity: 2 },
    ],
};

// ── POST /api/orders ──────────────────────────────────────────────────────────
describe('POST /api/orders', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
    });

    it('debería retornar 422 si el nombre del cliente está vacío', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, customerName: '' });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.errors).toBeDefined();
    });

    it('debería retornar 422 si el email del cliente es inválido', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, customerEmail: 'no-es-email' });

        expect(res.status).toBe(422);
    });

    it('debería retornar 422 si el carrito está vacío', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, items: [] });

        expect(res.status).toBe(422);
    });

    it('debería retornar 422 si falta la dirección de envío', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, shippingAddress: '' });

        expect(res.status).toBe(422);
    });

    it('debería crear una orden correctamente y retornar referencia + URL de pago', async () => {
        // INSERT orden → retorna id y referencia
        query.mockResolvedValueOnce({ rows: [{ id: 1, reference: 'DY-1234567-ABCD' }] });
    // INSERT item (1 item en el payload)
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/orders')
      .send(validOrderPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toBeDefined();
    expect(res.body.data.total).toBeGreaterThan(0);
        query.mockResolvedValueOnce({ rows: [{ id: 2, reference: 'DY-9999999-FREE' }] });
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/orders')
            .send({
                ...validOrderPayload,
                items: [
                    { productId: 'cf-premium', productName: 'Premium', unitPrice: 65000, quantity: 2 }, // 130.000 > 120.000
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body.shipping).toBe(0);
    });

    it('debería retornar 500 si la BD falla al insertar', async () => {
        query.mockRejectedValueOnce(new Error('BD no disponible'));

        const res = await request(app)
            .post('/api/orders')
            .send(validOrderPayload);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });
});

// ── GET /api/orders/:ref ──────────────────────────────────────────────────────
describe('GET /api/orders/:ref', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
    });

    it('debería retornar 404 si la referencia no existe', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/api/orders/DY-NOTEXIST-0000');

        expect(res.status).toBe(404);
    });

    it('debería retornar los datos de la orden si existe', async () => {
        const mockOrder = { id: 1, reference: 'DY-1234567-ABCD', status: 'pending_payment', total_cop: 96000 };
        query.mockResolvedValueOnce({ rows: [mockOrder] }); // orden
        query.mockResolvedValueOnce({ rows: [] });            // items

        const res = await request(app).get('/api/orders/DY-1234567-ABCD');

        expect(res.status).toBe(200);
        expect(res.body.order.reference).toBe('DY-1234567-ABCD');
    });
});
