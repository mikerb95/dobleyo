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

    // SQLite no soporta ADD COLUMN IF NOT EXISTS: se tolera el duplicado.
    // Tampoco admite UNIQUE en un ALTER, así que la unicidad va por índice.
    try {
      await query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255)');
      console.log('✓ Columna google_id agregada');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('⊗ Columna google_id ya existe');
    }

    // password_hash ya es nullable en db/schema.sql (los usuarios OAuth no
    // tienen contraseña). SQLite no permite ALTER COLUMN ... DROP NOT NULL,
    // así que no hay nada que hacer aquí.
    console.log('⊗ password_hash ya es nullable en el esquema base');

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
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
