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

// ─── POST /api/contact/export ───────────────────────────────────────────────
// Solicitud de cotización B2B/exportación (landing en inglés). Guarda el lead en
// el CRM (cuenta + contacto + interacción 'quote') y notifica al equipo de export.
contactRouter.post('/export',
  apiLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('company').trim().notEmpty().withMessage('Company required'),
    body('email').isEmail().withMessage('Valid business email required'),
    body('phone').optional().trim(),
    body('country').trim().notEmpty().withMessage('Country required'),
    body('volume').optional().trim(),
    body('interest').optional().trim(),
    body('message').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, company, email, phone, country, volume, interest, message } = req.body;
    const countryLabel = COUNTRY_LABELS[country] || country;
    const volumeLabel = VOLUME_LABELS[volume] || volume || '—';
    const interestLabel = INTEREST_LABELS[interest] || interest || '—';
    const segment = country === 'US' ? 'importer_us' : 'other';

    let stored = false;
    // 1) Guardar como lead en el CRM (best-effort: no debe bloquear la notificación).
    try {
      const found = await query(
        'SELECT id FROM crm_accounts WHERE lower(legal_name) = lower(?) AND country = ? LIMIT 1',
        [company, country]
      );
      let accountId;
      if (found.rows.length) {
        accountId = Number(found.rows[0].id);
      } else {
        const ins = await query(
          `INSERT INTO crm_accounts (legal_name, display_name, segment, country, source, pipeline_stage, notes)
           VALUES (?, ?, ?, ?, 'web_export_en', 'prospect', ?)`,
          [company, company, segment, country,
           `Volume: ${volumeLabel} · Interest: ${interestLabel}`]
        );
        accountId = Number(ins.lastInsertRowid);
      }

      // Contacto (primary solo si la cuenta aún no tiene uno).
      const hasPrimary = await query(
        'SELECT 1 FROM crm_contacts WHERE account_id = ? AND is_primary = 1 LIMIT 1', [accountId]
      );
      await query(
        `INSERT INTO crm_contacts (account_id, full_name, role, email, phone, is_primary)
         VALUES (?, ?, 'Buyer', ?, ?, ?)`,
        [accountId, name, email, phone ?? null, hasPrimary.rows.length ? 0 : 1]
      );

      // Interacción tipo cotización.
      await query(
        `INSERT INTO crm_interactions (account_id, kind, subject, body, metadata)
         VALUES (?, 'quote', ?, ?, ?)`,
        [accountId, `Export inquiry — ${company} (${countryLabel})`, message || null,
         JSON.stringify({ volume, interest, country, source: 'web_export_en' })]
      );
      stored = true;
    } catch (err) {
      logger.error({ err }, '[POST /api/contact/export] CRM');
    }

    // 2) Notificar al equipo de export por correo.
    let emailed = false;
    try {
      const body = [
        `New B2B / export inquiry from the English site.`,
        ``,
        `Company: ${company}`,
        `Contact: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || '—'}`,
        `Country: ${countryLabel}`,
        `Estimated volume: ${volumeLabel}`,
        `Primary interest: ${interestLabel}`,
        ``,
        `Message:`,
        message || '(none)',
      ].join('\n');
      await sendContactFormEmail({
        name, email, phone,
        subject: `Export inquiry — ${company} (${countryLabel})`,
        message: body,
      });
      emailed = true;
    } catch (err) {
      logger.error({ err }, '[POST /api/contact/export] email');
    }

    if (!stored && !emailed) {
      return res.status(500).json({ success: false, error: 'Could not process your inquiry' });
    }
    res.json({ success: true, message: 'Inquiry received' });
  }
);
