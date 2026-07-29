import 'dotenv/config';
import jwt from 'jsonwebtoken';
const { query } = await import('./server/db.js');
const { rows } = await query("SELECT id, role FROM users WHERE role='admin' LIMIT 1");
if (!rows.length) { console.error('NO_ADMIN'); process.exit(1); }
process.stdout.write(jwt.sign({ id: Number(rows[0].id), role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: '15m' }));
