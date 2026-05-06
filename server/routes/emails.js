import express from 'express';
import crypto from 'crypto';
import {
  sendOrderConfirmationEmail,
  sendContactFormEmail,
  sendContactReplyEmail,
  sendVerificationEmail,
  sendNewsletterWelcomeEmail,
} from '../services/email.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { authenticateToken, requireRole } from '../auth.js';
import { query } from '../db.js';

export const emailRouter = express.Router();

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
      console.warn('[Newsletter] Error al guardar suscriptor:', dbErr.message);
    }

    if (isNew) {
      sendNewsletterWelcomeEmail(email, token).catch(err =>
        console.warn('[Newsletter] Error al enviar email de bienvenida:', err.message)
      );
    }

    res.json({ success: true, message: '¡Suscrito! Revisa tu correo para el código de descuento.' });
  } catch (error) {
    console.error('[POST /api/emails/newsletter] Error:', error);
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
    console.error('[GET /api/emails/newsletter/unsubscribe] Error:', error);
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
    console.error('Error:', error);
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
    console.error('Error:', error);
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
    console.error('Error:', error);
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
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/health
emailRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    resendConfigured: !!process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'No configurado',
  });
});

export default emailRouter;
