// Tests del flujo de pedidos con ePayco como pasarela activa: creación de la
// sesión de pago y URL de confirmación.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.hoisted(() => { process.env.PAYMENT_PROVIDER = 'epayco'; });

vi.mock('../../db.js', () => {
    const query = vi.fn();
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
    sendOrderStatusEmail: vi.fn().mockResolvedValue({ success: true }),
    sendSubscriptionChargeFailedEmail: vi.fn().mockResolvedValue({ success: true }),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../services/geocoding.js', () => ({ geocodeOrderAsync: vi.fn().mockResolvedValue(null) }));
vi.mock('../../services/mlStock.js', () => ({ scheduleStockSync: vi.fn() }));

vi.mock('../../services/epayco.js', () => ({
    epaycoConfig: { configured: true, canVerifySignature: false, test: false, publicKey: 'pub' },
    createCheckoutSession: vi.fn(),
    verifyConfirmationSignature: vi.fn(() => true),
    fetchVerifiedTransaction: vi.fn(),
    isEpaycoRef: (v) => /^[A-Za-z0-9]{4,40}$/.test(String(v ?? '')),
    createCardCustomer: vi.fn(),
    chargeCardCustomer: vi.fn(),
}));

import { ordersRouter } from '../orders.js';
import { query } from '../../db.js';
import { createCheckoutSession, fetchVerifiedTransaction } from '../../services/epayco.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders', ordersRouter);
    return app;
}

const payload = {
    customerName: 'María García',
    customerEmail: 'maria@test.com',
    customerPhone: '3001234567',
    shippingAddress: 'Calle 123 #45-67',
    shippingCity: 'Bogotá',
    items: [{ productId: 'cf-sierra', quantity: 2 }],
};
const product = { id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp', stock_quantity: 10 };
const sqlCalls = (fragment) => query.mock.calls.filter(([sql]) => sql.includes(fragment));

describe('POST /api/orders con ePayco', () => {
    let app;
    beforeEach(() => { app = buildApp(); vi.clearAllMocks(); query.mockReset(); });

    it('debería crear la sesión de pago con el total del servidor y devolver solo el sessionId', async () => {
        createCheckoutSession.mockResolvedValueOnce('sess-1');
        query.mockResolvedValueOnce({ rows: [product] });
        query.mockResolvedValueOnce({ rows: [{ id: 1, reference: 'DY-1-AAAA' }] });
        query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/orders').send(payload);

        expect(res.status).toBe(201);
        expect(res.body.data.provider).toBe('epayco');
        expect(res.body.data.epayco).toEqual({ sessionId: 'sess-1', test: false });
        expect(res.body.data.wompi).toBeNull();
        const session = createCheckoutSession.mock.calls[0][0];
        expect(session.amount).toBe(96000); // 2 × 42.000 + 12.000 de envío fijo
        expect(session.reference).toMatch(/^DY-\d+-[0-9A-F]{10}$/);
        expect(session.confirmationUrl).toContain('/api/orders/epayco/confirmation');
        // La orden se guarda con la misma referencia que quedó en la sesión.
        expect(sqlCalls('INSERT INTO customer_orders')[0][1][0]).toBe(session.reference);
    });

    it('no debería guardar la orden si ePayco no crea la sesión', async () => {
        createCheckoutSession.mockRejectedValueOnce(new Error('ePayco caído'));
        query.mockResolvedValueOnce({ rows: [product] });

        const res = await request(app).post('/api/orders').send(payload);

        expect(res.status).toBe(502);
        expect(sqlCalls('INSERT INTO customer_orders')).toHaveLength(0);
    });
});

describe('POST /api/orders/epayco/confirmation', () => {
    let app;
    const order = (o) => ({
        id: 7, status: 'pending_payment', total_cop: 96000, currency: 'COP', expected_amount_cents: 9600000,
        payment_transaction_id: null, discount_code: null, payment_method: null, ...o,
    });
    const verified = (o) => ({
        provider: 'epayco', id: 'ref123456', reference: 'DY-1-AAAA', status: 'APPROVED',
        amount_in_cents: 9600000, currency: 'COP', payment_method_type: 'VS', test: false, raw: {}, ...o,
    });

    beforeEach(() => { app = buildApp(); vi.clearAllMocks(); query.mockReset(); });

    it('debería responder 400 si no trae la referencia de ePayco', async () => {
        const res = await request(app).post('/api/orders/epayco/confirmation').type('form').send({ x_response: 'Aceptada' });
        expect(res.status).toBe(400);
    });

    it('no debería marcar pagada la orden por lo que diga el cuerpo: manda lo que responde ePayco', async () => {
        // El cuerpo dice "Aceptada", pero al consultar a ePayco la transacción sigue pendiente.
        fetchVerifiedTransaction.mockResolvedValueOnce(verified({ status: 'PENDING' }));
        query.mockResolvedValueOnce({ rows: [order()] });
        query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/orders/epayco/confirmation').type('form')
            .send({ x_ref_payco: 'ref123456', x_response: 'Aceptada', x_cod_response: '1', x_id_invoice: 'DY-1-AAAA' });

        expect(res.status).toBe(200);
        expect(fetchVerifiedTransaction).toHaveBeenCalledWith('ref123456');
        expect(sqlCalls("SET status = 'paid'")).toHaveLength(0);
    });

    it('debería marcar pagada la orden y descontar stock cuando ePayco confirma el pago', async () => {
        fetchVerifiedTransaction.mockResolvedValueOnce(verified());
        query.mockResolvedValueOnce({ rows: [order()] }); // lookup
        query.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // UPDATE status = 'paid'
        query.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // reclama stock_deducted_at
        query.mockResolvedValueOnce({ rows: [{ product_id: 'cf-sierra', quantity: 2 }] });
        query.mockResolvedValueOnce({ rows: [{ stock_quantity: 8 }] });
        query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/orders/epayco/confirmation').type('form').send({ x_ref_payco: 'ref123456' });

        expect(res.status).toBe(200);
        const paid = sqlCalls("SET status = 'paid'");
        expect(paid).toHaveLength(1);
        expect(paid[0][1].slice(0, 2)).toEqual(['VS', 'ref123456']);
        expect(sqlCalls('UPDATE products SET stock_quantity = stock_quantity -')).toHaveLength(1);
    });

    it('debería responder 500 si ePayco no responde, para que reintente la confirmación', async () => {
        fetchVerifiedTransaction.mockRejectedValueOnce(new Error('timeout'));

        const res = await request(app).get('/api/orders/epayco/confirmation').query({ x_ref_payco: 'ref123456' });

        expect(res.status).toBe(500);
    });
});
