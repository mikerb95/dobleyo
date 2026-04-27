import { query } from '../db.js';

export async function createCoffeeTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS coffee_harvests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lot_id TEXT UNIQUE NOT NULL,
        farm TEXT NOT NULL,
        variety TEXT NOT NULL,
        climate TEXT NOT NULL,
        process TEXT NOT NULL,
        aroma TEXT NOT NULL,
        taste_notes TEXT NOT NULL,
        region TEXT,
        altitude INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_coffee_harvests_lot_id ON coffee_harvests(lot_id)');

    await query(`
      CREATE TABLE IF NOT EXISTS green_coffee_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        harvest_id INTEGER NOT NULL REFERENCES coffee_harvests(id),
        lot_id TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        location TEXT NOT NULL,
        storage_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_green_coffee_lot_id ON green_coffee_inventory(lot_id)');

    await query(`
      CREATE TABLE IF NOT EXISTS roasting_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lot_id TEXT NOT NULL,
        quantity_sent_kg REAL NOT NULL,
        target_temp INTEGER,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'in_roasting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_roasting_batches_lot_id ON roasting_batches(lot_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_roasting_batches_status ON roasting_batches(status)');

    await query(`
      CREATE TABLE IF NOT EXISTS roasted_coffee (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roasting_id INTEGER NOT NULL REFERENCES roasting_batches(id),
        roast_level TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        weight_loss_percent REAL NOT NULL,
        actual_temp INTEGER,
        roast_time_minutes INTEGER,
        observations TEXT,
        status TEXT NOT NULL DEFAULT 'ready_for_storage',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_roasted_coffee_status ON roasted_coffee(status)');

    await query(`
      CREATE TABLE IF NOT EXISTS roasted_coffee_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roasted_id INTEGER NOT NULL REFERENCES roasted_coffee(id),
        location TEXT NOT NULL,
        container_type TEXT NOT NULL,
        container_count INTEGER NOT NULL,
        storage_conditions TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'ready_for_packaging',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_roasted_inventory_status ON roasted_coffee_inventory(status)');

    await query(`
      CREATE TABLE IF NOT EXISTS packaged_coffee (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roasted_storage_id INTEGER NOT NULL REFERENCES roasted_coffee_inventory(id),
        acidity INTEGER NOT NULL,
        body INTEGER NOT NULL,
        balance INTEGER NOT NULL,
        score REAL NOT NULL,
        presentation TEXT NOT NULL,
        grind_size TEXT,
        package_size TEXT NOT NULL,
        unit_count INTEGER NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'ready_for_sale',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS idx_packaged_coffee_status ON packaged_coffee(status)');

    console.log('✅ Coffee tables created successfully');
  } catch (err) {
    console.error('Error creating coffee tables:', err);
    throw err;
  }
}

if (process.argv[1].endsWith('create_coffee_tables.js')) {
  import('dotenv/config').then(() =>
    createCoffeeTables().then(() => process.exit(0)).catch(() => process.exit(1))
  );
}
