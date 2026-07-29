// Tests de server/services/costService.js y accountingService.js
// Ejecutar con: npm test
//
// Igual que storageService.test.js, se usa un SQLite real en archivo temporal
// en vez de mocks: lo que interesa probar es el cálculo del costo por kg contra
// los pesos reales del pipeline y el cuadre de los asientos, y eso solo se
// verifica de punta a punta contra el motor.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// El cliente libSQL se crea al importar db.js, así que la URL debe fijarse antes.
const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-costs-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

let query, costs, accounting;

const user = { id: 1 };
const LOT = 'COL-HUI-1800-CAT-LAV-COST';

beforeAll(async () => {
    ({ query } = await import('../../db.js'));

    await query('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT)');
    await query(`INSERT OR IGNORE INTO users (id, first_name, last_name) VALUES (1, 'Admin', 'DobleYo')`);

    // Plan de cuentas y diarios: la migración de costeo se apoya en ellos.
    const { createFinanceTables } = await import('../../migrations/create_finance_tables.js');
    await createFinanceTables();

    const { createCoffeeTables } = await import('../../migrations/create_coffee_tables.js');
    await createCoffeeTables();

    // Cuentas del plan base que usa el costeo (el seed vive en db/seed_data.sql,
    // que no se aplica en tests).
    const baseAccounts = [
        ['1110', 'Caja Principal', 'activo', 'efectivo'],
        ['1210', 'Bancolombia CC', 'activo', 'banco'],
        ['1410', 'Café Verde', 'activo', 'inventario'],
        ['1420', 'Café Tostado', 'activo', 'inventario'],
        ['1430', 'Empaques y Consumibles', 'activo', 'inventario'],
        ['2110', 'Cuentas por Pagar - Proveedores', 'pasivo', 'cuentas_por_pagar'],
        ['2120', 'Cuentas por Pagar - Caficultores', 'pasivo', 'cuentas_por_pagar'],
    ];
    for (const [code, name, type, subtype] of baseAccounts) {
        await query(
            `INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at)
             SELECT ?, ?, ?, ?, 1, datetime('now')
             WHERE NOT EXISTS (SELECT 1 FROM accounting_accounts WHERE code = ?)`,
            [code, name, type, subtype, code]
        );
    }

    const { createCostTracking } = await import('../../migrations/create_cost_tracking.js');
    await createCostTracking();

    costs = await import('../costService.js');
    accounting = await import('../accountingService.js');
});

beforeEach(async () => {
    await query('DELETE FROM lot_costs');
    await query('DELETE FROM accounting_entry_lines');
    await query('DELETE FROM accounting_entries');
    await query('DELETE FROM packaged_coffee');
    await query('DELETE FROM roasted_coffee_inventory');
    await query('DELETE FROM roasted_coffee');
    await query('DELETE FROM roasting_batches');
    await query('DELETE FROM green_coffee_inventory');
    await query('DELETE FROM coffee_harvests');
});

/** Arma un lote con pesos en cada etapa, sin pasar por coffeeService. */
async function seedLot({ harvestKg, greenKg, sentKg, roastedKg }) {
    const { rows } = await query(
        `INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, harvest_weight_kg)
         VALUES (?, 'finca-la-sierra', 'CAT', 'SECO', 'LAV', 'Chocolate', 'Cereza', ?) RETURNING id`,
        [LOT, harvestKg]
    );
    const harvestId = rows[0].id;

    if (greenKg) {
        await query(
            `INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date)
             VALUES (?, ?, ?, 'BOD-A', date('now'))`,
            [harvestId, LOT, greenKg]
        );
    }
    if (sentKg) {
        const batch = await query(
            `INSERT INTO roasting_batches (lot_id, quantity_sent_kg, status) VALUES (?, ?, 'completed') RETURNING id`,
            [LOT, sentKg]
        );
        if (roastedKg) {
            await query(
                `INSERT INTO roasted_coffee (roasting_id, roast_level, weight_kg, weight_loss_percent, status)
                 VALUES (?, 'MEDIUM', ?, ?, 'stored')`,
                [batch.rows[0].id, roastedKg, ((sentKg - roastedKg) / sentKg) * 100]
            );
        }
    }
    return harvestId;
}

describe('recordCost', () => {
    it('registra el costo y genera un asiento en borrador', async () => {
        await seedLot({ harvestKg: 100 });

        const result = await costs.recordCost({
            lotId: LOT, costType: 'farmer_payment', amount: 1_800_000,
            qtyKg: 100, paymentMethod: 'banco',
            sourceTable: 'coffee_harvests', sourceId: 1, user,
        });

        expect(result.accounted).toBe(true);

        const { rows } = await query('SELECT * FROM lot_costs WHERE id = ?', [result.costId]);
        expect(rows[0].amount_cop).toBe(1_800_000);
        expect(rows[0].stage).toBe('harvest');
        expect(rows[0].payment_method).toBe('banco');
        expect(rows[0].accounting_entry_id).toBe(result.entryId);
    });

    it('rechaza montos no positivos', async () => {
        await expect(
            costs.recordCost({ lotId: LOT, costType: 'farmer_payment', amount: 0, user })
        ).rejects.toThrow(/positivo/i);
    });

    it('rechaza un tipo de costo desconocido', async () => {
        await expect(
            costs.recordCost({ lotId: LOT, costType: 'sobornos', amount: 1000, user })
        ).rejects.toThrow(/no reconocido/i);
    });

    it('actualiza en vez de duplicar cuando el paso reintenta (cola offline)', async () => {
        await seedLot({ harvestKg: 100 });

        const first = await costs.recordCost({
            lotId: LOT, costType: 'transport_to_storage', amount: 100_000,
            sourceTable: 'green_coffee_inventory', sourceId: 7, user,
        });
        const second = await costs.recordCost({
            lotId: LOT, costType: 'transport_to_storage', amount: 150_000,
            sourceTable: 'green_coffee_inventory', sourceId: 7, user,
        });

        expect(second.costId).toBe(first.costId);

        const { rows } = await query('SELECT * FROM lot_costs WHERE lot_id = ?', [LOT]);
        expect(rows).toHaveLength(1);
        expect(rows[0].amount_cop).toBe(150_000);
    });
});

describe('asientos contables', () => {
    it('cuadra débitos y créditos', async () => {
        const { entryId } = await accounting.postCostEntry({
            lotId: LOT, costType: 'roasting_service', amount: 450_000,
            paymentMethod: 'caja', userId: 1,
        });

        const { rows } = await query(
            'SELECT SUM(debit) AS d, SUM(credit) AS c FROM accounting_entry_lines WHERE entry_id = ?',
            [entryId]
        );
        expect(rows[0].d).toBe(450_000);
        expect(rows[0].c).toBe(450_000);

        const entry = await query('SELECT state FROM accounting_entries WHERE id = ?', [entryId]);
        expect(entry.rows[0].state).toBe('borrador');
    });

    it('acredita cuentas por pagar de caficultores cuando el pago es a crédito', async () => {
        const { creditCode } = await accounting.postCostEntry({
            lotId: LOT, costType: 'farmer_payment', amount: 500_000,
            paymentMethod: 'credito', userId: 1,
        });
        expect(creditCode).toBe('2120');
    });

    it('acredita cuentas por pagar de proveedores en costos de terceros', async () => {
        const { creditCode } = await accounting.postCostEntry({
            lotId: LOT, costType: 'roasting_service', amount: 500_000,
            paymentMethod: 'credito', userId: 1,
        });
        expect(creditCode).toBe('2110');
    });

    it('acredita el inventario de empaques cuando el costo viene de un insumo', async () => {
        const { creditCode } = await accounting.postCostEntry({
            lotId: LOT, costType: 'packaging_material', amount: 60_000,
            paymentMethod: 'caja', fromSupply: true, userId: 1,
        });
        expect(creditCode).toBe('1430');
    });

    it('cancela el asiento en borrador al reversarlo', async () => {
        const { entryId } = await accounting.postCostEntry({
            lotId: LOT, costType: 'roasting_service', amount: 100_000, userId: 1,
        });

        const result = await accounting.reverseCostEntry(entryId, { userId: 1 });
        expect(result.reversed).toBe(true);
        expect(result.reversalEntryId).toBeNull();

        const { rows } = await query('SELECT state FROM accounting_entries WHERE id = ?', [entryId]);
        expect(rows[0].state).toBe('cancelado');
    });

    it('crea el asiento espejo si el original ya estaba publicado', async () => {
        const { entryId } = await accounting.postCostEntry({
            lotId: LOT, costType: 'roasting_service', amount: 100_000, userId: 1,
        });
        await query("UPDATE accounting_entries SET state = 'publicado' WHERE id = ?", [entryId]);

        const result = await accounting.reverseCostEntry(entryId, { userId: 1 });
        expect(result.reversalEntryId).not.toBeNull();

        // El espejo invierte débito y crédito de cada línea.
        const original = await query(
            'SELECT account_id, debit, credit FROM accounting_entry_lines WHERE entry_id = ? ORDER BY account_id',
            [entryId]
        );
        const mirror = await query(
            'SELECT account_id, debit, credit FROM accounting_entry_lines WHERE entry_id = ? ORDER BY account_id',
            [result.reversalEntryId]
        );
        for (let i = 0; i < original.rows.length; i++) {
            expect(mirror.rows[i].debit).toBe(original.rows[i].credit);
            expect(mirror.rows[i].credit).toBe(original.rows[i].debit);
        }
    });
});

describe('updateCost', () => {
    it('reversa el asiento anterior y emite uno nuevo', async () => {
        await seedLot({ harvestKg: 100 });
        const created = await costs.recordCost({
            lotId: LOT, costType: 'farmer_payment', amount: 1_000_000, user,
        });

        const updated = await costs.updateCost(created.costId, { amount: 1_200_000 }, user);

        expect(updated.entryId).not.toBe(created.entryId);
        const old = await query('SELECT state FROM accounting_entries WHERE id = ?', [created.entryId]);
        expect(old.rows[0].state).toBe('cancelado');

        const { rows } = await query('SELECT amount_cop FROM lot_costs WHERE id = ?', [created.costId]);
        expect(rows[0].amount_cop).toBe(1_200_000);
    });
});

describe('getLotCostSummary — costo por kg', () => {
    it('divide el pago de origen entre los kilos que llegaron a bodega, no los cosechados', async () => {
        // 100 kg recibidos, 80 kg llegan a bodega: la merma de secado la absorbe
        // el café utilizable, así que el costo por kg sube.
        await seedLot({ harvestKg: 100, greenKg: 80 });
        await costs.recordCost({ lotId: LOT, costType: 'farmer_payment', amount: 800_000, user });

        const summary = await costs.getLotCostSummary(LOT);

        expect(summary.cost_per_kg.green).toBe(10_000); // 800.000 / 80, no / 100
        expect(summary.shrinkage.drying_pct).toBe(20);
    });

    it('reparte el costo acumulado entre los kilos que salieron del tostador', async () => {
        // 80 kg verdes → se envían 80 → salen 64 (20% de merma de tostión).
        await seedLot({ harvestKg: 100, greenKg: 80, sentKg: 80, roastedKg: 64 });

        await costs.recordCost({ lotId: LOT, costType: 'farmer_payment', amount: 800_000, user });
        await costs.recordCost({ lotId: LOT, costType: 'transport_to_storage', amount: 100_000, user });
        await costs.recordCost({ lotId: LOT, costType: 'roasting_service', amount: 256_000, user });

        const summary = await costs.getLotCostSummary(LOT);

        expect(summary.totals.total_cop).toBe(1_156_000);
        // El costo del café evaporado lo absorbe el café bueno.
        expect(summary.cost_per_kg.roasted).toBe(Math.round(1_156_000 / 64));
        expect(summary.shrinkage.roasting_pct).toBe(20);
    });

    it('marca las etapas alcanzadas que no tienen costo', async () => {
        await seedLot({ harvestKg: 100, greenKg: 80 });
        await costs.recordCost({ lotId: LOT, costType: 'farmer_payment', amount: 800_000, user });

        const summary = await costs.getLotCostSummary(LOT);

        expect(summary.complete).toBe(false);
        expect(summary.missing_stages).toContain('green_storage');
        // La tostión aún no ocurrió: no se reclama costo de una etapa no alcanzada.
        expect(summary.missing_stages).not.toContain('roast_retrieval');
    });

    it('no divide por cero cuando el lote aún no tiene pesos', async () => {
        await seedLot({ harvestKg: null });
        const summary = await costs.getLotCostSummary(LOT);

        expect(summary.cost_per_kg.green).toBeNull();
        expect(summary.cost_per_kg.roasted).toBeNull();
        expect(summary.unit_cost_cop).toBeNull();
    });
});

describe('consumeSupply', () => {
    it('descuenta stock y devuelve el costo total del insumo', async () => {
        const { rows } = await query(
            "SELECT id, unit_cost_cop FROM packaging_supplies WHERE sku = 'BOL-250'"
        );
        const supply = rows[0];
        await query('UPDATE packaging_supplies SET stock_units = 500 WHERE id = ?', [supply.id]);

        const result = await costs.consumeSupply({
            supplyId: supply.id, units: 60, lotId: LOT,
            sourceTable: 'packaged_coffee', sourceId: 1, user,
        });

        expect(result.totalCost).toBe(Math.round(supply.unit_cost_cop * 60));
        expect(result.stockAfter).toBe(440);
        expect(result.stockShort).toBe(false);

        const mov = await query(
            'SELECT * FROM packaging_supply_movements WHERE supply_id = ? ORDER BY id DESC LIMIT 1',
            [supply.id]
        );
        expect(mov.rows[0].movement_type).toBe('salida');
        expect(mov.rows[0].quantity_after).toBe(440);
    });

    it('permite stock negativo pero lo señala: el empaque físico ya ocurrió', async () => {
        const { rows } = await query("SELECT id FROM packaging_supplies WHERE sku = 'ETI-STD'");
        await query('UPDATE packaging_supplies SET stock_units = 10 WHERE id = ?', [rows[0].id]);

        const result = await costs.consumeSupply({ supplyId: rows[0].id, units: 25, lotId: LOT, user });

        expect(result.stockAfter).toBe(-15);
        expect(result.stockShort).toBe(true);
    });

    it('rechaza cantidades inválidas', async () => {
        const { rows } = await query("SELECT id FROM packaging_supplies WHERE sku = 'ETI-STD'");
        await expect(
            costs.consumeSupply({ supplyId: rows[0].id, units: 0, user })
        ).rejects.toThrow(/inválida/i);
    });
});
