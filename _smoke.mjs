process.env.TURSO_DATABASE_URL = 'file:/tmp/claude-1000/-home-mike-dev-work-github-com-dobleyo/9649703e-1692-4356-82c4-67ae21259474/scratchpad/smoke.db';
delete process.env.TURSO_AUTH_TOKEN;
const { query } = await import('./server/db.js');

// Tablas mínimas del pipeline que el módulo consulta.
await query(`CREATE TABLE IF NOT EXISTS coffee_harvests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lot_id TEXT UNIQUE NOT NULL, farm TEXT, variety TEXT,
  region TEXT, harvest_weight_kg REAL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
await query(`CREATE TABLE IF NOT EXISTS green_coffee_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lot_id TEXT, weight_kg REAL)`);
await query(`CREATE TABLE IF NOT EXISTS lot_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lot_id TEXT, stage TEXT, cost_type TEXT,
  amount_cop REAL, qty_kg REAL, recorded_at TIMESTAMP)`);

const { createFncPriceTables } = await import('./server/migrations/create_fnc_price_tables.js');
await createFncPriceTables();
await createFncPriceTables(); // idempotencia

// Datos de prueba: 120 kg verdes, $2.700.000 pagados = $22.500/kg (por debajo de FNC).
await query(`INSERT OR IGNORE INTO coffee_harvests (lot_id, farm, variety, region, harvest_weight_kg)
  VALUES ('LOT-001','La Esperanza','Castillo','Huila', 135)`);
await query(`INSERT INTO green_coffee_inventory (lot_id, weight_kg) VALUES ('LOT-001', 120)`);
await query(`INSERT INTO lot_costs (lot_id, stage, cost_type, amount_cop, qty_kg, recorded_at)
  VALUES ('LOT-001','harvest','farmer_payment', 2700000, 135, '2026-07-27 10:00:00')`);
await query(`INSERT INTO lot_costs (lot_id, stage, cost_type, amount_cop, recorded_at)
  VALUES ('LOT-001','sent_to_roasting','transport_to_roaster', 150000, '2026-07-28 10:00:00')`);

// Guardar el boletín real parseado.
import fs from 'node:fs';
const { parseFncBulletin } = await import('./server/services/fncPrice.js');
const text = fs.readFileSync('./server/services/__tests__/fixtures/fnc_boletin_2026-07-27.txt','utf8');
const p = parseFncBulletin(text, 'https://fixture');
await query(`INSERT INTO fnc_price_history (price_date, carga_cop, pasilla_cop_kg, ny_close_uscent_lb,
  base_yield_factor, excelso_cop_kg, yield_table, branches, source_url)
  VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(price_date) DO NOTHING`,
  [p.priceDate,p.cargaCop,p.pasillaCopKg,p.nyCloseUscentLb,p.baseYieldFactor,p.excelsoCopKg,
   JSON.stringify(p.yieldTable),JSON.stringify(p.branches),p.sourceUrl]);

// Ejecutar el mismo SQL del endpoint /comparison.
const { rows } = await query(`SELECT * FROM (
   SELECT h.lot_id, h.farm, h.variety, h.region, h.yield_factor, h.harvest_weight_kg,
          (SELECT COALESCE(SUM(g.weight_kg),0) FROM green_coffee_inventory g WHERE g.lot_id=h.lot_id) AS green_kg,
          (SELECT COALESCE(SUM(c.amount_cop),0) FROM lot_costs c WHERE c.lot_id=h.lot_id AND c.cost_type='farmer_payment') AS farmer_payment_cop,
          (SELECT COALESCE(SUM(c.amount_cop),0) FROM lot_costs c WHERE c.lot_id=h.lot_id) AS total_cost_cop,
          (SELECT MIN(date(c.recorded_at)) FROM lot_costs c WHERE c.lot_id=h.lot_id AND c.cost_type='farmer_payment') AS purchase_date
     FROM coffee_harvests h)
   WHERE farmer_payment_cop > 0 ORDER BY purchase_date DESC, lot_id DESC`);
console.log('\n--- filas del comparativo ---');
console.log(rows);

const { excelsoRefForFactor } = await import('./server/services/fncPrice.js');
const ref = excelsoRefForFactor(p, 94);
const l = rows[0];
const kg = l.green_kg || l.harvest_weight_kg;
const paidKg = l.farmer_payment_cop / kg;
console.log('\npagado $/kg :', Math.round(paidKg));
console.log('FNC ref $/kg:', Math.round(ref));
console.log('diferencia  :', Math.round(paidKg - ref), `(${(((paidKg-ref)/ref)*100).toFixed(2)}%)`);
console.log('costo total lote $/kg:', Math.round(l.total_cost_cop / kg));
