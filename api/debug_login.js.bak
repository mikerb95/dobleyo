import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Proteger en producción
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Endpoint no disponible en producción' });
  }

  const logs = [];
  const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

  const email = req.query.email || 'admin@dobleyo.com';
  const password = req.query.password || 'admin123';

  try {
    log(`Testing login for: ${email}`);

    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

    const dbUrl = new URL(process.env.DATABASE_URL);
    const connection = await mysql.createConnection({
      host: dbUrl.hostname,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1),
      port: Number(dbUrl.port),
      ssl: { rejectUnauthorized: false }
    });
    log("Connected to DB.");

    const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      log("User NOT found.");
      await connection.end();
      return res.status(200).json({ status: "Failed", reason: "User not found", logs });
    }

    const user = rows[0];
    log(`User found: ID=${user.id}, Role=${user.role}`);

    const match = await bcrypt.compare(password, user.password_hash);
    log(`Password match: ${match}`);

    await connection.end();
    res.status(200).json({ status: match ? "Success" : "Failed", reason: match ? "Login OK" : "Wrong Password", logs });

  } catch (error) {
    log(`ERROR: ${error.message}`);
    res.status(200).json({ status: "Error", error: error.message, logs });
  }
}
