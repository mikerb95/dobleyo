#!/usr/bin/env node
/**
 * Maestro de ubicaciones de bodega + libro de movimientos (ledger) + quants.
 *
 * Modelo (equivalente a Warehouse → Storage Type → Bin de un WMS):
 *   warehouses → storage_zones → storage_locations
 *
 * Regla central: el stock NO se edita. Se deriva de `storage_movements`, que es
 * append-only. `storage_quants` es una proyección reconstruible en cualquier
 * momento con rebuildQuants(). Si ambos divergen, el ledger es la verdad.
 *
 * La migración es idempotente: cada movimiento de backfill lleva un
 * `movement_uid` determinista y se inserta con INSERT OR IGNORE.
 *
 * Ejecutar: node server/migrations/create_storage_locations.js
 */
import { query } from '../db.js';
import { rebuildQuants } from '../services/storageService.js';

// ── Datos semilla ────────────────────────────────────────────────────────────
// Los códigos quedan unificados y globalmente únicos para que puedan imprimirse
// en un QR sin ambigüedad. `legacy` mapea el string libre que se venía usando.

const WAREHOUSE = {
  code: 'BOD-PRINCIPAL',
  name: 'Bodega Principal',
  city: 'Bogotá',
};

const ZONES = [
  { code: 'Z-VERDE',   name: 'Sección A · Café verde',       zone_type: 'green',      temp_controlled: 0 },
  { code: 'Z-VERDE-B', name: 'Sección B · Café verde',       zone_type: 'green',      temp_controlled: 0 },
  { code: 'Z-VERDE-C', name: 'Sección C · Temperatura controlada', zone_type: 'green', temp_controlled: 1, temp_min_c: 15, temp_max_c: 20, humidity_max_pct: 60 },
  { code: 'Z-TOSTADO-A', name: 'Sección A · Café tostado',   zone_type: 'roasted',    temp_controlled: 0 },
  { code: 'Z-TOSTADO-B', name: 'Sección B · Café tostado',   zone_type: 'roasted',    temp_controlled: 0 },
  { code: 'Z-CLIMA',   name: 'Climatizado · Premium',        zone_type: 'roasted',    temp_controlled: 1, temp_min_c: 16, temp_max_c: 21, humidity_max_pct: 55 },
  { code: 'Z-EMPAQUE', name: 'Zona de empaque',              zone_type: 'packaged',   temp_controlled: 0 },
  { code: 'Z-CUARENT', name: 'Cuarentena',                   zone_type: 'quarantine', temp_controlled: 0 },
];

const LOCATIONS = [
  // Café verde — antes 'A-01'…'C-02' en inventory-storage.astro
  { code: 'GREEN-A-01',   zone: 'Z-VERDE',     name: 'Estante 01', allowed_states: 'green',   capacity_kg: 1500, sort_order: 10, legacy: ['A-01'] },
  { code: 'GREEN-A-02',   zone: 'Z-VERDE',     name: 'Estante 02', allowed_states: 'green',   capacity_kg: 1500, sort_order: 20, legacy: ['A-02'] },
  { code: 'GREEN-B-01',   zone: 'Z-VERDE-B',   name: 'Estante 01', allowed_states: 'green',   capacity_kg: 1500, sort_order: 30, legacy: ['B-01'] },
  { code: 'GREEN-B-02',   zone: 'Z-VERDE-B',   name: 'Estante 02', allowed_states: 'green',   capacity_kg: 1500, sort_order: 40, legacy: ['B-02'] },
  { code: 'GREEN-C-01',   zone: 'Z-VERDE-C',   name: 'Estante 01 · Temperatura controlada', allowed_states: 'green', capacity_kg: 800, sort_order: 50, legacy: ['C-01'] },
  { code: 'GREEN-C-02',   zone: 'Z-VERDE-C',   name: 'Estante 02 · Temperatura controlada', allowed_states: 'green', capacity_kg: 800, sort_order: 60, legacy: ['C-02'] },
  // Café tostado — antes en el array LOCATIONS de roasted-storage.astro
  { code: 'ROASTED-A-01', zone: 'Z-TOSTADO-A', name: 'Estante 01', allowed_states: 'roasted', capacity_kg: 600, sort_order: 110, legacy: [] },
  { code: 'ROASTED-A-02', zone: 'Z-TOSTADO-A', name: 'Estante 02', allowed_states: 'roasted', capacity_kg: 600, sort_order: 120, legacy: [] },
  { code: 'ROASTED-B-01', zone: 'Z-TOSTADO-B', name: 'Estante 01', allowed_states: 'roasted', capacity_kg: 600, sort_order: 130, legacy: [] },
  { code: 'ROASTED-B-02', zone: 'Z-TOSTADO-B', name: 'Estante 02', allowed_states: 'roasted', capacity_kg: 600, sort_order: 140, legacy: [] },
  { code: 'CLIMATE-01',   zone: 'Z-CLIMA',     name: 'Bodega 01 · Premium', allowed_states: 'roasted', capacity_kg: 400, sort_order: 150, legacy: [] },
  { code: 'CLIMATE-02',   zone: 'Z-CLIMA',     name: 'Bodega 02 · Premium', allowed_states: 'roasted', capacity_kg: 400, sort_order: 160, legacy: [] },
  // Empaque
  { code: 'PACK-01',      zone: 'Z-EMPAQUE',   name: 'Producto terminado 01', allowed_states: 'packaged', capacity_kg: null, sort_order: 210, legacy: [] },
];

// ── DDL ──────────────────────────────────────────────────────────────────────

async function createTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      farm_id     INTEGER NULL,
      address     TEXT,
      city        TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS storage_zones (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id     INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
      code             TEXT NOT NULL,
      name             TEXT NOT NULL,
      zone_type        TEXT NOT NULL CHECK (zone_type IN ('green','roasted','packaged','quarantine','transit','scrap')),
      temp_controlled  INTEGER NOT NULL DEFAULT 0,
      temp_min_c       REAL NULL,
      temp_max_c       REAL NULL,
      humidity_max_pct REAL NULL,
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TIMESTAMP NULL,
      UNIQUE (warehouse_id, code)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS storage_locations (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id        INTEGER NOT NULL REFERENCES storage_zones(id) ON DELETE RESTRICT,
      code           TEXT NOT NULL UNIQUE,
      name           TEXT NOT NULL,
      capacity_kg    REAL NULL,
      max_containers INTEGER NULL,
      allowed_states TEXT NOT NULL DEFAULT 'green,roasted,packaged',
      is_active      INTEGER NOT NULL DEFAULT 1,
      is_blocked     INTEGER NOT NULL DEFAULT 0,
      block_reason   TEXT NULL,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      qr_payload     TEXT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      created_by     INTEGER NULL,
      created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP NULL
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_storage_locations_zone ON storage_locations(zone_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_storage_locations_active ON storage_locations(is_active, is_blocked)');

  // Libro de movimientos: APPEND-ONLY. Nunca se hace UPDATE ni DELETE aquí.
  await query(`
    CREATE TABLE IF NOT EXISTS storage_movements (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_uid     TEXT NOT NULL UNIQUE,
      movement_type    TEXT NOT NULL CHECK (movement_type IN ('receipt','transfer','issue','adjustment','count_correction')),
      from_location_id INTEGER NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
      to_location_id   INTEGER NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
      lot_id           TEXT NOT NULL,
      stock_state      TEXT NOT NULL CHECK (stock_state IN ('green','roasted','packaged')),
      qty_kg           REAL NOT NULL CHECK (qty_kg > 0),
      container_type   TEXT NULL,
      container_count  INTEGER NULL,
      source_table     TEXT NULL,
      source_id        TEXT NULL,
      reason_code      TEXT NULL,
      notes            TEXT NULL,
      performed_by     INTEGER NULL,
      performed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (from_location_id IS NOT NULL OR to_location_id IS NOT NULL)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_storage_movements_lot ON storage_movements(lot_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_storage_movements_from ON storage_movements(from_location_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_storage_movements_to ON storage_movements(to_location_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_storage_movements_date ON storage_movements(performed_at)');

  // Proyección del ledger. El CHECK impide stock negativo a nivel de motor.
  await query(`
    CREATE TABLE IF NOT EXISTS storage_quants (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id      INTEGER NOT NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
      lot_id           TEXT NOT NULL,
      stock_state      TEXT NOT NULL CHECK (stock_state IN ('green','roasted','packaged')),
      qty_kg           REAL NOT NULL DEFAULT 0 CHECK (qty_kg >= 0),
      container_count  INTEGER NOT NULL DEFAULT 0,
      last_movement_id INTEGER NULL,
      updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (location_id, lot_id, stock_state)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_storage_quants_location ON storage_quants(location_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_storage_quants_lot ON storage_quants(lot_id)');

  // Conteo cíclico (inventario físico)
  await query(`
    CREATE TABLE IF NOT EXISTS inventory_counts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      count_number TEXT NOT NULL UNIQUE,
      status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','counting','posted','cancelled')),
      scope_note   TEXT NULL,
      created_by   INTEGER NULL,
      created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      posted_by    INTEGER NULL,
      posted_at    TIMESTAMP NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_count_lines (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id      INTEGER NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
      location_id   INTEGER NOT NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
      lot_id        TEXT NOT NULL,
      stock_state   TEXT NOT NULL,
      system_qty_kg REAL NOT NULL,
      counted_qty_kg REAL NULL,
      counted_at    TIMESTAMP NULL,
      counted_by    INTEGER NULL,
      UNIQUE (count_id, location_id, lot_id, stock_state)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_count_lines_count ON inventory_count_lines(count_id)');
}

// ── Columnas de enlace en las tablas del pipeline existente ──────────────────
// Se conserva la columna `location` (TEXT) como campo denormalizado de solo
// lectura durante una release, para no romper consultas ni la app móvil.

async function addLinkColumns() {
  const alters = [
    'ALTER TABLE green_coffee_inventory ADD COLUMN location_id INTEGER REFERENCES storage_locations(id)',
    'ALTER TABLE roasted_coffee_inventory ADD COLUMN location_id INTEGER REFERENCES storage_locations(id)',
  ];
  for (const sql of alters) {
    try {
      await query(sql);
    } catch (err) {
      // "duplicate column name" en la re-ejecución: es inofensivo.
      if (!/duplicate column/i.test(err.message)) throw err;
    }
  }
}

// ── Seed de maestros ─────────────────────────────────────────────────────────

async function seedMasterData() {
  await query(
    `INSERT INTO warehouses (code, name, city, is_active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (code) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`,
    [WAREHOUSE.code, WAREHOUSE.name, WAREHOUSE.city]
  );
  const wh = await query('SELECT id FROM warehouses WHERE code = ?', [WAREHOUSE.code]);
  const warehouseId = wh.rows[0].id;

  for (const z of ZONES) {
    await query(
      `INSERT INTO storage_zones (warehouse_id, code, name, zone_type, temp_controlled, temp_min_c, temp_max_c, humidity_max_pct, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT (warehouse_id, code) DO UPDATE SET
         name = excluded.name, zone_type = excluded.zone_type,
         temp_controlled = excluded.temp_controlled, updated_at = datetime('now')`,
      [warehouseId, z.code, z.name, z.zone_type, z.temp_controlled,
       z.temp_min_c ?? null, z.temp_max_c ?? null, z.humidity_max_pct ?? null]
    );
  }

  const zoneRows = await query('SELECT id, code FROM storage_zones WHERE warehouse_id = ?', [warehouseId]);
  const zoneIdByCode = Object.fromEntries(zoneRows.rows.map((r) => [r.code, r.id]));

  for (const l of LOCATIONS) {
    // Sin DO UPDATE del `code`: cambiar el código de una ubicación con historial
    // rompería la trazabilidad. Solo se refrescan atributos no identificantes.
    await query(
      `INSERT INTO storage_locations (zone_id, code, name, capacity_kg, allowed_states, sort_order, qr_payload, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT (code) DO UPDATE SET
         name = excluded.name, capacity_kg = excluded.capacity_kg,
         allowed_states = excluded.allowed_states, sort_order = excluded.sort_order,
         updated_at = datetime('now')`,
      [zoneIdByCode[l.zone], l.code, l.name, l.capacity_kg ?? null,
       l.allowed_states, l.sort_order, `LOC:${l.code}`]
    );
  }
}

/**
 * Resuelve el string libre histórico a un id de ubicación. Si no coincide con
 * ningún código ni alias legacy, crea una ubicación LEGACY-* inactiva en
 * cuarentena: ningún registro histórico se pierde ni se descarta en silencio.
 */
async function resolveLegacyLocation(rawLocation, quarantineZoneId, cache) {
  const raw = (rawLocation || '').trim();
  if (!raw) return null;
  if (cache.has(raw)) return cache.get(raw);

  const direct = await query('SELECT id FROM storage_locations WHERE code = ?', [raw]);
  if (direct.rows.length) {
    cache.set(raw, direct.rows[0].id);
    return direct.rows[0].id;
  }

  const mapped = LOCATIONS.find((l) => l.legacy.includes(raw));
  if (mapped) {
    const row = await query('SELECT id FROM storage_locations WHERE code = ?', [mapped.code]);
    if (row.rows.length) {
      cache.set(raw, row.rows[0].id);
      return row.rows[0].id;
    }
  }

  const legacyCode = `LEGACY-${raw.toUpperCase().replace(/[^A-Z0-9-]/g, '-')}`.substring(0, 60);
  await query(
    `INSERT INTO storage_locations (zone_id, code, name, allowed_states, is_active, sort_order)
     VALUES (?, ?, ?, 'green,roasted,packaged', 0, 999)
     ON CONFLICT (code) DO NOTHING`,
    [quarantineZoneId, legacyCode, `Ubicación histórica sin maestro: ${raw}`]
  );
  const created = await query('SELECT id FROM storage_locations WHERE code = ?', [legacyCode]);
  cache.set(raw, created.rows[0].id);
  console.log(`   ⚠ Ubicación histórica sin maestro: "${raw}" → ${legacyCode} (cuarentena, inactiva)`);
  return created.rows[0].id;
}

// Inserta un movimiento de backfill. INSERT OR IGNORE + uid determinista hace
// que re-ejecutar la migración no duplique historial.
async function postBackfillMovement(m) {
  await query(
    `INSERT OR IGNORE INTO storage_movements
       (movement_uid, movement_type, from_location_id, to_location_id, lot_id, stock_state,
        qty_kg, container_type, container_count, source_table, source_id, reason_code, performed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'backfill', ?)`,
    [m.uid, m.type, m.from ?? null, m.to ?? null, m.lotId, m.state,
     m.qty, m.containerType ?? null, m.containerCount ?? null,
     m.sourceTable ?? null, m.sourceId != null ? String(m.sourceId) : null,
     m.at || new Date().toISOString()]
  );
}

// ── Backfill del ledger desde el pipeline existente ──────────────────────────

async function backfillLedger() {
  const zq = await query(`SELECT id FROM storage_zones WHERE code = 'Z-CUARENT'`);
  const quarantineZoneId = zq.rows[0].id;
  const cache = new Map();

  // 1. Entradas de café verde
  const green = await query(
    `SELECT id, lot_id, weight_kg, location, created_at
     FROM green_coffee_inventory ORDER BY id ASC`
  );
  for (const r of green.rows) {
    const locId = await resolveLegacyLocation(r.location, quarantineZoneId, cache);
    if (!locId || !(r.weight_kg > 0)) continue;
    await query('UPDATE green_coffee_inventory SET location_id = ? WHERE id = ?', [locId, r.id]);
    await postBackfillMovement({
      uid: `backfill:green-in:${r.id}`, type: 'receipt', to: locId,
      lotId: r.lot_id, state: 'green', qty: r.weight_kg,
      sourceTable: 'green_coffee_inventory', sourceId: r.id, at: r.created_at,
    });
  }

  // 2. Salidas de verde hacia tostión, consumiendo FIFO por lote.
  //    Sin esto los quants de verde quedarían inflados: el café enviado a
  //    tostar ya no está físicamente en el estante.
  const batches = await query(
    `SELECT id, lot_id, quantity_sent_kg, created_at FROM roasting_batches
     WHERE status != 'cancelled' ORDER BY id ASC`
  );
  const consumedByRow = new Map(); // green_coffee_inventory.id → kg ya consumidos
  for (const b of batches.rows) {
    let remaining = parseFloat(b.quantity_sent_kg) || 0;
    if (remaining <= 0) continue;

    const sources = green.rows.filter((g) => g.lot_id === b.lot_id);
    let seq = 0;
    for (const g of sources) {
      if (remaining <= 0.0001) break;
      const locId = cache.get((g.location || '').trim());
      if (!locId) continue;
      const already = consumedByRow.get(g.id) || 0;
      const free = (parseFloat(g.weight_kg) || 0) - already;
      if (free <= 0.0001) continue;

      const take = Math.min(free, remaining);
      consumedByRow.set(g.id, already + take);
      remaining -= take;
      seq += 1;

      await postBackfillMovement({
        uid: `backfill:green-out:${b.id}:${seq}`, type: 'issue', from: locId,
        lotId: b.lot_id, state: 'green', qty: parseFloat(take.toFixed(3)),
        sourceTable: 'roasting_batches', sourceId: b.id, at: b.created_at,
      });
    }
    if (remaining > 0.0001) {
      console.log(`   ⚠ Lote ${b.lot_id}: ${remaining.toFixed(3)} kg enviados a tostión sin ubicación de origen registrada.`);
    }
  }

  // 3. Entradas de café tostado (y salida si ya fue empacado)
  const roasted = await query(
    `SELECT rci.id, rci.location, rci.container_type, rci.container_count, rci.status,
            rci.created_at, rc.weight_kg, rb.lot_id
     FROM roasted_coffee_inventory rci
     LEFT JOIN roasted_coffee  rc ON rci.roasted_id = rc.id
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
     ORDER BY rci.id ASC`
  );
  for (const r of roasted.rows) {
    const locId = await resolveLegacyLocation(r.location, quarantineZoneId, cache);
    const qty = parseFloat(r.weight_kg) || 0;
    if (!locId || qty <= 0) continue;
    const lotId = r.lot_id || 'SIN-LOTE';

    await query('UPDATE roasted_coffee_inventory SET location_id = ? WHERE id = ?', [locId, r.id]);
    await postBackfillMovement({
      uid: `backfill:roasted-in:${r.id}`, type: 'receipt', to: locId,
      lotId, state: 'roasted', qty,
      containerType: r.container_type, containerCount: r.container_count,
      sourceTable: 'roasted_coffee_inventory', sourceId: r.id, at: r.created_at,
    });

    if (r.status === 'packaged') {
      await postBackfillMovement({
        uid: `backfill:roasted-out:${r.id}`, type: 'issue', from: locId,
        lotId, state: 'roasted', qty,
        // Se reversan también los contenedores: si no, la ubicación quedaría
        // con 0 kg pero ocupada por bultos que ya no están.
        containerType: r.container_type, containerCount: r.container_count,
        sourceTable: 'packaged_coffee', sourceId: r.id, at: r.created_at,
      });
    }
  }
}

// ── Verificación: ledger vs quants vs tablas legacy ──────────────────────────

async function verify() {
  const [ledger, quants, legacyGreen, legacyRoasted] = await Promise.all([
    query(`SELECT
             COALESCE(SUM(CASE WHEN to_location_id   IS NOT NULL THEN qty_kg ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN from_location_id IS NOT NULL THEN qty_kg ELSE 0 END), 0) AS net
           FROM storage_movements`),
    query('SELECT COALESCE(SUM(qty_kg), 0) AS total FROM storage_quants'),
    query('SELECT COALESCE(SUM(weight_kg), 0) AS total FROM green_coffee_inventory'),
    query(`SELECT COALESCE(SUM(rc.weight_kg), 0) AS total
           FROM roasted_coffee_inventory rci
           LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id`),
  ]);

  const net    = round3(ledger.rows[0].net);
  const total  = round3(quants.rows[0].total);
  const legacy = round3(parseFloat(legacyGreen.rows[0].total) + parseFloat(legacyRoasted.rows[0].total));

  console.log('\n   Verificación de cuadre:');
  console.log(`     Neto del ledger : ${net} kg`);
  console.log(`     Suma de quants  : ${total} kg`);
  console.log(`     Tablas legacy   : ${legacy} kg (bruto, sin descontar consumos)`);

  if (Math.abs(net - total) > 0.01) {
    throw new Error(`Descuadre ledger↔quants: ${net} vs ${total}. Revise antes de continuar.`);
  }
  console.log('     ✅ Ledger y quants cuadran.');
}

const round3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;

// ── Entrada ──────────────────────────────────────────────────────────────────

export async function createStorageLocations() {
  console.log('📦 Maestro de ubicaciones + ledger de almacenamiento');
  await createTables();
  await addLinkColumns();
  await seedMasterData();
  console.log(`   Maestros: 1 bodega, ${ZONES.length} zonas, ${LOCATIONS.length} ubicaciones.`);
  await backfillLedger();
  const rebuilt = await rebuildQuants();
  console.log(`   Quants reconstruidos desde el ledger: ${rebuilt.quants} registros, ${rebuilt.movements} movimientos.`);
  await verify();
  console.log('✅ Almacenamiento listo.');
}

if (process.argv[1] && process.argv[1].endsWith('create_storage_locations.js')) {
  import('dotenv/config').then(() =>
    createStorageLocations()
      .then(() => process.exit(0))
      .catch((err) => { console.error('❌', err.message); process.exit(1); })
  );
}
