import mysql from 'mysql2/promise';
import 'dotenv/config';

let pool = null;

try {
  if (!process.env.DATABASE_URL) {
    console.error("CRITICAL: DATABASE_URL is missing in environment variables.");
  } else {
    // Parse DATABASE_URL manually to ensure options are applied correctly
    const dbUrl = new URL(process.env.DATABASE_URL);
    
    pool = mysql.createPool({
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
    console.log("Database pool initialized successfully.");
  }
} catch (err) {
  console.error("CRITICAL: Failed to initialize database pool:", err.message);
}

// Wrapper compatible con la interfaz anterior (pero params es array)
export const query = async (text, params) => {
  if (!pool) {
    throw new Error("Database connection is not initialized. Check server logs for 'CRITICAL' errors.");
  }
  const [rows, fields] = await pool.execute(text, params);
  return { rows, fields };
};

export const getClient = () => {
  if (!pool) {
    throw new Error("Database connection is not initialized.");
  }
  return pool.getConnection();
};
