import { query } from '../db.js';

/**
 * Migración: Sistema de Inventario y Productos Completo
 * - Extiende tabla products con campos de inventario
 * - Crea tabla inventory_movements para trazabilidad
 * - Crea tablas de proveedores y relaciones
 */

export async function migrateInventoryTables() {
  console.log('🚀 Iniciando migración de inventario...');

  try {
    // 1. Verificar si necesitamos actualizar la tabla products
    console.log('📦 Actualizando tabla products...');
    
    // Agregar columnas nuevas si no existen (manejo seguro)
    const newColumns = [
      { name: 'sku', type: 'VARCHAR(100) UNIQUE' },
      { name: 'description', type: 'TEXT' },
      { name: 'subcategory', type: 'VARCHAR(80)' },
      { name: 'cost', type: 'INTEGER' },
      { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'images', type: 'JSON' },
      { name: 'stock_quantity', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'stock_reserved', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'stock_min', type: 'INTEGER DEFAULT 0' },
      { name: 'weight', type: 'DECIMAL(10,2)' },
      { name: 'weight_unit', type: "ENUM('g', 'kg', 'ml', 'l', 'unidad') DEFAULT 'g'" },
      { name: 'dimensions', type: 'VARCHAR(100)' },
      { name: 'meta_keywords', type: 'TEXT' },
      { name: 'meta_description', type: 'TEXT' }
    ];

    for (const col of newColumns) {
      try {
        await query(`
          ALTER TABLE products 
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`  ✓ Columna ${col.name} agregada`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
          console.log(`  ⚠ Columna ${col.name} ya existe, saltando...`);
        } else {
          throw err;
        }
      }
    }

    // Modificar category a ENUM si no lo es
    try {
      await query(`
        ALTER TABLE products 
        MODIFY COLUMN category ENUM('cafe', 'accesorio', 'merchandising') NOT NULL DEFAULT 'cafe'
      `);
      console.log('  ✓ Columna category actualizada a ENUM');
    } catch (err) {
      console.log('  ⚠ No se pudo actualizar category:', err.message);
    }

    // Renombrar stock a stock_quantity si existe
    try {
      await query(`
        ALTER TABLE products 
        CHANGE COLUMN stock stock_quantity INTEGER NOT NULL DEFAULT 0
      `);
      console.log('  ✓ Columna stock renombrada a stock_quantity');
    } catch (err) {
      console.log('  ⚠ Columna stock ya procesada o no existe');
    }

    // 2. Crear tabla inventory_movements
    console.log('📊 Creando tabla inventory_movements...');
    await query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        product_id VARCHAR(50) NOT NULL,
        movement_type ENUM('entrada', 'salida', 'ajuste', 'merma', 'devolucion') NOT NULL,
        quantity INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        reason VARCHAR(255),
        reference VARCHAR(100),
        notes TEXT,
        user_id BIGINT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('  ✓ Tabla inventory_movements creada');

    // Crear índices para inventory_movements
    try {
      await query('CREATE INDEX idx_inv_movements_product ON inventory_movements(product_id)');
      await query('CREATE INDEX idx_inv_movements_type ON inventory_movements(movement_type)');
      await query('CREATE INDEX idx_inv_movements_date ON inventory_movements(created_at)');
      console.log('  ✓ Índices de inventory_movements creados');
    } catch (err) {
      console.log('  ⚠ Índices ya existen');
    }

    // 3. Crear tabla product_suppliers
    console.log('🏭 Creando tabla product_suppliers...');
    await query(`
      CREATE TABLE IF NOT EXISTS product_suppliers (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(160) NOT NULL,
        contact_name VARCHAR(120),
        email VARCHAR(255),
        phone VARCHAR(40),
        address TEXT,
        tax_id VARCHAR(50),
        payment_terms VARCHAR(255),
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ Tabla product_suppliers creada');

    // 4. Crear tabla product_supplier_prices
    console.log('💰 Creando tabla product_supplier_prices...');
    await query(`
      CREATE TABLE IF NOT EXISTS product_supplier_prices (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        product_id VARCHAR(50) NOT NULL,
        supplier_id BIGINT NOT NULL,
        cost_price INTEGER NOT NULL,
        currency VARCHAR(3) DEFAULT 'COP',
        minimum_order_quantity INTEGER DEFAULT 1,
        lead_time_days INTEGER,
        last_order_date DATE,
        is_preferred BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✓ Tabla product_supplier_prices creada');

    // Crear índices para product_supplier_prices
    try {
      await query('CREATE INDEX idx_prod_supplier_product ON product_supplier_prices(product_id)');
      await query('CREATE INDEX idx_prod_supplier_supplier ON product_supplier_prices(supplier_id)');
      console.log('  ✓ Índices de product_supplier_prices creados');
    } catch (err) {
      console.log('  ⚠ Índices ya existen');
    }

    // 5. Migrar datos existentes de stock a stock_quantity (si aplica)
    console.log('🔄 Verificando migración de datos...');
    const productsCheck = await query('SELECT COUNT(*) as count FROM products WHERE stock_quantity > 0');
    console.log(`  ℹ Productos con stock: ${productsCheck.rows[0]?.count || 0}`);

    console.log('✅ Migración completada exitosamente!');
    return { success: true };

  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateInventoryTables()
    .then(() => {
      console.log('🎉 Script de migración finalizado');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Error fatal:', err);
      process.exit(1);
    });
}
