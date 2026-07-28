#!/usr/bin/env node
/**
 * Trazabilidad de costos de la línea de producción.
 *
 * Modelo: `lot_costs` es un libro append-friendly con un registro por evento de
 * costo (cosecha, transporte a bodega, transporte a tostión, maquila de tostión,
 * transporte de regreso, empaque). Cada registro apunta al paso del pipeline que
 * lo originó (source_table + source_id) y al asiento contable que generó.
 *
 * El costo NO se guarda como columna en las tablas de etapa: un lote puede
 * enviarse a tostión en varios envíos y empacarse en varios empaques, así que
 * cada evento lleva su propio costo y sus propios kg.
 *
 * `packaging_supplies` es el maestro de insumos de empaque (bolsas, etiquetas,
 * válvulas) con costo unitario y stock. Vive aparte de `products` porque
 * `products.category` tiene un CHECK que SQLite no permite alterar sin
 * reconstruir la tabla, y products está referenciada por variantes, movimientos
 * y líneas de factura.
 *
 * Ejecutar: node server/migrations/create_cost_tracking.js
 */
import { query } from '../db.js';

// Etapas del pipeline que pueden llevar costo, en orden.
const STAGES = ['harvest', 'green_storage', 'sent_to_roasting', 'roast_retrieval', 'roasted_storage', 'packaging'];

// Tipos de costo. Uno por etapa salvo empaque, que separa bolsa y etiqueta.
const COST_TYPES = [
  'farmer_payment',      // cosecha: lo pagado al caficultor
  'transport_to_storage', // ingreso a bodega: transporte de la carga
  'transport_to_roaster', // envío a tostión: transporte hacia la tostadora
  'roasting_service',     // retiro de tostión: maquila del proceso
  'transport_to_warehouse', // almacén tostado: transporte de regreso a bodega
  'packaging_material',   // empaque: bolsas
  'labeling_material',    // empaque: etiquetas
  'other',
];

// Forma de pago → determina la cuenta acreditada del asiento.
const PAYMENT_METHODS = ['caja', 'banco', 'credito'];

async function addColumn(table, name, definition) {
  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    console.log(`  ✅ ${table}.${name}`);
  } catch (err) {
    if (/duplicate column/i.test(err.message)) console.log(`  ⊗ ${table}.${name} ya existe`);
    else throw err;
  }
}

export async function createCostTracking() {
  // ── Maestro de insumos de empaque ──────────────────────────────────────────
  // Va primero: lot_costs lo referencia por FK.
  await query(`
    CREATE TABLE IF NOT EXISTS packaging_supplies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('bolsa', 'etiqueta', 'valvula', 'otro')),
      -- Tamaño de café al que corresponde la bolsa ('250g'...). NULL en etiquetas.
      size_label TEXT,
      unit_cost_cop REAL NOT NULL DEFAULT 0,
      stock_units INTEGER NOT NULL DEFAULT 0,
      stock_min INTEGER NOT NULL DEFAULT 0,
      supplier TEXT,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_pack_supplies_type ON packaging_supplies(type)');
  await query('CREATE INDEX IF NOT EXISTS idx_pack_supplies_active ON packaging_supplies(is_active)');
  console.log('✅ packaging_supplies');

  // Movimientos de insumos: el stock de bolsas y etiquetas también es trazable.
  await query(`
    CREATE TABLE IF NOT EXISTS packaging_supply_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supply_id INTEGER NOT NULL REFERENCES packaging_supplies(id),
      movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste')),
      quantity INTEGER NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      unit_cost_cop REAL,
      reason TEXT,
      lot_id TEXT,
      source_table TEXT,
      source_id INTEGER,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_supply_mov_supply ON packaging_supply_movements(supply_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_supply_mov_lot ON packaging_supply_movements(lot_id)');
  console.log('✅ packaging_supply_movements');

  // ── Libro de costos ────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS lot_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id TEXT NOT NULL,
      stage TEXT NOT NULL CHECK (stage IN (${STAGES.map(s => `'${s}'`).join(', ')})),
      cost_type TEXT NOT NULL CHECK (cost_type IN (${COST_TYPES.map(c => `'${c}'`).join(', ')})),
      amount_cop REAL NOT NULL,
      -- Kg a los que aplica este costo. Permite prorratear cuando un lote se
      -- procesa en varios envíos o empaques.
      qty_kg REAL,
      -- Unidades cuando el costo es por unidad (bolsas, etiquetas).
      qty_units INTEGER,
      payment_method TEXT NOT NULL DEFAULT 'caja' CHECK (payment_method IN (${PAYMENT_METHODS.map(p => `'${p}'`).join(', ')})),
      -- Paso del pipeline que originó el costo.
      source_table TEXT,
      source_id INTEGER,
      -- Insumo del maestro cuando el costo viene de packaging_supplies.
      supply_id INTEGER REFERENCES packaging_supplies(id),
      -- Asiento contable vigente. NULL = pendiente de contabilizar.
      accounting_entry_id INTEGER REFERENCES accounting_entries(id),
      -- Tercero (caficultor o proveedor) para el crédito a cuentas por pagar.
      partner_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      -- Fecha real del costo: sigue a recordedAt del paso, no a la digitación.
      recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_lot_costs_lot ON lot_costs(lot_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_lot_costs_stage ON lot_costs(stage)');
  await query('CREATE INDEX IF NOT EXISTS idx_lot_costs_source ON lot_costs(source_table, source_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_lot_costs_date ON lot_costs(recorded_at)');
  // Un paso del pipeline no puede tener dos veces el mismo tipo de costo: el
  // reintento de la cola offline actualiza en vez de duplicar.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lot_costs_unique_source
               ON lot_costs(source_table, source_id, cost_type)
               WHERE source_table IS NOT NULL`);
  console.log('✅ lot_costs');

  // ── Peso cosechado ─────────────────────────────────────────────────────────
  // La cosecha no guardaba peso: sin él no hay costo por kg en el origen.
  await addColumn('coffee_harvests', 'harvest_weight_kg', 'REAL');

  // ── Cuentas contables del proceso ──────────────────────────────────────────
  // El plan base ya trae 1410/1420/1430, 2110/2120, 1110/1210. Solo falta la
  // cuenta de costos de transformación que se capitalizan al inventario.
  const accounts = [
    ['1440', 'Café en Proceso', 'activo', 'inventario'],
    ['5110', 'Costo de Transporte de Café', 'costo', 'costo_venta'],
    ['5120', 'Costo de Maquila de Tostión', 'costo', 'costo_venta'],
    ['5130', 'Costo de Material de Empaque', 'costo', 'costo_venta'],
  ];
  for (const [code, name, type, subtype] of accounts) {
    await query(
      `INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at)
       SELECT ?, ?, ?, ?, 1, datetime('now')
       WHERE NOT EXISTS (SELECT 1 FROM accounting_accounts WHERE code = ?)`,
      [code, name, type, subtype, code]
    );
  }
  console.log('✅ Cuentas contables del proceso');

  // Diario de producción para los asientos de costeo.
  await query(
    `INSERT INTO accounting_journals (code, name, journal_type, is_active, created_at)
     SELECT 'PROD', 'Costos de Producción', 'general', 1, datetime('now')
     WHERE NOT EXISTS (SELECT 1 FROM accounting_journals WHERE code = 'PROD')`
  );
  console.log('✅ Diario PROD');

  // ── Insumos semilla ────────────────────────────────────────────────────────
  const supplies = [
    ['BOL-100', 'Bolsa kraft con válvula 100g', 'bolsa', '100g', 900],
    ['BOL-250', 'Bolsa kraft con válvula 250g', 'bolsa', '250g', 1200],
    ['BOL-500', 'Bolsa kraft con válvula 500g', 'bolsa', '500g', 1800],
    ['BOL-1000', 'Bolsa kraft con válvula 1kg', 'bolsa', '1kg', 2600],
    ['ETI-STD', 'Etiqueta adhesiva con QR', 'etiqueta', null, 350],
  ];
  for (const [sku, name, type, size, cost] of supplies) {
    await query(
      `INSERT INTO packaging_supplies (sku, name, type, size_label, unit_cost_cop, stock_units, is_active, created_at)
       SELECT ?, ?, ?, ?, ?, 0, 1, datetime('now')
       WHERE NOT EXISTS (SELECT 1 FROM packaging_supplies WHERE sku = ?)`,
      [sku, name, type, size, cost, sku]
    );
  }
  console.log('✅ Insumos semilla');

  console.log('✅ Migración de trazabilidad de costos completada');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  import('dotenv/config').then(() =>
    createCostTracking().then(() => process.exit(0)).catch(err => {
      console.error(err); process.exit(1);
    })
  );
}
