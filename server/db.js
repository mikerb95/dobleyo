import mysql from 'mysql2/promise';
import 'dotenv/config';

// Parse DATABASE_URL manually to ensure options are applied correctly
const dbUrl = new URL(process.env.DATABASE_URL);

const pool = mysql.createPool({
  host: dbUrl.hostname,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  port: Number(dbUrl.port),
  ssl: { rejectUnauthorized: false }, // Force SSL for Aiven
  waitForConnections: true,
  connectionLimit: 5, // Lower limit for serverless
  queueLimit: 0
});

// Wrapper compatible con la interfaz anterior (pero params es array)
export const query = async (text, params) => {
  const [rows, fields] = await pool.execute(text, params);
  return { rows, fields };
};

export const getClient = () => pool.getConnection();
