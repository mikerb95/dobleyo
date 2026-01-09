import { query } from '../db.js';

export async function addOriginFieldsToCoffeeHarvests() {
  try {
    // Check if columns exist
    const columns = await query('DESCRIBE coffee_harvests', []);
    const existingColumns = columns.rows.map(col => col.Field);

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
