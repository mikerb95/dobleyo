import { query } from '../db.js';

/**
 * Tablas del asistente con IA del panel (docs/plan-asistente.md).
 *
 * - `asistente_conversaciones`: una fila por conversación. `mensajes` es el
 *   historial de la API tal cual (solo por anexión) y `propuesta` la escritura
 *   que espera aprobación. Es el estado del bucle: la función serverless
 *   termina y la decisión llega en otra petición. Se purgan a los 30 días.
 * - `asistente_consumo`: una fila por llamada al modelo, con tokens y USD.
 *   De aquí sale el tope del día (por empresa y por usuario). No se purga.
 * - `asistente_auditoria`: cada decisión sobre una propuesta (quién pidió,
 *   quién decidió, antes y después, resultado). No se purga.
 * - `asistente_topes`: fila única con los topes diarios en USD, editables por
 *   el admin desde el panel.
 *
 * Idempotente: CREATE TABLE / INDEX IF NOT EXISTS e INSERT OR IGNORE.
 */
export async function createAsistenteTables() {
  await query(`CREATE TABLE IF NOT EXISTS asistente_conversaciones (
    id                     TEXT PRIMARY KEY,
    usuario_id             INTEGER NOT NULL,
    usuario_rol            TEXT NOT NULL,
    estado                 TEXT NOT NULL CHECK (estado IN ('corriendo', 'esperando_aprobacion', 'terminada', 'fallida')),
    pregunta               TEXT NOT NULL,
    mensajes               TEXT NOT NULL,
    propuesta              TEXT,
    respuesta              TEXT,
    error                  TEXT,
    aviso                  TEXT,
    turnos                 INTEGER NOT NULL DEFAULT 0,
    iteraciones            INTEGER NOT NULL DEFAULT 0,
    tokens_entrada         INTEGER NOT NULL DEFAULT 0,
    tokens_salida          INTEGER NOT NULL DEFAULT 0,
    tokens_cache_lectura   INTEGER NOT NULL DEFAULT 0,
    tokens_cache_escritura INTEGER NOT NULL DEFAULT 0,
    costo_usd              REAL NOT NULL DEFAULT 0,
    creada                 TEXT NOT NULL DEFAULT (datetime('now')),
    actualizada            TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_asistente_conv_usuario
    ON asistente_conversaciones(usuario_id, actualizada)`);

  await query(`CREATE TABLE IF NOT EXISTS asistente_consumo (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha                  TEXT NOT NULL DEFAULT (datetime('now')),
    dia                    TEXT NOT NULL,
    usuario_id             INTEGER NOT NULL,
    conversacion_id        TEXT NOT NULL,
    modelo                 TEXT NOT NULL,
    tokens_entrada         INTEGER NOT NULL DEFAULT 0,
    tokens_salida          INTEGER NOT NULL DEFAULT 0,
    tokens_cache_lectura   INTEGER NOT NULL DEFAULT 0,
    tokens_cache_escritura INTEGER NOT NULL DEFAULT 0,
    costo_usd              REAL NOT NULL DEFAULT 0
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_asistente_consumo_dia
    ON asistente_consumo(dia, usuario_id)`);

  await query(`CREATE TABLE IF NOT EXISTS asistente_auditoria (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha             TEXT NOT NULL DEFAULT (datetime('now')),
    conversacion_id   TEXT NOT NULL,
    herramienta       TEXT NOT NULL,
    pidio_usuario_id  INTEGER NOT NULL,
    decidio_usuario_id INTEGER NOT NULL,
    decision          TEXT NOT NULL CHECK (decision IN ('aprobada', 'rechazada')),
    entrada           TEXT NOT NULL,
    vista             TEXT,
    resultado         TEXT,
    ok                INTEGER NOT NULL DEFAULT 0
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_asistente_auditoria_fecha
    ON asistente_auditoria(fecha)`);

  await query(`CREATE TABLE IF NOT EXISTS asistente_topes (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    empresa_usd  REAL NOT NULL DEFAULT 3 CHECK (empresa_usd >= 0),
    usuario_usd  REAL NOT NULL DEFAULT 1 CHECK (usuario_usd >= 0),
    actualizado_por INTEGER,
    actualizado  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await query('INSERT OR IGNORE INTO asistente_topes (id, empresa_usd, usuario_usd) VALUES (1, 3, 1)');
}
