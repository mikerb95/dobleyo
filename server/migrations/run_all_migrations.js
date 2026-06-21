#!/usr/bin/env node
/**
 * Runner centralizado de todas las migraciones.
 * Ejecutar: node server/migrations/run_all_migrations.js
 *
 * IMPORTANTE: el orden importa por dependencias entre tablas.
 */
import 'dotenv/config';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

// Ejecutar un archivo JS como subproceso
function runFile(file) {
  execFileSync(node, [join(__dirname, file)], {
    stdio: 'inherit',
    env: process.env,
  });
}

// Importar y llamar una función exportada
async function runFn(file, fnName) {
  const mod = await import(join(__dirname, file));
  if (typeof mod[fnName] !== 'function') {
    throw new Error(`Función '${fnName}' no encontrada en ${file}`);
  }
  await mod[fnName]();
}

const steps = [
  // Self-executing (tienen process.exit internamente → subproceso)
  { name: 'Coffee pipeline tables',          run: () => runFile('run_coffee_migration.js') },
  { name: 'Roast fields on lots',            run: () => runFile('add_roast_fields.js') },
  { name: 'Labels tables',                   run: () => runFile('create_labels_tables.js') },
  { name: 'Google auth column',              run: () => runFile('add_google_auth.js') },

  // Exportan función → import directo
  { name: 'Origin fields on coffee_harvests', run: () => runFn('add_origin_fields_to_coffee_harvests.js', 'addOriginFieldsToCoffeeHarvests') },
  { name: 'Farms table',                     run: () => runFn('create_farms_table.js', 'createFarmsTable') },
  { name: 'Finance tables',                  run: () => runFn('create_finance_tables.js', 'createFinanceTables') },
  { name: 'Inventory tables',                run: () => runFn('create_inventory_tables.js', 'migrateInventoryTables') },
  { name: 'Customer orders tables',          run: () => runFn('create_customer_orders.js', 'createCustomerOrdersTables') },
  { name: 'Subscriptions tables',            run: () => runFn('create_subscriptions.js', 'createSubscriptionsTables') },
  { name: 'Currency on customer_orders',     run: () => runFn('add_currency_to_orders.js', 'addCurrencyToOrders') },
  { name: 'Geocoding on orders',             run: () => runFn('add_geocoding_to_orders.js', 'addGeocodingToOrders') },
  { name: 'Split name fields',               run: () => runFn('split_name_fields.js', 'splitNameFields') },
  { name: 'Product variants table',          run: () => runFn('add_product_variants.js', 'addProductVariants') },
  { name: 'Newsletter subscribers table',    run: () => runFn('add_newsletter_subscribers.js', 'addNewsletterSubscribers') },
  { name: 'Newsletter unsubscribe token',    run: () => runFn('add_newsletter_unsubscribe_token.js', 'addNewsletterUnsubscribeToken') },
  { name: 'Blog posts table + seed',         run: () => runFn('add_blog_posts.js', 'addBlogPosts') },
  { name: 'Product reviews table',           run: () => runFn('add_product_reviews.js', 'addProductReviews') },
  { name: 'Gift sets column + seed',         run: () => runFn('add_gift_sets.js', 'addGiftSets') },
  { name: 'System tables (error_logs + system_changelog)', run: () => runFn('add_system_tables.js', 'addSystemTables') },
  { name: 'Demand forecasts table',          run: () => runFn('create_demand_forecasts.js', 'createDemandForecasts') },
  { name: 'CRM tables + overview view',      run: () => runFn('create_crm_tables.js', 'createCrmTables') },
  { name: 'ML sales fields (buyer/status)',  run: () => runFn('add_ml_sales_fields.js', 'addMlSalesFields') },
];

async function runAll() {
  console.log('🚀 Ejecutando todas las migraciones...\n');
  let ok = 0;
  let failed = 0;

  for (const step of steps) {
    process.stdout.write(`  ▶ ${step.name}... `);
    try {
      await step.run();
      console.log('✅');
      ok++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`✅ Exitosas: ${ok}  ❌ Fallidas: ${failed}`);
  if (failed > 0) {
    console.log('Revisa los errores. Las migraciones con IF NOT EXISTS son seguras de re-ejecutar.');
    // MIGRATE_SOFT_FAIL=1 → no bloquear (p. ej. hook de build en Vercel): los
    // fallos suelen ser de re-ejecución (columna ya existe) y son inofensivos.
    if (process.env.MIGRATE_SOFT_FAIL) {
      console.log('MIGRATE_SOFT_FAIL activo → se continúa sin bloquear el build.');
      process.exit(0);
    }
    process.exit(1);
  }
  process.exit(0);
}

runAll();
