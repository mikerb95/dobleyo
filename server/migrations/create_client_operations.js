// Migración: Tabla client_operations — idempotencia de mutaciones móviles
// La app móvil reintenta POSTs encolados offline con un client_op_id único;
// esta tabla garantiza que un reintento no duplique el registro.
import { query } from '../db.js';

export async function createClientOperationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS client_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_op_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
      status_code INTEGER,
      response_json TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      -- Sin FK a users: debe aceptar al usuario dev sintético (id 0) y la
      -- limpieza por retención (30 días) hace innecesario el ON DELETE.
    )
  `, []);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_operations_created ON client_operations(created_at)`, []);

  console.log('[ClientOperations Migration] Tabla client_operations creada correctamente.');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createClientOperationsTable()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
