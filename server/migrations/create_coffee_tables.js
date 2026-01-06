import { query } from '../db.js';

export async function createCoffeeTables() {
  try {
    // 1. Tabla de cosechas (recolección en finca)
    await query(`
      CREATE TABLE IF NOT EXISTS coffee_harvests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        lot_id VARCHAR(30) UNIQUE NOT NULL,
        farm VARCHAR(100) NOT NULL,
        variety VARCHAR(50) NOT NULL,
        climate VARCHAR(50) NOT NULL,
        process VARCHAR(50) NOT NULL,
        aroma TEXT NOT NULL,
        taste_notes TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lot_id (lot_id)
      )
    `, []);

    // 2. Tabla de inventario de café verde
    await query(`
      CREATE TABLE IF NOT EXISTS green_coffee_inventory (
        id INT PRIMARY KEY AUTO_INCREMENT,
        harvest_id INT NOT NULL,
        lot_id VARCHAR(30) NOT NULL,
        weight_kg DECIMAL(10, 2) NOT NULL,
        location VARCHAR(100) NOT NULL,
        storage_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvest_id) REFERENCES coffee_harvests(id),
        INDEX idx_lot_id (lot_id)
      )
    `, []);

    // 3. Tabla de lotes en tostión
    await query(`
      CREATE TABLE IF NOT EXISTS roasting_batches (
        id INT PRIMARY KEY AUTO_INCREMENT,
        lot_id VARCHAR(30) NOT NULL,
        quantity_sent_kg DECIMAL(10, 2) NOT NULL,
        target_temp INT,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'in_roasting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lot_id (lot_id),
        INDEX idx_status (status)
      )
    `, []);

    // 4. Tabla de café tostado
    await query(`
      CREATE TABLE IF NOT EXISTS roasted_coffee (
        id INT PRIMARY KEY AUTO_INCREMENT,
        roasting_id INT NOT NULL,
        roast_level VARCHAR(50) NOT NULL,
        weight_kg DECIMAL(10, 2) NOT NULL,
        weight_loss_percent DECIMAL(5, 2) NOT NULL,
        actual_temp INT,
        roast_time_minutes INT,
        observations TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ready_for_storage',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roasting_id) REFERENCES roasting_batches(id),
        INDEX idx_status (status)
      )
    `, []);

    // 5. Tabla de inventario de café tostado
    await query(`
      CREATE TABLE IF NOT EXISTS roasted_coffee_inventory (
        id INT PRIMARY KEY AUTO_INCREMENT,
        roasted_id INT NOT NULL,
        location VARCHAR(100) NOT NULL,
        container_type VARCHAR(50) NOT NULL,
        container_count INT NOT NULL,
        storage_conditions TEXT,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ready_for_packaging',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roasted_id) REFERENCES roasted_coffee(id),
        INDEX idx_status (status)
      )
    `, []);

    // 6. Tabla de café empacado para venta
    await query(`
      CREATE TABLE IF NOT EXISTS packaged_coffee (
        id INT PRIMARY KEY AUTO_INCREMENT,
        roasted_storage_id INT NOT NULL,
        acidity INT NOT NULL,
        body INT NOT NULL,
        balance INT NOT NULL,
        score DECIMAL(3, 2) NOT NULL,
        presentation VARCHAR(50) NOT NULL,
        grind_size VARCHAR(100),
        package_size VARCHAR(50) NOT NULL,
        unit_count INT NOT NULL,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ready_for_sale',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roasted_storage_id) REFERENCES roasted_coffee_inventory(id),
        INDEX idx_status (status)
      )
    `, []);

    console.log('✅ Coffee tables created successfully');
  } catch (err) {
    console.error('Error creating coffee tables:', err);
    throw err;
  }
}
