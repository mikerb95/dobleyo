// Auditoría de las decisiones sobre propuestas del asistente: quién pidió,
// quién decidió, qué herramienta, antes y después, y el resultado. Además se
// escribe en audit_logs para que aparezca en /admin/auditoria.
// No se purga con las conversaciones.

import { query } from '../../db.js';
import { logger } from '../../logger.js';
import { logAudit } from '../audit.js';

export async function registrar({ conversacionId, herramienta, pidioId, decidioId, aprobada, entrada, vista, resultado }) {
  const ok = resultado?.ok === true;
  try {
    await query(
      `INSERT INTO asistente_auditoria
         (conversacion_id, herramienta, pidio_usuario_id, decidio_usuario_id, decision, entrada, vista, resultado, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversacionId, herramienta, pidioId, decidioId, aprobada ? 'aprobada' : 'rechazada',
        JSON.stringify(entrada ?? {}), vista ? JSON.stringify(vista) : null,
        resultado ? JSON.stringify(resultado) : null, ok ? 1 : 0,
      ],
    );
  } catch (err) {
    // La escritura ya ocurrió (o se descartó): no se tumba la respuesta, pero queda en el log.
    logger.error({ err, conversacionId, herramienta }, '[asistente] No se pudo registrar la auditoría');
  }
  await logAudit(decidioId, aprobada ? 'asistente_aprobada' : 'asistente_rechazada', 'asistente', conversacionId, {
    herramienta,
    ok,
    resumen: resultado?.datos?.resumen ?? resultado?.error ?? null,
  });
}
