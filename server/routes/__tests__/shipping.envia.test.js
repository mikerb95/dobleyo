// Tests de las rutas de envíos con Envia.com: cotización junto a los otros
// proveedores, generación de guía, cancelación y webhook. Sin red ni base de
// datos (todo mockeado).

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../db.js', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../../auth.js', () => ({
    authenticateToken: (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
    requireRole: () => (_req, _res, next) => next(),
}));
vi.mock('../../services/audit.js', () => ({
    logAudit: vi.fn().mockResolvedValue(null),
    logSystemAudit: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/email.js', () => ({
    sendShippingNotificationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendOrderConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('../../services/alerts.js', () => ({ notifyShippingIssue: vi.fn() }));
vi.mock('../../services/mipaquete.js', () => ({
    quoteShipping: vi.fn(),
    createSending: vi.fn(),
    getSendings: vi.fn(),
    getTracking: vi.fn(),
    cancelSending: vi.fn(),
    getLocations: vi.fn(),
    registerWebhook: vi.fn(),
    healthCheck: vi.fn(),
    resolveDaneCode: vi.fn(),
    computePackageFromOrder: vi.fn(),
    findSendingByReference: vi.fn(),
    MP_PAYMENT_TYPE_PREPAID: 101,
    MP_PAYMENT_TYPE_COD: 102,
    MipaqueteError: class MipaqueteError extends Error {},
    MipaqueteConfigError: class MipaqueteConfigError extends Error {},
}));
vi.mock('../../services/interrapidisimo.js', () => ({
    isInterConfigured: vi.fn(() => false),
    quoteInter: vi.fn(),
    createInterAdmission: vi.fn(),
    getInterGuidePdf: vi.fn(),
    getInterStatuses: vi.fn(),
    requestInterPickup: vi.fn(),
    generateInterManifest: vi.fn(),
    trackingUrlForGuide: (g) => `https://inter.test/?guia=${g}`,
    interStatesToEvents: vi.fn(() => []),
    mapInterStatus: vi.fn(() => null),
    interHealthCheck: vi.fn(),
    InterError: class InterError extends Error {},
    InterConfigError: class InterConfigError extends Error {},
}));

vi.mock('../../services/envia.js', () => ({
    isEnviaConfigured: vi.fn(() => true),
    quoteEnvia: vi.fn(),
    parseEnviaCompanyId: (id) => {
        const [p, carrier, service] = String(id).split(':');
        return p === 'envia' && carrier && service ? { carrier, service } : null;
    },
    createEnviaLabel: vi.fn(),
    requestEnviaPickup: vi.fn(),
    trackEnvia: vi.fn(),
    cancelEnviaLabel: vi.fn(),
    registerEnviaWebhook: vi.fn(),
    mapEnviaStatus: vi.fn(() => null),
    enviaGuideToEvents: vi.fn(() => []),
    enviaHealthCheck: vi.fn(),
    EnviaError: class EnviaError extends Error {},
    EnviaConfigError: class EnviaConfigError extends Error {},
}));

process.env.MIPAQUETE_ORIGIN_DANE = '11001000';
process.env.ENVIA_WEBHOOK_TOKEN = 'hook_test';

const { query } = await import('../../db.js');
const mipaquete = await import('../../services/mipaquete.js');
const envia = await import('../../services/envia.js');

let app;
beforeAll(async () => {
    const { shippingRouter } = await import('../shipping.js');
    app = express();
    app.use(express.json());
    app.use('/api/shipping', shippingRouter);
});

beforeEach(() => {
    vi.clearAllMocks();
    query.mockReset();
});

const quoteBody = {
    orderId: 5, weightKg: 0.5, width: 20, length: 30, height: 15,
    destinyDaneCode: '05001000', declaredValueCop: 60000, paymentMode: 'prepaid',
};

const paidOrder = {
    id: 5, reference: 'DY-1', status: 'paid', currency: 'COP',
    customer_name: 'Ana Gómez', customer_email: 'ana@test.co', customer_phone: '3001234567',
    customer_document_type: 'CC', customer_document_number: '1020304050',
    shipping_address: 'Cra 18 # 10-45',
};

describe('POST /api/shipping/quote (Envia.com)', () => {
    it('cotiza con Envia aunque Mipaquete no esté configurado', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 5, currency: 'COP' }] });
        envia.quoteEnvia.mockResolvedValueOnce([
            { provider: 'envia', deliveryCompanyId: 'envia:servientrega:ground', shippingCost: 16000 },
            { provider: 'envia', deliveryCompanyId: 'envia:coordinadora:ground', shippingCost: 12000 },
        ]);

        const res = await request(app).post('/api/shipping/quote').send(quoteBody);

        expect(res.status).toBe(200);
        expect(res.body.data.map((q) => q.deliveryCompanyId)).toEqual(['envia:coordinadora:ground', 'envia:servientrega:ground']);
        expect(mipaquete.quoteShipping).not.toHaveBeenCalled();
        expect(envia.quoteEnvia).toHaveBeenCalledWith(expect.objectContaining({ originDaneCode: '11001000', codAmount: 0 }));
    });
});

describe('POST /api/shipping/create (Envia.com)', () => {
    it('genera la guía, guarda PDF y rastreo y marca la orden despachada', async () => {
        query.mockResolvedValueOnce({ rows: [paidOrder] });        // orden
        query.mockResolvedValueOnce({ rows: [] });                 // items
        query.mockResolvedValueOnce({ rows: [{ id: 77 }] });       // INSERT shipments
        query.mockResolvedValue({ rows: [] });                     // updates
        envia.createEnviaLabel.mockResolvedValueOnce({
            trackingNumber: '9988776655', labelUrl: 'https://s3.envia.com/l.pdf', trackUrl: 'https://envia.com/t/9988776655',
            totalPrice: 12300, carrier: 'coordinadora', service: 'ground',
        });
        envia.requestEnviaPickup.mockResolvedValueOnce({ confirmation: 'PK-1', date: '2026-10-20' });

        const res = await request(app).post('/api/shipping/create').send({
            ...quoteBody, deliveryCompanyId: 'envia:coordinadora:ground', deliveryCompanyName: 'Coordinadora · Terrestre',
        });

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ shipmentId: 77, guideNumber: '9988776655', pickupCode: 'PK-1', trackingUrl: 'https://envia.com/t/9988776655' });
        expect(envia.createEnviaLabel).toHaveBeenCalledWith(expect.objectContaining({
            carrier: 'coordinadora', service: 'ground',
            receiver: expect.objectContaining({ identificationNumber: '1020304050', daneCode: '05001000' }),
        }));
        const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO shipments'));
        expect(insert[1][1]).toBe('envia');
        const update = query.mock.calls.find(([sql]) => sql.includes('tracking_url = ?'));
        expect(update[1]).toEqual(['9988776655', 'PK-1', 'Coordinadora · Terrestre', 12300,
            JSON.stringify(['https://s3.envia.com/l.pdf']), 'https://envia.com/t/9988776655', 'pickup_requested', 77]);
    });

    it('deja el envío en error si Envia rechaza la guía', async () => {
        query.mockResolvedValueOnce({ rows: [paidOrder] });
        query.mockResolvedValueOnce({ rows: [] });
        query.mockResolvedValueOnce({ rows: [{ id: 78 }] });
        query.mockResolvedValue({ rows: [] });
        envia.createEnviaLabel.mockRejectedValueOnce(new envia.EnviaError('Dirección inválida'));

        const res = await request(app).post('/api/shipping/create').send({
            ...quoteBody, deliveryCompanyId: 'envia:coordinadora:ground',
        });

        expect(res.status).toBe(422);
        const errorUpdate = query.mock.calls.find(([sql]) => sql.includes("status = 'error'"));
        expect(errorUpdate[1]).toEqual(['Dirección inválida', 78]);
    });
});

describe('PUT /api/shipping/:id/cancel (Envia.com)', () => {
    it('anula la guía en Envia antes de cancelar localmente', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 3, order_id: 5, provider: 'envia', guide_number: '9988776655', delivery_company_id: 'envia:coordinadora:ground' }] });
        query.mockResolvedValue({ rows: [] });
        envia.cancelEnviaLabel.mockResolvedValueOnce({ balanceReturned: true });

        const res = await request(app).put('/api/shipping/3/cancel');

        expect(res.status).toBe(200);
        expect(envia.cancelEnviaLabel).toHaveBeenCalledWith({ carrier: 'coordinadora', trackingNumber: '9988776655' });
    });
});

describe('POST /api/shipping/envia/webhook', () => {
    it('rechaza un token inválido', async () => {
        const res = await request(app).post('/api/shipping/envia/webhook?token=otro').send({ trackingNumber: '1' });
        expect(res.status).toBe(401);
        expect(query).not.toHaveBeenCalled();
    });

    it('registra el aviso y re-consulta el tracking con la API', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 3 }] });       // buscar envío
        query.mockResolvedValue({ rows: [] });                    // insert evento + refresh
        envia.trackEnvia.mockResolvedValue(new Map());

        const res = await request(app).post('/api/shipping/envia/webhook?token=hook_test')
            .send({ trackingNumber: '9988776655', status: 'Delivered' });

        expect(res.status).toBe(200);
        expect(query.mock.calls[0][1]).toEqual(['9988776655']);
        expect(query.mock.calls[1][0]).toContain('raw_payload');
    });
});
