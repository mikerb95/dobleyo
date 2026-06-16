import { query } from './server/db.js';
for (const t of ['crm_accounts','crm_interactions','crm_contacts']) {
  const r = await query(`SELECT sql FROM sqlite_master WHERE name=?`, [t]);
  console.log(`\n=== ${t} ===\n` + (r.rows[0]?.sql||'').replace(/\s+/g,' '));
}
process.exit(0);
