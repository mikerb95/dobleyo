import * as db from './db.js';
import * as auth from './auth.js';

const ADMIN_EMAIL = 'admin@dobleyo.com';
const ADMIN_PASS = 'admin123'; // Change this in production!

async function createAdmin() {
  console.log('Creating admin user...');
  try {
    // Check if exists
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
    
    if (existing.rows.length > 0) {
      console.log('Admin user already exists.');
      // Update password just in case
      const hash = await auth.hashPassword(ADMIN_PASS);
      await db.query('UPDATE users SET password_hash = ?, role = ?, is_verified = TRUE WHERE email = ?', [hash, 'admin', ADMIN_EMAIL]);
      console.log('Admin password and role updated.');
    } else {
      const hash = await auth.hashPassword(ADMIN_PASS);
      await db.query(
        'INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, ?)',
        [ADMIN_EMAIL, hash, 'Admin DobleYo', 'admin', true]
      );
      console.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();
