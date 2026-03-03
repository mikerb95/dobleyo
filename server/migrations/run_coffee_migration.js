#!/usr/bin/env node
import 'dotenv/config';
import { query } from '../db.js';

async function runCoffeeMigration() {
  console.log('🚀 Iniciando migración de tablas de café...\n');

  try {
    // Verificar conexión a BD
    if (!process.env.DATABASE_URL) {
      throw new Error('❌ DATABASE_URL no está configurada en .env');
    }

    console.log('✓ Conexión a base de datos configurada');

    // 1. Tabla de cosechas (recolección en finca)
    console.log('\n📦 Creando tabla coffee_harvests...');
    await query(`
      CREATE TABLE IF NOT EXISTS coffee_harvests (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        lot_id VARCHAR(30) UNIQUE NOT NULL,
        farm VARCHAR(100) NOT NULL,
        variety VARCHAR(50) NOT NULL,
        climate VARCHAR(50) NOT NULL,
        process VARCHAR(50) NOT NULL,
        aroma TEXT NOT NULL,
        taste_notes TEXT NOT NULL,
        region VARCHAR(100),
        altitude INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `, []);
    await query('CREATE INDEX IF NOT EXISTS idx_coffee_harvests_lot_id ON coffee_harvests(lot_id)');
    console.log('✅ Tabla coffee_harvests creada correctamente');

    // 2. Tabla de inventario de café verde
    console.log('\n📦 Creando tabla green_coffee_inventory...');
    await query(`
      CREATE TABLE IF NOT EXISTS green_coffee_inventory (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        harvest_id BIGINT NOT NULL,
        lot_id VARCHAR(30) NOT NULL,
        weight_kg DECIMAL(10, 2) NOT NULL,
        location VARCHAR(100) NOT NULL,
        storage_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvest_id) REFERENCES coffee_harvests(id)
      )
    `, []);
    await query('CREATE INDEX IF NOT EXISTS idx_green_coffee_lot_id ON green_coffee_inventory(lot_id)');
    console.log('✅ Tabla green_coffee_inventory creada correctamente');

    // 3. Tabla de lotes en tostión
    console.log('\n📦 Creando tabla roasting_batches...');
    await query(`
      CREATE TABLE IF NOT EXISTS roasting_batches (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        lot_id VARCHAR(30) NOT NULL,
        quantity_sent_kg DECIMAL(10, 2) NOT NULL,
        target_temp INTEGER,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'in_roasting',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `, []);
    await query('CREATE INDEX IF NOT EXISTS idx_roasting_batches_lot_id ON roasting_batches(lot_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_roasting_batches_status ON roasting_batches(status)');
    console.log('✅ Tabla roasting_batches creada correctamente');

    // 4. Tabla de café tostado
    console.log('\n📦 Creando tabla roasted_coffee...');
    await query(`
      CREATE TABLE IF NOT EXISTS roasted_coffee (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        roasting_id BIGINT NOT NULL,
        roast_level VARCHAR(50) NOT NULL,
        weight_kg DECIMAL(10, 2) NOT NULL,
        weight_loss_percent DECIMAL(5, 2) NOT NULL,
        actual_temp INTEGER,
        roast_time_minutes INTEGER,
        observations TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ready_for_storage',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roasting_id) REFERENCES roasting_batches(id)
      )
    `, []);
    await query('CREATE INDEX IF NOT EXISTS idx_roasted_coffee_status ON roasted_coffee(status)');
    console.log('✅ Tabla roasted_coffee creada correctamente');

    // 5. Tabla de inventario de café tostado
    console.log('\n📦 Creando tabla roasted_coffee_inventory...');
    await query(`
      CREATE TABLE IF NOT EXISTS roasted_coffee_inventory (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        roasted_id BIGINT NOT NULL,
        location VARCHAR(100) NOT NULL,
        container_type VARCHAR(50) NOT NULL,
        container_count INTEGER NOT NULL,
        storage_conditions TEXT,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ready_for_packaging',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roasted_id) REFERENCES roasted_coffee(id)
      )
    `, []);
    await query('CREATE INDEX IF NOT EXISTS idx_roasted_inv_status ON roasted_coffee_inventory(status)');
    console.log('✅ Tabla roasted_coffee_inventory creada correctamente');

    // 6. Tabla de café empacado para venta
    console.log('\n📦 Creando tabla packaged_coffee...');
    await query(`
      CREATE TABLE IF NOT EXISTS packaged_coffee (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        roasted_storage_id BIGINT NOT NULL,
        acidity INTEGER NOT NULL,
        body INTEGER NOT NULL,
        balance INTEGER NOT NULL,
        score DECIMAL(3, 2) NOT NULL,
        presentation VARCHAR(50) NOT NULL,
        grind_size VARCHAR(100),
        package_size VARCHAR(50) NOT NULL,
        unit_count INTEGER NOT NULL,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ready_for_sale',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roasted_storage_id) REFERENCES roasted_coffee_inventory(id)
      )
    `, []);
    await query('CREATE INDEX IF NOT EXISTS idx_packaged_coffee_status ON packaged_coffee(status)');
    console.log('✅ Tabla packaged_coffee creada correctamente');

    console.log('\n✅ Migración completada exitosamente');
    console.log('📊 Todas las tablas de trazabilidad de café están listas\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error en la migración:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runCoffeeMigration();
