import { query } from './server/db.js';
for (const t of ['caficultor_applications','lots','product_variants','product_reviews']) {
  const r = await query(`PRAGMA table_info("${t}")`);
  console.log(`=== ${t} ===\n` + r.rows.map(c=>c.name).join(', '));
}
process.exit(0);
