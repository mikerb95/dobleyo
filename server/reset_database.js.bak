import 'dotenv/config';
import { query } from './db.js';
import { hashPassword } from './auth.js';
import mysql from 'mysql2/promise';

/**
 * Script para RESETEAR completamente la base de datos
 * 
 * ADVERTENCIA: Esto eliminará TODOS los datos existentes
 */

async function resetDatabase() {
  console.log('🚨 INICIANDO RESET DE BASE DE DATOS...\n');
  
  // Crear conexión directa
  const dbUrl = new URL(process.env.DATABASE_URL);
  const connection = await mysql.createConnection({
    host: dbUrl.hostname,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    port: Number(dbUrl.port),
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // 1. ELIMINAR todas las tablas en orden correcto (FK constraints)
    console.log('📦 Eliminando tablas existentes...');
    
    const dropTables = [
      'sales_tracking',
      'product_supplier_prices',
      'product_suppliers',
      'inventory_movements',
      'lots',
      'products',
      'audit_logs',
      'refresh_tokens',
      'providers',
      'caficultor_applications',
      'users'
    ];
    
    for (const table of dropTables) {
      try {
        await connection.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`  ✓ Eliminada tabla: ${table}`);
      } catch (err) {
        console.log(`  ⚠️  Error al eliminar ${table}:`, err.message);
      }
    }
    
    console.log('\n✅ Todas las tablas eliminadas\n');
    
    // 2. CREAR todas las tablas
    console.log('🔨 Creando tablas...\n');
    
    // Users
    await connection.execute(`
      CREATE TABLE users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(120),
        mobile_phone VARCHAR(20),
        landline_phone VARCHAR(20),
        tax_id VARCHAR(50),
        city VARCHAR(120),
        state_province VARCHAR(120),
        country VARCHAR(120) DEFAULT 'Colombia',
        address TEXT,
        role ENUM('admin', 'client', 'provider', 'caficultor') NOT NULL DEFAULT 'client',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        caficultor_status ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none',
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.execute('CREATE INDEX idx_users_role ON users(role)');
    await connection.execute('CREATE INDEX idx_users_caficultor_status ON users(caficultor_status)');
    console.log('  ✓ Tabla users creada');
    
    // Caficultor Applications
    await connection.execute(`
      CREATE TABLE caficultor_applications (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        farm_name VARCHAR(160) NOT NULL,
        region VARCHAR(80) NOT NULL,
        altitude INT,
        hectares DECIMAL(10,2),
        varieties_cultivated TEXT,
        certifications TEXT,
        description TEXT,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_by BIGINT,
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await connection.execute('CREATE INDEX idx_caficultor_apps_user ON caficultor_applications(user_id)');
    await connection.execute('CREATE INDEX idx_caficultor_apps_status ON caficultor_applications(status)');
    console.log('  ✓ Tabla caficultor_applications creada');
    
    // Providers
    await connection.execute(`
      CREATE TABLE providers (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        company_name VARCHAR(160) NOT NULL,
        tax_id VARCHAR(50),
        phone VARCHAR(40),
        address TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✓ Tabla providers creada');
    
    // Refresh Tokens
    await connection.execute(`
      CREATE TABLE refresh_tokens (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        replaced_by_token VARCHAR(255),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await connection.execute('CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)');
    console.log('  ✓ Tabla refresh_tokens creada');
    
    // Audit Logs
    await connection.execute(`
      CREATE TABLE audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT,
        action VARCHAR(64) NOT NULL,
        entity_type VARCHAR(64),
        entity_id VARCHAR(64),
        details JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('  ✓ Tabla audit_logs creada');
    
    // Products
    await connection.execute(`
      CREATE TABLE products (
        id VARCHAR(50) PRIMARY KEY,
        sku VARCHAR(100) UNIQUE,
        name VARCHAR(160) NOT NULL,
        description TEXT,
        category ENUM('cafe', 'accesorio', 'merchandising') NOT NULL DEFAULT 'cafe',
        subcategory VARCHAR(80),
        origin VARCHAR(120),
        process VARCHAR(80),
        roast VARCHAR(80),
        price INTEGER NOT NULL,
        cost INTEGER,
        rating DECIMAL(3,1) DEFAULT 0,
        is_deal BOOLEAN DEFAULT FALSE,
        is_bestseller BOOLEAN DEFAULT FALSE,
        is_new BOOLEAN DEFAULT FALSE,
        is_fast BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        image_url TEXT,
        images JSON,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        stock_reserved INTEGER NOT NULL DEFAULT 0,
        stock_min INTEGER DEFAULT 0,
        weight DECIMAL(10,2),
        weight_unit ENUM('g', 'kg', 'ml', 'l', 'unidad') DEFAULT 'g',
        dimensions VARCHAR(100),
        meta_keywords TEXT,
        meta_description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.execute('CREATE INDEX idx_products_category ON products(category)');
    await connection.execute('CREATE INDEX idx_products_active ON products(is_active)');
    await connection.execute('CREATE INDEX idx_products_sku ON products(sku)');
    console.log('  ✓ Tabla products creada');
    
    // Inventory Movements
    await connection.execute(`
      CREATE TABLE inventory_movements (
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
    await connection.execute('CREATE INDEX idx_inv_movements_product ON inventory_movements(product_id)');
    await connection.execute('CREATE INDEX idx_inv_movements_type ON inventory_movements(movement_type)');
    await connection.execute('CREATE INDEX idx_inv_movements_date ON inventory_movements(created_at)');
    console.log('  ✓ Tabla inventory_movements creada');
    
    // Product Suppliers
    await connection.execute(`
      CREATE TABLE product_suppliers (
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
    
    // Product-Supplier Prices
    await connection.execute(`
      CREATE TABLE product_supplier_prices (
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
    await connection.execute('CREATE INDEX idx_prod_supplier_product ON product_supplier_prices(product_id)');
    await connection.execute('CREATE INDEX idx_prod_supplier_supplier ON product_supplier_prices(supplier_id)');
    console.log('  ✓ Tabla product_supplier_prices creada');
    
    // Lots
    await connection.execute(`
      CREATE TABLE lots (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(160),
        origin VARCHAR(160),
        farm VARCHAR(160),
        producer VARCHAR(160),
        altitude VARCHAR(60),
        variety VARCHAR(120),
        shade_system VARCHAR(120),
        climate VARCHAR(120),
        process VARCHAR(80),
        roast VARCHAR(80),
        harvest_date DATE,
        roast_date DATE,
        moisture VARCHAR(20),
        score DECIMAL(4,1),
        notes TEXT,
        product_id VARCHAR(50) NULL,
        estado ENUM('verde', 'tostado') NOT NULL DEFAULT 'verde',
        fecha_tostado DATE NULL,
        parent_lot_id BIGINT NULL,
        weight DECIMAL(10,2),
        weight_unit ENUM('g', 'kg') NOT NULL DEFAULT 'kg',
        aroma VARCHAR(255),
        flavor_notes VARCHAR(255),
        acidity VARCHAR(80),
        body VARCHAR(80),
        balance VARCHAR(80),
        presentation VARCHAR(120),
        grind VARCHAR(80),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (parent_lot_id) REFERENCES lots(id) ON DELETE SET NULL
      )
    `);
    await connection.execute('CREATE INDEX idx_lots_code ON lots(code)');
    await connection.execute('CREATE INDEX idx_lots_product ON lots(product_id)');
    await connection.execute('CREATE INDEX idx_lots_estado ON lots(estado)');
    await connection.execute('CREATE INDEX idx_lots_parent ON lots(parent_lot_id)');
    console.log('  ✓ Tabla lots creada');
    
    // Sales Tracking
    await connection.execute(`
      CREATE TABLE sales_tracking (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        ml_order_id BIGINT NOT NULL UNIQUE,
        purchase_date DATETIME NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        order_status VARCHAR(80),
        shipping_method VARCHAR(120),
        recipient_city VARCHAR(160),
        recipient_state VARCHAR(160),
        recipient_country VARCHAR(120),
        recipient_zip_code VARCHAR(20),
        latitude DECIMAL(10,8),
        longitude DECIMAL(10,8),
        products JSON NOT NULL,
        sync_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await connection.execute('CREATE INDEX idx_sales_ml_order_id ON sales_tracking(ml_order_id)');
    await connection.execute('CREATE INDEX idx_sales_purchase_date ON sales_tracking(purchase_date)');
    await connection.execute('CREATE INDEX idx_sales_city ON sales_tracking(recipient_city)');
    await connection.execute('CREATE INDEX idx_sales_state ON sales_tracking(recipient_state)');
    console.log('  ✓ Tabla sales_tracking creada');
    
    console.log('\n✅ Todas las tablas creadas exitosamente\n');
    
    // 3. CREAR usuario administrador
    console.log('👤 Creando usuario administrador...\n');
    
    const adminData = {
      name: 'Admin Dev',
      email: 'dev@dobleyo.cafe',
      password: 'D0bl3Y02026*',
      role: 'admin',
      mobile_phone: '3114769114'
    };
    
    const passwordHash = await hashPassword(adminData.password);
    
    await connection.execute(
      `INSERT INTO users (name, email, password_hash, role, mobile_phone, is_verified) 
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [adminData.name, adminData.email, passwordHash, adminData.role, adminData.mobile_phone]
    );
    
    console.log('✅ Usuario administrador creado:');
    console.log(`   Nombre: ${adminData.name}`);
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Teléfono: ${adminData.mobile_phone}`);
    console.log(`   Rol: ${adminData.role}`);
    console.log(`   Contraseña: ${adminData.password}\n`);
    
    console.log('🎉 RESET COMPLETADO EXITOSAMENTE\n');
    
  } catch (error) {
    console.error('❌ ERROR durante el reset:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Ejecutar
resetDatabase().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
