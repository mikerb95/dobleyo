/**
 * Migración: Soporte para autenticación con Apple
 * - Agrega columna apple_id a users
 * Ejecutar: node server/migrations/add_apple_auth.js
 */

import { query } from '../db.js';

async function migrate() {
  try {
    console.log('Iniciando migración: add_apple_auth...');

    try {
      await query(`ALTER TABLE users ADD COLUMN apple_id VARCHAR(255) UNIQUE`);
      console.log('✓ Columna apple_id agregada');
    } catch (e) {
      if (e.message?.includes('duplicate column')) {
        console.log('· Columna apple_id ya existe, se omite');
      } else {
        throw e;
      }
    }

    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)
    `);
    console.log('✓ Índice en apple_id creado');

    console.log('Migración completada exitosamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err);
    process.exit(1);
  }
}

migrate();
