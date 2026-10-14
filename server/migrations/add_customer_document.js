// Migración: documento del comprador en customer_orders.
// Interrapidísimo exige tipo y número de documento del destinatario para crear
// la guía. Se pide en el checkout y se guarda con el pedido para no tener que
// pedírselo al cliente otra vez al despachar.
import { query } from '../db.js';

async function addColumnIfMissing(table, column, ddl) {
  const col = await query(
    `SELECT name FROM pragma_table_info('${table}') WHERE name = ?`,
    [column]
  );
  if (!col.rows.length) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.log(`[Migration] columna ${table}.${column} añadida.`);
  } else {
    console.log(`[Migration] ${table}.${column} ya existe.`);
  }
}

export async function addCustomerDocument() {
  await addColumnIfMissing('customer_orders', 'customer_document_type', 'customer_document_type TEXT');
  await addColumnIfMissing('customer_orders', 'customer_document_number', 'customer_document_number TEXT');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addCustomerDocument().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
