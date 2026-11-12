// Migración: suscripciones con ePayco.
// - payment_provider: pasarela con la que se cobra la suscripción ('wompi' o
//   'epayco'). NULL = suscripciones anteriores, que siguen en Wompi.
// - epayco_customer_id / epayco_token_card: cliente y tarjeta tokenizada en ePayco.
// - customer_document_*: ePayco exige el documento del titular en cada cobro.
// - customer_ip: IP del alta; ePayco pide una IP en los cobros recurrentes.
import { query } from '../db.js';

const COLUMNS = [
  ['payment_provider', 'TEXT'],
  ['epayco_customer_id', 'TEXT'],
  ['epayco_token_card', 'TEXT'],
  ['customer_document_type', 'TEXT'],
  ['customer_document_number', 'TEXT'],
  ['customer_ip', 'TEXT'],
];

export async function addSubscriptionPaymentProvider() {
  for (const [name, type] of COLUMNS) {
    const col = await query(
      `SELECT name FROM pragma_table_info('subscriptions') WHERE name = ?`,
      [name]
    );
    if (col.rows.length) continue;
    await query(`ALTER TABLE subscriptions ADD COLUMN ${name} ${type}`);
    console.log(`[Migration] columna subscriptions.${name} añadida.`);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addSubscriptionPaymentProvider().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })
  );
}
