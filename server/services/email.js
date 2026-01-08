import { Resend } from 'resend';

// Initialize Resend only if key is present to avoid crashes
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@dobleyo.cafe';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'DobleYo Café';

export const sendVerificationEmail = async (email, token) => {
  if (!resend) {
    console.log('Mock Email sent to:', email, 'Token:', token);
    return { success: true, mock: true };
  }
  const verifyUrl = `${process.env.SITE_BASE_URL || 'https://dobleyo.cafe'}/verify-email?token=${token}`;

  try {
    const data = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: '🎉 Confirma tu cuenta en DobleYo Café',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Lora', Georgia, serif; color: #1f1f1f; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f7f3ef; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #251a14; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #251a14; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>☕ DobleYo Café</h1>
            </div>
            <div class="content">
              <h2>¡Bienvenido a DobleYo!</h2>
              <p>Gracias por registrarte. Para activar tu cuenta y acceder a todas las funciones, por favor verifica tu correo electrónico.</p>
              
              <center>
                <a href="${verifyUrl}" class="button">Verificar mi Cuenta</a>
              </center>
              
              <p style="color: #666; font-size: 14px;">
                O copia este enlace en tu navegador:<br>
                <code style="background: #f5f5f5; padding: 8px; border-radius: 4px; display: inline-block; font-size: 12px;">${verifyUrl}</code>
              </p>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
            </div>
            <div class="footer">
              <p>© 2026 DobleYo Café. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    return { success: true, data };
  } catch (error) {
    console.error('Error enviando email de verificación:', error);
    return { success: false, error };
  }
};

// Email de confirmación de pedido
export const sendOrderConfirmationEmail = async (email, customerName, orderData) => {
  if (!resend) {
    console.log('Mock Order Email sent to:', email);
    return { success: true, mock: true };
  }

  try {
    const itemsHTML = orderData.items
      .map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e6e6e6;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e6e6e6; text-align: right;">x${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e6e6e6; text-align: right;">$${item.price.toLocaleString('es-CO')}</td>
        </tr>
      `)
      .join('');

    const data = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `📦 Confirmación de pedido #${orderData.orderId}`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Lora', Georgia, serif; color: #1f1f1f; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f7f3ef; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #251a14; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .order-info { background: #f9fafb; padding: 15px; border-left: 4px solid #c67b4e; margin: 20px 0; border-radius: 4px; }
            .order-table { width: 100%; margin: 20px 0; }
            .order-table th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #e6e6e6; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>☕ DobleYo Café</h1>
            </div>
            <div class="content">
              <h2>¡Gracias por tu pedido, ${customerName}!</h2>
              <p>Tu pedido ha sido confirmado y será procesado pronto.</p>
              
              <div class="order-info">
                <strong style="color: #251a14;">Número de Pedido:</strong> #${orderData.orderId}<br>
                <strong style="color: #251a14;">Fecha:</strong> ${new Date(orderData.date).toLocaleDateString('es-CO')}<br>
                <strong style="color: #251a14;">Estado:</strong> <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Confirmado</span>
              </div>
              
              <h3 style="color: #251a14; border-bottom: 2px solid #e6e6e6; padding-bottom: 10px;">Resumen del Pedido</h3>
              
              <table class="order-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="text-align: right;">Cant.</th>
                    <th style="text-align: right;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong>Subtotal:</strong>
                  <span>$${orderData.subtotal.toLocaleString('es-CO')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong>Envío:</strong>
                  <span>$${orderData.shipping.toLocaleString('es-CO')}</span>
                </div>
                <hr style="border: none; border-top: 1px solid #d1d1d1;">
                <div style="display: flex; justify-content: space-between; font-size: 16px;">
                  <strong style="color: #251a14;">Total:</strong>
                  <strong style="color: #c67b4e;">$${orderData.total.toLocaleString('es-CO')}</strong>
                </div>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                <strong>Dirección de Envío:</strong><br>
                ${orderData.shippingAddress}
              </p>
              
              <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e6e6e6; font-size: 13px; color: #777;">
                Pronto recibirás un email con el número de seguimiento. Si tienes preguntas, contáctanos.
              </p>
            </div>
            <div class="footer">
              <p>© 2026 DobleYo Café. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error enviando email de confirmación de pedido:', error);
    return { success: false, error };
  }
};

// Email de contacto (al admin)
export const sendContactFormEmail = async (contactData) => {
  if (!resend) {
    console.log('Mock Contact Email sent:', contactData);
    return { success: true, mock: true };
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@dobleyo.cafe';
    
    const data = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: adminEmail,
      replyTo: contactData.email,
      subject: `📧 Nuevo mensaje de contacto: ${contactData.name}`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Lora', Georgia, serif; color: #1f1f1f; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f7f3ef; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #251a14; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .info-box { background: #fffbf7; padding: 15px; border-left: 4px solid #c67b4e; margin: 15px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>☕ DobleYo Café</h1>
              <p style="color: #777; margin: 0;">Nuevo Mensaje de Contacto</p>
            </div>
            <div class="content">
              <h2 style="color: #251a14; margin-top: 0;">Tienes un nuevo mensaje</h2>
              
              <div class="info-box">
                <strong style="color: #251a14;">Nombre:</strong> ${contactData.name}<br>
                <strong style="color: #251a14;">Email:</strong> <a href="mailto:${contactData.email}">${contactData.email}</a><br>
                <strong style="color: #251a14;">Teléfono:</strong> ${contactData.phone || 'No proporcionado'}<br>
                <strong style="color: #251a14;">Asunto:</strong> ${contactData.subject}
              </div>
              
              <h3 style="color: #251a14;">Mensaje:</h3>
              <p style="background: #f9fafb; padding: 15px; border-radius: 4px; white-space: pre-wrap;">
                ${contactData.message}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e6e6e6; margin: 20px 0;">
              
              <p style="font-size: 12px; color: #777;">
                <strong>Enviado:</strong> ${new Date().toLocaleString('es-CO')}<br>
                <strong>Desde IP:</strong> ${contactData.ip || 'N/A'}
              </p>
            </div>
            <div class="footer">
              <p>© 2026 DobleYo Café. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error enviando email de contacto:', error);
    return { success: false, error };
  }
};

// Email de respuesta al cliente
export const sendContactReplyEmail = async (email, clientName, replyMessage) => {
  if (!resend) {
    console.log('Mock Reply Email sent to:', email);
    return { success: true, mock: true };
  }

  try {
    const data = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: '📧 Respuesta a tu mensaje de contacto - DobleYo Café',
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Lora', Georgia, serif; color: #1f1f1f; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f7f3ef; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #251a14; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>☕ DobleYo Café</h1>
            </div>
            <div class="content">
              <h2>Hola ${clientName},</h2>
              <p>Gracias por tu mensaje. Aquí está nuestra respuesta:</p>
              
              <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #c67b4e; border-radius: 4px; margin: 20px 0;">
                <p style="white-space: pre-wrap; margin: 0;">
                  ${replyMessage}
                </p>
              </div>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                Si tienes más preguntas, no dudes en contactarnos nuevamente.
              </p>
            </div>
            <div class="footer">
              <p>© 2026 DobleYo Café. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error enviando email de respuesta:', error);
    return { success: false, error };
  }
};

