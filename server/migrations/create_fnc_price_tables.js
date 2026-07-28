import { query } from '../db.js';

/**
 * Módulo de comparación contra el precio de referencia de la FNC.
 *
 * Solo agrega el histórico del boletín y el factor de rendimiento del lote.
 * Lo pagado al caficultor NO se duplica aquí: ya vive en `lot_costs` con
 * cost_type = 'farmer_payment', y los kilos en `green_coffee_inventory` /
 * `coffee_harvests.harvest_weight_kg`.
 */
export async function createFncPriceTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS fnc_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_date DATE NOT NULL UNIQUE,        -- fecha del boletín de la FNC
      carga_cop INTEGER NOT NULL,             -- precio total por carga de 125 kg de pergamino, al factor base
      pasilla_cop_kg INTEGER,                 -- precio de la pasilla contenida en el pergamino
      ny_close_uscent_lb REAL,                -- cierre contrato C de Nueva York
      base_yield_factor INTEGER DEFAULT 94,   -- factor de rendimiento al que se publica el precio base
      excelso_cop_kg REAL,                    -- derivado: COP por kg de café verde excelso al factor base
      yield_table TEXT,                       -- JSON: precios por factor de rendimiento 88..100
      branches TEXT,                          -- JSON: precios por sucursal de Almacafé
      source_url TEXT,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_fnc_price_date ON fnc_price_history(price_date DESC)');
  console.log('✅ fnc_price_history');

  // Opcional: si el proveedor entrega análisis de trilla, afina la comparación
  // aplicando la tabla de primas y descuentos del boletín. Si queda NULL se usa
  // el factor base del boletín (94).
  try {
    await query('ALTER TABLE coffee_harvests ADD COLUMN yield_factor INTEGER');
    console.log('✅ Added yield_factor to coffee_harvests');
  } catch (err) {
    if (err.message.includes('duplicate column')) {
      console.log('⊗ yield_factor ya existe');
    } else {
      throw err;
    }
  }

  console.log('✅ Migración de precio FNC completada');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  import('dotenv/config').then(() =>
    createFncPriceTables()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      })
  );
}
