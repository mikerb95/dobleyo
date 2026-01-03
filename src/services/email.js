import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev'; // Usar dominio verificado en prod

export const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.SITE_BASE_URL || 'http://localhost:4000'}/verify-email.html?token=${token}`;

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verifica tu cuenta en DobleYo',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Bienvenido a DobleYo</h2>
          <p>Gracias por registrarte. Para activar tu cuenta y acceder a todas las funciones, por favor verifica tu correo electrónico.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verificar mi cuenta</a>
          </div>
          <p style="color: #666; font-size: 14px;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
        </div>
      `
    });
    return { success: true, data };
  } catch (error) {
    console.error('Error enviando email:', error);
    return { success: false, error };
  }
};
