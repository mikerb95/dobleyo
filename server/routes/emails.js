import express from 'express';
import {
  sendOrderConfirmationEmail,
  sendContactFormEmail,
  sendContactReplyEmail,
  sendVerificationEmail
} from '../services/email.js';

export const emailRouter = express.Router();

// POST /api/emails/account-confirmation
emailRouter.post('/account-confirmation', async (req, res) => {
  try {
    const { email, name, confirmationToken } = req.body;

    if (!email || !name || !confirmationToken) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const confirmationLink = `${process.env.SITE_BASE_URL}/verify-email?token=${confirmationToken}`;
    const result = await sendVerificationEmail(email, confirmationToken);

    if (result.success) {
      return res.json({ success: true, message: 'Email de confirmación enviado' });
    } else {
      return res.status(500).json({ error: 'Error al enviar email', details: result.error });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/order-confirmation
emailRouter.post('/order-confirmation', async (req, res) => {
  try {
    const { email, customerName, orderId, items, subtotal, shipping, total, shippingAddress } = req.body;

    if (!email || !customerName || !orderId || !items || !total) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const orderData = {
      orderId,
      date: new Date().toISOString(),
      items,
      subtotal: subtotal || 0,
      shipping: shipping || 0,
      total,
      shippingAddress: shippingAddress || 'No especificada'
    };

    const result = await sendOrderConfirmationEmail(email, customerName, orderData);

    if (result.success) {
      return res.json({ success: true, message: 'Email de confirmación de pedido enviado' });
    } else {
      return res.status(500).json({ error: 'Error al enviar email', details: result.error });
    }
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

    const contactData = {
      name,
      email,
      phone: phone || '',
      subject,
      message,
      ip: ip || req.ip
    };

    const result = await sendContactFormEmail(contactData);

    if (result.success) {
      return res.json({ success: true, message: 'Mensaje de contacto enviado al administrador' });
    } else {
      return res.status(500).json({ error: 'Error al enviar email', details: result.error });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/emails/contact-reply
emailRouter.post('/contact-reply', async (req, res) => {
  try {
    const { email, clientName, message } = req.body;

    if (!email || !clientName || !message) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const result = await sendContactReplyEmail(email, clientName, message);

    if (result.success) {
      return res.json({ success: true, message: 'Email de respuesta enviado al cliente' });
    } else {
      return res.status(500).json({ error: 'Error al enviar email', details: result.error });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/health (para verificar que el servicio funciona)
emailRouter.get('/health', (req, res) => {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  return res.json({
    status: 'ok',
    resendConfigured: hasApiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'No configurado'
  });
});

export default emailRouter;
