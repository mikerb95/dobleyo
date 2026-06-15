import { query } from './server/db.js';
for (const t of ['product_variants','discount_codes','coffee_harvests','green_coffee_inventory','roasting_batches','roasted_coffee','accounting_accounts','sales_invoices','payments','expenses']) {
  const r = await query(`PRAGMA table_info("${t}")`);
  console.log(`=== ${t} ===\n` + r.rows.map(c=>c.name).join(', '));
}
process.exit(0);
