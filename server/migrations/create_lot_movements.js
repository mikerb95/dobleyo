import { query } from '../db.js';

/**
 * Tabla lot_movements: trazabilidad de ajustes de peso de lotes de café.
 *
 * inventory_movements no sirve para lotes: exige product_id NOT NULL y
 * quantity INTEGER, mientras que los lotes manejan peso decimal en kg y
 * pueden no tener producto asociado. Esta tabla registra entradas/salidas/
 * ajustes/mermas sobre lots.weight, con peso antes/después para auditoría.
 *
 * Idempotente: CREATE TABLE/INDEX IF NOT EXISTS.
 */
export async function createLotMovements() {
  await query(`
    CREATE TABLE IF NOT EXISTS lot_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste', 'merma')),
      quantity DECIMAL(10,2) NOT NULL,
      weight_before DECIMAL(10,2) NOT NULL,
      weight_after DECIMAL(10,2) NOT NULL,
      reason VARCHAR(255),
      reference VARCHAR(100),
      notes TEXT,
      user_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_lot_movements_lot ON lot_movements(lot_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_lot_movements_date ON lot_movements(created_at)');

  console.log('[Migration] lot_movements: tabla e índices listos.');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  createLotMovements()
    .then(() => process.exit(0))
    .catch((err) => { console.error('💥 Error:', err); process.exit(1); });
}
