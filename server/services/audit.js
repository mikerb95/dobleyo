const db = require('../db');

/**
 * Registrar una acción en el audit_logs
 * @param {number} userId - ID del usuario que realiza la acción
 * @param {string} action - Tipo de acción (create, update, delete, harvest, store, roast_send, roast_receive)
 * @param {string} entityType - Tipo de entidad (product, user, inventory, harvest, roast)
 * @param {string} entityId - ID de la entidad afectada
 * @param {object} details - Detalles adicionales de la acción (JSON)
 */
async function logAudit(userId, action, entityType, entityId, details = {}) {
  try {
    if (!userId || !action || !entityType || !entityId) {
      console.warn('[Audit] Missing required parameters:', { userId, action, entityType, entityId });
      return null;
    }

    const { query } = require('../db');
    
    const result = await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, JSON.stringify(details)]
    );

    return result;
  } catch (err) {
    console.error('[Audit] Error logging action:', err);
    // No lanzar error, solo registrar - no queremos que falle la acción principal
    return null;
  }
}

/**
 * Obtener logs de auditoría con filtros
 */
async function getAuditLogs(filters = {}) {
  try {
    const { query } = require('../db');
    const { action, entityType, userId, limit = 100, offset = 0 } = filters;

    let sql = `
      SELECT 
        al.id,
        al.user_id,
        u.email as user_email,
        u.first_name,
        u.last_name,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];

    if (action) {
      sql += ` AND al.action = ?`;
      params.push(action);
    }

    if (entityType) {
      sql += ` AND al.entity_type = ?`;
      params.push(entityType);
    }

    if (userId) {
      sql += ` AND al.user_id = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  } catch (err) {
    console.error('[Audit] Error getting logs:', err);
    return [];
  }
}

/**
 * Obtener estadísticas de auditoría
 */
async function getAuditStats() {
  try {
    const { query } = require('../db');

    const result = await query(`
      SELECT 
        action,
        entity_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY action, entity_type
      ORDER BY count DESC
    `);

    return result.rows;
  } catch (err) {
    console.error('[Audit] Error getting stats:', err);
    return [];
  }
}

module.exports = {
  logAudit,
  getAuditLogs,
  getAuditStats
};