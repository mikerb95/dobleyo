import { query } from '../db.js';

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
    console.error('[Audit] Error logging action:', err);
    return null;
  }
}

export async function getAuditLogs(filters = {}) {
  try {
    const { action, entityType, userId, limit = 100, offset = 0 } = filters;

    let sql = `
      SELECT al.id, al.user_id, u.email as user_email,
             u.first_name, u.last_name,
             al.action, al.entity_type, al.entity_id, al.details, al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action)     { params.push(action);      sql += ' AND al.action = ?'; }
    if (entityType) { params.push(entityType);  sql += ' AND al.entity_type = ?'; }
    if (userId)     { params.push(userId);       sql += ' AND al.user_id = ?'; }

    params.push(Number(limit), Number(offset));
    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';

    const result = await query(sql, params);
    return result.rows;
  } catch (err) {
    console.error('[Audit] Error getting logs:', err);
    return [];
  }
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
    console.error('[Audit] Error getting stats:', err);
    return [];
  }
}
