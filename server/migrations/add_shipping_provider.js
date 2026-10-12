// Migración: proveedor logístico por envío.
// - shipments.provider: 'mipaquete' (agregador), 'interrapidisimo' (API directa)
//   o 'manual' (guía registrada a mano). Los envíos existentes se marcan según
//   delivery_company_id para no cambiar su comportamiento.
import { query } from '../db.js';

export async function addShippingProvider() {
  const col = await query(
    `SELECT name FROM pragma_table_info('shipments') WHERE name = ?`,
    ['provider']
  );
  if (col.rows.length) {
    console.log('[Migration] shipments.provider ya existe.');
  } else {
    await query(`ALTER TABLE shipments ADD COLUMN provider TEXT NOT NULL DEFAULT 'mipaquete'`);
    console.log('[Migration] columna shipments.provider añadida.');
  }
  // Idempotente: también cubre bases nuevas, donde schema.sql ya trae la columna.
  await query(`UPDATE shipments SET provider = 'manual' WHERE delivery_company_id = 'manual' AND provider <> 'manual'`);
  // El índice vive aquí y no en schema.sql: schema.sql corre antes que este ALTER.
  await query(`CREATE INDEX IF NOT EXISTS idx_shipments_provider ON shipments(provider)`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addShippingProvider().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
