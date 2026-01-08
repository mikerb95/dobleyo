import { query } from '../db.js';
import 'dotenv/config';

export async function splitNameFields() {
  try {
    console.log('Starting migration: Split name into first_name and last_name...');

    // 1. Agregar columnas first_name y last_name
    console.log('Adding first_name and last_name columns...');
    await query(`
      ALTER TABLE users 
      ADD COLUMN first_name VARCHAR(60),
      ADD COLUMN last_name VARCHAR(60)
    `, []);
    console.log('✓ Columns added');

    // 2. Migrar datos del campo name actual
    console.log('Migrating existing names...');
    const result = await query('SELECT id, name FROM users WHERE name IS NOT NULL', []);
    
    let migratedCount = 0;
    for (const user of result.rows) {
      const nameParts = (user.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await query(
        'UPDATE users SET first_name = ?, last_name = ? WHERE id = ?',
        [firstName, lastName, user.id]
      );
      migratedCount++;
    }
    console.log(`✓ Migrated ${migratedCount} users`);

    console.log('✅ Migration completed successfully!');
    console.log('\nNotes:');
    console.log('- Old "name" column is still present for reference');
    console.log('- New columns: first_name, last_name');
    console.log('- You can manually drop the "name" column when ready');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  splitNameFields().then(() => {
    console.log('\nMigration script finished.');
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
