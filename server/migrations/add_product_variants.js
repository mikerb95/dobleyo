import { query } from '../db.js';

export async function addProductVariants() {
    await query(`
        CREATE TABLE IF NOT EXISTS product_variants (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id    VARCHAR(50) NOT NULL,
            size_label    VARCHAR(30),
            grind_label   VARCHAR(30),
            price_cop     INTEGER NOT NULL,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            sku_suffix    VARCHAR(30),
            is_active     INTEGER NOT NULL DEFAULT 1,
            sort_order    INTEGER NOT NULL DEFAULT 0,
            created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_pv_product ON product_variants(product_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_pv_active  ON product_variants(is_active)`);

    console.log('[Migration] product_variants creada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    import('dotenv/config').then(() =>
        addProductVariants()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(err => { console.error(err); process.exit(1); })
    );
}
