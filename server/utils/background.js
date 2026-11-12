import { waitUntil } from '@vercel/functions';
import { logger } from '../logger.js';

/**
 * Deja corriendo una tarea después de responder la petición.
 *
 * En Vercel (Fluid Compute) la instancia puede pausarse apenas sale la
 * respuesta: una promesa suelta (correo, ntfy, geocodificación) se queda a
 * medias. `waitUntil` mantiene viva la instancia hasta que termine. Fuera de
 * Vercel la promesa ya está corriendo y `waitUntil` no hace nada.
 *
 * Nunca lanza: el error de la tarea queda en el log.
 */
export function runInBackground(promise, label = 'tarea') {
  const task = Promise.resolve(promise).catch((err) => {
    logger.error({ err }, `[background] Falló ${label}`);
  });
  try { waitUntil(task); } catch { /* fuera de Vercel */ }
  return task;
}
