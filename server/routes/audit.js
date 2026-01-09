import express from 'express';
import * as auth from '../auth.js';
import { query } from '../db.js';
import { logAudit, getAuditLogs, getAuditStats } from '../services/audit.js';

const auditRouter = express.Router();

// GET /api/audit/logs - Obtener logs de auditoría (solo admin)
auditRouter.get('/logs', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const { action, entity_type, user_id, limit = 100, offset = 0 } = req.query;

    const filters = {
      action: action || null,
      entityType: entity_type || null,
      userId: user_id ? parseInt(user_id) : null,
      limit: Math.min(parseInt(limit) || 100, 500),
      offset: parseInt(offset) || 0
    };

    const logs = await getAuditLogs(filters);
    
    // Contar total de registros
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (filters.action) {
      countSql += ` AND action = ?`;
      countParams.push(filters.action);
    }
    if (filters.entityType) {
      countSql += ` AND entity_type = ?`;
      countParams.push(filters.entityType);
    }
    if (filters.userId) {
      countSql += ` AND user_id = ?`;
      countParams.push(filters.userId);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult.rows[0].total;

    res.json({
      logs,
      total,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (err) {
    console.error('[GET /api/audit/logs] Error:', err);
    res.status(500).json({ error: 'Error al obtener logs de auditoría' });
  }
});

// GET /api/audit/stats - Obtener estadísticas de auditoría (solo admin)
auditRouter.get('/stats', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const stats = await getAuditStats();
    res.json({ stats });
  } catch (err) {
    console.error('[GET /api/audit/stats] Error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/audit/actions - Obtener lista de acciones disponibles (solo admin)
auditRouter.get('/actions', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT action FROM audit_logs ORDER BY action`
    );

    const actions = result.rows.map(r => r.action);
    res.json({ actions });
  } catch (err) {
    console.error('[GET /api/audit/actions] Error:', err);
    res.status(500).json({ error: 'Error al obtener acciones' });
  }
});

export default auditRouter;
