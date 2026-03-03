import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { hashPassword } from './auth.js';

/**
 * Script para RESETEAR completamente la base de datos PostgreSQL
 *
 * ADVERTENCIA: Esto eliminará TODOS los datos existentes
 *
 * Uso: node server/reset_database.js
 *
 * Variables de entorno requeridas:
 *   DATABASE_URL - URL de conexión PostgreSQL
 *   ADMIN_EMAIL - Email del admin a crear
 *   ADMIN_PASSWORD - Contraseña del admin (min 8 chars)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

async function resetDatabase() {
  console.log('🚨 INICIANDO RESET DE BASE DE DATOS PostgreSQL...\n');

  try {
    // 1. Verificar conexión
    console.log('📡 Verificando conexión...');
    await query('SELECT 1');
    console.log('✅ Conexión exitosa\n');

    // 2. ELIMINAR todas las tablas en orden inverso (FK constraints)
    console.log('📦 Eliminando tablas existentes...');

    const dropTables = [
      // Dependencias más profundas primero
      'equipment_maintenance',
      'production_waste_byproducts',
      'production_quality_checks',
      'roast_batches',
      'roast_profiles',
      'production_material_consumption',
      'production_orders',
      'bom_components',
      'bill_of_materials',
      'roasting_equipment',
      'work_centers',
      'tax_rates',
      'expenses',
      'credit_debit_notes',
      'budget_lines',
      'budgets',
      'cost_centers',
      'payment_allocations',
      'payments',
      'payment_methods',
      'sales_invoice_lines',
      'sales_invoices',
      'purchase_invoice_lines',
      'purchase_invoices',
      'purchase_order_lines',
      'purchase_orders',
      'bank_movements',
      'bank_accounts',
      'accounting_entry_lines',
      'accounting_entries',
      'accounting_journals',
      'accounting_accounts',
      'generated_labels',
      'product_labels',
      'sales_tracking',
      'lots',
      'product_supplier_prices',
      'inventory_movements',
      'products',
      'product_suppliers',
      'audit_logs',
      'refresh_tokens',
      'providers',
      // Tablas de trazabilidad de café
      'green_coffee_inventory',
      'coffee_harvests',
      // Tablas de órdenes
      'order_items',
      'orders',
      // Tablas de fincas
      'farm_gallery',
      'farms',
      'caficultor_applications',
      'users',
    ];

    for (const table of dropTables) {
      try {
        await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✓ Eliminada tabla: ${table}`);
      } catch (err) {
        console.log(`  ⚠️  Error al eliminar ${table}:`, err.message);
      }
    }

    console.log('\n✅ Todas las tablas eliminadas\n');

    // 3. CREAR todas las tablas desde schema.sql
    console.log('🔨 Creando tablas desde db/schema.sql...\n');

    const schemaPath = resolve(__dirname, '..', 'db', 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf8');

    // Dividir por ; y ejecutar cada sentencia
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let tablesCreated = 0;
    let indexesCreated = 0;
    let errors = 0;

    for (const statement of statements) {
      // Saltar comentarios puros
      const cleaned = statement.replace(/--.*$/gm, '').trim();
      if (!cleaned) continue;

      try {
        await query(cleaned);
        if (cleaned.toUpperCase().includes('CREATE TABLE')) {
          const tableName = cleaned.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/i)?.[1];
          console.log(`  ✓ Tabla creada: ${tableName}`);
          tablesCreated++;
        } else if (cleaned.toUpperCase().includes('CREATE INDEX')) {
          indexesCreated++;
        }
      } catch (err) {
        // Ignorar errores de "ya existe"
        if (err.code === '42P07' || err.code === '42710') {
          // table/index already exists
        } else {
          console.log(`  ⚠ Error no fatal: ${err.message.slice(0, 100)}`);
          errors++;
        }
      }
    }

    console.log(`\n✅ Schema aplicado: ${tablesCreated} tablas, ${indexesCreated} índices${errors ? `, ${errors} errores no fatales` : ''}\n`);

    // 4. Ejecutar migraciones adicionales (tablas que no están en schema.sql)
    console.log('🔄 Ejecutando migraciones adicionales...');

    const migrations = [
      { name: 'create_customer_orders', file: './migrations/create_customer_orders.js' },
      { name: 'create_farms_table', file: './migrations/create_farms_table.js' },
      { name: 'create_finance_tables', file: './migrations/create_finance_tables.js' },
      { name: 'split_name_fields', file: './migrations/split_name_fields.js' },
    ];

    for (const mig of migrations) {
      try {
        const mod = await import(mig.file);
        const fn = mod.default || mod[Object.keys(mod)[0]];
        if (typeof fn === 'function') {
          await fn();
          console.log(`  ✓ Migración: ${mig.name}`);
        }
      } catch (err) {
        // Muchas migraciones fallan si la tabla/columna ya existe — no fatal
        if (err.code === '42P07' || err.code === '42701') {
          console.log(`  ✓ ${mig.name} (ya aplicada)`);
        } else {
          console.log(`  ⚠ ${mig.name}: ${err.message.slice(0, 100)}`);
        }
      }
    }

    console.log('');

    // 5. CREAR usuario administrador
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASS) {
      console.log('⚠️  Saltando creación de admin: ADMIN_EMAIL y ADMIN_PASSWORD no configurados.');
    } else if (ADMIN_PASS.length < 8) {
      console.log('⚠️  Saltando creación de admin: La contraseña debe tener al menos 8 caracteres.');
    } else {
      console.log('👤 Creando usuario administrador...');

      const passwordHash = await hashPassword(ADMIN_PASS);

      await query(
        `INSERT INTO users (email, password_hash, first_name, role, is_verified)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [ADMIN_EMAIL, passwordHash, 'Admin DobleYo', 'admin']
      );

      console.log(`✅ Admin creado: ${ADMIN_EMAIL}`);
    }

    console.log('\n🎉 RESET COMPLETADO EXITOSAMENTE\n');

  } catch (error) {
    console.error('❌ ERROR durante el reset:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar
resetDatabase();
