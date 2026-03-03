/**
 * Migration script para agregar campos de tostado a tabla lots en Aiven
 * Ejecutar cuando el servidor esté configurado: node server/migrations/add_roast_fields.js
 * O integrar en server/init_db.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  let connection;
  try {
    console.log('Iniciando migración: Agregar campos de tostado a Aiven...');
    
    // Usar las variables de ambiente que apuntan a Aiven
    const dbConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    };

    console.log(`Conectando a ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Conectado a Aiven\n');

    // Agregar columnas si no existen
    const queries = [
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS estado ENUM('verde', 'tostado') DEFAULT 'verde'",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS fecha_tostado DATE NULL",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS parent_lot_id BIGINT NULL",
      "ALTER TABLE lots ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2) NULL"
    ];

    for (const sql of queries) {
      try {
        await connection.query(sql);
        console.log('✓', sql.substring(0, 70) + '...');
      } catch (err) {
        // Si la columna ya existe, continuar
        if (err.errno === 1060) {
          console.log('⊗', sql.substring(0, 70) + '... (ya existe)');
        } else {
          throw err;
        }
      }
    }

    // Agregar índices
    console.log('\nAgregando índices...');
    const indexes = [
      "ALTER TABLE lots ADD INDEX IF NOT EXISTS idx_lots_estado (estado)",
      "ALTER TABLE lots ADD INDEX IF NOT EXISTS idx_lots_parent (parent_lot_id)"
    ];

    for (const sql of indexes) {
      try {
        await connection.query(sql);
        console.log('✓', sql.substring(0, 70) + '...');
      } catch (err) {
        if (err.errno === 1061) {
          console.log('⊗', sql.substring(0, 70) + '... (ya existe)');
        } else {
          throw err;
        }
      }
    }

    // Agregar Foreign Key si no existe
    console.log('\nAgregando Foreign Key...');
    try {
      await connection.query(`
        ALTER TABLE lots 
        ADD CONSTRAINT fk_lots_parent 
        FOREIGN KEY (parent_lot_id) 
        REFERENCES lots(id) 
        ON DELETE SET NULL
      `);
      console.log('✓ Foreign Key agregada');
    } catch (err) {
      if (err.errno === 1064 || err.errno === 1826) {
        console.log('⊗ Foreign Key... (ya existe)');
      } else if (err.message.includes('CONSTRAINT')) {
        console.log('⊗ Foreign Key... (ya existe)');
      } else {
        console.warn('⚠ Foreign Key:', err.message);
      }
    }

    console.log('\n✓ Migración completada exitosamente en Aiven');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error en migración:', err.message);
    console.error('Verifica que las variables de ambiente DB_* estén configuradas correctamente');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
