import { query } from '../db.js';

/**
 * Migración: Crear tablas de etiquetas (product_labels y generated_labels)
 * Ejecuta: node server/migrations/create_labels_tables.js
 */

async function runMigration() {
  console.log('🔄 Iniciando migración: crear tablas de etiquetas...\n');

  try {
    // 1. Crear tabla product_labels
    console.log('📋 Creando tabla product_labels...');
    await query(`
      CREATE TABLE IF NOT EXISTS product_labels (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          lot_id BIGINT,
          label_code VARCHAR(100) NOT NULL UNIQUE,
          sequence INT,
          qr_data JSON,
          printed BOOLEAN DEFAULT FALSE,
          printed_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla product_labels creada\n');

    // Crear índices para product_labels
    console.log('🔍 Creando índices para product_labels...');
    try {
      await query(`CREATE INDEX idx_product_labels_lot ON product_labels(lot_id);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    try {
      await query(`CREATE INDEX idx_product_labels_code ON product_labels(label_code);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    try {
      await query(`CREATE INDEX idx_product_labels_printed ON product_labels(printed);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    console.log('✅ Índices de product_labels creados\n');

    // 2. Crear tabla generated_labels
    console.log('📋 Creando tabla generated_labels...');
    await query(`
      CREATE TABLE IF NOT EXISTS generated_labels (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          label_code VARCHAR(100) NOT NULL UNIQUE,
          lot_code VARCHAR(100),
          origin VARCHAR(160),
          variety VARCHAR(120),
          roast VARCHAR(80),
          process VARCHAR(80),
          altitude VARCHAR(60),
          farm VARCHAR(160),
          acidity INT,
          body INT,
          balance INT,
          score DECIMAL(4,1),
          flavor_notes TEXT,
          qr_data JSON,
          user_id BIGINT,
          printed BOOLEAN DEFAULT FALSE,
          printed_at TIMESTAMP NULL,
          sequence INT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Tabla generated_labels creada\n');

    // Crear índices para generated_labels
    console.log('🔍 Creando índices para generated_labels...');
    try {
      await query(`CREATE INDEX idx_generated_labels_code ON generated_labels(label_code);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    try {
      await query(`CREATE INDEX idx_generated_labels_lot_code ON generated_labels(lot_code);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    try {
      await query(`CREATE INDEX idx_generated_labels_user ON generated_labels(user_id);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    try {
      await query(`CREATE INDEX idx_generated_labels_printed ON generated_labels(printed);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    try {
      await query(`CREATE INDEX idx_generated_labels_created ON generated_labels(created_at);`);
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) throw e;
    }
    console.log('✅ Índices de generated_labels creados\n');

    console.log('✅✅✅ ¡Migración completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar
runMigration();
