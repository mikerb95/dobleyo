// Tests del envío del checkout: peso del paquete, token firmado, elección de la
// oferta más barata de Envia y caída a la tarifa fija. fetch se mockea; no hay red.

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.ENVIA_TOKEN = 'tok_test';
process.env.ENVIA_CARRIERS = 'coordinadora,servientrega';
process.env.ENVIA_ORIGIN_DANE = '11001';
process.env.JWT_SECRET = 'secreto_de_prueba_de_al_menos_32_caracteres';

const ship = await import('../checkoutShipping.js');
const { findMunicipality, CO_LOCATIONS } = await import('../../utils/coLocations.js');

function rateResponse(carrier, totalPrice, extra = {}) {
    return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
            meta: 'rate',
            data: [{ carrier, carrierDescription: carrier, service: 'ground', totalPrice, deliveryDate: { dateDifference: 3 }, ...extra }],
        }),
    };
}

describe('coLocations', () => {
    it('trae los 1.122 municipios y resuelve por DANE', () => {
        expect(CO_LOCATIONS.reduce((n, [, , cities]) => n + cities.length, 0)).toBe(1122);
        expect(findMunicipality('05001')).toEqual({ code: '05001', city: 'Medellín', department: 'Antioquia' });
        expect(findMunicipality('11001').city).toBe('Bogotá D.C.');
        expect(findMunicipality('99999')).toBeNull();
    });
});

describe('packageWeightKg', () => {
    it('suma pesos en g/kg y supone 0,5 kg por unidad sin peso', () => {
        const products = [
            { id: 1, weight: 250, weight_unit: 'g' },
            { id: 2, weight: 1, weight_unit: 'kg' },
            { id: 3, weight: null },
        ];
        expect(ship.packageWeightKg([{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }], products)).toBe(1.5);
        expect(ship.packageWeightKg([{ productId: 3, quantity: 2 }], products)).toBe(1);
        expect(ship.packageWeightKg([{ productId: 1, quantity: 1 }], products)).toBe(0.5); // mínimo
    });
});

describe('token de cotización', () => {
    const quote = { daneCode: '05001', weightKg: 1, isCod: false, cost: 15300 };

    it('acepta el token para el mismo destino, peso y pago', () => {
        const token = ship.signQuote(quote);
        expect(ship.verifyQuoteToken(token, quote)).toBe(15300);
    });

    it('rechaza token alterado, de otro destino, de otro pago o vencido', () => {
        const token = ship.signQuote(quote);
        const [, exp, mac] = token.split('.');
        expect(ship.verifyQuoteToken(`100.${exp}.${mac}`, quote)).toBeNull();
        expect(ship.verifyQuoteToken(token, { ...quote, daneCode: '76001' })).toBeNull();
        expect(ship.verifyQuoteToken(token, { ...quote, isCod: true })).toBeNull();
        expect(ship.verifyQuoteToken(token, quote, Date.now() + 31 * 60 * 1000)).toBeNull();
        expect(ship.verifyQuoteToken('basura', quote)).toBeNull();
    });
});

describe('quoteCheckoutShipping', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('cobra la oferta más barata redondeada a 100', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(rateResponse('coordinadora', 14210))
            .mockResolvedValueOnce(rateResponse('servientrega', 12950)));
        const q = await ship.quoteCheckoutShipping({ daneCode: '05001', weightKg: 1.2, declaredValueCop: 60000 });
        expect(q).toMatchObject({ cost: 13000, source: 'envia', etaDays: 3 });
    });

    it('en contraentrega suma la comisión de recaudo', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(rateResponse('coordinadora', 12000, { cashOnDeliveryCommission: 3000 }))
            .mockResolvedValueOnce(rateResponse('servientrega', 13000, { cashOnDeliveryCommission: 500 })));
        const q = await ship.quoteCheckoutShipping({ daneCode: '76001', weightKg: 1.2, isCod: true, collectionCop: 80000 });
        expect(q.cost).toBe(13500);
    });

    it('si Envia falla o el DANE no existe, tarifa fija', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '{}' }));
        const failed = await ship.quoteCheckoutShipping({ daneCode: '68001', weightKg: 1 });
        expect(failed).toMatchObject({ cost: ship.FLAT_SHIPPING_COP, source: 'flat' });
        const unknown = await ship.quoteCheckoutShipping({ daneCode: '99999', weightKg: 1 });
        expect(unknown.source).toBe('flat');
    });
});

describe('resolveOrderShipping', () => {
    it('gratis desde el umbral, token válido sin llamar a Envia', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const products = [{ id: 1, weight: 500, weight_unit: 'g' }];
        const items = [{ productId: 1, quantity: 2 }];

        expect(await ship.resolveOrderShipping({ discountedSubtotal: 120000, daneCode: '05001', items, products }))
            .toEqual({ shipping: 0, source: 'free' });

        const token = ship.signQuote({ daneCode: '05001', weightKg: 1, isCod: false, cost: 16700 });
        expect(await ship.resolveOrderShipping({ discountedSubtotal: 50000, daneCode: '05001', items, products, isCod: false, quoteToken: token }))
            .toEqual({ shipping: 16700, source: 'quote' });

        expect(await ship.resolveOrderShipping({ discountedSubtotal: 50000, daneCode: null, items, products }))
            .toEqual({ shipping: ship.FLAT_SHIPPING_COP, source: 'flat' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
