/**
 * Migración: Agregar campos de tostado a tabla lots
 * Ejecutar: node server/migrations/add_roast_fields.js
 */

import { query } from '../db.js';

async function migrate() {
  try {
    console.log('Iniciando migración: Agregar campos de tostado...');

    // Agregar columnas si no existen
    const columns = [
      { name: 'estado', sql: "ALTER TABLE lots ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'verde'" },
      { name: 'fecha_tostado', sql: 'ALTER TABLE lots ADD COLUMN IF NOT EXISTS fecha_tostado DATE' },
      { name: 'parent_lot_id', sql: 'ALTER TABLE lots ADD COLUMN IF NOT EXISTS parent_lot_id BIGINT' },
      { name: 'weight_kg', sql: 'ALTER TABLE lots ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2)' },
    ];

    for (const col of columns) {
      try {
        await query(col.sql);
        console.log(`✓ Columna ${col.name} agregada`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`⊗ Columna ${col.name} ya existe, saltando...`);
        } else {
          throw err;
        }
      }
    }

    // Agregar índices
    console.log('\nAgregando índices...');
    await query('CREATE INDEX IF NOT EXISTS idx_lots_estado ON lots(estado)');
    console.log('✓ Índice idx_lots_estado creado');
    await query('CREATE INDEX IF NOT EXISTS idx_lots_parent ON lots(parent_lot_id)');
    console.log('✓ Índice idx_lots_parent creado');

    // Agregar Foreign Key si no existe
    console.log('\nAgregando Foreign Key...');
    try {
      await query(`
        ALTER TABLE lots 
        ADD CONSTRAINT fk_lots_parent 
        FOREIGN KEY (parent_lot_id) 
        REFERENCES lots(id) 
        ON DELETE SET NULL
      `);
      console.log('✓ Foreign Key fk_lots_parent agregada');
    } catch (err) {
      if (err.code === '42710' || err.message?.includes('already exists')) {
        console.log('⊗ Foreign Key fk_lots_parent ya existe');
      } else {
        console.warn('⚠ Foreign Key:', err.message);
      }
    }

    console.log('\n✓ Migración completada exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error en migración:', err.message);
    process.exit(1);
  }
}

migrate();
