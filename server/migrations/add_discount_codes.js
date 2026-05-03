import { query } from '../db.js';

export async function addDiscountCodes() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        code              TEXT UNIQUE NOT NULL COLLATE NOCASE,
        discount_type     TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
        discount_value    DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
        first_purchase_only INTEGER DEFAULT 0,
        max_uses          INTEGER DEFAULT NULL,
        uses_count        INTEGER DEFAULT 0,
        expires_at        TEXT DEFAULT NULL,
        active            INTEGER DEFAULT 1,
        created_at        TEXT DEFAULT (datetime('now'))
      )
    `, []);

    await query(`
      INSERT OR IGNORE INTO discount_codes (code, discount_type, discount_value, first_purchase_only, active)
      VALUES ('PRIMERA10', 'percent', 10, 1, 1)
    `, []);

    // Columnas en customer_orders (SQLite ignora el error si ya existen)
    try {
      await query(`ALTER TABLE customer_orders ADD COLUMN discount_code TEXT DEFAULT NULL`, []);
    } catch {}
    try {
      await query(`ALTER TABLE customer_orders ADD COLUMN discount_amount_cop INTEGER DEFAULT 0`, []);
    } catch {}

    console.log('✅ discount_codes migration completed');
  } catch (err) {
    console.error('❌ discount_codes migration failed:', err.message);
    throw err;
  }
}
