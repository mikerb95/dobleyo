// Migración: Suscripción de café recurrente (Wompi con fuente de pago).
// - subscriptions: una suscripción activa por cliente/plan, con su payment_source.
// - subscription_charges: bitácora de cada cobro recurrente y el pedido generado.
// Turso/libSQL (SQLite): INTEGER claves, fechas datetime('now'), sin tipos PG.
import { query } from '../db.js';

export async function createSubscriptionsTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      reference               TEXT UNIQUE NOT NULL,
      user_id                 INTEGER REFERENCES users(id) ON DELETE SET NULL,

      product_id              TEXT NOT NULL,
      product_name            TEXT NOT NULL,
      variant_size            TEXT,
      variant_grind           TEXT,
      quantity                INTEGER NOT NULL DEFAULT 1,
      frequency_days          INTEGER NOT NULL,          -- 15 o 30

      unit_price_cop          INTEGER NOT NULL,
      discount_percent        INTEGER NOT NULL DEFAULT 0,
      amount_cop              INTEGER NOT NULL,           -- a cobrar por periodo

      customer_name           TEXT NOT NULL,
      customer_email          TEXT NOT NULL,
      customer_phone          TEXT,
      shipping_address        TEXT NOT NULL,
      shipping_city           TEXT NOT NULL,
      shipping_department     TEXT,
      shipping_zip            TEXT,

      wompi_payment_source_id INTEGER,
      status                  TEXT NOT NULL DEFAULT 'pending_auth',
                              -- pending_auth | active | paused | payment_failed | cancelled
      next_billing_date       DATE,
      last_charged_at         TIMESTAMP,
      charge_count            INTEGER NOT NULL DEFAULT 0,
      failed_attempts         INTEGER NOT NULL DEFAULT 0,

      created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at              TIMESTAMP,
      cancelled_at            TIMESTAMP
    )
  `, []);

  await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(customer_email)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`, []);

  await query(`
    CREATE TABLE IF NOT EXISTS subscription_charges (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id       INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      reference             TEXT UNIQUE NOT NULL,
      wompi_transaction_id  TEXT,
      amount_cop            INTEGER NOT NULL,
      status                TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | DECLINED | ERROR | VOIDED
      order_id              INTEGER REFERENCES customer_orders(id) ON DELETE SET NULL,
      created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            TIMESTAMP
    )
  `, []);

  await query(`CREATE INDEX IF NOT EXISTS idx_sub_charges_subscription ON subscription_charges(subscription_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_sub_charges_tx ON subscription_charges(wompi_transaction_id)`, []);

  console.log('[Subscriptions Migration] Tablas subscriptions y subscription_charges creadas.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    createSubscriptionsTables().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
