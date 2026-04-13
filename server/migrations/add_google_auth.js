/**
 * Migración: Soporte para autenticación con Google
 * - Agrega columna google_id a users
 * - Hace password_hash nullable (usuarios OAuth no tienen contraseña)
 * Ejecutar: node server/migrations/add_google_auth.js
 */

import { query } from '../db.js';

async function migrate() {
  try {
    console.log('Iniciando migración: add_google_auth...');

    await query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE
    `);
    console.log('✓ Columna google_id agregada');

    await query(`
      ALTER TABLE users
        ALTER COLUMN password_hash DROP NOT NULL
    `);
    console.log('✓ password_hash ahora es nullable');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
    `);
    console.log('✓ Índice en google_id creado');

    console.log('Migración completada exitosamente.');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err);
    process.exit(1);
  }
}

migrate();
