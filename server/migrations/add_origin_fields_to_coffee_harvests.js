import { query } from '../db.js';

export async function addOriginFieldsToCoffeeHarvests() {
  const cols = [
    { name: 'region',   sql: 'ALTER TABLE coffee_harvests ADD COLUMN region TEXT' },
    { name: 'altitude', sql: 'ALTER TABLE coffee_harvests ADD COLUMN altitude INTEGER' },
  ];
  for (const col of cols) {
    try {
      await query(col.sql);
      console.log('✅ Added', col.name, 'to coffee_harvests');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⊗', col.name, 'ya existe');
      } else {
        throw err;
      }
    }
  }
  console.log('✅ Origin fields migration completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  import('dotenv/config').then(() =>
    addOriginFieldsToCoffeeHarvests().then(() => process.exit(0)).catch(err => {
      console.error(err); process.exit(1);
    })
  );
}
