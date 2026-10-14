import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import * as db from '../db.js';
import * as auth from '../auth.js';
import { sendCaficultorDecisionEmail } from '../services/email.js';

// Avisa al solicitante la decisión sobre su solicitud (fire-and-forget).
async function notifyDecision(userId, approved, reason) {
  const u = await db.query('SELECT email, first_name FROM users WHERE id = ?', [userId]);
  if (!u.rows.length) return;
  const r = await sendCaficultorDecisionEmail(u.rows[0].email, u.rows[0].first_name, { approved, reason });
  if (!r.success) logger.error({ err: r.error, userId }, '[caficultor] No se pudo enviar el correo de decisión');
}

export const caficultorRouter = Router();

// Get all pending caficultor applications (ADMIN ONLY)
caficultorRouter.get('/applications',
  auth.authenticateToken,
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          ca.id,
          ca.user_id,
          ca.farm_name,
          ca.region,
          ca.altitude,
          ca.hectares,
          ca.varieties_cultivated,
          ca.certifications,
          ca.description,
          ca.status,
          ca.created_at,
          u.name,
          u.email
        FROM caficultor_applications ca
        JOIN users u ON ca.user_id = u.id
        ORDER BY ca.created_at DESC
      `);
      res.json({ applications: result.rows });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Error al obtener solicitudes' });
    }
  }
);

// Get single caficultor application details (ADMIN ONLY)
caficultorRouter.get('/applications/:id',
  auth.authenticateToken,
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          ca.*,
          u.name,
          u.email,
          reviewer.name as reviewed_by_name
        FROM caficultor_applications ca
        JOIN users u ON ca.user_id = u.id
        LEFT JOIN users reviewer ON ca.reviewed_by = reviewer.id
        WHERE ca.id = ?
      `, [req.params.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Aplicación no encontrada' });
      }
      res.json({ application: result.rows[0] });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Error al obtener aplicación' });
    }
  }
);

// Approve caficultor application (ADMIN ONLY)
caficultorRouter.post('/applications/:id/approve',
  auth.authenticateToken,
  auth.requireRole('admin'),
  body('notes').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { notes } = req.body;
    const appId = req.params.id;
    const adminId = req.user.id;

    try {
      // Obtener la aplicación y el usuario
      const appResult = await db.query(
        'SELECT user_id FROM caficultor_applications WHERE id = ?',
        [appId]
      );
      
      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Aplicación no encontrada' });
      }

      const userId = appResult.rows[0].user_id;

      // Actualizar aplicación
      await db.query(
        "UPDATE caficultor_applications SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), admin_notes = ? WHERE id = ?",
        [adminId, notes || null, appId]
      );

      // Actualizar usuario: cambiar role a caficultor y status a approved
      await db.query(
        'UPDATE users SET role = "caficultor", caficultor_status = "approved" WHERE id = ?',
        [userId]
      );

      // Log de auditoria
      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [adminId, 'APPROVE_CAFICULTOR', 'caficultor_applications', String(appId), JSON.stringify({ approved_user_id: userId })]
      );

      notifyDecision(userId, true).catch((err) => logger.error({ err }, '[caficultor] Error notificando aprobación'));

      res.json({ message: 'Solicitud de caficultor aprobada' });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Error al aprobar solicitud' });
    }
  }
);

// Reject caficultor application (ADMIN ONLY)
caficultorRouter.post('/applications/:id/reject',
  auth.authenticateToken,
  auth.requireRole('admin'),
  body('reason').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reason } = req.body;
    const appId = req.params.id;
    const adminId = req.user.id;

    try {
      // Obtener la aplicación
      const appResult = await db.query(
        'SELECT user_id FROM caficultor_applications WHERE id = ?',
        [appId]
      );
      
      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Aplicación no encontrada' });
      }

      const userId = appResult.rows[0].user_id;

      // Actualizar aplicación
      await db.query(
        "UPDATE caficultor_applications SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), admin_notes = ? WHERE id = ?",
        [adminId, reason, appId]
      );

      // Actualizar usuario: cambiar status a rejected (mantiene role client)
      await db.query(
        'UPDATE users SET caficultor_status = "rejected" WHERE id = ?',
        [userId]
      );

      // Log de auditoria
      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [adminId, 'REJECT_CAFICULTOR', 'caficultor_applications', String(appId), JSON.stringify({ rejected_user_id: userId, reason })]
      );

      // El motivo se guarda como nota interna; solo llega al solicitante si el admin
      // lo pide explícitamente con share_reason.
      notifyDecision(userId, false, req.body.share_reason === true ? reason : null)
        .catch((err) => logger.error({ err }, '[caficultor] Error notificando rechazo'));

      res.json({ message: 'Solicitud de caficultor rechazada' });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
  }
);
