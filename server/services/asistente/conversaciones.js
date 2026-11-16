// Conversaciones del asistente: la fila ES el estado del bucle.
//
// Privadas para todos (decisión del dueño, docs/plan-asistente.md): cada
// persona ve y sigue solo las suyas; el admin tampoco ve las ajenas. Los
// cambios aprobados quedan aparte, en la auditoría.

import crypto from 'crypto';
import { query } from '../../db.js';
import { USO_CERO } from './costo.js';
import { contarTurnos } from './turnos.js';

export const RETENCION_DIAS = 30;
/** Preguntas por conversación: cada una reenvía todo el historial y cuesta más. */
export const MAX_TURNOS = 12;

const parse = (s, defecto) => {
  if (s == null) return defecto;
  try {
    return JSON.parse(s);
  } catch {
    return defecto;
  }
};

function aEjecucion(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    usuarioId: Number(fila.usuario_id),
    estado: fila.estado,
    pregunta: fila.pregunta,
    mensajes: parse(fila.mensajes, []),
    propuesta: parse(fila.propuesta, null),
    respuesta: fila.respuesta ?? null,
    error: fila.error ?? null,
    aviso: fila.aviso ?? null,
    iteraciones: Number(fila.iteraciones) || 0,
    uso: {
      entrada: Number(fila.tokens_entrada) || 0,
      salida: Number(fila.tokens_salida) || 0,
      cacheLectura: Number(fila.tokens_cache_lectura) || 0,
      cacheEscritura: Number(fila.tokens_cache_escritura) || 0,
    },
    costoUsd: Number(fila.costo_usd) || 0,
    actualizada: fila.actualizada,
  };
}

export const nuevoId = () => crypto.randomUUID();

/** Crea la fila de una conversación nueva. */
export async function crear(e, usuario) {
  await query(
    `INSERT INTO asistente_conversaciones (id, usuario_id, usuario_rol, estado, pregunta, mensajes, turnos)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [e.id, usuario.id, usuario.rol, e.estado, e.pregunta.slice(0, 500), JSON.stringify(e.mensajes)],
  );
}

/** Guarda el estado completo de la ejecución (llamado por el bucle en cada paso). */
export async function guardar(e) {
  const uso = e.uso ?? USO_CERO;
  await query(
    `UPDATE asistente_conversaciones
        SET estado = ?, mensajes = ?, propuesta = ?, respuesta = ?, error = ?, aviso = ?, turnos = ?,
            iteraciones = ?, tokens_entrada = ?, tokens_salida = ?, tokens_cache_lectura = ?,
            tokens_cache_escritura = ?, costo_usd = ?, actualizada = datetime('now')
      WHERE id = ?`,
    [
      e.estado, JSON.stringify(e.mensajes), e.propuesta ? JSON.stringify(e.propuesta) : null,
      e.respuesta, e.error, e.aviso ?? null, contarTurnos(e.mensajes), e.iteraciones,
      uso.entrada, uso.salida, uso.cacheLectura, uso.cacheEscritura, e.costoUsd, e.id,
    ],
  );
}

/** Conversación de un usuario (null si no existe o es de otra persona). */
export async function obtener(id, usuarioId) {
  const { rows } = await query('SELECT * FROM asistente_conversaciones WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return aEjecucion(rows[0]);
}

/**
 * Pasa la conversación a `corriendo` si está en alguno de los estados `desde`
 * y es del usuario. Atómico: dos clics o dos pestañas no avanzan la misma
 * conversación. Devuelve null si otra petición se adelantó.
 */
export async function reclamar(id, desde, usuarioId) {
  const { rows } = await query(
    `UPDATE asistente_conversaciones SET estado = 'corriendo', actualizada = datetime('now')
      WHERE id = ? AND usuario_id = ? AND estado IN (${desde.map(() => '?').join(',')})
      RETURNING *`,
    [id, usuarioId, ...desde],
  );
  return aEjecucion(rows[0]);
}

/** Últimas conversaciones del usuario, para "Recientes". */
export async function listarRecientes(usuarioId, limite = 5) {
  const { rows } = await query(
    `SELECT id, pregunta, estado, turnos, actualizada FROM asistente_conversaciones
      WHERE usuario_id = ? ORDER BY actualizada DESC LIMIT ?`,
    [usuarioId, limite],
  );
  return rows.map((r) => ({
    id: r.id,
    pregunta: r.pregunta,
    estado: r.estado,
    esperando: r.estado === 'esperando_aprobacion',
    turnos: Number(r.turnos) || 1,
    actualizada: r.actualizada,
  }));
}

/**
 * Borra las conversaciones de más de RETENCION_DIAS. Se llama al crear una
 * conversación (sin cron nuevo). Consumo y auditoría NO se borran.
 * Una conversación esperando aprobación también vence: la tarjeta de hace un
 * mes ya no refleja la base.
 */
export async function purgarViejas() {
  await query(`DELETE FROM asistente_conversaciones WHERE actualizada < datetime('now', ?)`, [`-${RETENCION_DIAS} days`]);
}
