import { query } from '../db.js';

async function migrate() {
  try {
    console.log('Iniciando migración: Agregar campos de tostado...');

    const columns = [
      { name: 'estado',        sql: "ALTER TABLE lots ADD COLUMN estado TEXT DEFAULT 'verde'" },
      { name: 'fecha_tostado', sql: 'ALTER TABLE lots ADD COLUMN fecha_tostado DATE' },
      { name: 'parent_lot_id', sql: 'ALTER TABLE lots ADD COLUMN parent_lot_id INTEGER' },
      { name: 'weight_kg',     sql: 'ALTER TABLE lots ADD COLUMN weight_kg REAL' },
    ];

    for (const col of columns) {
      try {
        await query(col.sql);
        console.log(`✓ Columna ${col.name} agregada`);
      } catch (err) {
        if (err.message.includes('duplicate column')) {
          console.log(`⊗ Columna ${col.name} ya existe`);
        } else {
          throw err;
        }
      }
    }

    await query('CREATE INDEX IF NOT EXISTS idx_lots_estado ON lots(estado)');
    await query('CREATE INDEX IF NOT EXISTS idx_lots_parent ON lots(parent_lot_id)');
    console.log('✓ Índices creados');

    console.log('✓ Migración completada exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('✗ Error en migración:', err.message);
    process.exit(1);
  }
}

migrate();
