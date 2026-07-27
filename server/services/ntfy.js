import { logger } from '../logger.js';

// Servicio de notificaciones push vía ntfy (https://ntfy.sh o instancia propia).
// Configuración por entorno:
//   NTFY_URL   — base del servidor (por defecto https://ntfy.sh)
//   NTFY_TOPIC — topic al que se publica. Sin él, el servicio queda inactivo.
//   NTFY_TOKEN — token de acceso (opcional, para topics protegidos)

const NTFY_URL   = (process.env.NTFY_URL || 'https://ntfy.sh').replace(/\/+$/, '');
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_TOKEN = process.env.NTFY_TOKEN || '';

export const isNtfyEnabled = () => Boolean(NTFY_TOPIC);

/**
 * Publica una notificación en ntfy. Nunca lanza: un fallo de notificación no
 * debe tumbar la operación de negocio que la disparó.
 *
 * @param {object}   opts
 * @param {string}   opts.title     Título de la notificación.
 * @param {string}   opts.message   Cuerpo del mensaje.
 * @param {number}   [opts.priority] 1 (min) … 5 (urgent). Por defecto 3.
 * @param {string[]} [opts.tags]    Emojis/etiquetas de ntfy, ej. ['coffee'].
 * @param {string}   [opts.click]   URL que abre la notificación al tocarla.
 * @param {string}   [opts.topic]   Topic alterno (por defecto NTFY_TOPIC).
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
export async function sendNtfy({ title, message, priority = 3, tags = [], click, topic } = {}) {
  const target = topic || NTFY_TOPIC;
  if (!target) {
    logger.debug('[ntfy] NTFY_TOPIC no configurado; notificación omitida');
    return { success: false, skipped: true };
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    Title: encodeHeader(title),
    Priority: String(priority),
  };
  if (tags.length) headers.Tags = tags.join(',');
  if (click) headers.Click = click;
  if (NTFY_TOKEN) headers.Authorization = `Bearer ${NTFY_TOKEN}`;

  try {
    const res = await fetch(`${NTFY_URL}/${target}`, {
      method: 'POST',
      headers,
      body: message,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error({ status: res.status, detail }, '[ntfy] Publicación rechazada');
      return { success: false, error: `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, '[ntfy] Error al publicar la notificación');
    return { success: false, error: err.message };
  }
}

/**
 * Variante fire-and-forget: dispara la notificación sin bloquear al llamador
 * ni propagar errores. Úsela dentro de rutas donde la respuesta HTTP no debe
 * esperar a ntfy.
 */
export function sendNtfyAsync(opts) {
  sendNtfy(opts).catch((err) => logger.error({ err }, '[ntfy] Fallo no capturado'));
}

// Los headers HTTP solo admiten latin-1: los títulos con tildes o emojis se
// codifican en RFC 2047 para que ntfy los muestre correctamente.
function encodeHeader(value) {
  const text = String(value ?? '');
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}
