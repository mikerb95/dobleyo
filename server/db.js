import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// ── Detectar si estamos en entorno serverless ─────────────────────────────────
// En Vercel serverless cada instancia de función es de corta duración.
// En desarrollo (node server/index.js) el proceso es persistente.
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

// ── Configuración del pool ────────────────────────────────────────────────────
//
// Con PgBouncer (Transaction mode) delante:
//   - max: bajo, ya que PgBouncer maneja el pool real hacia PostgreSQL.
//     En serverless cada instancia de función vive ~segundos; 2 conexiones
//     por instancia es más que suficiente.
//   - idleTimeoutMillis: breve para cerrar conexiones rápido al final de la
//     invocación y no agotar el pool de PgBouncer.
//   - allowExitOnIdle: true → el proceso puede terminar limpiamente en serverless
//     sin esperar a que expiren todas las conexiones idle.
//
// Sin PgBouncer (conexión directa):
//   - max: 5 — límite conservador para no saturar PostgreSQL directamente.
//
// Eliminar parámetros SSL de la URL para evitar conflicto con pg v8:
// cuando el connection string tiene ?sslmode=require y se pasa ssl:{} por config,
// pg puede activar validación de certificado ignorando rejectUnauthorized.
const _rawUrl = process.env.DATABASE_URL || '';
const _cleanUrl = _rawUrl.replace(/[?&]sslmode=[^&]*/gi, '').replace(/[?&]ssl=[^&]*/gi, '').replace(/[?&]$/, '');

const POOL_CONFIG = {
  connectionString: _cleanUrl || undefined,

  ssl: _cleanUrl
    ? {
        // Aiven usa certificado auto-firmado. rejectUnauthorized: false lo acepta
        // sin necesidad de incluir el CA cert en el bundle.
        rejectUnauthorized: false,
      }
    : false,

  // Tamaño del pool por instancia de función/proceso
  max: IS_SERVERLESS ? 2 : 5,

  // Cerrar conexiones idle rápido en serverless (ms)
  idleTimeoutMillis: IS_SERVERLESS ? 10_000 : 30_000,

  // Tiempo máximo de espera para obtener una conexión del pool (ms)
  connectionTimeoutMillis: 8_000,

  // Tiempo máximo de vida de una conexión individual (ms)
  // Evita mantener conexiones "rancias" que Aiven podría cerrar por idle
  maxLifetimeSeconds: 900, // 15 min

  // Permitir que el proceso Node.js termine aunque haya conexiones idle
  // (crítico en Vercel serverless para no dejar instancias colgadas)
  allowExitOnIdle: true,
};

let pool = null;

function createPool() {
  if (!_cleanUrl) {
    console.error('[db] CRITICAL: DATABASE_URL no está definido en las variables de entorno.');
    return null;
  }

  try {
    const p = new Pool(POOL_CONFIG);

    // Log de errores de pool (conexiones perdidas, timeouts, etc.)
    p.on('error', (err) => {
      console.error('[db] Error inesperado en cliente idle del pool:', err.message);
    });

    p.on('connect', () => {
      if (!IS_SERVERLESS) {
        console.log('[db] Nueva conexión abierta en el pool.');
      }
    });

    console.log(
      `[db] Pool PostgreSQL inicializado — max: ${POOL_CONFIG.max} conexión(es), ` +
      `modo: ${IS_SERVERLESS ? 'serverless' : 'standalone'}`
    );

    return p;
  } catch (err) {
    console.error('[db] CRITICAL: No se pudo inicializar el pool:', err.message);
    return null;
  }
}

// Pool único por proceso (se reutiliza entre invocaciones en warm lambdas)
pool = createPool();

// ── Wrapper de consulta ───────────────────────────────────────────────────────
//
// Notas de compatibilidad con PgBouncer Transaction mode:
//   - No usar SET/RESET a nivel de sesión fuera de una transacción explícita.
//   - No usar LISTEN/NOTIFY.
//   - No usar prepared statements con nombre (pg lo hace internamente solo con
//     pg.Client.query({ name: '...' }) — el pool.query() estándar usa el
//     protocolo simple y es compatible.
//
export const query = async (text, params) => {
  if (!pool) {
    throw new Error('[db] Pool no inicializado. Revisa DATABASE_URL y los logs de arranque.');
  }

  const start = Date.now();

  try {
    const result = await pool.query(text, params);

    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(`[db] Query lenta (${duration}ms): ${text.substring(0, 80)}...`);
      }
    }

    return { rows: result.rows, fields: result.fields };
  } catch (err) {
    // Re-lanzar con contexto de la query para facilitar el debugging
    const msg = `[db] Error en query: ${err.message} | SQL: ${text.substring(0, 120)}`;
    console.error(msg);
    throw new Error(err.message);
  }
};

// ── Cliente dedicado para transacciones explícitas ────────────────────────────
//
// Uso:
//   const client = await getClient();
//   try {
//     await client.query('BEGIN');
//     await client.query('INSERT INTO ...');
//     await client.query('COMMIT');
//   } catch (e) {
//     await client.query('ROLLBACK');
//     throw e;
//   } finally {
//     client.release();  // ← SIEMPRE liberar el cliente
//   }
//
export const getClient = async () => {
  if (!pool) {
    throw new Error('[db] Pool no inicializado.');
  }
  return pool.connect();
};

// ── Helper para transacciones ─────────────────────────────────────────────────
// Evita el patrón BEGIN/COMMIT/ROLLBACK manual. Úsalo para operaciones que
// deben ser atómicas (ej: packaging + inventory movement).
//
// Ejemplo:
//   const result = await withTransaction(async (client) => {
//     const r = await client.query('INSERT INTO ...', [...]);
//     await client.query('UPDATE ...', [...]);
//     return r.rows[0];
//   });
//
export const withTransaction = async (fn) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Health check ──────────────────────────────────────────────────────────────
export const healthCheck = async () => {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    return { ok: true, latencyMs: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export default pool;
