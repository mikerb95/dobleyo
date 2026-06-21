import { query } from '../db.js';

/**
 * Tablas de cuenta de usuario (rol client):
 *  - user_addresses     → libreta de direcciones de envío (múltiples + predeterminada)
 *  - user_favorites     → lista de deseos / favoritos (referencia a products)
 *  - user_preferences   → preferencias de comunicación e idioma/moneda
 *
 * Idempotente vía CREATE TABLE IF NOT EXISTS — seguro de re-ejecutar.
 */
export async function createAccountTables() {
  console.log('👤 Iniciando migración de tablas de cuenta de usuario...');

  await query(`
    CREATE TABLE IF NOT EXISTS user_addresses (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label           TEXT,
      recipient_name  TEXT NOT NULL,
      phone           TEXT,
      address         TEXT NOT NULL,
      city            TEXT NOT NULL,
      state_province  TEXT,
      country         TEXT NOT NULL DEFAULT 'Colombia',
      zip             TEXT,
      is_default      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✓ Tabla user_addresses creada');

  await query(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, product_id)
    )
  `);
  console.log('  ✓ Tabla user_favorites creada');

  await query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      newsletter     INTEGER NOT NULL DEFAULT 1,
      order_updates  INTEGER NOT NULL DEFAULT 1,
      promotions     INTEGER NOT NULL DEFAULT 1,
      language       TEXT NOT NULL DEFAULT 'es',
      currency       TEXT NOT NULL DEFAULT 'COP',
      updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✓ Tabla user_preferences creada');

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id)`,
  ];
  for (const sql of indexes) await query(sql);
  console.log('  ✓ Índices creados');

  // Triggers updated_at (sintaxis SQLite)
  await query(`
    CREATE TRIGGER IF NOT EXISTS user_addresses_updated_at
      AFTER UPDATE ON user_addresses
      FOR EACH ROW
      BEGIN
        UPDATE user_addresses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
  `);

  console.log('✅ Migración de tablas de cuenta completada');
  return { success: true };
}

// Permitir ejecución directa: node server/migrations/create_account_tables.js
if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    createAccountTables()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch((err) => { console.error(err); process.exit(1); })
  );
}
