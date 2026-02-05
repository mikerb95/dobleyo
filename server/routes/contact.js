import express from 'express';
import { apiLimiter } from '../middleware/rateLimit.js';

export const contactRouter = express.Router();

// PROTECCIÓN: Rate limit en contacto público
// POST - Enviar mensaje de contacto
contactRouter.post('/', apiLimiter, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validación básica
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nombre, email, asunto y mensaje son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email inválido' 
      });
    }

    // TODO: Aquí puedes implementar:
    // 1. Guardar el mensaje en la BD
    // 2. Enviar email a través de Resend
    // 3. Notificar al equipo

    // Por ahora, solo logueamos
    console.log('Mensaje de contacto recibido:', {
      name,
      email,
      phone,
      subject,
      message,
      timestamp: new Date().toISOString()
    });

    // Simular envío exitoso
    res.json({
      success: true,
      message: 'Mensaje recibido correctamente'
    });

  } catch (error) {
    console.error('Error procesando mensaje de contacto:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al procesar el mensaje' 
    });
  }
});
