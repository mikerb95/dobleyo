// Consumo del asistente: una fila por llamada al modelo. Es la fuente única
// del tope diario (empresa y usuario) y del reporte del mes.
//
// Se registra POR LLAMADA, no al final de la pregunta: si la función muere a
// mitad, lo ya pagado cuenta igual para el tope.

import { query } from '../../db.js';
import { costoUsd, sumarUso, USO_CERO } from './costo.js';
import { hoy } from './herramientas/comun.js';

export async function registrar({ usuarioId, conversacionId, modelo, usage }) {
  const u = sumarUso(USO_CERO, usage);
  await query(
    `INSERT INTO asistente_consumo
       (dia, usuario_id, conversacion_id, modelo, tokens_entrada, tokens_salida, tokens_cache_lectura, tokens_cache_escritura, costo_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hoy(), usuarioId, conversacionId, modelo, u.entrada, u.salida, u.cacheLectura, u.cacheEscritura, costoUsd(u, modelo)],
  );
}

/** USD gastados en el día (hora de Colombia), de todos o de un usuario. Lanza si no puede leer. */
export async function gastoDelDia(dia = hoy(), usuarioId = null) {
  const { rows } = usuarioId == null
    ? await query('SELECT COALESCE(SUM(costo_usd), 0) AS usd FROM asistente_consumo WHERE dia = ?', [dia])
    : await query('SELECT COALESCE(SUM(costo_usd), 0) AS usd FROM asistente_consumo WHERE dia = ? AND usuario_id = ?', [dia, usuarioId]);
  return Number(rows[0]?.usd) || 0;
}

/** Resumen del mes (AAAA-MM) para el admin: total, por usuario y por día. */
export async function resumenDelMes(mes = hoy().slice(0, 7)) {
  const like = `${mes}-%`;
  const [total, porUsuario, porDia] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(costo_usd), 0) AS usd, COUNT(*) AS llamadas, COUNT(DISTINCT conversacion_id) AS conversaciones
         FROM asistente_consumo WHERE dia LIKE ?`,
      [like],
    ),
    query(
      `SELECT c.usuario_id, COALESCE(u.name, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))) AS nombre,
              u.role, SUM(c.costo_usd) AS usd, COUNT(DISTINCT c.conversacion_id) AS conversaciones
         FROM asistente_consumo c LEFT JOIN users u ON u.id = c.usuario_id
        WHERE c.dia LIKE ? GROUP BY c.usuario_id ORDER BY usd DESC`,
      [like],
    ),
    query('SELECT dia, SUM(costo_usd) AS usd FROM asistente_consumo WHERE dia LIKE ? GROUP BY dia ORDER BY dia', [like]),
  ]);
  return {
    mes,
    usd: Number(total.rows[0]?.usd) || 0,
    llamadas: Number(total.rows[0]?.llamadas) || 0,
    conversaciones: Number(total.rows[0]?.conversaciones) || 0,
    porUsuario: porUsuario.rows.map((r) => ({
      usuarioId: Number(r.usuario_id),
      nombre: r.nombre || (Number(r.usuario_id) === 0 ? 'Usuario de desarrollo' : `Usuario ${r.usuario_id}`),
      rol: r.role ?? null,
      usd: Number(r.usd) || 0,
      conversaciones: Number(r.conversaciones) || 0,
    })),
    porDia: porDia.rows.map((r) => ({ dia: r.dia, usd: Number(r.usd) || 0 })),
  };
}
