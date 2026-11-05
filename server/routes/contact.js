import express from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import { apiLimiter } from '../middleware/rateLimit.js';
import { sendContactFormEmail, sendContactAcknowledgementEmail } from '../services/email.js';
import { notifyContactMessage } from '../services/alerts.js';

export const contactRouter = express.Router();

// PROTECCIÓN: Rate limit en contacto público
// POST - Enviar mensaje de contacto
contactRouter.post('/',
  apiLimiter,
  [
    body('name').trim().notEmpty().withMessage('Nombre requerido'),
    body('email').isEmail().withMessage('Correo inválido'),
    body('subject').trim().notEmpty().withMessage('Asunto requerido'),
    body('message').trim().isLength({ min: 10 }).withMessage('Mensaje muy corto'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, phone, subject, message } = req.body;

      // Enviar email al admin vía Resend (BUG-008 — antes solo console.log)
      const sent = await sendContactFormEmail({ name, email, phone, subject, message, ip: req.ip });
      if (!sent.success) logger.error({ err: sent.error }, '[POST /api/contact] No se pudo enviar el mensaje al equipo');
      notifyContactMessage({ name, email, subject, message });
      sendContactAcknowledgementEmail(email, name, subject)
        .catch((err) => logger.error({ err }, '[POST /api/contact] Error enviando acuse de recibo'));

      res.json({ success: true, message: 'Mensaje recibido correctamente' });
    } catch (error) {
      logger.error('[POST /api/contact] Error:', error);
      res.status(500).json({ success: false, error: 'Error al procesar el mensaje' });
    }
  }
);
