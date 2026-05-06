import { query } from '../db.js';

export async function addNewsletterUnsubscribeToken() {
  await query(`ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT UNIQUE`).catch(err => {
    if (!err.message.includes('duplicate column')) throw err;
  });
  await query(`CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token ON newsletter_subscribers(unsubscribe_token)`);
  console.log('[Migration] unsubscribe_token añadido a newsletter_subscribers.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addNewsletterUnsubscribeToken()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch(err => { console.error(err); process.exit(1); })
  );
}
