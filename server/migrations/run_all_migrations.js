#!/usr/bin/env node
/**
 * Runner centralizado de todas las migraciones.
 * Ejecutar: node server/migrations/run_all_migrations.js
 *
 * IMPORTANTE: el orden importa por dependencias entre tablas.
 */
import 'dotenv/config';

async function runAll() {
  console.log('🚀 Ejecutando todas las migraciones...\n');

  const steps = [
    { name: 'Coffee pipeline tables', path: './run_coffee_migration.js', fn: null },
    { name: 'Origin fields on coffee_harvests', path: './add_origin_fields_to_coffee_harvests.js', fn: 'addOriginFieldsToCoffeeHarvests' },
    { name: 'Roast fields on lots', path: './add_roast_fields.js', fn: 'addRoastFields' },
    { name: 'Labels tables', path: './create_labels_tables.js', fn: 'createLabelsTables' },
    { name: 'Farms table', path: './create_farms_table.js', fn: 'createFarmsTable' },
    { name: 'Finance tables', path: './create_finance_tables.js', fn: 'createFinanceTables' },
    { name: 'Inventory tables', path: './create_inventory_tables.js', fn: 'createInventoryTables' },
    { name: 'Customer orders tables', path: './create_customer_orders.js', fn: 'createCustomerOrdersTables' },
    { name: 'Google auth column', path: './add_google_auth.js', fn: 'addGoogleAuth' },
    { name: 'Geocoding on orders', path: './add_geocoding_to_orders.js', fn: 'addGeocodingToOrders' },
    { name: 'Split name fields', path: './split_name_fields.js', fn: 'splitNameFields' },
  ];

  let ok = 0;
  let failed = 0;

  for (const step of steps) {
    process.stdout.write(`  ▶ ${step.name}... `);
    try {
      const mod = await import(step.path);

      if (step.fn) {
        // Módulo que exporta una función
        if (typeof mod[step.fn] !== 'function') {
          throw new Error(`Función ${step.fn} no encontrada en ${step.path}`);
        }
        await mod[step.fn]();
      } else {
        // run_coffee_migration.js ejecuta solo al importar — ya tiene su propio main
        // Lo ejecutamos como subprocess para no tener conflicto con process.exit()
        const { execSync } = await import('child_process');
        execSync(`node ${new URL(step.path, import.meta.url).pathname}`, { stdio: 'pipe' });
      }

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
    console.log('Revisa los errores arriba. Las migraciones con IF NOT EXISTS son seguras de re-ejecutar.');
  }
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
