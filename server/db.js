import mysql from 'mysql2/promise';
import 'dotenv/config';

// Parse DATABASE_URL (mysql://user:pass@host:port/db)
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Wrapper compatible con la interfaz anterior (pero params es array)
export const query = async (text, params) => {
  const [rows, fields] = await pool.execute(text, params);
  return { rows, fields };
};

export const getClient = () => pool.getConnection();
