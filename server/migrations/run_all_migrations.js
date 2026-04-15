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
  { name: 'Geocoding on orders',             run: () => runFn('add_geocoding_to_orders.js', 'addGeocodingToOrders') },
  { name: 'Split name fields',               run: () => runFn('split_name_fields.js', 'splitNameFields') },
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
    process.exit(1);
  }
  process.exit(0);
}

runAll();
