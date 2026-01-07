import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as db from '../db.js';
import * as auth from '../auth.js';

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
      console.error(err);
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
      console.error(err);
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
        'UPDATE caficultor_applications SET status = "approved", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE id = ?',
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

      res.json({ message: 'Solicitud de caficultor aprobada' });
    } catch (err) {
      console.error(err);
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
        'UPDATE caficultor_applications SET status = "rejected", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE id = ?',
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

      res.json({ message: 'Solicitud de caficultor rechazada' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al rechazar solicitud' });
    }
  }
);
