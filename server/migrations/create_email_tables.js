import { query } from '../db.js';

// Tablas del sistema de correo (Resend):
// - password_reset_tokens: enlaces de "olvidé mi contraseña" (se guarda el hash, nunca el token).
// - email_suppressions: rebotes permanentes y quejas de spam reportados por el webhook de Resend.
// - newsletter_campaigns: historial de campañas del boletín enviadas desde el panel.
export async function createEmailTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      used_at     TEXT,
      request_ip  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS email_suppressions (
      email       TEXT PRIMARY KEY,
      reason      TEXT NOT NULL CHECK (reason IN ('bounced','complained','manual')),
      detail      TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

  await query(`
    CREATE TABLE IF NOT EXISTS newsletter_campaigns (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      subject       TEXT NOT NULL,
      heading       TEXT NOT NULL,
      preheader     TEXT,
      body          TEXT NOT NULL,
      cta_label     TEXT,
      cta_url       TEXT,
      status        TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','partial','failed')),
      recipients    INTEGER NOT NULL DEFAULT 0,
      sent_count    INTEGER NOT NULL DEFAULT 0,
      failed_count  INTEGER NOT NULL DEFAULT 0,
      created_by    INTEGER REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at       TEXT
    )`);

  console.log('[Migration] Tablas de correo creadas (password_reset_tokens, email_suppressions, newsletter_campaigns).');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    createEmailTables()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch(err => { console.error(err); process.exit(1); })
  );
}
