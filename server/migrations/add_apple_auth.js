/**
 * Migración: Soporte para autenticación con Apple
 * - Agrega columna apple_id a users
 * Ejecutar: node server/migrations/add_apple_auth.js
 */

import { query } from '../db.js';

async function migrate() {
  try {
    console.log('Iniciando migración: add_apple_auth...');

    // SQLite no soporta ADD COLUMN UNIQUE; la unicidad se garantiza con el índice
    try {
      await query(`ALTER TABLE users ADD COLUMN apple_id VARCHAR(255)`);
      console.log('✓ Columna apple_id agregada');
    } catch (e) {
      if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
        console.log('· Columna apple_id ya existe, se omite');
      } else {
        throw e;
      }
    }

    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)`);
    console.log('✓ Índice único en apple_id creado');

    console.log('Migración completada exitosamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err);
    process.exit(1);
  }
}

migrate();
