// Tests del alcance por lote del caficultor (server/middleware/farmAuth.js)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../db.js', () => ({ query: mocks.query }));

import { assertLotAccess, filterRowsByLotAccess } from '../farmAuth.js';

const admin = { id: 1, role: 'admin' };
const ana = { id: 20, role: 'caficultor' };

// Ana es dueña de "la-ceiba"; "el-roble" es de otro caficultor; "sin-registro" no está en farms.
function mockDb() {
    mocks.query.mockImplementation(async (sql, args = []) => {
        if (/FROM coffee_harvests ch\s+LEFT JOIN farms/.test(sql)) {
            const owners = { 'L-ANA': 20, 'L-OTRO': 99, 'L-LIBRE': null };
            return args[0] in owners ? { rows: [{ caficultor_id: owners[args[0]] }] } : { rows: [] };
        }
        if (/SELECT lot_id, farm FROM coffee_harvests/.test(sql)) {
            return { rows: [
                { lot_id: 'L-ANA', farm: 'la-ceiba' },
                { lot_id: 'L-OTRO', farm: 'el-roble' },
                { lot_id: 'L-LIBRE', farm: 'sin-registro' },
            ] };
        }
        if (/SELECT slug, caficultor_id FROM farms/.test(sql)) {
            return { rows: [{ slug: 'la-ceiba', caficultor_id: 20 }, { slug: 'el-roble', caficultor_id: 99 }] };
        }
        if (/FROM roasting_batches WHERE id = \?/.test(sql)) {
            return { rows: args[0] === 5 ? [{ lot_id: 'L-OTRO' }] : [] };
        }
        return { rows: [] };
    });
}

describe('assertLotAccess', () => {
    beforeEach(mockDb);

    it('deja pasar al admin sin consultar la BD', async () => {
        await expect(assertLotAccess('lot', 'L-OTRO', admin)).resolves.toBeUndefined();
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it('permite al caficultor sus lotes y los de fincas sin dueño', async () => {
        await expect(assertLotAccess('lot', 'L-ANA', ana)).resolves.toBeUndefined();
        await expect(assertLotAccess('lot', 'L-LIBRE', ana)).resolves.toBeUndefined();
    });

    it('rechaza con 403 un lote de otra finca, también llegando por el id de tostión', async () => {
        await expect(assertLotAccess('lot', 'L-OTRO', ana)).rejects.toMatchObject({ status: 403 });
        await expect(assertLotAccess('roastingBatch', 5, ana)).rejects.toMatchObject({ status: 403 });
    });
});

describe('filterRowsByLotAccess', () => {
    beforeEach(mockDb);

    const rows = [{ lot_id: 'L-ANA' }, { lot_id: 'L-OTRO' }, { lot_id: 'L-LIBRE' }, { lot_id: null }];

    it('devuelve todo al admin', async () => {
        expect(await filterRowsByLotAccess(rows, admin)).toHaveLength(4);
    });

    it('al caficultor le quita lotes ajenos y filas sin lote', async () => {
        const visibles = await filterRowsByLotAccess(rows, ana);
        expect(visibles.map((r) => r.lot_id)).toEqual(['L-ANA', 'L-LIBRE']);
    });
});
