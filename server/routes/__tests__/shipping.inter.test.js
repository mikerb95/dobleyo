// Tests de las rutas de envíos que usan Interrapidísimo directo: cotización
// combinada con Mipaquete, validación del documento del destinatario y
// recogida agrupada. Sin red ni base de datos (todo mockeado).

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
    isInterConfigured: vi.fn(() => true),
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

process.env.MIPAQUETE_API_KEY = 'test';
process.env.MIPAQUETE_ORIGIN_DANE = '11001000';

const { query } = await import('../../db.js');
const mipaquete = await import('../../services/mipaquete.js');
const inter = await import('../../services/interrapidisimo.js');

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

describe('POST /api/shipping/quote', () => {
    it('combina ofertas de ambos proveedores ordenadas por precio', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 5, currency: 'COP' }] });
        mipaquete.quoteShipping.mockResolvedValueOnce([{ deliveryCompanyId: 'c1', deliveryCompanyName: 'Coordinadora', shippingCost: 14000 }]);
        inter.quoteInter.mockResolvedValueOnce([{ provider: 'interrapidisimo', deliveryCompanyId: 'inter:3', shippingCost: 11000 }]);

        const res = await request(app).post('/api/shipping/quote').send(quoteBody);

        expect(res.status).toBe(200);
        expect(res.body.data.map((q) => q.provider)).toEqual(['interrapidisimo', 'mipaquete']);
    });

    it('sigue respondiendo con Inter si Mipaquete falla', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 5, currency: 'COP' }] });
        mipaquete.quoteShipping.mockRejectedValueOnce(new Error('caído'));
        inter.quoteInter.mockResolvedValueOnce([{ provider: 'interrapidisimo', deliveryCompanyId: 'inter:3', shippingCost: 11000 }]);

        const res = await request(app).post('/api/shipping/quote').send(quoteBody);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
});

describe('POST /api/shipping/create (Interrapidísimo)', () => {
    it('exige el documento del destinatario antes de crear la guía', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 5, reference: 'DY-1', status: 'paid', currency: 'COP' }] }); // orden
        query.mockResolvedValueOnce({ rows: [] }); // items

        const res = await request(app).post('/api/shipping/create').send({
            ...quoteBody, deliveryCompanyId: 'inter:3',
        });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/documento/i);
        expect(inter.createInterAdmission).not.toHaveBeenCalled();
    });
});

describe('POST /api/shipping/inter/pickup', () => {
    it('agrupa las guías en una recogida y marca solo las incluidas', async () => {
        query.mockResolvedValueOnce({ rows: [
            { id: 1, guide_number: '240000000001', status: 'created' },
            { id: 2, guide_number: '240000000002', status: 'created' },
        ] });
        query.mockResolvedValue({ rows: [] }); // updates
        inter.requestInterPickup.mockResolvedValueOnce({ IdRecogida: 987, preenviosNoIncluidos: ['240000000002'] });

        const res = await request(app).post('/api/shipping/inter/pickup').send({ shipmentIds: [1, 2] });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ pickupCode: '987', included: ['240000000001'], excluded: ['240000000002'] });
        const updates = query.mock.calls.filter(([sql]) => sql.includes("status = 'pickup_requested'"));
        expect(updates).toHaveLength(1);
        expect(updates[0][1]).toEqual(['987', 1]);
    });

    it('rechaza si ninguna guía es de Inter pendiente de recogida', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).post('/api/shipping/inter/pickup').send({ shipmentIds: [9] });

        expect(res.status).toBe(422);
        expect(inter.requestInterPickup).not.toHaveBeenCalled();
    });
});
