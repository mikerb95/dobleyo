import { query } from '../db.js';

/**
 * Tablas del centralizador de stock con MercadoLibre.
 *
 * - `ml_oauth`: la conexión OAuth con la cuenta de vendedor (una sola fila).
 *   Los tokens se guardan cifrados (AES-256-GCM, ver services/mlAuth.js). El
 *   access token de ML vence a las 6 h y el refresh token es de un solo uso,
 *   así que cada renovación reescribe ambos.
 * - `ml_listings`: qué publicación (y variación) de ML corresponde a qué
 *   producto o variante del sitio. Guarda el último valor enviado, lo que ML
 *   reporta y el último error, para que el panel muestre el estado real.
 * - `ml_order_stock`: lo que se descontó del stock local por cada ítem de una
 *   orden de ML. Es la clave de idempotencia: un webhook repetido o un sync que
 *   reprocesa la misma orden no descuenta dos veces, y una cancelación repone
 *   exactamente lo que se había descontado.
 *
 * Idempotente: CREATE TABLE / INDEX IF NOT EXISTS.
 */
export async function createMlStockSync() {
  await query(`CREATE TABLE IF NOT EXISTS ml_oauth (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    ml_user_id        TEXT NOT NULL,
    nickname          TEXT,
    access_token_enc  TEXT NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    expires_at        TEXT NOT NULL,
    scope             TEXT,
    connected_by      INTEGER,
    connected_at      TEXT NOT NULL DEFAULT (datetime('now')),
    refreshed_at      TEXT,
    last_error        TEXT,
    last_error_at     TEXT
  )`);

  await query(`CREATE TABLE IF NOT EXISTS ml_listings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       VARCHAR(50) NOT NULL,
    variant_id       INTEGER,
    ml_item_id       TEXT NOT NULL,
    ml_variation_id  TEXT NOT NULL DEFAULT '',
    title            TEXT,
    permalink        TEXT,
    logistic_type    TEXT,
    stock_buffer     INTEGER NOT NULL DEFAULT 0 CHECK (stock_buffer >= 0),
    is_active        INTEGER NOT NULL DEFAULT 1,
    pending_push     INTEGER NOT NULL DEFAULT 1,
    last_pushed_qty  INTEGER,
    last_pushed_at   TEXT,
    ml_available_qty INTEGER,
    ml_status        TEXT,
    ml_checked_at    TEXT,
    last_error       TEXT,
    last_error_at    TEXT,
    linked_at        TEXT NOT NULL DEFAULT (datetime('now')),
    created_by       INTEGER,
    updated_at       TEXT,
    UNIQUE (ml_item_id, ml_variation_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ml_listings_product ON ml_listings(product_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ml_listings_pending ON ml_listings(pending_push) WHERE is_active = 1`);

  await query(`CREATE TABLE IF NOT EXISTS ml_order_stock (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ml_order_id      TEXT NOT NULL,
    listing_id       INTEGER,
    ml_item_id       TEXT NOT NULL,
    ml_variation_id  TEXT NOT NULL DEFAULT '',
    product_id       VARCHAR(50) NOT NULL,
    variant_id       INTEGER,
    quantity         INTEGER NOT NULL,
    deducted_qty     INTEGER NOT NULL DEFAULT 0,
    oversold         INTEGER NOT NULL DEFAULT 0,
    applied_at       TEXT NOT NULL DEFAULT (datetime('now')),
    reverted_at      TEXT,
    UNIQUE (ml_order_id, ml_item_id, ml_variation_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ml_order_stock_order ON ml_order_stock(ml_order_id)`);

  console.log('[Migration] Centralizador de stock MercadoLibre: tablas listas.');
}

// Permite correrla sola: node server/migrations/create_ml_stock_sync.js
if (import.meta.url === `file://${process.argv[1]}`) {
  createMlStockSync().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
