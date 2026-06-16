import bcrypt from 'bcryptjs';
import { query } from './server/db.js';
const tables = ['users','caficultor_applications','coffee_harvests','lots','product_variants','product_reviews','newsletter_subscribers','sales_tracking','customer_orders','customer_order_items','external_sales','external_sale_items','demand_records','crm_accounts','crm_contacts','crm_interactions','work_centers','roasting_equipment','roast_profiles','bill_of_materials','production_orders','inventory_movements','accounting_accounts','accounting_journals','payment_methods','cost_centers','bank_accounts','tax_rates','product_suppliers','sales_invoices','sales_invoice_lines','payments','payment_allocations','purchase_invoices','expenses'];
for (const t of tables) {
  const c = await query(`SELECT COUNT(*) AS n FROM "${t}"`);
  console.log(String(c.rows[0].n).padStart(4), t);
}
// login check
const u = await query("SELECT password_hash FROM users WHERE email='caficultor.huila@demo.dobleyo.cafe'");
const ok = await bcrypt.compare('Demo1234*', u.rows[0].password_hash);
console.log('\nLogin demo (Demo1234*) válido:', ok);
process.exit(0);
