import express from 'express';
import { logger } from '../logger.js';
import * as auth from '../auth.js';
import { query } from '../db.js';
import { getAuditLogs, getAuditStats, getAuditSummary } from '../services/audit.js';

const auditRouter = express.Router();

// Lee los filtros del querystring. days admite 1, 7, 30, 90 o 0 (sin límite).
const ALLOWED_DAYS = new Set([0, 1, 7, 30, 90]);
function parseAuditFilters(q) {
  const days = Number.parseInt(q.days, 10);
  return {
    action: q.action || null,
    entityType: q.entity_type || null,
    userId: q.user_id ? Number.parseInt(q.user_id, 10) || null : null,
    q: typeof q.q === 'string' && q.q.trim() ? q.q.trim().slice(0, 100) : null,
    days: ALLOWED_DAYS.has(days) ? days : null,
    hideSystem: q.hide_system === '1' || q.hide_system === 'true',
  };
}

// GET /api/audit/logs - Registro paginado y filtrado en el servidor (solo admin)
auditRouter.get('/logs', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const filters = {
      ...parseAuditFilters(req.query),
      limit: Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 500),
      offset: Math.max(Number.parseInt(req.query.offset, 10) || 0, 0),
    };

    const [logs, summary] = await Promise.all([
      getAuditLogs(filters),
      getAuditSummary(filters),
    ]);

    res.json({
      success: true,
      logs,
      total: summary.total,
      summary,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/audit/logs] Error:');
    res.status(500).json({ success: false, error: 'Error al obtener logs de auditoría' });
  }
});

// GET /api/audit/entity-types - Tipos de entidad presentes en el registro (solo admin)
auditRouter.get('/entity-types', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type`
    );
    res.json({ success: true, entityTypes: result.rows.map((r) => r.entity_type) });
  } catch (err) {
    logger.error({ err }, '[GET /api/audit/entity-types] Error:');
    res.status(500).json({ success: false, error: 'Error al obtener tipos de entidad' });
  }
});

// GET /api/audit/stats - Obtener estadísticas de auditoría (solo admin)
auditRouter.get('/stats', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const stats = await getAuditStats();
    res.json({ stats });
  } catch (err) {
    logger.error({ err }, '[GET /api/audit/stats] Error:');
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
    logger.error({ err }, '[GET /api/audit/actions] Error:');
    res.status(500).json({ error: 'Error al obtener acciones' });
  }
});

export default auditRouter;
