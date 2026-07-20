// Migración: columnas de robustez para el flujo de pago/logística.
// - customer_orders.expected_amount_cents: monto exacto firmado a Wompi (en centavos,
//   en la moneda real de la orden) para validar el webhook sin asumir COP.
// - customer_orders.confirmation_email_sent_at: outbox simplificado del email de
//   confirmación de pago (permite reintento sin reenviar duplicados).
// - shipments.recovery_attempts: contador de intentos de reconciliación de
//   envíos huérfanos (mp_code NULL) antes de marcarlos 'error'.
// - customer_orders.stock_deducted_at: marca si ya se descontó inventario para
//   esta orden (idempotencia de descuento/reposición de stock_quantity).
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

export async function addLogisticsHardening() {
  await addColumnIfMissing('customer_orders', 'expected_amount_cents', 'expected_amount_cents INTEGER');
  await addColumnIfMissing('customer_orders', 'confirmation_email_sent_at', 'confirmation_email_sent_at TEXT');
  await addColumnIfMissing('shipments', 'recovery_attempts', 'recovery_attempts INTEGER NOT NULL DEFAULT 0');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addLogisticsHardening().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
