// Prueba de integración del costeo de producción, de punta a punta.
//
// A diferencia de los demás tests de rutas, aquí NO se mockea la base de datos:
// se recorre el pipeline completo por HTTP (cosecha → bodega → tostión → retiro
// → almacén → empaque) contra un SQLite real y se verifica que el costo se
// acumule, se prorratee por los pesos correctos y quede contabilizado.
//
// Lo único mockeado es autenticación, rate limiting y ntfy: probar el JWT y la
// red aquí no aporta nada y sí hace el test frágil.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// El cliente libSQL se crea al importar db.js: la URL debe fijarse antes.
const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-costs-e2e-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

// El rol lo controla cada test: así se verifica que el caficultor no pueda
// registrar costos aunque los envíe en el body.
const session = { user: { id: 1, role: 'admin' } };

vi.mock('../../auth.js', () => ({
    authenticateToken: (req, _res, next) => { req.user = session.user; next(); },
    requireRole: (roles) => (req, res, next) => {
        const allowed = Array.isArray(roles) ? roles : [roles];
        if (allowed.includes(req.user?.role)) return next();
        res.status(403).json({ error: 'Permisos insuficientes' });
    },
}));

vi.mock('../../middleware/rateLimit.js', () => ({
    apiLimiter: (_req, _res, next) => next(),
    globalLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../services/ntfy.js', () => ({
    sendNtfyAsync: vi.fn(),
    sendNtfy: vi.fn().mockResolvedValue({ ok: true }),
}));

let query, app;
const LOT = {};

beforeAll(async () => {
    ({ query } = await import('../../db.js'));

    await query(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, role TEXT)`);
    await query(`INSERT OR IGNORE INTO users (id, first_name, last_name, email, role)
                 VALUES (1, 'Admin', 'DobleYo', 'admin@dobleyo.cafe', 'admin')`);
    await query(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT,
        entity_type TEXT, entity_id TEXT, details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    const { createFinanceTables } = await import('../../migrations/create_finance_tables.js');
    await createFinanceTables();

    // Cuentas del plan base (el seed vive en db/seed_data.sql, que no se aplica aquí).
    for (const [code, name, type, subtype] of [
        ['1110', 'Caja Principal', 'activo', 'efectivo'],
        ['1210', 'Bancolombia CC', 'activo', 'banco'],
        ['1410', 'Café Verde', 'activo', 'inventario'],
        ['1420', 'Café Tostado', 'activo', 'inventario'],
        ['1430', 'Empaques y Consumibles', 'activo', 'inventario'],
        ['2110', 'Cuentas por Pagar - Proveedores', 'pasivo', 'cuentas_por_pagar'],
        ['2120', 'Cuentas por Pagar - Caficultores', 'pasivo', 'cuentas_por_pagar'],
    ]) {
        await query(
            `INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at)
             SELECT ?, ?, ?, ?, 1, datetime('now')
             WHERE NOT EXISTS (SELECT 1 FROM accounting_accounts WHERE code = ?)`,
            [code, name, type, subtype, code]
        );
    }

    const { createCoffeeTables } = await import('../../migrations/create_coffee_tables.js');
    await createCoffeeTables();

    // `assertFarmOwnership` la consulta; sin filas, cualquier finca pasa.
    await query(`CREATE TABLE IF NOT EXISTS farms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, caficultor_id INTEGER)`);
    const { createStorageLocations } = await import('../../migrations/create_storage_locations.js');
    await createStorageLocations();
    const { createCostTracking } = await import('../../migrations/create_cost_tracking.js');
    await createCostTracking();

    // El empaque crea un producto cuando addToInventory está activo.
    await query(`CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY, name TEXT, category TEXT, origin TEXT, process TEXT,
        roast TEXT, price INTEGER, cost INTEGER, is_active INTEGER, stock_quantity INTEGER,
        stock_min INTEGER, weight REAL, weight_unit TEXT, created_at TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT, movement_type TEXT,
        quantity INTEGER, quantity_before INTEGER, quantity_after INTEGER,
        reason TEXT, reference TEXT, created_at TIMESTAMP)`);

    const { coffeeRouter } = await import('../coffee.js');
    const { costsRouter } = await import('../costs.js');

    app = express();
    app.use(express.json());
    app.use('/api/coffee', coffeeRouter);
    app.use('/api/costs', costsRouter);
});

/** Ubicación activa apta para el estado de stock pedido. */
async function pickLocation(state) {
    const { rows } = await query(
        `SELECT l.code FROM storage_locations l
         JOIN storage_zones z ON z.id = l.zone_id
        WHERE z.zone_type = ? AND l.is_active = 1 LIMIT 1`,
        [state]
    );
    return rows[0].code;
}

describe('Pipeline completo con costos', () => {
    it('1. cosecha: registra el lote, el peso y el pago al caficultor', async () => {
        const res = await request(app)
            .post('/api/coffee/harvest')
            .send({
                farm: 'finca-la-sierra', variety: 'CAT', climate: 'SECO', process: 'LAV',
                aroma: 'Chocolate', tasteNotes: 'Cereza y avellana',
                harvestWeightKg: 100,
                cost: { amount: 1_800_000, paymentMethod: 'credito' },
            })
            .expect(201);

        expect(res.body.success).toBe(true);
        LOT.id = res.body.lotId;

        const { rows } = await query('SELECT * FROM lot_costs WHERE lot_id = ?', [LOT.id]);
        expect(rows).toHaveLength(1);
        expect(rows[0].amount_cop).toBe(1_800_000);
        expect(rows[0].cost_type).toBe('farmer_payment');
        expect(rows[0].accounting_entry_id).not.toBeNull();
    });

    it('2. bodega: 100 kg cosechados entran 80 kg, más el flete', async () => {
        await request(app)
            .post('/api/coffee/inventory-storage')
            .send({
                lotId: LOT.id, weight: 80, weightUnit: 'kg',
                location: await pickLocation('green'),
                storageDate: new Date().toISOString().slice(0, 10),
                cost: { amount: 180_000, paymentMethod: 'caja' },
            })
            .expect(201);

        const { rows } = await query(
            "SELECT amount_cop FROM lot_costs WHERE lot_id = ? AND cost_type = 'transport_to_storage'",
            [LOT.id]
        );
        expect(rows[0].amount_cop).toBe(180_000);
    });

    it('3. tostión: se envían los 80 kg con su transporte', async () => {
        const res = await request(app)
            .post('/api/coffee/send-roasting')
            .send({
                lotId: LOT.id, quantitySent: 80, targetTemp: 210,
                cost: { amount: 120_000, paymentMethod: 'banco' },
            })
            .expect(201);

        LOT.roastingId = res.body.roastingId;

        const { rows } = await query(
            "SELECT amount_cop FROM lot_costs WHERE lot_id = ? AND cost_type = 'transport_to_roaster'",
            [LOT.id]
        );
        expect(rows[0].amount_cop).toBe(120_000);
    });

    it('4. retiro: salen 64 kg (20% de merma) y se paga la maquila', async () => {
        const res = await request(app)
            .post('/api/coffee/roast-retrieval')
            .send({
                roastingId: LOT.roastingId, roastLevel: 'MEDIUM', roastedWeight: 64,
                actualTemp: 205, roastTime: 12,
                cost: { amount: 256_000, paymentMethod: 'banco' },
            })
            .expect(201);

        LOT.roastedId = res.body.roastedId;
        expect(res.body.weightLossPercent).toBe(20);

        const { rows } = await query(
            "SELECT amount_cop, qty_kg FROM lot_costs WHERE lot_id = ? AND cost_type = 'roasting_service'",
            [LOT.id]
        );
        // La maquila se imputa sobre los kilos que salieron, no los enviados.
        expect(rows[0].qty_kg).toBe(64);
    });

    it('5. almacén: entra a bodega con el flete de retorno', async () => {
        const res = await request(app)
            .post('/api/coffee/roasted-storage')
            .send({
                roastedId: LOT.roastedId, location: await pickLocation('roasted'),
                container: 'saco', containerCount: 2,
                cost: { amount: 100_000, paymentMethod: 'caja' },
            })
            .expect(201);

        LOT.storageId = res.body.storageId;

        const { rows } = await query(
            "SELECT amount_cop FROM lot_costs WHERE lot_id = ? AND cost_type = 'transport_to_warehouse'",
            [LOT.id]
        );
        expect(rows[0].amount_cop).toBe(100_000);
    });

    it('6. empaque: consume bolsa y etiqueta del maestro y descuenta su stock', async () => {
        const bag = await query("SELECT id, unit_cost_cop FROM packaging_supplies WHERE sku = 'BOL-250'");
        const label = await query("SELECT id, unit_cost_cop FROM packaging_supplies WHERE sku = 'ETI-STD'");
        await query('UPDATE packaging_supplies SET stock_units = 500 WHERE id IN (?, ?)',
            [bag.rows[0].id, label.rows[0].id]);

        // 64 kg tostados → 256 bolsas de 250 g.
        const res = await request(app)
            .post('/api/coffee/packaging')
            .send({
                roastedStorageId: LOT.storageId,
                acidity: 4, body: 4, balance: 4,
                presentation: 'GRANO', packageSize: '250g', unitCount: 256,
                addToInventory: true,
                bagSupplyId: bag.rows[0].id, labelSupplyId: label.rows[0].id,
            })
            .expect(201);

        const expected = (bag.rows[0].unit_cost_cop + label.rows[0].unit_cost_cop) * 256;
        expect(res.body.packagingCostCop).toBe(expected);

        // El stock del maestro bajó por las 256 unidades consumidas.
        const after = await query('SELECT stock_units FROM packaging_supplies WHERE id = ?', [bag.rows[0].id]);
        expect(after.rows[0].stock_units).toBe(244);

        // Bolsa y etiqueta quedan como costos separados para poder leer el desglose.
        const { rows } = await query(
            `SELECT cost_type FROM lot_costs WHERE lot_id = ? AND stage = 'packaging' ORDER BY cost_type`,
            [LOT.id]
        );
        expect(rows.map((r) => r.cost_type)).toEqual(['labeling_material', 'packaging_material']);
    });

    it('7. el resumen acumula el costo y lo prorratea por los pesos correctos', async () => {
        const res = await request(app)
            .get(`/api/costs/lot/${encodeURIComponent(LOT.id)}`)
            .expect(200);

        const d = res.body.data;

        expect(d.weights.harvested_kg).toBe(100);
        expect(d.weights.green_kg).toBe(80);
        expect(d.weights.roasted_kg).toBe(64);
        expect(d.shrinkage.drying_pct).toBe(20);
        expect(d.shrinkage.roasting_pct).toBe(20);

        // Origen: 1.800.000 + 180.000 = 1.980.000 entre los 80 kg que llegaron
        // a bodega (no entre los 100 cosechados).
        expect(d.cost_per_kg.green).toBe(24_750);

        // Tostado: acumulado hasta el almacén entre los 64 kg que salieron.
        const roastedCost = 1_980_000 + 120_000 + 256_000 + 100_000;
        expect(d.totals.roasted_cop).toBe(roastedCost);
        expect(d.cost_per_kg.roasted).toBe(Math.round(roastedCost / 64));

        // El total suma el empaque.
        expect(d.totals.total_cop).toBe(roastedCost + d.totals.packaging_cop);

        // Todas las etapas alcanzadas tienen costo.
        expect(d.missing_stages).toEqual([]);
        expect(d.complete).toBe(true);
        expect(d.pending_accounting).toBe(0);
    });

    it('8. todos los asientos del lote cuadran y están en borrador', async () => {
        const { rows } = await query(
            `SELECT e.id, e.state, e.total_debit,
                    (SELECT SUM(debit)  FROM accounting_entry_lines WHERE entry_id = e.id) AS d,
                    (SELECT SUM(credit) FROM accounting_entry_lines WHERE entry_id = e.id) AS c
               FROM accounting_entries e
              WHERE e.reference = ?`,
            [LOT.id]
        );

        expect(rows.length).toBe(7); // 5 etapas + bolsa + etiqueta
        for (const entry of rows) {
            expect(entry.d).toBe(entry.c);
            expect(entry.d).toBe(entry.total_debit);
            expect(entry.state).toBe('borrador');
        }
    });

    it('9. el listado general expone el lote con su costo unitario', async () => {
        const res = await request(app).get('/api/costs?limit=10').expect(200);

        const lot = res.body.data.lots.find((l) => l.lot_id === LOT.id);
        expect(lot).toBeDefined();
        expect(lot.unit_cost_cop).toBeGreaterThan(0);
        expect(lot.complete).toBe(true);
    });

    it('10. corregir un costo reversa el asiento y recalcula el total', async () => {
        const before = await request(app).get(`/api/costs/lot/${encodeURIComponent(LOT.id)}`);
        const totalBefore = before.body.data.totals.total_cop;

        const { rows } = await query(
            "SELECT id, accounting_entry_id FROM lot_costs WHERE lot_id = ? AND cost_type = 'roasting_service'",
            [LOT.id]
        );

        await request(app)
            .patch(`/api/costs/${rows[0].id}`)
            .send({ amount: 300_000 })
            .expect(200);

        const oldEntry = await query('SELECT state FROM accounting_entries WHERE id = ?',
            [rows[0].accounting_entry_id]);
        expect(oldEntry.rows[0].state).toBe('cancelado');

        const after = await request(app).get(`/api/costs/lot/${encodeURIComponent(LOT.id)}`);
        expect(after.body.data.totals.total_cop).toBe(totalBefore - 256_000 + 300_000);
    });
});

describe('Permisos', () => {
    it('el caficultor puede registrar la cosecha pero su costo se descarta', async () => {
        session.user = { id: 1, role: 'caficultor' };

        const res = await request(app)
            .post('/api/coffee/harvest')
            .send({
                farm: 'finca-nariño', variety: 'BOR', climate: 'LLUV', process: 'HON',
                aroma: 'Floral', tasteNotes: 'Panela',
                harvestWeightKg: 50,
                cost: { amount: 999_999, paymentMethod: 'caja' },
            })
            .expect(201);

        const { rows } = await query('SELECT * FROM lot_costs WHERE lot_id = ?', [res.body.lotId]);
        expect(rows).toHaveLength(0);

        // El peso tampoco se acepta de un no-admin: es dato de compra.
        const harvest = await query('SELECT harvest_weight_kg FROM coffee_harvests WHERE lot_id = ?',
            [res.body.lotId]);
        expect(harvest.rows[0].harvest_weight_kg).toBeNull();

        session.user = { id: 1, role: 'admin' };
    });

    it('el caficultor no puede consultar el costeo', async () => {
        session.user = { id: 1, role: 'caficultor' };
        await request(app).get('/api/costs').expect(403);
        session.user = { id: 1, role: 'admin' };
    });
});
