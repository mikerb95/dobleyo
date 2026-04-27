import { query } from '../db.js';

export async function addProductReviews() {
    await query(`
        CREATE TABLE IF NOT EXISTS product_reviews (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id    VARCHAR(50) NOT NULL,
            user_id       BIGINT NULL,
            reviewer_name VARCHAR(100) NOT NULL,
            rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment       TEXT,
            is_approved   INTEGER NOT NULL DEFAULT 0,
            created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL
        )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_reviews_product  ON product_reviews(product_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reviews_approved ON product_reviews(is_approved)`);
    console.log('[Migration] product_reviews creada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    import('dotenv/config').then(() =>
        addProductReviews()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(err => { console.error(err); process.exit(1); })
    );
}
