import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../db/schema.sql');

async function initDb() {
  console.log('Initializing database...');
  
  try {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    // Split by semicolon, but ignore empty lines
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        // Skip comments only lines
        if (statement.startsWith('--')) continue;
        
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.query(statement);
      } catch (err) {
        // Ignore "Duplicate key" or "Index already exists" errors to make it idempotent
        if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('  -> Already exists, skipping.');
        } else {
          console.error('  -> Error:', err.message);
          // Don't exit, try next statement
        }
      }
    }
    
    console.log('Database initialization complete.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

initDb();
