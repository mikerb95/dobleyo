import { query } from '../db.js';

/**
 * Columnas faltantes en sales_tracking para la integración MercadoLibre.
 *
 * La UI de /admin/mercadolibre ya mostraba columnas "Comprador", "Estado pago"
 * y "Estado envío", pero `transformOrderData` nunca capturaba esos datos, así
 * que salían vacías y el filtro por estado quedaba inservible. Esta migración
 * agrega las columnas; el servicio las puebla en cada sync.
 *
 * Idempotente: verifica la existencia de cada columna antes del ALTER.
 */
export async function addMlSalesFields() {
  const cols = [
    ['buyer_nickname',  'TEXT'],
    ['buyer_id',        'INTEGER'],
    ['payment_status',  'TEXT'],
    ['shipping_status', 'TEXT'],
  ];

  const existing = await query(`SELECT name FROM pragma_table_info('sales_tracking')`);
  const have = new Set(existing.rows.map((r) => r.name));

  for (const [name, type] of cols) {
    if (!have.has(name)) {
      await query(`ALTER TABLE sales_tracking ADD COLUMN ${name} ${type}`);
      console.log(`[Migration] columna sales_tracking.${name} añadida.`);
    }
  }

  await query(`CREATE INDEX IF NOT EXISTS idx_sales_tracking_payment_status ON sales_tracking(payment_status)`);
  console.log('[Migration] sales_tracking: campos ML listos.');
}
