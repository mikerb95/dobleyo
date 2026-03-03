import pg from 'pg';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Proteger en producción
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Endpoint no disponible en producción' });
  }

  const logs = [];
  const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

  const email = req.query.email || 'admin@dobleyo.cafe';
  const password = req.query.password || 'admin123';

  let client;
  try {
    log(`Testing login for: ${email}`);

    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');

    client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    log('Connected to DB.');

    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      log('User NOT found.');
      await client.end();
      return res.status(200).json({ status: 'Failed', reason: 'User not found', logs });
    }

    const user = result.rows[0];
    log(`User found: ID=${user.id}, Role=${user.role}`);

    const match = await bcrypt.compare(password, user.password_hash);
    log(`Password match: ${match}`);

    await client.end();
    res.status(200).json({ status: match ? 'Success' : 'Failed', reason: match ? 'Login OK' : 'Wrong Password', logs });

  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (client) try { await client.end(); } catch (_) {}
    res.status(200).json({ status: 'Error', error: error.message, logs });
  }
}
