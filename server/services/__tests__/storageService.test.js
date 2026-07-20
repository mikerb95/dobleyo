// Tests de server/services/storageService.js
// Ejecutar con: npm test
//
// A diferencia de los demás tests del proyecto, aquí NO se mockea la base de
// datos: se usa un SQLite real en archivo temporal. El valor de este módulo
// está justamente en las restricciones del motor (CHECK qty_kg >= 0, UNIQUE de
// movement_uid) y en el comportamiento transaccional; mockear la BD probaría
// los mocks, no las garantías que interesan.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// El cliente libSQL se crea al importar db.js, así que la URL debe fijarse antes.
const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-storage-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

let query, storage;

const user = { id: 1 };
const LOT = 'COL-HUI-1800-CAT-LAV-TEST';
const LOT_B = 'COL-NAR-1900-BOR-HON-TEST';

beforeAll(async () => {
    ({ query } = await import('../../db.js'));
    storage = await import('../storageService.js');

    // Tablas mínimas que el servicio referencia en sus JOIN.
    await query('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT)');
    await query(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT,
        entity_type TEXT, entity_id TEXT, details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`INSERT OR IGNORE INTO users (id, email) VALUES (1, 'admin@dobleyo.cafe')`);

    // Tablas del pipeline: la migración hace backfill a partir de ellas.
    const { createCoffeeTables } = await import('../../migrations/create_coffee_tables.js');
    await createCoffeeTables();

    const { createStorageLocations } = await import('../../migrations/create_storage_locations.js');
    await createStorageLocations();
});

// Cada test parte de una bodega vacía y del maestro recién sembrado.
beforeEach(async () => {
    await query('DELETE FROM storage_quants');
    await query('DELETE FROM storage_movements');
    await query('UPDATE storage_locations SET is_blocked = 0, block_reason = NULL, is_active = 1');
});

const occupancyOf = async (code) => {
    const list = await storage.listLocations({ includeInactive: true });
    return list.find((l) => l.code === code)?.occupied_kg ?? 0;
};

describe('postMovement() — validaciones de ubicación', () => {
    it('rechaza una ubicación que no existe en el maestro', async () => {
        await expect(storage.postMovement({
            type: 'receipt', to: 'NO-EXISTE', lotId: LOT, stockState: 'green', qtyKg: 10, user,
        })).rejects.toMatchObject({ status: 404 });
    });

    it('rechaza mercancía de un tipo que la ubicación no admite', async () => {
        await expect(storage.postMovement({
            type: 'receipt', to: 'ROASTED-A-01', lotId: LOT, stockState: 'green', qtyKg: 10, user,
        })).rejects.toMatchObject({ status: 422 });
    });

    it('rechaza el ingreso a una ubicación bloqueada', async () => {
        await query(`UPDATE storage_locations SET is_blocked = 1, block_reason = 'Conteo' WHERE code = 'GREEN-A-01'`);
        await expect(storage.postMovement({
            type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 10, user,
        })).rejects.toMatchObject({ status: 409 });
    });

    it('el bloqueo congela la ubicación en AMBOS sentidos', async () => {
        // Es lo que hace confiable un conteo físico: si pudiera salir mercancía
        // mientras se cuenta, la diferencia medida sería ruido, no un hallazgo.
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 50, user });
        await query(`UPDATE storage_locations SET is_blocked = 1, block_reason = 'Conteo físico' WHERE code = 'GREEN-A-01'`);

        await expect(storage.postMovement({
            type: 'issue', from: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 50, user,
        })).rejects.toMatchObject({ status: 409 });
        expect(await occupancyOf('GREEN-A-01')).toBe(50);
    });

    it('permite SACAR mercancía mal tipificada de una ubicación operativa', async () => {
        // La restricción de tipo aplica al ingresar. Si se aplicara también al
        // salir, un lote mal ubicado quedaría atrapado sin forma de corregirlo.
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 50, user });
        await query(`UPDATE storage_locations SET allowed_states = 'roasted' WHERE code = 'GREEN-A-01'`);

        await expect(storage.postMovement({
            type: 'issue', from: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 50, user,
        })).resolves.toMatchObject({ idempotent: false });
        expect(await occupancyOf('GREEN-A-01')).toBe(0);

        await query(`UPDATE storage_locations SET allowed_states = 'green' WHERE code = 'GREEN-A-01'`);
    });

    it('rechaza un movimiento con el mismo origen y destino', async () => {
        await expect(storage.postMovement({
            type: 'transfer', from: 'GREEN-A-01', to: 'GREEN-A-01',
            lotId: LOT, stockState: 'green', qtyKg: 1, user,
        })).rejects.toMatchObject({ status: 422 });
    });

    it('rechaza cantidades no positivas', async () => {
        await expect(storage.postMovement({
            type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 0, user,
        })).rejects.toMatchObject({ status: 400 });
        await expect(storage.postMovement({
            type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: -5, user,
        })).rejects.toMatchObject({ status: 400 });
    });
});

describe('postMovement() — capacidad y existencia', () => {
    it('rechaza un ingreso que supera la capacidad de la ubicación', async () => {
        // GREEN-A-01 tiene capacidad 1500 kg en el maestro sembrado.
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 1400, user });

        await expect(storage.postMovement({
            type: 'receipt', to: 'GREEN-A-01', lotId: LOT_B, stockState: 'green', qtyKg: 200, user,
        })).rejects.toMatchObject({ status: 409 });

        // La capacidad se evalúa sobre el total de la ubicación, no por lote.
        expect(await occupancyOf('GREEN-A-01')).toBe(1400);
    });

    it('acepta un ingreso que llega exactamente a la capacidad', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 1500, user });
        expect(await occupancyOf('GREEN-A-01')).toBe(1500);
    });

    it('rechaza una salida mayor a la existencia disponible', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });

        await expect(storage.postMovement({
            type: 'issue', from: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 101, user,
        })).rejects.toMatchObject({ status: 409 });
        expect(await occupancyOf('GREEN-A-01')).toBe(100);
    });

    it('valida la existencia por lote, no por ubicación', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });
        // Hay 100 kg en la ubicación, pero de OTRO lote.
        await expect(storage.postMovement({
            type: 'issue', from: 'GREEN-A-01', lotId: LOT_B, stockState: 'green', qtyKg: 50, user,
        })).rejects.toMatchObject({ status: 409 });
    });

    it('nunca deja un quant en negativo', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 10, user });
        await storage.postMovement({ type: 'issue', from: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 10, user });

        const { rows } = await query('SELECT MIN(qty_kg) AS min FROM storage_quants');
        expect(Number(rows[0].min ?? 0)).toBeGreaterThanOrEqual(0);
    });
});

describe('postMovement() — idempotencia', () => {
    it('un reintento con el mismo movement_uid no duplica stock', async () => {
        const uid = 'cola-offline-op-001';
        const payload = {
            type: 'receipt', to: 'GREEN-A-01', lotId: LOT,
            stockState: 'green', qtyKg: 80, movementUid: uid, user,
        };

        const first = await storage.postMovement(payload);
        const retry = await storage.postMovement(payload);

        expect(first.idempotent).toBe(false);
        expect(retry.idempotent).toBe(true);
        expect(retry.movementId).toBe(first.movementId);
        expect(await occupancyOf('GREEN-A-01')).toBe(80);

        const { rows } = await query('SELECT COUNT(*) AS c FROM storage_movements WHERE movement_uid = ?', [uid]);
        expect(Number(rows[0].c)).toBe(1);
    });

    it('genera un uid propio cuando el llamador no provee uno', async () => {
        const a = await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 5, user });
        const b = await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 5, user });
        expect(a.movementUid).not.toBe(b.movementUid);
        expect(await occupancyOf('GREEN-A-01')).toBe(10);
    });
});

describe('postMovement() — atomicidad', () => {
    it('no deja rastro en el ledger si la validación falla', async () => {
        await expect(storage.postMovement({
            type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 99999, user,
        })).rejects.toThrow();

        const { rows } = await query('SELECT COUNT(*) AS c FROM storage_movements');
        expect(Number(rows[0].c)).toBe(0);
    });

    it('un traslado descuenta el origen y acredita el destino en un solo asiento', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 300, user });
        await storage.transferStock({
            fromCode: 'GREEN-A-01', toCode: 'GREEN-B-01',
            lotId: LOT, stockState: 'green', qtyKg: 120, user,
        });

        expect(await occupancyOf('GREEN-A-01')).toBe(180);
        expect(await occupancyOf('GREEN-B-01')).toBe(120);

        const { rows } = await query('SELECT COUNT(*) AS c FROM storage_movements WHERE movement_type = ?', ['transfer']);
        expect(Number(rows[0].c)).toBe(1);
    });
});

describe('issueFromLotFIFO()', () => {
    it('consume varias ubicaciones en orden hasta cubrir la cantidad', async () => {
        const { withTransaction } = await import('../../db.js');
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-02', lotId: LOT, stockState: 'green', qtyKg: 100, user });
        await storage.postMovement({ type: 'receipt', to: 'GREEN-B-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });

        const result = await withTransaction((tx) => storage.issueFromLotFIFO(tx, {
            lotId: LOT, stockState: 'green', qtyKg: 250,
            uidPrefix: 'test-fifo', reasonCode: 'test', user,
        }));

        expect(result.issued.map((i) => [i.location, i.qty_kg])).toEqual([
            ['GREEN-A-01', 100], ['GREEN-A-02', 100], ['GREEN-B-01', 50],
        ]);
        expect(await occupancyOf('GREEN-A-01')).toBe(0);
        expect(await occupancyOf('GREEN-B-01')).toBe(50);
    });

    it('rechaza el retiro completo si el lote no alcanza, sin consumir nada', async () => {
        const { withTransaction } = await import('../../db.js');
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });

        await expect(withTransaction((tx) => storage.issueFromLotFIFO(tx, {
            lotId: LOT, stockState: 'green', qtyKg: 500, uidPrefix: 'test-short', user,
        }))).rejects.toMatchObject({ status: 409 });

        // Nada consumido: la transacción completa se revirtió.
        expect(await occupancyOf('GREEN-A-01')).toBe(100);
    });
});

describe('adjustStock()', () => {
    it('asienta la diferencia en lugar de editar el quant', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });

        const result = await storage.adjustStock({
            locationCode: 'GREEN-A-01', lotId: LOT, stockState: 'green',
            targetQtyKg: 94, reason: 'Merma por humedad detectada en inspección', user,
        });

        expect(result.delta).toBe(-6);
        expect(await occupancyOf('GREEN-A-01')).toBe(94);

        const { rows } = await query(
            'SELECT movement_type, qty_kg FROM storage_movements WHERE movement_type = ?', ['adjustment']
        );
        expect(rows).toHaveLength(1);
        expect(Number(rows[0].qty_kg)).toBe(6);
    });

    it('no genera movimiento cuando no hay diferencia', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });
        const result = await storage.adjustStock({
            locationCode: 'GREEN-A-01', lotId: LOT, stockState: 'green',
            targetQtyKg: 100, reason: 'Verificación rutinaria', user,
        });
        expect(result.movementId).toBeNull();
        expect(result.delta).toBe(0);
    });

    it('registra el ajuste en la auditoría', async () => {
        await query('DELETE FROM audit_logs');
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 100, user });
        await storage.adjustStock({
            locationCode: 'GREEN-A-01', lotId: LOT, stockState: 'green',
            targetQtyKg: 90, reason: 'Diferencia hallada en revisión', user,
        });

        // logAudit usa el cliente NO transaccional: si se llamara dentro de la
        // transacción del ajuste se auto-bloquearía y el registro se perdería.
        const { rows } = await query(`SELECT action, entity_type FROM audit_logs WHERE action = 'adjust'`);
        expect(rows).toHaveLength(1);
        expect(rows[0].entity_type).toBe('storage_movement');
    });

    it('exige un motivo', async () => {
        await expect(storage.adjustStock({
            locationCode: 'GREEN-A-01', lotId: LOT, stockState: 'green', targetQtyKg: 10, user,
        })).rejects.toMatchObject({ status: 400 });
    });
});

describe('Maestro de ubicaciones', () => {
    it('impide desactivar una ubicación con existencias', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 10, user });
        const { rows } = await query(`SELECT id FROM storage_locations WHERE code = 'GREEN-A-01'`);

        await expect(storage.deactivateLocation(rows[0].id, user)).rejects.toMatchObject({ status: 409 });
    });

    it('permite desactivar una ubicación vacía', async () => {
        const { rows } = await query(`SELECT id FROM storage_locations WHERE code = 'GREEN-A-02'`);
        await expect(storage.deactivateLocation(rows[0].id, user)).resolves.toMatchObject({ is_active: 0 });
    });

    it('rechaza fijar una capacidad por debajo de lo ya almacenado', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 900, user });
        const { rows } = await query(`SELECT id, version FROM storage_locations WHERE code = 'GREEN-A-01'`);

        await expect(storage.updateLocation(rows[0].id, {
            capacityKg: 500, version: rows[0].version, user,
        })).rejects.toMatchObject({ status: 422 });
    });

    it('rechaza retirar un tipo de café del que aún hay existencias', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 10, user });
        const { rows } = await query(`SELECT id, version FROM storage_locations WHERE code = 'GREEN-A-01'`);

        await expect(storage.updateLocation(rows[0].id, {
            allowedStates: ['roasted'], version: rows[0].version, user,
        })).rejects.toMatchObject({ status: 422 });
    });

    it('aplica bloqueo optimista: una versión vieja no pisa el cambio ajeno', async () => {
        const { rows } = await query(`SELECT id, version FROM storage_locations WHERE code = 'GREEN-B-02'`);
        const staleVersion = rows[0].version;

        await storage.updateLocation(rows[0].id, { name: 'Primer cambio', version: staleVersion, user });

        await expect(storage.updateLocation(rows[0].id, {
            name: 'Cambio con versión vieja', version: staleVersion, user,
        })).rejects.toMatchObject({ status: 409 });
    });

    it('rechaza códigos duplicados y mal formados', async () => {
        const zone = await query(`SELECT id FROM storage_zones WHERE code = 'Z-VERDE'`);
        await expect(storage.createLocation({
            zoneId: zone.rows[0].id, code: 'GREEN-A-01', name: 'Duplicada',
            allowedStates: ['green'], user,
        })).rejects.toMatchObject({ status: 409 });

        await expect(storage.createLocation({
            zoneId: zone.rows[0].id, code: 'con minúsculas!', name: 'Inválida',
            allowedStates: ['green'], user,
        })).rejects.toMatchObject({ status: 422 });
    });

    it('exige un motivo al bloquear', async () => {
        const { rows } = await query(`SELECT id FROM storage_locations WHERE code = 'GREEN-A-01'`);
        await expect(storage.setLocationBlocked(rows[0].id, { blocked: true, reason: '  ', user }))
            .rejects.toMatchObject({ status: 422 });
    });
});

describe('rebuildQuants() y reconcileReport()', () => {
    it('reconstruye exactamente las existencias a partir del ledger', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 500, user });
        await storage.postMovement({ type: 'receipt', to: 'GREEN-B-01', lotId: LOT_B, stockState: 'green', qtyKg: 200, user });
        await storage.transferStock({ fromCode: 'GREEN-A-01', toCode: 'GREEN-A-02', lotId: LOT, stockState: 'green', qtyKg: 150, user });
        await storage.postMovement({ type: 'issue', from: 'GREEN-B-01', lotId: LOT_B, stockState: 'green', qtyKg: 80, user });

        const before = await storage.listLocations({ includeInactive: true });
        await storage.rebuildQuants();
        const after = await storage.listLocations({ includeInactive: true });

        const snapshot = (list) => list.map((l) => `${l.code}:${l.occupied_kg}`).join('|');
        expect(snapshot(after)).toBe(snapshot(before));
        expect(await occupancyOf('GREEN-A-01')).toBe(350);
        expect(await occupancyOf('GREEN-A-02')).toBe(150);
        expect(await occupancyOf('GREEN-B-01')).toBe(120);
    });

    it('detecta una proyección corrupta y la repara', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 400, user });

        // Corrupción simulada: alguien tocó storage_quants por fuera del servicio.
        await query(`UPDATE storage_quants SET qty_kg = 999 WHERE lot_id = ?`, [LOT]);

        const dirty = await storage.reconcileReport();
        expect(dirty.inSync).toBe(false);
        expect(dirty.discrepancies).toHaveLength(1);
        expect(Number(dirty.discrepancies[0].diff_kg)).toBe(-599);

        await storage.rebuildQuants();
        const clean = await storage.reconcileReport();
        expect(clean.inSync).toBe(true);
        expect(await occupancyOf('GREEN-A-01')).toBe(400);
    });
});

describe('Conteo cíclico', () => {
    it('bloquea las ubicaciones, asienta las diferencias y desbloquea al cerrar', async () => {
        await storage.postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: LOT, stockState: 'green', qtyKg: 200, user });

        const opened = await storage.openInventoryCount({
            locationCodes: ['GREEN-A-01'], scopeNote: 'Conteo trimestral', user,
        });
        expect(opened.lines).toBe(1);

        const blocked = await query(`SELECT is_blocked FROM storage_locations WHERE code = 'GREEN-A-01'`);
        expect(Number(blocked.rows[0].is_blocked)).toBe(1);

        // El operario cuenta 195 kg físicos frente a los 200 del sistema.
        const lineRow = await query('SELECT id FROM inventory_count_lines WHERE count_id = ?', [opened.countId]);
        await storage.recordCountLine(opened.countId, lineRow.rows[0].id, 195, user);

        const posted = await storage.postInventoryCount(opened.countId, user);
        expect(posted.corrections).toHaveLength(1);
        expect(posted.corrections[0].delta_kg).toBe(-5);
        expect(await occupancyOf('GREEN-A-01')).toBe(195);

        const after = await query(`SELECT is_blocked FROM storage_locations WHERE code = 'GREEN-A-01'`);
        expect(Number(after.rows[0].is_blocked)).toBe(0);

        const state = await query('SELECT status FROM inventory_counts WHERE id = ?', [opened.countId]);
        expect(state.rows[0].status).toBe('posted');
    });

    it('no permite contabilizar dos veces el mismo conteo', async () => {
        const opened = await storage.openInventoryCount({ locationCodes: ['GREEN-A-02'], user });
        await storage.postInventoryCount(opened.countId, user);
        await expect(storage.postInventoryCount(opened.countId, user)).rejects.toMatchObject({ status: 409 });
    });
});
