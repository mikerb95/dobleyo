// Tests del servicio ePayco: firma, estados y normalización de transacciones.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

async function loadService(env = {}) {
    vi.resetModules();
    vi.stubEnv('EPAYCO_PUBLIC_KEY', 'pub');
    vi.stubEnv('EPAYCO_PRIVATE_KEY', 'priv');
    vi.stubEnv('EPAYCO_CUSTOMER_ID', '12345');
    vi.stubEnv('EPAYCO_P_KEY', 'pkey');
    vi.stubEnv('EPAYCO_TEST', 'false');
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return import('../epayco.js');
}

const sign = (p) => crypto.createHash('sha256')
    .update(`12345^pkey^${p.x_ref_payco}^${p.x_transaction_id}^${p.x_amount}^${p.x_currency_code}`)
    .digest('hex');

const tx = (o = {}) => ({
    x_ref_payco: '68fb83729d094878e015be00', x_transaction_id: '987', x_amount: '96000', x_currency_code: 'COP',
    x_id_invoice: 'DY-1-AAAA', x_cod_response: 1, x_response: 'Aceptada', x_franchise: 'VS', x_test_request: 'FALSE', ...o,
});

describe('services/epayco', () => {
    beforeEach(() => { vi.restoreAllMocks(); });
    afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

    it('valida la firma de la confirmación y rechaza una alterada', async () => {
        const { verifyConfirmationSignature } = await loadService();
        const p = tx();
        expect(verifyConfirmationSignature({ ...p, x_signature: sign(p) })).toBe(true);
        expect(verifyConfirmationSignature({ ...p, x_amount: '1', x_signature: sign(p) })).toBe(false);
        expect(verifyConfirmationSignature(p)).toBe(false);
    });

    it('traduce los estados de ePayco al vocabulario interno', async () => {
        const { epaycoStatus } = await loadService();
        expect(epaycoStatus(1)).toBe('APPROVED');
        expect(epaycoStatus(2)).toBe('DECLINED');
        expect(epaycoStatus(3)).toBe('PENDING');
        expect(epaycoStatus(6)).toBe('VOIDED');
        expect(epaycoStatus(undefined, 'Abandonada')).toBe('DECLINED');
        expect(epaycoStatus(undefined, 'algo nuevo')).toBe('ERROR');
    });

    it('normaliza una transacción a la forma que consume applyPaymentTransaction', async () => {
        const { normalizeEpaycoTransaction } = await loadService();
        expect(normalizeEpaycoTransaction(tx({ x_amount: '96000.00' }))).toMatchObject({
            provider: 'epayco', id: '68fb83729d094878e015be00', reference: 'DY-1-AAAA',
            status: 'APPROVED', amount_in_cents: 9600000, currency: 'COP', test: false,
        });
        expect(normalizeEpaycoTransaction(tx({ x_id_invoice: '', x_extra1: 'DY-2-BBBB' })).reference).toBe('DY-2-BBBB');
        expect(normalizeEpaycoTransaction({})).toBeNull();
    });

    it('ignora una transacción de prueba cuando el sitio está en producción', async () => {
        const { fetchVerifiedTransaction } = await loadService();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true, status: 200, json: async () => ({ success: true, data: tx({ x_test_request: 'TRUE' }) }),
        }));
        expect(await fetchVerifiedTransaction('68fb83729d094878e015be00')).toBeNull();
    });

    it('acepta transacciones de prueba con EPAYCO_TEST=true y descarta referencias mal formadas sin llamar a ePayco', async () => {
        const { fetchVerifiedTransaction } = await loadService({ EPAYCO_TEST: 'true' });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true, status: 200, json: async () => ({ success: true, data: tx({ x_test_request: 'TRUE' }) }),
        });
        vi.stubGlobal('fetch', fetchMock);
        expect((await fetchVerifiedTransaction('68fb83729d094878e015be00')).status).toBe('APPROVED');
        expect(await fetchVerifiedTransaction('../../etc')).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('crea la sesión de pago con el monto y la referencia del servidor', async () => {
        const { createCheckoutSession } = await loadService();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'jwt' }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { sessionId: 'sess-1' } }) });
        vi.stubGlobal('fetch', fetchMock);

        const id = await createCheckoutSession({
            reference: 'DY-1-AAAA', amount: 96000, description: '2 x Sierra', lang: 'es',
            responseUrl: 'https://x/confirmacion?ref=DY-1-AAAA', confirmationUrl: 'https://x/api/orders/epayco/confirmation',
            customer: { email: 'a@b.co', name: 'Ana', docType: 'NI', docNumber: '900123456', phone: '+57 300 123 4567' },
        });

        expect(id).toBe('sess-1');
        const body = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(body).toMatchObject({
            checkout_version: '2', currency: 'COP', amount: 96000, invoice: 'DY-1-AAAA', method: 'POST',
            extras: { extra1: 'DY-1-AAAA' },
            billing: { email: 'a@b.co', typeDoc: 'NIT', numberDoc: '900123456', callingCode: '+57', mobilePhone: '3001234567' },
        });
    });
});
