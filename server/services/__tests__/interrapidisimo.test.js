// Tests unitarios de la lógica pura del cliente de Interrapidísimo:
// normalización de cotizaciones y mapeo de estados de guía.

import { describe, it, expect } from 'vitest';
import {
    normalizeInterQuotes,
    mapInterStatus,
    interStatesToEvents,
} from '../interrapidisimo.js';

describe('normalizeInterQuotes', () => {
    const rawQuote = {
        IdServicio: 3,
        NombreServicio: 'Mensajería',
        Precio: { Valor: 10850.4, ValorContraPago: 2500, Impuestos: 0 },
        TiempoEntrega: 2,
        FechaEntrega: '2026-10-15T18:00:00',
        Mensaje: '',
    };

    it('normaliza al formato que usa el panel de envíos', () => {
        const [q] = normalizeInterQuotes([rawQuote]);
        expect(q).toMatchObject({
            provider: 'interrapidisimo',
            serviceId: 3,
            deliveryCompanyId: 'inter:3',
            shippingCost: 10850,
            codCost: 2500,
            shippingTime: 2 * 24 * 60,
        });
        expect(q.deliveryCompanyName).toContain('Mensajería');
    });

    it('acepta una respuesta con un solo objeto en vez de lista', () => {
        expect(normalizeInterQuotes(rawQuote)).toHaveLength(1);
    });

    it('descarta servicios sin precio (sin cobertura)', () => {
        const sinPrecio = { ...rawQuote, IdServicio: 6, Precio: { Valor: 0 } };
        expect(normalizeInterQuotes([rawQuote, sinPrecio])).toHaveLength(1);
        expect(normalizeInterQuotes(null)).toEqual([]);
    });
});

describe('mapInterStatus', () => {
    it('usa el estado más reciente por fecha, no por posición', () => {
        const estados = [
            { idEstadoGuia: 3, nombreEstado: 'Tránsito nacional', fechaEstado: '2026-10-10T08:00:00' },
            { idEstadoGuia: 11, nombreEstado: 'ENTREGADA', fechaEstado: '2026-10-12T15:00:00' },
            { idEstadoGuia: 1, nombreEstado: 'Admitida', fechaEstado: '2026-10-09T10:00:00' },
        ];
        expect(mapInterStatus(estados)).toBe('delivered');
    });

    it('mapea devolución y anulación por id', () => {
        expect(mapInterStatus([{ idEstadoGuia: 10, fechaEstado: '2026-10-12' }])).toBe('returned');
        expect(mapInterStatus([{ idEstadoGuia: 15, fechaEstado: '2026-10-12' }])).toBe('cancelled');
    });

    it('cae al texto cuando el id no está en la tabla', () => {
        expect(mapInterStatus([{ idEstadoGuia: 99, nombreEstado: 'Entrega exitosa', fechaEstado: '2026-10-12' }])).toBe('delivered');
        expect(mapInterStatus([{ idEstadoGuia: 99, nombreEstado: 'No entregado', fechaEstado: '2026-10-12' }])).toBeNull();
        expect(mapInterStatus([{ idEstadoGuia: 99, nombreEstado: 'En devolución', fechaEstado: '2026-10-12' }])).toBe('returned');
    });

    it('devuelve null sin estados', () => {
        expect(mapInterStatus([])).toBeNull();
        expect(mapInterStatus(undefined)).toBeNull();
    });
});

describe('interStatesToEvents', () => {
    it('produce eventos con el formato de shipment_events', () => {
        const [ev] = interStatesToEvents([{
            idEstadoGuia: 3, nombreEstado: 'Tránsito nacional',
            nombreCiudadOrigen: 'BOGOTA', nombreCiudadDestino: 'MEDELLIN', fechaEstado: '2026-10-10T08:00:00',
        }]);
        expect(ev).toEqual({
            updateState: 'Tránsito nacional',
            description: 'BOGOTA → MEDELLIN',
            date: '2026-10-10T08:00:00',
            stateId: 3,
        });
    });
});
