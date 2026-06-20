import express from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import { apiLimiter } from '../middleware/rateLimit.js';
import { sendContactFormEmail } from '../services/email.js';
import { query } from '../db.js';

export const contactRouter = express.Router();

// Mapas legibles para el correo y el CRM (formulario B2B en inglés).
const COUNTRY_LABELS = {
  US: 'United States', CA: 'Canada', UK: 'United Kingdom', DE: 'Germany',
  NL: 'Netherlands', AU: 'Australia', JP: 'Japan', KR: 'South Korea', other: 'Other',
};
const VOLUME_LABELS = {
  samples: 'Samples only (for now)', '1-5': '1–5 MT/year', '5-20': '5–20 MT/year',
  '20-50': '20–50 MT/year', '50+': '50+ MT/year',
};
const INTEREST_LABELS = {
  'single-origin': 'Single Origin Lots', 'micro-lots': 'Micro Lots (86+ SCA)',
  blends: 'Blend Components', certified: 'Certified Coffees', custom: 'Custom Sourcing',
};

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
      await sendContactFormEmail({ name, email, phone, subject, message });

      res.json({ success: true, message: 'Mensaje recibido correctamente' });
    } catch (error) {
      logger.error('[POST /api/contact] Error:', error);
      res.status(500).json({ success: false, error: 'Error al procesar el mensaje' });
    }
  }
);
