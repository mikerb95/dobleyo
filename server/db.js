import { createClient } from '@libsql/client';
import 'dotenv/config';

if (!process.env.TURSO_DATABASE_URL) {
  console.error('[db] CRITICAL: TURSO_DATABASE_URL no está definido en las variables de entorno.');
}

const libsqlClient = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log(`[db] Cliente Turso/libSQL inicializado — url: ${(process.env.TURSO_DATABASE_URL || 'file:local.db').substring(0, 40)}`);

// ── Wrapper de consulta ───────────────────────────────────────────────────────
// Mantiene la misma interfaz que el wrapper pg anterior: { rows, rowCount, lastInsertRowid }
export const query = async (sql, args = []) => {
  const start = Date.now();

  try {
    const result = await libsqlClient.execute({ sql, args: args ?? [] });

    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(`[db] Query lenta (${duration}ms): ${sql.substring(0, 80)}...`);
      }
    }

    return {
      rows: result.rows,
      rowCount: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid,
    };
  } catch (err) {
    console.error(`[db] Error en query: ${err.message} | SQL: ${sql.substring(0, 120)}`);
    throw new Error(err.message);
  }
};

// ── Cliente dedicado para transacciones explícitas ────────────────────────────
// Intercepta BEGIN/COMMIT/ROLLBACK y los traduce a la API de transacciones libSQL.
// Compatible con el patrón legacy que usa finance.js.
export const getClient = async () => {
  const tx = await libsqlClient.transaction('write');
  let finished = false;

  const txQuery = async (sql, args = []) => {
    const normalized = sql.trim().toUpperCase();
    if (normalized === 'BEGIN') return { rows: [], rowCount: 0 };
    if (normalized === 'COMMIT') {
      if (!finished) { finished = true; await tx.commit(); }
      return { rows: [], rowCount: 0 };
    }
    if (normalized === 'ROLLBACK') {
      if (!finished) { finished = true; await tx.rollback(); }
      return { rows: [], rowCount: 0 };
    }
    const result = await tx.execute({ sql, args });
    return {
      rows: result.rows,
      rowCount: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid,
    };
  };

  return {
    query: txQuery,
    release: async () => {
      if (!finished) { finished = true; try { await tx.rollback(); } catch {} }
    },
  };
};

// ── Helper para transacciones ─────────────────────────────────────────────────
// Uso: await withTransaction(async (client) => { await client.query(...); });
export const withTransaction = async (fn) => {
  const tx = await libsqlClient.transaction('write');
  const txQuery = async (sql, args = []) => {
    const result = await tx.execute({ sql, args });
    return {
      rows: result.rows,
      rowCount: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid,
    };
  };
  try {
    const result = await fn({ query: txQuery });
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};

// ── Health check ──────────────────────────────────────────────────────────────
export const healthCheck = async () => {
  try {
    const start = Date.now();
    await libsqlClient.execute('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export default libsqlClient;
