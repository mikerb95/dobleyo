import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

let pool = null;

try {
  if (!process.env.DATABASE_URL) {
    console.error("CRITICAL: DATABASE_URL is missing in environment variables.");
  } else {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // SSL requerido para Supabase/Neon/Railway
      max: 5, // Límite bajo para entornos serverless
    });
    console.log("Database pool (PostgreSQL) initialized successfully.");
  }
} catch (err) {
  console.error("CRITICAL: Failed to initialize database pool:", err.message);
}

// Wrapper de consulta — compatible con $1, $2 placeholders de PostgreSQL
export const query = async (text, params) => {
  if (!pool) {
    throw new Error("Database connection is not initialized. Check server logs for 'CRITICAL' errors.");
  }
  const { rows, fields } = await pool.query(text, params);
  return { rows, fields };
};

// Obtiene un cliente dedicado para transacciones
export const getClient = async () => {
  if (!pool) {
    throw new Error("Database connection is not initialized.");
  }
  return pool.connect();
};
