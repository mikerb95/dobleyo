import { query } from '../db.js';

export async function addOriginFieldsToCoffeeHarvests() {
  try {
    // Obtener columnas existentes usando information_schema de PostgreSQL
    const columns = await query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'coffee_harvests' AND table_schema = 'public'`,
      []
    );
    const existingColumns = columns.rows.map(col => col.column_name);

    // Add region column if it doesn't exist
    if (!existingColumns.includes('region')) {
      await query(
        'ALTER TABLE coffee_harvests ADD COLUMN region VARCHAR(80)',
        []
      );
      console.log('✅ Added region column to coffee_harvests');
    }

    // Add altitude column if it doesn't exist
    if (!existingColumns.includes('altitude')) {
      await query(
        'ALTER TABLE coffee_harvests ADD COLUMN altitude INT',
        []
      );
      console.log('✅ Added altitude column to coffee_harvests');
    }

    console.log('✅ Origin fields migration completed');
  } catch (err) {
    console.error('Error adding origin fields:', err);
    throw err;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addOriginFieldsToCoffeeHarvests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
