// Migración: código DANE del destino en customer_orders.
// El checkout lo envía al elegir la ciudad (lista DIVIPOLA de
// server/utils/coLocations.js). Sirve para cotizar con Envia.com al crear el
// pedido y para que /admin/envios no tenga que adivinar el DANE por el nombre.
import { query } from '../db.js';

export async function addOrderShippingDane() {
  const col = await query(
    `SELECT name FROM pragma_table_info('customer_orders') WHERE name = ?`,
    ['shipping_dane_code']
  );
  if (col.rows.length) {
    console.log('[Migration] customer_orders.shipping_dane_code ya existe.');
    return;
  }
  await query(`ALTER TABLE customer_orders ADD COLUMN shipping_dane_code TEXT`);
  console.log('[Migration] columna customer_orders.shipping_dane_code añadida.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addOrderShippingDane().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
