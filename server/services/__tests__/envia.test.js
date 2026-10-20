// Tests del cliente de Envia.com: normalización de tarifas, direcciones de
// Colombia (DANE → estado), estados de tracking y la llamada de cotización por
// transportadora. fetch se mockea; no hay red.

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.ENVIA_TOKEN = 'tok_test';
process.env.ENVIA_CARRIERS = 'coordinadora, servientrega';

const envia = await import('../envia.js');

describe('direcciones', () => {
    it('completa el DANE de municipio a 8 dígitos y deriva el estado', () => {
        expect(envia.normalizeDane('05001')).toBe('05001000');
        expect(envia.stateForDane('11001000')).toBe('DC');
        expect(envia.stateForDane('76001')).toBe('VC');
        expect(envia.stateForDane('12001')).toBeNull();
    });

    it('arma el destino con el formato de Colombia', () => {
        const dest = envia.enviaDestination({
            name: 'Ana Gómez', phone: '+57 300 123 4567', street: 'Cra 18 # 10-45', daneCode: '05001',
            identificationNumber: ' 1020304050 ',
        });
        expect(dest).toMatchObject({
            city: '05001000', postalCode: '05001000', state: 'AN', country: 'CO',
            phone: '3001234567', identificationNumber: '1020304050',
        });
    });
});

describe('normalizeEnviaRates', () => {
    it('convierte cada tarifa al formato del panel y descarta las de precio 0', () => {
        const rates = envia.normalizeEnviaRates({
            meta: 'rate',
            data: [
                { carrier: 'coordinadora', carrierDescription: 'Coordinadora', service: 'ground', serviceDescription: 'Terrestre', totalPrice: 12500.4, deliveryDate: { dateDifference: 2, date: '2026-10-21' } },
                { carrier: 'coordinadora', service: 'express', totalPrice: 0 },
            ],
        });
        expect(rates).toEqual([expect.objectContaining({
            provider: 'envia',
            deliveryCompanyId: 'envia:coordinadora:ground',
            deliveryCompanyName: 'Coordinadora · Terrestre',
            shippingCost: 12500,
            shippingTime: 2 * 24 * 60,
        })]);
    });

    it('lee carrier y servicio del id de la oferta', () => {
        expect(envia.parseEnviaCompanyId('envia:servientrega:ground')).toEqual({ carrier: 'servientrega', service: 'ground' });
        expect(envia.parseEnviaCompanyId('inter:3')).toBeNull();
        expect(envia.parseEnviaCompanyId('envia:coordinadora')).toBeNull();
    });
});

describe('estados', () => {
    it('mapea por id y, si no hay, por nombre', () => {
        expect(envia.mapEnviaStatus({ statusId: 3 })).toBe('delivered');
        expect(envia.mapEnviaStatus({ statusId: 8 })).toBe('in_transit');
        expect(envia.mapEnviaStatus({ status: 'Canceled' })).toBe('cancelled');
        expect(envia.mapEnviaStatus({ statusId: 5 })).toBeNull();
        expect(envia.mapEnviaStatus(null)).toBeNull();
    });

    it('agrega una novedad en español para los estados que piden gestión', () => {
        const events = envia.enviaGuideToEvents({
            statusId: 21,
            eventHistory: [{ event: 'En tránsito', location: 'Bogotá', date: '2026-10-19 10:00' }],
        });
        expect(events).toHaveLength(2);
        expect(events[1].updateState).toBe('Novedad: Error en la dirección');
    });
});

describe('nextPickupDate', () => {
    it('usa hoy antes de mediodía en Colombia y salta el domingo', () => {
        expect(envia.nextPickupDate(new Date('2026-10-19T14:00:00Z'))).toBe('2026-10-19'); // lunes 9:00
        expect(envia.nextPickupDate(new Date('2026-10-19T20:00:00Z'))).toBe('2026-10-20'); // lunes 15:00
        expect(envia.nextPickupDate(new Date('2026-10-24T20:00:00Z'))).toBe('2026-10-26'); // sábado tarde → lunes
    });
});

describe('quoteEnvia', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('cotiza una vez por transportadora y tolera las que fallan', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({ meta: 'rate', data: [{ carrier: 'coordinadora', service: 'ground', totalPrice: 15000 }] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ meta: 'error', error: { message: 'Sin cobertura' } }), { status: 200 }));

        const offers = await envia.quoteEnvia({
            originDaneCode: '11001000', destinyDaneCode: '05001000',
            weightKg: 1, width: 20, length: 30, height: 10, declaredValue: 60000,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api-test.envia.com/ship/rate/');
        expect(init.headers.Authorization).toBe('Bearer tok_test');
        const body = JSON.parse(init.body);
        expect(body.shipment.carrier).toBe('coordinadora');
        expect(body.destination).toMatchObject({ city: '05001000', state: 'AN' });
        expect(offers).toHaveLength(1);
    });

    it('incluye el recaudo contraentrega en el paquete', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({ meta: 'rate', data: [] }), { status: 200 }));

        await envia.quoteEnvia({
            originDaneCode: '11001000', destinyDaneCode: '05001000',
            weightKg: 1, width: 20, length: 30, height: 10, declaredValue: 60000, codAmount: 60000,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.packages[0].additionalServices).toEqual([{ service: 'cash_on_delivery', data: { amount: 60000 } }]);
    });

    it('lanza error si todas las transportadoras fallan', async () => {
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));

        await expect(envia.quoteEnvia({
            originDaneCode: '11001000', destinyDaneCode: '05001000',
            weightKg: 1, width: 20, length: 30, height: 10, declaredValue: 60000,
        })).rejects.toBeInstanceOf(envia.EnviaError);
    });
});
