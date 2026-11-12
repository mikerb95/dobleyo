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
    sendOrderStatusEmail: vi.fn().mockResolvedValue({ success: true }),
    sendSubscriptionChargeFailedEmail: vi.fn().mockResolvedValue({ success: true }),
    sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../services/geocoding.js', () => ({
    geocodeOrderAsync: vi.fn().mockResolvedValue(null),
}));

// El centralizador de MercadoLibre consulta la BD en segundo plano; aquí se
// aísla para no consumir las respuestas encadenadas del mock de `query`.
vi.mock('../../services/mlStock.js', () => ({
    scheduleStockSync: vi.fn(),
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
        expect(orderInsertArgs[12]).toBe(84000); // índice 12 = subtotal_cop (11 = shipping_dane_code)
    });

    it('debería retornar 422 si no hay stock suficiente', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp', stock_quantity: 1 }],
        });

        const res = await request(app)
            .post('/api/orders')
            .send(validOrderPayload); // pide quantity: 2, solo hay 1 en stock

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/stock/i);
    });

    it('debería descontar stock al crear una orden COD (nace processing, sin webhook de pago)', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp', stock_quantity: 10 }],
        }); // SELECT products
        query.mockResolvedValueOnce({ rows: [{ cnt: 0 }] }); // COD antifraude: pedidos abiertos
        query.mockResolvedValueOnce({ rows: [{ cnt: 0 }] }); // COD antifraude: devoluciones previas
        query.mockResolvedValueOnce({ rows: [{ id: 5, reference: 'DY-COD-0001' }] }); // INSERT customer_orders
        query.mockResolvedValueOnce({ rows: [] }); // INSERT customer_order_items
        query.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // deductStockForOrder: reclama stock_deducted_at
        query.mockResolvedValueOnce({ rows: [{ product_id: 'cf-sierra', quantity: 2 }] }); // SELECT order items
        query.mockResolvedValueOnce({ rows: [{ stock_quantity: 8 }] }); // UPDATE products (descuenta)
        query.mockResolvedValueOnce({ rows: [] }); // INSERT inventory_movements

        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, paymentMethod: 'cod' });

        expect(res.status).toBe(201);
        const deductUpdateCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE products SET stock_quantity = stock_quantity -'));
        expect(deductUpdateCall).toBeDefined();
        expect(deductUpdateCall[1]).toEqual([2, 'cf-sierra', 2]); // descuenta la cantidad pedida
    });

    it('debería responder 409 sin crear la orden si el total cambió frente al que vio el cliente', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'cf-sierra', name: 'Sierra Nevada', price: 42000, image_url: '/img/si.webp', stock_quantity: 10 }],
        });

        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, expectedTotal: 1000 });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('TOTAL_CHANGED');
        expect(res.body.data.total).toBe(96000); // 2 × 42.000 + 12.000 de envío fijo
        expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO customer_orders'))).toBe(false);
    });

    it('debería rechazar HTML en la ciudad cuando no viene el DANE', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, shippingCity: '<img src=x onerror=alert(1)>' });

        expect(res.status).toBe(422);
        expect(query).not.toHaveBeenCalled();
    });

    it('debería rechazar pedidos en USD (el sitio vende solo en COP)', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ ...validOrderPayload, currency: 'USD' });

        expect(res.status).toBe(422);
        expect(query).not.toHaveBeenCalled();
    });
});

// ── POST /api/orders/wompi/webhook ────────────────────────────────────────────
// Fuera de producción y sin WOMPI_EVENTS_SECRET la firma no se verifica: basta
// con que el evento traiga checksum y timestamp.
describe('POST /api/orders/wompi/webhook', () => {
    let app;

    const event = (tx) => ({
        event: 'transaction.updated',
        timestamp: 1700000000,
        signature: { checksum: 'abc', properties: ['transaction.id'] },
        data: { transaction: { reference: 'DY-1-AAAA', id: 'tx-1', status: 'APPROVED', amount_in_cents: 9600000, currency: 'COP', payment_method_type: 'CARD', ...tx } },
    });
    const order = (o) => ({
        id: 7, status: 'pending_payment', total_cop: 96000, currency: 'COP', expected_amount_cents: 9600000,
        payment_transaction_id: null, discount_code: null, payment_method: null, ...o,
    });
    const sqlCalls = (fragment) => query.mock.calls.filter(([sql]) => sql.includes(fragment));

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        query.mockReset();
    });

    it('debería marcar pagada la orden, contar el cupón y descontar stock con un APPROVED', async () => {
        query.mockResolvedValueOnce({ rows: [order({ discount_code: 'PROMO10' })] }); // lookup
        query.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // UPDATE status = 'paid'
        query.mockResolvedValueOnce({ rows: [] }); // UPDATE discount_codes
        query.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // reclama stock_deducted_at
        query.mockResolvedValueOnce({ rows: [{ product_id: 'cf-sierra', quantity: 2 }] }); // ítems
        query.mockResolvedValueOnce({ rows: [{ stock_quantity: 8 }] }); // UPDATE products
        query.mockResolvedValueOnce({ rows: [] }); // INSERT inventory_movements
        query.mockResolvedValue({ rows: [] }); // alerta y correo

        const res = await request(app).post('/api/orders/wompi/webhook').send(event());

        expect(res.status).toBe(200);
        expect(sqlCalls("SET status = 'paid'")).toHaveLength(1);
        expect(sqlCalls('UPDATE discount_codes')).toHaveLength(1);
        expect(sqlCalls('UPDATE products SET stock_quantity = stock_quantity -')).toHaveLength(1);
    });

    it('no debería tocar la orden si el monto no coincide', async () => {
        query.mockResolvedValueOnce({ rows: [order()] });

        const res = await request(app).post('/api/orders/wompi/webhook').send(event({ amount_in_cents: 100 }));

        expect(res.status).toBe(200);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('no debería contar el cupón dos veces ni devolver a "paid" una orden ya enviada cuando el evento se repite', async () => {
        query.mockResolvedValueOnce({ rows: [order({ status: 'shipped', payment_transaction_id: 'tx-1', discount_code: 'PROMO10' })] });
        query.mockResolvedValueOnce({ rows: [] }); // UPDATE condicional: no aplica
        query.mockResolvedValueOnce({ rows: [] }); // stock ya reclamado
        query.mockResolvedValue({ rows: [] }); // correo ya enviado

        const res = await request(app).post('/api/orders/wompi/webhook').send(event());

        expect(res.status).toBe(200);
        // El cambio de estado va condicionado a que la orden siga abierta para pago.
        expect(sqlCalls("SET status = 'paid'")[0][0]).toContain("status = 'pending_payment'");
        expect(sqlCalls('UPDATE discount_codes')).toHaveLength(0);
        expect(sqlCalls('UPDATE products SET stock_quantity')).toHaveLength(0);
    });

    it('debería completar el descuento de stock en el reintento si el primer intento falló después de marcar pagada', async () => {
        query.mockResolvedValueOnce({ rows: [order({ status: 'paid', payment_transaction_id: 'tx-1' })] });
        query.mockResolvedValueOnce({ rows: [] }); // UPDATE condicional: ya estaba pagada
        query.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // reclama stock_deducted_at (seguía en NULL)
        query.mockResolvedValueOnce({ rows: [{ product_id: 'cf-sierra', quantity: 2 }] });
        query.mockResolvedValueOnce({ rows: [{ stock_quantity: 8 }] });
        query.mockResolvedValueOnce({ rows: [] });
        query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/orders/wompi/webhook').send(event());

        expect(res.status).toBe(200);
        expect(sqlCalls('UPDATE products SET stock_quantity = stock_quantity -')).toHaveLength(1);
    });

    it('debería responder 500 si falla el descuento de stock, para que Wompi reintente', async () => {
        query.mockResolvedValueOnce({ rows: [order()] });
        query.mockResolvedValueOnce({ rows: [{ id: 7 }] }); // UPDATE status = 'paid'
        query.mockRejectedValueOnce(new Error('BD caída')); // reclamo de stock

        const res = await request(app).post('/api/orders/wompi/webhook').send(event());

        expect(res.status).toBe(500);
    });

    it('no debería cancelar una orden pagada por un rechazo de otra transacción', async () => {
        query.mockResolvedValueOnce({ rows: [order({ status: 'paid', payment_transaction_id: 'tx-1' })] });
        query.mockResolvedValueOnce({ rows: [] }); // UPDATE condicional: no aplica

        const res = await request(app).post('/api/orders/wompi/webhook').send(event({ id: 'tx-2', status: 'DECLINED' }));

        expect(res.status).toBe(200);
        expect(sqlCalls("SET status = 'cancelled'")[0][0]).toContain("status = 'pending_payment' OR payment_transaction_id = ?");
        expect(sqlCalls('UPDATE products')).toHaveLength(0);
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
        query.mockResolvedValueOnce({ rows: [] });            // envío

        const res = await request(app).get('/api/orders/DY-1234567-ABCD');

        expect(res.status).toBe(200);
        expect(res.body.data.reference).toBe('DY-1234567-ABCD');
        expect(res.body.data.shipment).toBeNull();
    });

    it('debería incluir el seguimiento del envío con enlace de Interrapidísimo', async () => {
        const mockOrder = { id: 1, reference: 'DY-1234567-ABCD', status: 'shipped', total_cop: 96000 };
        query.mockResolvedValueOnce({ rows: [mockOrder] });
        query.mockResolvedValueOnce({ rows: [] });
        query.mockResolvedValueOnce({ rows: [{
            id: 7, provider: 'interrapidisimo', status: 'in_transit', guide_number: '240012345678',
            delivery_company_name: 'Interrapidísimo', tracking_updated_at: '2026-10-12 10:00:00',
        }] });
        query.mockResolvedValueOnce({ rows: [{ update_state: 'Tránsito nacional', description: 'BOGOTA → CALI', event_date: '2026-10-12T09:00:00' }] });

        const res = await request(app).get('/api/orders/DY-1234567-ABCD');

        expect(res.status).toBe(200);
        expect(res.body.data.shipment).toMatchObject({
            status: 'in_transit',
            guideNumber: '240012345678',
            trackingUrl: expect.stringContaining('240012345678'),
        });
        expect(res.body.data.shipment.events).toHaveLength(1);
    });
});
