// Migración: columna currency en customer_orders (soporte USD para el portal en inglés).
// Los montos se siguen guardando en las columnas *_cop (el nombre es histórico);
// currency indica en qué moneda está expresado el pedido.
import { query } from '../db.js';

export async function addCurrencyToOrders() {
  const col = await query(
    "SELECT name FROM pragma_table_info('customer_orders') WHERE name = 'currency'"
  );
  if (!col.rows.length) {
    await query("ALTER TABLE customer_orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'COP'");
    console.log('[Migration] columna customer_orders.currency añadida.');
  } else {
    console.log('[Migration] customer_orders.currency ya existe.');
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addCurrencyToOrders().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
