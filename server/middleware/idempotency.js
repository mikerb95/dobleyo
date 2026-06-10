// Idempotencia para mutaciones de la cola offline móvil.
// Si el POST trae `client_op_id`, un reintento con el mismo ID devuelve la
// respuesta original guardada en `client_operations` en vez de re-ejecutar.
// Los requests sin client_op_id (web) pasan sin tocarse.
import { query } from '../db.js';
import { logger } from '../logger.js';

// Un `pending` más viejo que esto se considera huérfano (el proceso murió
// antes de completar) y el reintento puede tomar posesión y re-ejecutar.
const STALE_PENDING_MINUTES = 2;
const RETENTION_DAYS = 30;

export async function idempotency(req, res, next) {
  const opId = req.body?.client_op_id;
  if (req.method !== 'POST' || typeof opId !== 'string' || !opId) return next();

  try {
    await query(
      'INSERT INTO client_operations (client_op_id, user_id, endpoint) VALUES (?, ?, ?)',
      [opId, req.user.id, req.originalUrl]
    );
  } catch (err) {
    if (!/UNIQUE constraint failed/i.test(err.message ?? '')) {
      logger.error({ err }, '[idempotency] Error registrando operación');
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
    return replayOrConflict(opId, req, res, next);
  }

  // Limpieza oportunista de operaciones viejas (tabla pequeña, delete barato).
  query(`DELETE FROM client_operations WHERE created_at < datetime('now', '-${RETENTION_DAYS} days')`, [])
    .catch((err) => logger.warn({ err }, '[idempotency] Error en limpieza'));

  captureResponse(opId, res);
  next();
}

// Ya existe una fila con este client_op_id: decidir entre devolver la
// respuesta guardada, tomar posesión de un pending huérfano, o 409.
async function replayOrConflict(opId, req, res, next) {
  try {
    const result = await query(
      'SELECT status, status_code, response_json, user_id FROM client_operations WHERE client_op_id = ?',
      [opId]
    );
    const op = result.rows[0];
    if (!op) return res.status(409).json({ success: false, error: 'Operación en curso. Intente de nuevo.' });

    // Un client_op_id es del usuario que lo creó; otro usuario no puede leerlo.
    if (op.user_id !== req.user.id) {
      return res.status(409).json({ success: false, error: 'Identificador de operación en conflicto.' });
    }

    if (op.status === 'done') {
      return res.status(op.status_code ?? 200).json(JSON.parse(op.response_json));
    }

    // pending: tomar posesión solo si quedó huérfano (proceso anterior murió).
    const takeover = await query(
      `UPDATE client_operations SET created_at = datetime('now')
       WHERE client_op_id = ? AND status = 'pending' AND created_at < datetime('now', '-${STALE_PENDING_MINUTES} minutes')`,
      [opId]
    );
    if ((takeover.rowCount ?? 0) > 0) {
      captureResponse(opId, res);
      return next();
    }
    return res.status(409).json({ success: false, error: 'Operación en curso. Intente de nuevo.' });
  } catch (err) {
    logger.error({ err }, '[idempotency] Error consultando operación');
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

// Envuelve res.json para guardar la respuesta ANTES de enviarla: en
// serverless el proceso puede congelarse al terminar la respuesta, y un
// 'done' no persistido haría que el reintento duplique la operación.
function captureResponse(opId, res) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode;
    const persist = status < 400
      ? query(
          "UPDATE client_operations SET status = 'done', status_code = ?, response_json = ? WHERE client_op_id = ?",
          [status, JSON.stringify(body), opId]
        )
      // Errores 4xx/5xx: liberar el ID para que el reintento re-ejecute
      // (la operación de negocio no escribió nada).
      : query('DELETE FROM client_operations WHERE client_op_id = ?', [opId]);

    persist
      .catch((err) => logger.error({ err }, '[idempotency] Error persistiendo resultado'))
      .finally(() => originalJson(body));
    return res;
  };
}
