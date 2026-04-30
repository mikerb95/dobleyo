import { query } from '../db.js';

export async function addSystemTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      level          TEXT NOT NULL DEFAULT 'error',
      message        TEXT NOT NULL,
      stack          TEXT,
      source         TEXT,
      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      request_path   TEXT,
      request_method TEXT,
      details        TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_error_logs_level   ON error_logs(level)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at)`);

  await query(`
    CREATE TABLE IF NOT EXISTS system_changelog (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      version      TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT,
      change_type  TEXT NOT NULL DEFAULT 'feature',
      author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      published_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_changelog_created ON system_changelog(created_at)`);

  console.log('[Migration] error_logs + system_changelog creadas.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await addSystemTables();
  console.log('OK');
  process.exit(0);
}
