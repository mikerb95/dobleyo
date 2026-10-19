import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Nada que sirva para suplantar una sesión o llamar un endpoint protegido debe
// quedar en los logs de Vercel: cookies de sesión, Authorization, secretos de
// cron y firmas de webhooks.
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-cron-secret"]',
  'req.headers["svix-signature"]',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  'req.query.secret',
  'req.query.token',
];

// Parámetros de URL que llevan secretos (tokens de webhook, verificación, baja).
const SECRET_QUERY_PARAMS = /([?&](?:secret|token|key)=)[^&]*/gi;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: REDACT_PATHS, censor: '[redactado]' },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname', translateTime: 'HH:MM:ss' },
    },
  }),
});

/**
 * Crea un logger con contexto de ruta para identificar la fuente del error.
 * Uso: const log = routeLogger('POST /api/orders');
 */
export function routeLogger(route) {
  return logger.child({ route });
}

/**
 * Opciones de pino-http compartidas por server/index.js y api/index.js.
 * Además de la redacción de cabeceras, limpia los secretos que vienen en la URL.
 */
export const httpLoggerOptions = {
  logger,
  serializers: {
    req(req) {
      if (typeof req.url === 'string') req.url = req.url.replace(SECRET_QUERY_PARAMS, '$1[redactado]');
      return req;
    },
  },
};
