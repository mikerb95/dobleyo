import { query } from './server/db.js';
for (const t of ['external_sales','external_sale_items','accounting_journals','payment_methods','cost_centers','bank_accounts','tax_rates','product_suppliers','sales_invoice_lines','payment_allocations','purchase_invoices','expenses','work_centers','roasting_equipment','bill_of_materials','bom_components','roast_profiles','production_orders','inventory_movements','crm_accounts']) {
  const r = await query(`PRAGMA table_info("${t}")`);
  console.log(`${t}: ` + r.rows.map(c=>c.name).join(', '));
}
process.exit(0);
