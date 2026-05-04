import { query } from '../db.js';

// Migración: Crear tablas para ventas externas (canales no integrados)
// Ejecutar: node server/migrations/create_external_sales.js

async function runMigration() {
  console.log('Iniciando migración: crear tablas de ventas externas...\n');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS external_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_number VARCHAR(20) NOT NULL UNIQUE,
        channel VARCHAR(60) NOT NULL CHECK (channel IN ('instagram','whatsapp','referido','tienda_fisica','telefono','otro')),
        channel_detail VARCHAR(120),
        customer_name VARCHAR(160),
        customer_contact VARCHAR(160),
        customer_city VARCHAR(120),
        customer_state VARCHAR(120),
        sale_date DATE NOT NULL,
        subtotal INTEGER NOT NULL DEFAULT 0,
        discount INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'completada' CHECK (status IN ('completada','cancelada','pendiente')),
        registered_by BIGINT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL,
        FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('Tabla external_sales creada');

    await query(`
      CREATE TABLE IF NOT EXISTS external_sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        lot_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES external_sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE SET NULL
      )
    `);
    console.log('Tabla external_sale_items creada');

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_ext_sales_date ON external_sales(sale_date)`,
      `CREATE INDEX IF NOT EXISTS idx_ext_sales_channel ON external_sales(channel)`,
      `CREATE INDEX IF NOT EXISTS idx_ext_sales_status ON external_sales(status)`,
      `CREATE INDEX IF NOT EXISTS idx_ext_sale_items_sale ON external_sale_items(sale_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ext_sale_items_product ON external_sale_items(product_id)`,
    ];

    for (const sql of indexes) {
      await query(sql);
    }
    console.log('Indices creados');

    console.log('\nMigracion completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('Error durante la migracion:', error.message);
    process.exit(1);
  }
}

runMigration();
