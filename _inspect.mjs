import { query } from './server/db.js';
const wanted = ['users','products','customer_orders','demand_records','crm_accounts','crm_contacts','crm_interactions','sales_tracking','external_sales','product_reviews','newsletter_subscribers'];
for (const t of wanted) {
  try {
    const r = await query(`PRAGMA table_info("${t}")`);
    console.log(`\n=== ${t} ===`);
    console.log(r.rows.map(c => `${c.name}:${c.type}${c.notnull?'!':''}${c.dflt_value!=null?'='+c.dflt_value:''}`).join('  '));
  } catch(e){ console.log(`\n=== ${t} === ERR ${e.message}`); }
}
process.exit(0);
