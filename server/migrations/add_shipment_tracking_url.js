// Migración: URL de rastreo por envío.
// Envia.com devuelve la URL de rastreo de la transportadora al generar la guía;
// se guarda para el correo de despacho, el panel y la página de confirmación.
import { query } from '../db.js';

export async function addShipmentTrackingUrl() {
  const col = await query(
    `SELECT name FROM pragma_table_info('shipments') WHERE name = ?`,
    ['tracking_url']
  );
  if (col.rows.length) {
    console.log('[Migration] shipments.tracking_url ya existe.');
    return;
  }
  await query(`ALTER TABLE shipments ADD COLUMN tracking_url TEXT`);
  console.log('[Migration] columna shipments.tracking_url añadida.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addShipmentTrackingUrl().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
