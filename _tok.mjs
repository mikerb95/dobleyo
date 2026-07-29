import 'dotenv/config';
import jwt from 'jsonwebtoken';
const { query } = await import('./server/db.js');
const { rows } = await query("SELECT id, email, role FROM users WHERE role='admin' LIMIT 1");
if (!rows.length) { console.error('NO_ADMIN'); process.exit(1); }
const u = rows[0];
console.error('admin id:', u.id);
process.stdout.write(jwt.sign({ id: Number(u.id), role: u.role }, process.env.JWT_SECRET, { expiresIn: '15m' }));
