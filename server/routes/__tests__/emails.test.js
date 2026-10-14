// Tests del webhook de Resend (firma Svix) y la baja de un clic.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

const mocks = vi.hoisted(() => ({ query: vi.fn(), suppressEmail: vi.fn() }));

vi.mock('../../db.js', () => ({ query: mocks.query }));
vi.mock('../../auth.js', () => ({
    authenticateToken: (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
}));
vi.mock('../../middleware/rateLimit.js', () => ({ apiLimiter: (_req, _res, next) => next() }));
vi.mock('../../services/audit.js', () => ({ logAudit: vi.fn() }));
vi.mock('../../services/email.js', () => ({
    sendOrderConfirmationEmail: vi.fn(),
    sendContactFormEmail: vi.fn(),
    sendContactReplyEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    sendNewsletterWelcomeEmail: vi.fn(),
    sendNewsletterCampaign: vi.fn(),
    renderCampaignPreview: vi.fn(),
    suppressEmail: mocks.suppressEmail,
}));

const SECRET_BYTES = crypto.randomBytes(24);
process.env.RESEND_WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

import { emailRouter } from '../emails.js';

function buildApp() {
    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
    app.use('/api/emails', emailRouter);
    return app;
}

function signedPost(app, event, { tamper = false, timestamp = Math.floor(Date.now() / 1000) } = {}) {
    const raw = JSON.stringify(event);
    const id = 'msg_123';
    const sig = crypto.createHmac('sha256', SECRET_BYTES).update(`${id}.${timestamp}.${raw}`).digest('base64');
    return request(app)
        .post('/api/emails/webhook')
        .set('Content-Type', 'application/json')
        .set('svix-id', id)
        .set('svix-timestamp', String(timestamp))
        .set('svix-signature', `v1,${tamper ? sig.replace(/^./, sig[0] === 'A' ? 'B' : 'A') : sig}`)
        .send(raw);
}

describe('POST /api/emails/webhook', () => {
    let app;
    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('rechaza firmas inválidas', async () => {
        const res = await signedPost(app, { type: 'email.bounced', data: { to: ['a@test.com'] } }, { tamper: true });
        expect(res.status).toBe(401);
        expect(mocks.suppressEmail).not.toHaveBeenCalled();
    });

    it('rechaza eventos con timestamp viejo (repetición)', async () => {
        const res = await signedPost(app, { type: 'email.bounced', data: { to: ['a@test.com'] } }, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
        expect(res.status).toBe(401);
    });

    it('suprime rebotes permanentes e ignora los transitorios', async () => {
        await signedPost(app, { type: 'email.bounced', data: { to: ['a@test.com'], bounce: { type: 'Permanent', message: 'No existe' } } });
        expect(mocks.suppressEmail).toHaveBeenCalledWith('a@test.com', 'bounced', 'No existe');

        mocks.suppressEmail.mockClear();
        await signedPost(app, { type: 'email.bounced', data: { to: ['b@test.com'], bounce: { type: 'Transient' } } });
        expect(mocks.suppressEmail).not.toHaveBeenCalled();
    });

    it('una queja de spam suprime y da de baja del boletín', async () => {
        const res = await signedPost(app, { type: 'email.complained', data: { to: ['c@test.com'] } });
        expect(res.status).toBe(200);
        expect(mocks.suppressEmail).toHaveBeenCalledWith('c@test.com', 'complained', null);
        expect(mocks.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM newsletter_subscribers'))).toBe(true);
    });
});

describe('POST /api/emails/newsletter/unsubscribe (un clic)', () => {
    it('da de baja por token y es idempotente', async () => {
        const app = buildApp();
        mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
        const res = await request(app).post('/api/emails/newsletter/unsubscribe?token=abc').send('List-Unsubscribe=One-Click');
        expect(res.status).toBe(200);
        expect(mocks.query).toHaveBeenCalledWith('DELETE FROM newsletter_subscribers WHERE unsubscribe_token = ?', ['abc']);
    });
});
