import { Resend } from 'resend';
import { logger } from '../logger.js';
import { query } from '../db.js';

// Servicio central de correo (Resend).
//
// Todas las funciones devuelven { success, id?, mock?, skipped?, error? } y nunca
// lanzan: el SDK de Resend tampoco lanza ante un rechazo (responde { data, error }),
// así que quien necesite saber si el correo salió debe revisar `success`.
//
// Sin RESEND_API_KEY el servicio funciona en modo simulado: registra el envío en el
// log y responde success con mock: true (útil en desarrollo y en tests).

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@dobleyo.cafe';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'DobleYo Café';
const REPLY_TO = process.env.RESEND_REPLY_TO || process.env.ADMIN_EMAIL || undefined;
const SITE_URL = (process.env.SITE_BASE_URL || 'https://dobleyo.cafe').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dobleyo.cafe';

// Resend admite hasta 100 correos por llamada de batch.
const BATCH_SIZE = 100;

// Paleta de marca. Los clientes de correo no soportan variables CSS, por eso los
// colores viven aquí (mismos valores que :root en public/assets/css/styles.css).
const C = {
  espresso: '#2b1d15',
  cream: '#f6f1ea',
  caramel: '#b4642f',
  caramelTint: '#f7ece3',
  leaf: '#3e5d3a',
  leafBg: '#eaf0e6',
  danger: '#a33d2a',
  dangerBg: '#fbeae5',
  muted: '#6f6259',
  line: '#e8e0d6',
  white: '#ffffff',
};

const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Escapa texto para insertarlo en HTML. Todo dato que venga de un usuario pasa por aquí. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Texto multilínea → HTML con saltos de línea, escapado. */
const escMultiline = (value) => esc(value).replace(/\r?\n/g, '<br>');

const cop = (v) => `$${Number(v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || '';

const greeting = (name) => (firstNameOf(name) ? `Hola ${esc(firstNameOf(name))},` : 'Hola,');

/** Versión de texto plano a partir del HTML (la parte text/plain del correo). */
function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|tr|div|table)>/gi, '\n\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Bloques de la plantilla ─────────────────────────────────────────────────

function button(url, label) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
      <tr><td style="border-radius:8px;background:${C.espresso};">
        <a href="${esc(url)}" style="display:inline-block;padding:14px 32px;font-family:${FONT_BODY};font-size:15px;font-weight:600;color:${C.white};text-decoration:none;border-radius:8px;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

/** Caja de datos clave/valor con fondo tintado. `rows`: [[etiqueta, valorHTML], ...] */
function infoBox(rows, tone = 'neutral') {
  const bg = tone === 'danger' ? C.dangerBg : tone === 'success' ? C.leafBg : C.caramelTint;
  const body = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:4px 0;font-size:14px;color:${C.muted};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
        <td style="padding:4px 0 4px 16px;font-size:14px;color:${C.espresso};font-weight:600;">${value}</td>
      </tr>`)
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:10px;margin:20px 0;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${body}</table>
      </td></tr>
    </table>`;
}

function note(html, tone = 'neutral') {
  const bg = tone === 'danger' ? C.dangerBg : tone === 'success' ? C.leafBg : C.caramelTint;
  return `<p style="margin:20px 0;padding:14px 18px;background:${bg};border-radius:10px;font-size:14px;color:${C.espresso};">${html}</p>`;
}

const p = (html) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${C.espresso};">${html}</p>`;
const small = (html) => `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${C.muted};">${html}</p>`;

/** Enlace en crudo debajo de un botón, para clientes que bloquean botones. */
const fallbackLink = (url) =>
  small(`Si el botón no funciona, copie y pegue este enlace en su navegador:<br><a href="${esc(url)}" style="color:${C.caramel};word-break:break-all;">${esc(url)}</a>`);

/**
 * Plantilla base de todos los correos.
 * @param {object} o
 * @param {string} o.preheader   Texto de vista previa en la bandeja (no se ve en el cuerpo).
 * @param {string} o.heading     Título principal (ya escapado si trae datos de usuario).
 * @param {string} o.body        HTML del cuerpo.
 * @param {string} [o.footer]    HTML extra del pie (p. ej. enlace para darse de baja).
 */
function layout({ preheader = '', heading, body, footer = '' }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(heading.replace(/<[^>]+>/g, ''))}</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr><td align="center" style="padding:0 0 24px;">
          <a href="${SITE_URL}" style="font-family:${FONT_DISPLAY};font-size:26px;font-weight:700;color:${C.espresso};text-decoration:none;">DobleYo <span style="color:${C.caramel};">Café</span></a>
        </td></tr>
        <tr><td style="background:${C.white};border-radius:16px;padding:36px 32px;font-family:${FONT_BODY};">
          <h1 style="margin:0 0 20px;font-family:${FONT_DISPLAY};font-size:24px;line-height:1.3;color:${C.espresso};">${heading}</h1>
          ${body}
        </td></tr>
        <tr><td align="center" style="padding:24px 8px 0;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${C.muted};">
          ${footer ? `${footer}<br><br>` : ''}
          DobleYo Café · Café de especialidad colombiano<br>
          <a href="${SITE_URL}" style="color:${C.muted};">dobleyo.cafe</a> · © ${year}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Lista de supresión ──────────────────────────────────────────────────────

/**
 * Correos que rebotaron de forma permanente o marcaron spam (los registra el
 * webhook de Resend). Enviarles de nuevo daña la reputación del dominio.
 */
async function isSuppressed(email) {
  try {
    const r = await query('SELECT 1 FROM email_suppressions WHERE email = ? LIMIT 1', [String(email).toLowerCase()]);
    return r.rows.length > 0;
  } catch (err) {
    // Tabla aún no migrada: no bloquear el envío.
    logger.warn({ err: err.message }, '[email] No se pudo consultar email_suppressions');
    return false;
  }
}

export async function suppressEmail(email, reason, detail = null) {
  await query(
    `INSERT INTO email_suppressions (email, reason, detail) VALUES (?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET reason = excluded.reason, detail = excluded.detail, updated_at = datetime('now')`,
    [String(email).toLowerCase(), reason, detail]
  );
}

// ─── Envío ───────────────────────────────────────────────────────────────────

/**
 * Envía un correo. Punto único de salida hacia Resend.
 * @param {object} o
 * @param {string|string[]} o.to
 * @param {string} o.subject
 * @param {string} o.html
 * @param {string} [o.text]            Por defecto se deriva del HTML.
 * @param {string} o.category          Etiqueta para filtrar en el panel de Resend (p. ej. 'password_reset').
 * @param {string} [o.idempotencyKey]  Resend descarta duplicados con la misma clave durante 24 h.
 * @param {string|string[]} [o.replyTo]
 * @param {Record<string,string>} [o.headers]
 * @param {boolean} [o.ignoreSuppression]  Solo para correos internos al equipo.
 */
export async function sendEmail({ to, subject, html, text, category, idempotencyKey, replyTo, headers, ignoreSuppression = false }) {
  const recipients = Array.isArray(to) ? to : [to];
  if (!recipients.length || recipients.some((r) => !r)) {
    return { success: false, error: 'Destinatario vacío' };
  }

  if (!ignoreSuppression) {
    for (const r of recipients) {
      if (await isSuppressed(r)) {
        logger.warn({ to: r, category }, '[email] Destinatario en lista de supresión; no se envía');
        return { success: false, skipped: true, error: 'Destinatario suprimido (rebote o queja previa)' };
      }
    }
  }

  if (!resend) {
    logger.info({ to: recipients, subject, category }, '[email:mock] Correo simulado (sin RESEND_API_KEY)');
    return { success: true, mock: true };
  }

  try {
    const { data, error } = await resend.emails.send(
      {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: recipients,
        subject,
        html,
        text: text ?? htmlToText(html),
        replyTo: replyTo ?? REPLY_TO,
        headers,
        tags: category ? [{ name: 'category', value: category }] : undefined,
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );
    if (error) {
      logger.error({ error, to: recipients, category }, '[email] Resend rechazó el envío');
      return { success: false, error };
    }
    return { success: true, id: data?.id };
  } catch (error) {
    logger.error({ err: error, to: recipients, category }, '[email] Error de red enviando a Resend');
    return { success: false, error };
  }
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (email, token, name = '') => {
  const url = `${SITE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to: email,
    subject: 'Confirme su correo en DobleYo Café',
    category: 'account_verification',
    html: layout({
      preheader: 'Un clic para activar su cuenta.',
      heading: 'Confirme su correo',
      body: `
        ${p(greeting(name))}
        ${p('Gracias por crear su cuenta en DobleYo Café. Para activarla, confirme que este correo le pertenece:')}
        ${button(url, 'Confirmar mi correo')}
        ${fallbackLink(url)}
        ${small('El enlace vence en 24 horas. Si usted no creó esta cuenta, puede ignorar este mensaje.')}
      `,
    }),
  });
};

export const sendWelcomeEmail = async (email, name = '') =>
  sendEmail({
    to: email,
    subject: 'Bienvenido a DobleYo Café',
    category: 'welcome',
    idempotencyKey: `welcome/${String(email).toLowerCase()}`,
    html: layout({
      preheader: 'Su cuenta ya está activa.',
      heading: 'Su cuenta está lista',
      body: `
        ${p(greeting(name))}
        ${p('Su correo quedó confirmado. Desde su cuenta puede seguir sus pedidos, guardar direcciones y favoritos, y administrar su suscripción de café.')}
        ${p('Cada bolsa que vendemos tiene un código QR con la historia completa del lote: la finca, la cosecha y la tostión.')}
        ${button(`${SITE_URL}/tienda`, 'Ver los cafés')}
        ${small(`¿Preguntas? Responda este correo o escríbanos desde <a href="${SITE_URL}/contacto" style="color:${C.caramel};">la página de contacto</a>.`)}
      `,
    }),
  });

export const sendPasswordResetEmail = async (email, name, token) => {
  const url = `${SITE_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to: email,
    subject: 'Restablezca su contraseña de DobleYo Café',
    category: 'password_reset',
    html: layout({
      preheader: 'Recibimos una solicitud para cambiar su contraseña.',
      heading: 'Restablecer contraseña',
      body: `
        ${p(greeting(name))}
        ${p('Recibimos una solicitud para restablecer la contraseña de su cuenta. Haga clic en el botón para elegir una nueva:')}
        ${button(url, 'Elegir nueva contraseña')}
        ${fallbackLink(url)}
        ${note('El enlace vence en <strong>1 hora</strong> y solo se puede usar una vez.')}
        ${small('Si usted no lo solicitó, ignore este correo: su contraseña actual sigue funcionando y nadie más puede usar este enlace.')}
      `,
    }),
  });
};

export const sendPasswordChangedEmail = async (email, name, { sessionsRevoked = false } = {}) =>
  sendEmail({
    to: email,
    subject: 'Su contraseña fue actualizada',
    category: 'password_changed',
    html: layout({
      preheader: 'Aviso de seguridad de su cuenta.',
      heading: 'Contraseña actualizada',
      body: `
        ${p(greeting(name))}
        ${p(`La contraseña de su cuenta en DobleYo Café se cambió el ${esc(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' }))} (hora de Colombia).${sessionsRevoked ? ' Por seguridad, cerramos las sesiones abiertas en todos sus dispositivos.' : ''}`)}
        ${note(`<strong>¿No fue usted?</strong> Restablezca la contraseña de inmediato desde <a href="${SITE_URL}/recuperar-contrasena" style="color:${C.danger};">este enlace</a> y avísenos respondiendo este correo.`, 'danger')}
      `,
    }),
  });

export const sendCaficultorDecisionEmail = async (email, name, { approved, reason }) =>
  sendEmail({
    to: email,
    subject: approved ? 'Su solicitud de caficultor fue aprobada' : 'Respuesta a su solicitud de caficultor',
    category: approved ? 'caficultor_approved' : 'caficultor_rejected',
    html: layout({
      preheader: approved ? 'Ya puede registrar sus cosechas.' : 'Revisamos su solicitud.',
      heading: approved ? 'Bienvenido como caficultor' : 'Revisamos su solicitud',
      body: approved
        ? `
          ${p(greeting(name))}
          ${p('Aprobamos su solicitud. Su cuenta ya tiene acceso al panel de caficultor, donde puede registrar cosechas y seguir el recorrido de su café hasta la venta.')}
          ${button(`${SITE_URL}/admin/produccion`, 'Ir al panel')}
          ${small('Le recomendamos cerrar sesión y volver a ingresar para que se apliquen los nuevos permisos.')}
        `
        : `
          ${p(greeting(name))}
          ${p('Gracias por su interés en trabajar con DobleYo. Por ahora no podemos aprobar su solicitud de caficultor.')}
          ${reason ? infoBox([['Motivo', escMultiline(reason)]]) : ''}
          ${p('Si cree que hay un error o quiere enviar más información, responda este correo y con gusto lo revisamos de nuevo.')}
        `,
    }),
  });

// ─── Pedidos ─────────────────────────────────────────────────────────────────

function itemsTable(items) {
  const rows = items
    .map((item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.espresso};">${esc(item.name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.muted};text-align:center;white-space:nowrap;">× ${esc(item.quantity)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.espresso};text-align:right;white-space:nowrap;">${cop(item.price * item.quantity)}</td>
      </tr>`)
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
      ${rows}
    </table>`;
}

function totalsTable({ subtotal, shipping, discount, total }) {
  const line = (label, value, strong = false) => `
    <tr>
      <td style="padding:4px 0;font-size:${strong ? 16 : 14}px;color:${strong ? C.espresso : C.muted};${strong ? 'font-weight:700;' : ''}">${label}</td>
      <td style="padding:4px 0;font-size:${strong ? 16 : 14}px;color:${strong ? C.caramel : C.espresso};text-align:right;${strong ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 20px;">
      ${line('Subtotal', cop(subtotal))}
      ${discount ? line('Descuento', `−${cop(discount)}`) : ''}
      ${line('Envío', Number(shipping) ? cop(shipping) : 'Gratis')}
      ${line('Total', cop(total), true)}
    </table>`;
}

/**
 * Confirmación de pedido pagado (o contraentrega confirmado).
 * orderData: { orderId (referencia), date, items[{name, quantity, price}], subtotal, shipping, discount?, total, shippingAddress, paymentMethod? }
 */
export const sendOrderConfirmationEmail = async (email, customerName, orderData) => {
  const trackUrl = `${SITE_URL}/confirmacion?ref=${encodeURIComponent(orderData.orderId)}`;
  const isCod = orderData.paymentMethod === 'cod';
  return sendEmail({
    to: email,
    subject: `Pedido ${orderData.orderId} confirmado`,
    category: 'order_confirmation',
    idempotencyKey: `order-confirmation/${orderData.orderId}`,
    html: layout({
      preheader: `Recibimos su pedido por ${cop(orderData.total)}. Le avisaremos cuando salga.`,
      heading: '¡Gracias por su compra!',
      body: `
        ${p(greeting(customerName))}
        ${p('Su pedido quedó confirmado. Lo estamos preparando y le escribiremos de nuevo con el número de guía apenas salga.')}
        ${infoBox([
          ['Pedido', esc(orderData.orderId)],
          ['Fecha', esc(new Date(orderData.date || Date.now()).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long' }))],
          ['Pago', isCod ? 'Contraentrega' : 'Aprobado'],
          ['Envío a', esc(orderData.shippingAddress)],
        ])}
        <h2 style="margin:24px 0 0;font-family:${FONT_DISPLAY};font-size:18px;color:${C.espresso};">Resumen</h2>
        ${itemsTable(orderData.items || [])}
        ${totalsTable(orderData)}
        ${isCod ? note(`Recuerde tener disponibles <strong>${cop(orderData.total)}</strong> al recibir el pedido.`) : ''}
        ${button(trackUrl, 'Ver mi pedido')}
        ${small('¿Algo no está bien con su pedido? Responda este correo y le ayudamos.')}
      `,
    }),
  });
};

// Notificación de despacho (número de guía, transportadora, tracking)
export const sendShippingNotificationEmail = async (email, customerName, shipmentData) => {
  const { reference, guideNumber, deliveryCompanyName, trackingUrl, isCod, collectionValue } = shipmentData;
  return sendEmail({
    to: email,
    subject: `Su pedido ${reference} va en camino`,
    category: 'order_shipped',
    idempotencyKey: `order-shipped/${reference}/${guideNumber || 'sin-guia'}`,
    html: layout({
      preheader: `Transportadora: ${deliveryCompanyName || 'por confirmar'}. Guía: ${guideNumber || 'pendiente'}.`,
      heading: 'Su pedido va en camino',
      body: `
        ${p(greeting(customerName))}
        ${p('Entregamos su pedido a la transportadora. Con estos datos puede seguir el envío:')}
        ${infoBox([
          ['Pedido', esc(reference)],
          ['Transportadora', esc(deliveryCompanyName || 'Por confirmar')],
          ['Número de guía', esc(guideNumber || 'Pendiente')],
        ])}
        ${isCod ? note(`<strong>Pago contraentrega:</strong> tenga disponibles ${cop(collectionValue)} al recibir su pedido.`) : ''}
        ${button(trackingUrl || `${SITE_URL}/confirmacion?ref=${encodeURIComponent(reference)}`, 'Seguir mi pedido')}
        ${small('Si tiene preguntas sobre su envío, responda este correo.')}
      `,
    }),
  });
};

const ORDER_STATUS_COPY = {
  delivered: {
    subject: (ref) => `Su pedido ${ref} fue entregado`,
    heading: 'Pedido entregado',
    preheader: 'Esperamos que disfrute su café.',
    tone: 'success',
    body: () => `
      ${p('La transportadora reporta su pedido como entregado. Esperamos que disfrute cada taza.')}
      ${p('Escanee el código QR de la bolsa para conocer la finca y el proceso de su café. Y si tiene un minuto, su reseña ayuda a otros a elegir.')}
    `,
    cta: (ref) => [`${SITE_URL}/cuenta`, 'Dejar una reseña'],
  },
  cancelled: {
    subject: (ref) => `Su pedido ${ref} fue cancelado`,
    heading: 'Pedido cancelado',
    preheader: 'Le contamos qué sigue.',
    tone: 'danger',
    body: () => `
      ${p('Su pedido fue cancelado. Si ya se había realizado un cobro, el reembolso se procesa por el mismo medio de pago; el tiempo en verse reflejado depende de su banco.')}
      ${p('Si usted no pidió la cancelación o tiene dudas, responda este correo.')}
    `,
    cta: () => [`${SITE_URL}/tienda`, 'Volver a la tienda'],
  },
  refunded: {
    subject: (ref) => `Reembolso del pedido ${ref}`,
    heading: 'Reembolso procesado',
    preheader: 'Su dinero va de regreso.',
    tone: 'neutral',
    body: () => `
      ${p('Procesamos el reembolso de su pedido por el mismo medio de pago que usó. Según su banco, puede tardar entre 5 y 15 días hábiles en verse reflejado.')}
    `,
    cta: () => null,
  },
};

/** Cambio de estado del pedido. Solo aplica para 'delivered', 'cancelled' y 'refunded'. */
export const sendOrderStatusEmail = async (email, customerName, { reference, status, total }) => {
  const copy = ORDER_STATUS_COPY[status];
  if (!copy) return { success: false, skipped: true, error: `Estado sin correo: ${status}` };
  const cta = copy.cta(reference);
  return sendEmail({
    to: email,
    subject: copy.subject(reference),
    category: `order_${status}`,
    idempotencyKey: `order-status/${reference}/${status}`,
    html: layout({
      preheader: copy.preheader,
      heading: copy.heading,
      body: `
        ${p(greeting(customerName))}
        ${infoBox([['Pedido', esc(reference)], ...(total ? [['Total', cop(total)]] : [])], copy.tone)}
        ${copy.body()}
        ${cta ? button(cta[0], cta[1]) : ''}
      `,
    }),
  });
};

// ─── Suscripciones ───────────────────────────────────────────────────────────

export const sendSubscriptionChargeFailedEmail = async (email, customerName, { reference, amount, failedAttempts, suspended }) =>
  sendEmail({
    to: email,
    subject: suspended ? 'Su suscripción quedó en pausa' : 'No pudimos cobrar su suscripción',
    category: 'subscription_charge_failed',
    idempotencyKey: `subscription-failed/${reference}/${failedAttempts}`,
    html: layout({
      preheader: suspended ? 'Actualice su medio de pago para reactivarla.' : 'Volveremos a intentarlo pronto.',
      heading: suspended ? 'Suscripción en pausa' : 'Cobro no aprobado',
      body: `
        ${p(greeting(customerName))}
        ${p(suspended
          ? 'Intentamos cobrar su suscripción varias veces sin éxito, así que la pusimos en pausa para no seguir intentando con su tarjeta.'
          : 'Su banco no aprobó el cobro de este ciclo de su suscripción. Lo intentaremos de nuevo en los próximos días.')}
        ${infoBox([
          ['Suscripción', esc(reference)],
          ['Valor', cop(amount)],
          ['Intentos', esc(failedAttempts)],
        ], 'danger')}
        ${p('Las causas más comunes son fondos insuficientes, una tarjeta vencida o un bloqueo de compras en línea. Para cambiar de tarjeta, responda este correo y le ayudamos.')}
        ${button(`${SITE_URL}/cuenta`, 'Ver mi suscripción')}
      `,
    }),
  });

export const sendSubscriptionCancelledEmail = async (email, customerName, { reference, productName }) =>
  sendEmail({
    to: email,
    subject: 'Su suscripción fue cancelada',
    category: 'subscription_cancelled',
    idempotencyKey: `subscription-cancelled/${reference}`,
    html: layout({
      preheader: 'No haremos más cobros.',
      heading: 'Suscripción cancelada',
      body: `
        ${p(greeting(customerName))}
        ${p('Confirmamos la cancelación de su suscripción. No se harán más cobros a su tarjeta. Los pedidos que ya estaban pagos se entregan con normalidad.')}
        ${infoBox([['Suscripción', esc(reference)], ...(productName ? [['Café', esc(productName)]] : [])])}
        ${p('Gracias por dejarnos acompañar sus mañanas. Si quiere volver, puede suscribirse de nuevo cuando quiera.')}
        ${button(`${SITE_URL}/suscripcion`, 'Ver suscripciones')}
      `,
    }),
  });

// ─── Contacto ────────────────────────────────────────────────────────────────

// Mensaje del formulario de contacto (al equipo)
export const sendContactFormEmail = async (contactData) =>
  sendEmail({
    to: ADMIN_EMAIL,
    replyTo: contactData.email,
    subject: `Nuevo mensaje de contacto: ${String(contactData.name).slice(0, 80)}`,
    category: 'contact_internal',
    ignoreSuppression: true,
    html: layout({
      preheader: String(contactData.subject || '').slice(0, 120),
      heading: 'Nuevo mensaje de contacto',
      body: `
        ${infoBox([
          ['Nombre', esc(contactData.name)],
          ['Correo', `<a href="mailto:${esc(contactData.email)}" style="color:${C.caramel};">${esc(contactData.email)}</a>`],
          ['Teléfono', esc(contactData.phone || 'No indicado')],
          ['Asunto', esc(contactData.subject)],
        ])}
        <h2 style="margin:24px 0 8px;font-family:${FONT_DISPLAY};font-size:18px;color:${C.espresso};">Mensaje</h2>
        ${p(escMultiline(contactData.message))}
        ${small(`Recibido: ${esc(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }))}${contactData.ip ? ` · IP: ${esc(contactData.ip)}` : ''}<br>Responda este correo para contestarle directamente.`)}
      `,
    }),
  });

// Acuse de recibo al cliente que escribió por el formulario
export const sendContactAcknowledgementEmail = async (email, name, subject) =>
  sendEmail({
    to: email,
    subject: 'Recibimos su mensaje',
    category: 'contact_ack',
    html: layout({
      preheader: 'Le responderemos pronto.',
      heading: 'Recibimos su mensaje',
      body: `
        ${p(greeting(name))}
        ${p('Gracias por escribirnos. Su mensaje llegó a nuestro equipo y le responderemos en un plazo de 1 a 2 días hábiles.')}
        ${subject ? infoBox([['Asunto', esc(subject)]]) : ''}
        ${small('Si necesita agregar algo, puede responder directamente este correo.')}
      `,
    }),
  });

// Respuesta del equipo a un mensaje de contacto
export const sendContactReplyEmail = async (email, clientName, replyMessage) =>
  sendEmail({
    to: email,
    subject: 'Respuesta a su mensaje · DobleYo Café',
    category: 'contact_reply',
    html: layout({
      preheader: String(replyMessage || '').slice(0, 120),
      heading: 'Respuesta a su mensaje',
      body: `
        ${p(greeting(clientName))}
        ${p(escMultiline(replyMessage))}
        ${small('Si tiene más preguntas, responda este correo.')}
      `,
    }),
  });

// ─── Boletín ─────────────────────────────────────────────────────────────────

const unsubscribePageUrl = (token) => `${SITE_URL}/desuscribirse${token ? `?token=${encodeURIComponent(token)}` : ''}`;

/**
 * Cabeceras List-Unsubscribe (RFC 8058). Gmail y Yahoo las exigen a remitentes
 * masivos: muestran el botón "Cancelar suscripción" junto al remitente y hacen
 * un POST de un clic al endpoint.
 */
function unsubscribeHeaders(token) {
  if (!token) return undefined;
  return {
    'List-Unsubscribe': `<${SITE_URL}/api/emails/newsletter/unsubscribe?token=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

const unsubscribeFooter = (token) =>
  `Recibe este correo porque se suscribió al boletín de DobleYo Café.<br><a href="${unsubscribePageUrl(token)}" style="color:${C.muted};">Darse de baja</a>`;

// Bienvenida al boletín con el código de descuento
export const sendNewsletterWelcomeEmail = async (email, unsubscribeToken) =>
  sendEmail({
    to: email,
    subject: 'Tu 10% de descuento en DobleYo Café',
    category: 'newsletter_welcome',
    headers: unsubscribeHeaders(unsubscribeToken),
    html: layout({
      preheader: 'Tu código PRIMERA10 te espera.',
      heading: '¡Gracias por suscribirte!',
      body: `
        ${p('Ya eres parte de la familia DobleYo. Como regalo de bienvenida, aquí está tu código para obtener <strong>10% de descuento</strong> en tu primera compra:')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
          <tr><td align="center" style="background:${C.caramelTint};border:2px dashed ${C.caramel};border-radius:12px;padding:22px;">
            <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.muted};">Tu código</div>
            <div style="margin-top:6px;font-family:${FONT_DISPLAY};font-size:32px;font-weight:700;letter-spacing:.12em;color:${C.espresso};">PRIMERA10</div>
          </td></tr>
        </table>
        ${p('Aplícalo al finalizar tu compra. Es válido para tu primer pedido.')}
        ${button(`${SITE_URL}/tienda`, 'Ir a la tienda')}
        ${small('Te escribiremos sobre nuevos lotes, recetas y lanzamientos. Nada de spam.')}
      `,
      footer: unsubscribeFooter(unsubscribeToken),
    }),
  });

/** Convierte el texto plano de una campaña en párrafos HTML escapados. */
function campaignBodyToHtml(text) {
  return String(text || '')
    .trim()
    .split(/\n{2,}/)
    .map((para) => p(escMultiline(para)))
    .join('');
}

function campaignHtml({ heading, preheader, body, ctaLabel, ctaUrl }, token) {
  return layout({
    preheader: preheader || '',
    heading: esc(heading),
    body: `${campaignBodyToHtml(body)}${ctaLabel && ctaUrl ? button(ctaUrl, ctaLabel) : ''}`,
    footer: unsubscribeFooter(token),
  });
}

/**
 * Envía una campaña del boletín a una lista de suscriptores, en lotes de 100
 * (límite de la API batch de Resend). Cada destinatario recibe su propio enlace
 * de baja y sus cabeceras List-Unsubscribe.
 *
 * @param {{subject, heading, preheader?, body, ctaLabel?, ctaUrl?}} campaign
 *   `body` es texto plano: los párrafos se separan con una línea en blanco.
 * @param {{email, unsubscribe_token}[]} subscribers
 * @param {string} campaignId  Identificador estable para la idempotencia de cada lote.
 */
export async function sendNewsletterCampaign(campaign, subscribers, campaignId) {
  const result = { sent: 0, failed: 0, skipped: 0, mock: !resend };

  // Excluir suprimidos de una sola consulta en vez de una por destinatario.
  let suppressed = new Set();
  try {
    const r = await query('SELECT email FROM email_suppressions');
    suppressed = new Set(r.rows.map((row) => String(row.email).toLowerCase()));
  } catch { /* tabla sin migrar: se envía a todos */ }

  const targets = subscribers.filter((s) => {
    if (suppressed.has(String(s.email).toLowerCase())) { result.skipped++; return false; }
    return true;
  });

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const chunk = targets.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((s) => {
      const html = campaignHtml(campaign, s.unsubscribe_token);
      return {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [s.email],
        subject: campaign.subject,
        html,
        text: htmlToText(html),
        replyTo: REPLY_TO,
        headers: unsubscribeHeaders(s.unsubscribe_token),
        tags: [{ name: 'category', value: 'newsletter_campaign' }],
      };
    });

    if (!resend) {
      logger.info({ count: chunk.length, subject: campaign.subject }, '[email:mock] Lote de campaña simulado');
      result.sent += chunk.length;
      continue;
    }

    try {
      const { error } = await resend.batch.send(payload, { idempotencyKey: `campaign/${campaignId}/${i / BATCH_SIZE}` });
      if (error) {
        logger.error({ error, batch: i / BATCH_SIZE }, '[email] Resend rechazó un lote de la campaña');
        result.failed += chunk.length;
      } else {
        result.sent += chunk.length;
      }
    } catch (err) {
      logger.error({ err, batch: i / BATCH_SIZE }, '[email] Error de red enviando lote de campaña');
      result.failed += chunk.length;
    }

    // Respetar el límite de peticiones por segundo de Resend entre lotes.
    if (i + BATCH_SIZE < targets.length) await new Promise((r) => setTimeout(r, 600));
  }

  return result;
}

/** Vista previa de una campaña (para el panel de administración). */
export const renderCampaignPreview = (campaign) => campaignHtml(campaign, 'vista-previa');
