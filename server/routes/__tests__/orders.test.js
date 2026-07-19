// Tests de integración para server/routes/orders.js
// Prueba creación de órdenes y endpoint de webhook Wompi

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => {
    const query = vi.fn();
    // withTransaction real usa un cliente propio; en el test se resuelve con el
    // mismo mock de `query` para que las secuencias mockResolvedValueOnce sigan
    // funcionando igual que antes de envolver la creación de orden en una transacción.
    const withTransaction = vi.fn((fn) => fn({ query }));
    return { query, withTransaction };
});

vi.mock('../../auth.js', () => ({
    authenticateToken: (req, _res, next) => { req.user = null; next(); },
    optionalAuth: (req, _res, next) => { req.user = null; next(); },
    requireRole: () => (_req, _res, next) => next(),
}));

vi.mock('../../services/audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(null),
    logSystemAudit: vi.fn().mockResolvedValue(null),
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
        { productId: 'cf-sierra', quantity: 2 },
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
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp' }],
        });
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
    });

    it('debería calcular envío gratis cuando el subtotal supera $120.000 COP', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-premium', name: 'Premium', price: 65000, image_url: '/img/premium.webp' }],
        });
        query.mockResolvedValueOnce({ rows: [{ id: 2, reference: 'DY-9999999-FREE' }] });
        query.mockResolvedValueOnce({ rows: [] }); // INSERT item

        const res = await request(app)
            .post('/api/orders')
            .send({
                ...validOrderPayload,
                items: [
                    { productId: 'cf-premium', quantity: 2 }, // 130.000 > 120.000
                ],
            });

        expect(res.status).toBe(201);
        expect(res.body.data.shipping).toBe(0);
    });

    it('debería retornar 500 si la BD falla al insertar', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp' }],
        });
        query.mockRejectedValueOnce(new Error('BD no disponible'));

        const res = await request(app)
            .post('/api/orders')
            .send(validOrderPayload);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });

    it('debería retornar 422 si uno o más productos no existen o están inactivos', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/orders')
            .send(validOrderPayload);

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
    });

    it('debería calcular subtotal usando precios de BD, no del cliente', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp' }],
        });
        query.mockResolvedValueOnce({ rows: [{ id: 3, reference: 'DY-DB-PRICE' }] });
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/orders')
            .send({
                ...validOrderPayload,
                items: [{ productId: 'cf-sierra', quantity: 2, unitPrice: 1, productName: 'Hack' }],
            });

        expect(res.status).toBe(201);
        const orderInsertArgs = query.mock.calls[1][1];
        expect(orderInsertArgs[8]).toBe(84000);
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
        expect(res.body.data.reference).toBe('DY-1234567-ABCD');
    });
});
