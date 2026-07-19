// Tests unitarios para la lógica pura de server/routes/shipping.js:
// mapeo de estados de tracking (con estados reales de transportadoras
// colombianas) y match seguro de envíos por mpCode.

import { describe, it, expect, vi } from 'vitest';

// El módulo importa db/auth/email/mipaquete al cargar; se mockean para poder
// importar las funciones puras sin tocar red ni base de datos.
vi.mock('../../db.js', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../../auth.js', () => ({
    authenticateToken: (_req, _res, next) => next(),
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

import { mapTrackingStateToStatus, matchSendingByMpCode } from '../shipping.js';

// Helper: evento de tracking con fecha
const ev = (updateState, date, description = '') => ({ updateState, date, description });

describe('mapTrackingStateToStatus', () => {
    it('debería retornar null sin eventos', () => {
        expect(mapTrackingStateToStatus([])).toBe(null);
        expect(mapTrackingStateToStatus(null)).toBe(null);
    });

    it('debería mapear "Entregado" a delivered', () => {
        expect(mapTrackingStateToStatus([ev('Entregado', '2026-07-19')])).toBe('delivered');
    });

    it('NO debería marcar delivered ante "No entregado" ni "Entrega fallida"', () => {
        expect(mapTrackingStateToStatus([ev('No entregado', '2026-07-19')])).toBe('in_transit');
        expect(mapTrackingStateToStatus([ev('Entrega fallida', '2026-07-19')])).toBe('in_transit');
        expect(mapTrackingStateToStatus([ev('Intento de entrega', '2026-07-19')])).toBe('in_transit');
        expect(mapTrackingStateToStatus([ev('Novedad en la entrega', '2026-07-19')])).toBe('in_transit');
    });

    it('debería usar solo el evento MÁS RECIENTE, no el historial completo', () => {
        // Un "Entregado" antiguo no debe contaminar una devolución posterior
        const events = [
            ev('Entregado', '2026-07-10'),
            ev('Devuelto al remitente', '2026-07-15'),
        ];
        expect(mapTrackingStateToStatus(events)).toBe('returned');

        // Y al revés: la entrega final gana aunque hubo novedades antes
        const events2 = [
            ev('No entregado', '2026-07-10'),
            ev('Entregado', '2026-07-15'),
        ];
        expect(mapTrackingStateToStatus(events2)).toBe('delivered');
    });

    it('debería mapear variantes de devolución (Devuelto, En devolución, Retorno)', () => {
        expect(mapTrackingStateToStatus([ev('Devuelto', '2026-07-19')])).toBe('returned');
        expect(mapTrackingStateToStatus([ev('En devolución', '2026-07-19')])).toBe('returned');
        expect(mapTrackingStateToStatus([ev('Retorno al origen', '2026-07-19')])).toBe('returned');
    });

    it('debería mapear estados de tránsito y recolección', () => {
        expect(mapTrackingStateToStatus([ev('En tránsito', '2026-07-19')])).toBe('in_transit');
        expect(mapTrackingStateToStatus([ev('En camino a ciudad destino', '2026-07-19')])).toBe('in_transit');
        expect(mapTrackingStateToStatus([ev('Recolectado', '2026-07-19')])).toBe('in_transit');
        expect(mapTrackingStateToStatus([ev('Pendiente por recogida', '2026-07-19')])).toBe('pickup_requested');
    });

    it('debería mapear "Cancelado" a cancelled', () => {
        expect(mapTrackingStateToStatus([ev('Cancelado', '2026-07-19')])).toBe('cancelled');
    });

    it('debería retornar null ante estados no reconocibles', () => {
        expect(mapTrackingStateToStatus([ev('Guía generada', '2026-07-19')])).toBe(null);
    });
});

describe('matchSendingByMpCode', () => {
    it('debería retornar null con lista vacía o inválida', () => {
        expect(matchSendingByMpCode([], 'MP1')).toBe(null);
        expect(matchSendingByMpCode(null, 'MP1')).toBe(null);
    });

    it('debería encontrar el envío cuyo mpCode coincide, sin importar la posición', () => {
        const sendings = [
            { mpCode: 'MP-AAA', guide: '1' },
            { mpCode: 'MP-BBB', guide: '2' },
        ];
        expect(matchSendingByMpCode(sendings, 'MP-BBB').guide).toBe('2');
    });

    it('debería aceptar el único resultado si la respuesta no trae mpCode', () => {
        const sendings = [{ 'Número de Guía': '999' }];
        expect(matchSendingByMpCode(sendings, 'MP-X')['Número de Guía']).toBe('999');
    });

    it('NO debería tomar a ciegas el primero cuando hay varios sin mpCode', () => {
        const sendings = [{ guide: '1' }, { guide: '2' }];
        expect(matchSendingByMpCode(sendings, 'MP-X')).toBe(null);
    });

    it('debería comparar mpCode numérico contra string', () => {
        const sendings = [{ mpCode: 12345, guide: 'n' }];
        expect(matchSendingByMpCode(sendings, '12345').guide).toBe('n');
    });
});
