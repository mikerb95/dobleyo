import { query } from '../db.js';

export async function addNewsletterSubscribers() {
    await query(`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL UNIQUE,
            source     TEXT NOT NULL DEFAULT 'footer',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email)`);
    console.log('[Migration] newsletter_subscribers creada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    import('dotenv/config').then(() =>
        addNewsletterSubscribers()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(err => { console.error(err); process.exit(1); })
    );
}
