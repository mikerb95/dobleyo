import express from 'express';
import { body, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import crypto from 'crypto';
import {
  sendOrderConfirmationEmail,
  sendContactFormEmail,
  sendContactReplyEmail,
  sendVerificationEmail,
  sendNewsletterWelcomeEmail,
  sendNewsletterCampaign,
  renderCampaignPreview,
  suppressEmail,
} from '../services/email.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { authenticateToken, requireRole } from '../auth.js';
import { query } from '../db.js';
import { logAudit } from '../services/audit.js';

export const emailRouter = express.Router();

// ─── Webhook de Resend ──────────────────────────────────────────────────────
// Va antes del apiLimiter: Resend puede mandar ráfagas de eventos tras una campaña.
// Firma Svix: base64(HMAC-SHA256(secreto, "<id>.<timestamp>.<cuerpo crudo>")).
// El cuerpo crudo lo guarda express.json (verify) en req.rawBody, ver server/index.js.

const WEBHOOK_TOLERANCE_S = 5 * 60;

function verifyResendSignature(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  // Respaldo si el runtime ya consumió el stream antes de express.json: Resend envía
  // JSON compacto, así que re-serializarlo reproduce los mismos bytes.
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
  if (!secret) return false;
  const id = req.get('svix-id');
  const timestamp = req.get('svix-timestamp');
  const signatures = req.get('svix-signature');
  if (!id || !timestamp || !signatures) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > WEBHOOK_TOLERANCE_S) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${raw}`)
    .digest();

  // La cabecera puede traer varias firmas ("v1,<b64> v1,<b64>") durante una rotación de secreto.
  return signatures.split(' ').some((entry) => {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

emailRouter.post('/webhook', async (req, res) => {
  if (!verifyResendSignature(req)) {
    return res.status(401).json({ success: false, error: 'Firma inválida' });
  }

  try {
    const { type, data } = req.body ?? {};
    const recipients = Array.isArray(data?.to) ? data.to : [data?.to].filter(Boolean);

    if (type === 'email.bounced') {
      // Solo los rebotes permanentes (buzón inexistente, dominio inválido). Los
      // transitorios (buzón lleno, servidor caído) se reintentan solos.
      const bounceType = data?.bounce?.type;
      if (bounceType !== 'Transient') {
        for (const email of recipients) {
          await suppressEmail(email, 'bounced', data?.bounce?.message ?? bounceType ?? null);
        }
        logger.warn({ recipients, bounceType }, '[Resend webhook] Rebote permanente: destinatario suprimido');
      }
    } else if (type === 'email.complained') {
      for (const email of recipients) {
        await suppressEmail(email, 'complained', null);
        // Quien marca spam no quiere el boletín: se le da de baja de inmediato.
        await query('DELETE FROM newsletter_subscribers WHERE lower(email) = lower(?)', [email]);
      }
      logger.warn({ recipients }, '[Resend webhook] Queja de spam: destinatario suprimido y dado de baja');
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, '[POST /api/emails/webhook] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

emailRouter.use(apiLimiter);

// POST /api/emails/newsletter
emailRouter.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Correo inválido' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    let isNew = true;
    try {
      const result = await query(
        `INSERT INTO newsletter_subscribers (email, unsubscribe_token) VALUES (?, ?)
         ON CONFLICT (email) DO NOTHING`,
        [email, token]
      );
      isNew = result.rowsAffected > 0 || (result.rowCount ?? 0) > 0;
    } catch (dbErr) {
      logger.warn('[Newsletter] Error al guardar suscriptor:', dbErr.message);
    }

    if (isNew) {
      sendNewsletterWelcomeEmail(email, token).catch(err =>
        logger.warn('[Newsletter] Error al enviar email de bienvenida:', err.message)
      );
    }

    res.json({ success: true, message: '¡Suscrito! Revisa tu correo para el código de descuento.' });
  } catch (error) {
    logger.error('[POST /api/emails/newsletter] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// POST /api/emails/newsletter/unsubscribe?token=xxx
// Baja de un clic (RFC 8058): Gmail y Yahoo hacen este POST desde el botón
// "Cancelar suscripción" que muestran gracias a la cabecera List-Unsubscribe.
emailRouter.post('/newsletter/unsubscribe', async (req, res) => {
  try {
    const token = req.query.token || req.body?.token;
    if (!token) return res.status(400).json({ success: false, error: 'Se requiere token' });
    await query('DELETE FROM newsletter_subscribers WHERE unsubscribe_token = ?', [String(token)]);
    // Idempotente: si ya estaba de baja también es éxito para el proveedor de correo.
    res.json({ success: true, message: 'Desuscrito correctamente' });
  } catch (error) {
    logger.error('[POST /api/emails/newsletter/unsubscribe] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// GET /api/emails/newsletter/unsubscribe?token=xxx
emailRouter.get('/newsletter/unsubscribe', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (token) {
      const result = await query(
        `DELETE FROM newsletter_subscribers WHERE unsubscribe_token = ?`,
        [token]
      );
      const deleted = result.rowsAffected > 0 || (result.rowCount ?? 0) > 0;
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Token no válido o ya desuscrito' });
      }
      return res.json({ success: true, message: 'Desuscrito correctamente' });
    }

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Correo inválido' });
      }
      const result = await query(
        `DELETE FROM newsletter_subscribers WHERE email = ?`,
        [email]
      );
      const deleted = result.rowsAffected > 0 || (result.rowCount ?? 0) > 0;
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Correo no encontrado en la lista' });
      }
      return res.json({ success: true, message: 'Desuscrito correctamente' });
    }

    return res.status(400).json({ success: false, error: 'Se requiere token o email' });
  } catch (error) {
    logger.error('[GET /api/emails/newsletter/unsubscribe] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// POST /api/emails/account-confirmation (solo admin)
emailRouter.post('/account-confirmation', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { email, name, confirmationToken } = req.body;
    if (!email || !name || !confirmationToken) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    const result = await sendVerificationEmail(email, confirmationToken);
    if (result.success) return res.json({ success: true, message: 'Email de confirmación enviado' });
    return res.status(500).json({ error: 'Error al enviar email', details: result.error });
  } catch (error) {
    logger.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/order-confirmation (solo admin)
emailRouter.post('/order-confirmation', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { email, customerName, orderId, items, subtotal, shipping, total, shippingAddress } = req.body;
    if (!email || !customerName || !orderId || !items || !total) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    const orderData = {
      orderId, date: new Date().toISOString(), items,
      subtotal: subtotal || 0, shipping: shipping || 0, total,
      shippingAddress: shippingAddress || 'No especificada',
    };
    const result = await sendOrderConfirmationEmail(email, customerName, orderData);
    if (result.success) return res.json({ success: true, message: 'Email de confirmación de pedido enviado' });
    return res.status(500).json({ error: 'Error al enviar email', details: result.error });
  } catch (error) {
    logger.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/contact
emailRouter.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message, ip } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    const result = await sendContactFormEmail({ name, email, phone: phone || '', subject, message, ip: ip || req.ip });
    if (result.success) return res.json({ success: true, message: 'Mensaje enviado al administrador' });
    return res.status(500).json({ error: 'Error al enviar email', details: result.error });
  } catch (error) {
    logger.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/contact-reply (solo admin)
emailRouter.post('/contact-reply', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { email, clientName, message } = req.body;
    if (!email || !clientName || !message) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    const result = await sendContactReplyEmail(email, clientName, message);
    if (result.success) return res.json({ success: true, message: 'Email de respuesta enviado' });
    return res.status(500).json({ error: 'Error al enviar email', details: result.error });
  } catch (error) {
    logger.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Campañas del boletín (solo admin) ──────────────────────────────────────

const campaignValidators = [
  body('subject').trim().isLength({ min: 3, max: 150 }).withMessage('Asunto requerido (máx. 150 caracteres)'),
  body('heading').trim().isLength({ min: 3, max: 150 }).withMessage('Título requerido (máx. 150 caracteres)'),
  body('preheader').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('body').trim().isLength({ min: 10, max: 20000 }).withMessage('El contenido debe tener al menos 10 caracteres'),
  body('ctaLabel').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
  body('ctaUrl').optional({ values: 'falsy' }).trim().isURL({ protocols: ['https'], require_protocol: true }).withMessage('El enlace del botón debe empezar por https://'),
  body('testEmail').optional({ values: 'falsy' }).trim().isEmail().withMessage('Correo de prueba inválido'),
];

const pickCampaign = (b) => ({
  subject: b.subject,
  heading: b.heading,
  preheader: b.preheader || '',
  body: b.body,
  ctaLabel: b.ctaLabel || '',
  ctaUrl: b.ctaUrl || '',
});

// GET /api/emails/newsletter/stats
emailRouter.get('/newsletter/stats', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const [subs, suppressed, campaigns] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM newsletter_subscribers'),
      query('SELECT COUNT(*) AS total FROM email_suppressions').catch(() => ({ rows: [{ total: 0 }] })),
      query(`SELECT id, subject, status, recipients, sent_count, failed_count, created_at, sent_at
             FROM newsletter_campaigns ORDER BY id DESC LIMIT 20`).catch(() => ({ rows: [] })),
    ]);
    res.json({
      success: true,
      data: {
        subscribers: Number(subs.rows[0]?.total ?? 0),
        suppressed: Number(suppressed.rows[0]?.total ?? 0),
        campaigns: campaigns.rows,
        resendConfigured: !!process.env.RESEND_API_KEY,
      },
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/emails/newsletter/stats] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// POST /api/emails/newsletter/preview → HTML de la campaña tal como llegará
emailRouter.post('/newsletter/preview', authenticateToken, requireRole('admin'), campaignValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  res.json({ success: true, data: { html: renderCampaignPreview(pickCampaign(req.body)) } });
});

// POST /api/emails/newsletter/campaign
// Con testEmail envía solo una prueba a esa dirección; sin él, a todos los suscriptores.
emailRouter.post('/newsletter/campaign', authenticateToken, requireRole('admin'), campaignValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

  const campaign = pickCampaign(req.body);

  try {
    if (req.body.testEmail) {
      const r = await sendNewsletterCampaign(
        { ...campaign, subject: `[Prueba] ${campaign.subject}` },
        [{ email: req.body.testEmail, unsubscribe_token: null }],
        `test-${crypto.randomUUID()}`
      );
      if (!r.sent) return res.status(502).json({ success: false, error: 'No se pudo enviar la prueba' });
      return res.json({ success: true, data: { test: true, ...r } });
    }

    const subs = await query('SELECT email, unsubscribe_token FROM newsletter_subscribers ORDER BY id');
    if (!subs.rows.length) return res.status(400).json({ success: false, error: 'No hay suscriptores' });

    const created = await query(
      `INSERT INTO newsletter_campaigns (subject, heading, preheader, body, cta_label, cta_url, recipients, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [campaign.subject, campaign.heading, campaign.preheader || null, campaign.body,
       campaign.ctaLabel || null, campaign.ctaUrl || null, subs.rows.length, req.user.id]
    );
    const campaignId = created.rows[0].id;

    const r = await sendNewsletterCampaign(campaign, subs.rows, campaignId);
    const status = r.failed === 0 ? 'sent' : r.sent > 0 ? 'partial' : 'failed';
    await query(
      `UPDATE newsletter_campaigns SET status = ?, sent_count = ?, failed_count = ?, sent_at = datetime('now') WHERE id = ?`,
      [status, r.sent, r.failed, campaignId]
    );
    await logAudit(req.user.id, 'send', 'newsletter_campaign', campaignId, { subject: campaign.subject, ...r });

    res.json({ success: true, data: { campaignId, status, ...r } });
  } catch (err) {
    logger.error({ err }, '[POST /api/emails/newsletter/campaign] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// GET /api/emails/suppressions → correos bloqueados por rebote o queja
emailRouter.get('/suppressions', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const r = await query('SELECT email, reason, detail, created_at, updated_at FROM email_suppressions ORDER BY updated_at DESC LIMIT 200');
    res.json({ success: true, data: r.rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/emails/suppressions] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// DELETE /api/emails/suppressions/:email → desbloquear (p. ej. el cliente corrigió su buzón)
emailRouter.delete('/suppressions/:email', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const r = await query('DELETE FROM email_suppressions WHERE email = ?', [req.params.email.toLowerCase()]);
    if (!r.rowCount) return res.status(404).json({ success: false, error: 'Correo no encontrado en la lista' });
    await logAudit(req.user.id, 'delete', 'email_suppression', req.params.email.toLowerCase(), {});
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, '[DELETE /api/emails/suppressions/:email] Error:');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// GET /api/emails/health
emailRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    resendConfigured: !!process.env.RESEND_API_KEY,
    webhookConfigured: !!process.env.RESEND_WEBHOOK_SECRET,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'No configurado',
  });
});

export default emailRouter;
