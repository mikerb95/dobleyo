import { query } from '../db.js';

/**
 * Módulo de comparación de precio FNC.
 *
 * Crea el histórico de precios de referencia de la Federación Nacional de
 * Cafeteros y agrega a `coffee_harvests` los datos de la compra al caficultor,
 * sin los cuales no hay nada que comparar.
 */
export async function createFncPriceTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS fnc_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_date DATE NOT NULL UNIQUE,        -- fecha del boletín de la FNC
      carga_cop INTEGER NOT NULL,             -- precio total por carga de 125 kg de pergamino, FR base
      pasilla_cop_kg INTEGER,                 -- precio de la pasilla contenida en el pergamino
      ny_close_uscent_lb REAL,                -- cierre contrato C Nueva York
      base_yield_factor INTEGER DEFAULT 94,   -- factor de rendimiento al que se publica el precio base
      excelso_cop_kg REAL,                    -- derivado: COP por kg de café verde excelso al factor base
      yield_table TEXT,                       -- JSON: precios por factor de rendimiento 88..100
      branches TEXT,                          -- JSON: precios por sucursal de Almacafé
      source_url TEXT,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_fnc_price_date ON fnc_price_history(price_date DESC)');

  // Datos de la compra al caficultor. DobleYo recibe el café ya trillado, así
  // que el peso se registra en kg de café verde.
  const columns = [
    { name: 'purchase_weight_kg',  sql: 'ALTER TABLE coffee_harvests ADD COLUMN purchase_weight_kg REAL' },
    { name: 'purchase_total_cop',  sql: 'ALTER TABLE coffee_harvests ADD COLUMN purchase_total_cop INTEGER' },
    { name: 'purchase_date',       sql: 'ALTER TABLE coffee_harvests ADD COLUMN purchase_date DATE' },
    // Opcional: si el proveedor entrega análisis de trilla se afina la comparación.
    { name: 'yield_factor',        sql: 'ALTER TABLE coffee_harvests ADD COLUMN yield_factor INTEGER' },
  ];

  for (const col of columns) {
    try {
      await query(col.sql);
      console.log('✅ Added', col.name, 'to coffee_harvests');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⊗', col.name, 'ya existe');
      } else {
        throw err;
      }
    }
  }

  console.log('✅ FNC price tables migration completed');
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
