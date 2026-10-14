// Tests del servicio de correo (server/services/email.js) con Resend simulado.

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    send: vi.fn(),
    batchSend: vi.fn(),
}));

vi.mock('../../db.js', () => ({ query: mocks.query }));
vi.mock('resend', () => ({
    Resend: class {
        emails = { send: mocks.send };
        batch = { send: mocks.batchSend };
    },
}));

let email;

beforeAll(async () => {
    process.env.RESEND_API_KEY = 're_test';
    email = await import('../email.js');
});

beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({ rows: [] }); // nadie suprimido
    mocks.send.mockResolvedValue({ data: { id: 'em_1' }, error: null });
    mocks.batchSend.mockResolvedValue({ data: { data: [] }, error: null });
});

describe('sendEmail', () => {
    it('reporta fallo cuando Resend responde { error } (el SDK no lanza)', async () => {
        mocks.send.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'dominio no verificado' } });

        const r = await email.sendEmail({ to: 'a@test.com', subject: 'x', html: '<p>x</p>', category: 't' });

        expect(r.success).toBe(false);
        expect(r.error.message).toMatch(/dominio/);
    });

    it('no envía a un destinatario en la lista de supresión', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

        const r = await email.sendEmail({ to: 'rebote@test.com', subject: 'x', html: '<p>x</p>' });

        expect(r).toMatchObject({ success: false, skipped: true });
        expect(mocks.send).not.toHaveBeenCalled();
    });

    it('incluye texto plano, etiqueta de categoría e idempotencia', async () => {
        await email.sendEmail({ to: 'a@test.com', subject: 'x', html: '<p>Hola <a href="https://d.co">aquí</a></p>', category: 'demo', idempotencyKey: 'k1' });

        const [payload, options] = mocks.send.mock.calls[0];
        expect(payload.text).toContain('aquí (https://d.co)');
        expect(payload.tags).toEqual([{ name: 'category', value: 'demo' }]);
        expect(options).toEqual({ idempotencyKey: 'k1' });
    });
});

describe('plantillas', () => {
    it('escapa el HTML que viene del formulario de contacto', async () => {
        await email.sendContactFormEmail({
            name: '<script>alert(1)</script>',
            email: 'x@test.com',
            subject: 'Hola',
            message: '<img src=x onerror=alert(1)>',
        });

        const { html } = mocks.send.mock.calls[0][0];
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;script&gt;');
    });

    it('la confirmación de pedido usa la referencia como clave de idempotencia', async () => {
        await email.sendOrderConfirmationEmail('c@test.com', 'Carla Gómez', {
            orderId: 'DY-123', date: '2026-10-01', items: [{ name: 'Café', quantity: 2, price: 30000 }],
            subtotal: 60000, shipping: 0, total: 60000, shippingAddress: 'Calle 1, Bogotá',
        });

        const [payload, options] = mocks.send.mock.calls[0];
        expect(options.idempotencyKey).toBe('order-confirmation/DY-123');
        expect(payload.subject).toContain('DY-123');
        expect(payload.html).toContain('Hola Carla,');
    });

    it('el boletín lleva cabeceras List-Unsubscribe de un clic', async () => {
        await email.sendNewsletterWelcomeEmail('s@test.com', 'tok123');

        const { headers } = mocks.send.mock.calls[0][0];
        expect(headers['List-Unsubscribe']).toContain('/api/emails/newsletter/unsubscribe?token=tok123');
        expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('ningún correo usa em dash ni voseo', async () => {
        await email.sendVerificationEmail('a@test.com', 't', 'Ana');
        await email.sendPasswordResetEmail('a@test.com', 'Ana', 't');
        await email.sendPasswordChangedEmail('a@test.com', 'Ana');
        await email.sendWelcomeEmail('a@test.com', 'Ana');
        for (const [{ html, subject }] of mocks.send.mock.calls) {
            expect(html + subject).not.toMatch(/—/);
            expect(html).not.toMatch(/\b(ingresá|hacé|probá|tenés|querés)\b/i);
        }
    });
});

describe('sendNewsletterCampaign', () => {
    it('envía en lotes de 100 y omite los suprimidos', async () => {
        vi.useFakeTimers();
        const subs = Array.from({ length: 150 }, (_, i) => ({ email: `u${i}@test.com`, unsubscribe_token: `t${i}` }));
        mocks.query.mockResolvedValueOnce({ rows: [{ email: 'u0@test.com' }] }); // supresiones

        const promise = email.sendNewsletterCampaign({ subject: 'S', heading: 'H', body: 'Párrafo uno.\n\nDos.' }, subs, 42);
        await vi.runAllTimersAsync();
        const r = await promise;
        vi.useRealTimers();

        expect(r).toMatchObject({ sent: 149, failed: 0, skipped: 1 });
        expect(mocks.batchSend).toHaveBeenCalledTimes(2);
        expect(mocks.batchSend.mock.calls[0][0]).toHaveLength(100);
        expect(mocks.batchSend.mock.calls[0][1]).toEqual({ idempotencyKey: 'campaign/42/0' });
        // Cada destinatario lleva su propio enlace de baja.
        expect(mocks.batchSend.mock.calls[0][0][0].html).toContain('token=t1');
    });
});
