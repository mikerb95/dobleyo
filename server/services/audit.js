import { query } from '../db.js';
import { logger } from '../logger.js';

export async function logAudit(userId, action, entityType, entityId, details = {}) {
  try {
    if (!userId || !action || !entityType || !entityId) return null;

    const result = await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, entityType, String(entityId), JSON.stringify(details)]
    );
    return result;
  } catch (err) {
    logger.error({ err }, '[Audit] Error logging action:');
    return null;
  }
}

// Variante para eventos disparados por el sistema (webhooks, polling, jobs) sin
// un usuario autenticado detrás. user_id queda NULL; logAudit() normal exige un
// userId real y no debe modificarse para no alterar el comportamiento de sus
// demás llamadores.
export async function logSystemAudit(action, entityType, entityId, details = {}) {
  try {
    if (!action || !entityType || entityId == null) return null;

    const result = await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (NULL, ?, ?, ?, ?)`,
      [action, entityType, String(entityId), JSON.stringify(details)]
    );
    return result;
  } catch (err) {
    logger.error({ err }, '[Audit] Error logging system action:');
    return null;
  }
}

// Construye el WHERE compartido por el listado, el conteo y el resumen del
// registro de auditoría. Todos los valores van como parámetros posicionales.
//   q          busca en entity_id, email, nombre del usuario y details
//   days       ventana hacia atrás desde ahora (0 o null = sin límite)
//   hideSystem excluye los eventos sin usuario (jobs, webhooks)
export function buildAuditWhere(filters = {}) {
  const { action, entityType, userId, q, days, hideSystem } = filters;
  const clauses = [];
  const params = [];

  if (action)     { clauses.push('al.action = ?');      params.push(action); }
  if (entityType) { clauses.push('al.entity_type = ?'); params.push(entityType); }
  if (userId)     { clauses.push('al.user_id = ?');     params.push(userId); }
  if (hideSystem) { clauses.push('al.user_id IS NOT NULL'); }
  if (days) {
    clauses.push("al.created_at >= datetime('now', ?)");
    params.push(`-${Number(days)} days`);
  }
  if (q) {
    // Escapa los comodines de LIKE para que "50%" busque el texto literal.
    const like = `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    clauses.push(`(al.entity_id LIKE ? ESCAPE '\\'
                OR u.email LIKE ? ESCAPE '\\'
                OR (IFNULL(u.first_name, '') || ' ' || IFNULL(u.last_name, '')) LIKE ? ESCAPE '\\'
                OR al.details LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like);
  }

  return {
    sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

export async function getAuditLogs(filters = {}) {
  try {
    const { limit = 100, offset = 0 } = filters;
    const where = buildAuditWhere(filters);

    const sql = `
      SELECT al.id, al.user_id, u.email as user_email,
             u.first_name, u.last_name, u.role as user_role,
             al.action, al.entity_type, al.entity_id, al.details, al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1${where.sql}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ? OFFSET ?`;

    const result = await query(sql, [...where.params, Number(limit), Number(offset)]);
    return result.rows;
  } catch (err) {
    logger.error({ err }, '[Audit] Error getting logs:');
    return [];
  }
}

// Conteo total y desglose por tipo de acción con los mismos filtros del listado.
export async function getAuditSummary(filters = {}) {
  const where = buildAuditWhere(filters);
  const result = await query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN al.action = 'create' THEN 1 ELSE 0 END) AS creates,
            SUM(CASE WHEN al.action = 'update' THEN 1 ELSE 0 END) AS updates,
            SUM(CASE WHEN al.action = 'delete' THEN 1 ELSE 0 END) AS deletes,
            SUM(CASE WHEN al.user_id IS NULL THEN 1 ELSE 0 END) AS system
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1${where.sql}`,
    where.params
  );
  const r = result.rows[0] || {};
  const n = (v) => Number(v || 0);
  return { total: n(r.total), creates: n(r.creates), updates: n(r.updates), deletes: n(r.deletes), system: n(r.system) };
}

export async function getAuditStats() {
  try {
    const result = await query(`
      SELECT action, entity_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY action, entity_type
      ORDER BY count DESC
    `);
    return result.rows;
  } catch (err) {
    logger.error({ err }, '[Audit] Error getting stats:');
    return [];
  }
}
