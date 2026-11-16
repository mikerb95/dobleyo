// Topes de gasto diario del asistente (USD, día de Colombia): uno para toda
// la empresa y uno por persona. Editables por el admin desde el panel.
//
// Fallan CERRADO: si no se puede leer el tope o el gasto, `restante()` lanza
// y el bucle no llama al modelo.

import { query } from '../../db.js';
import { gastoDelDia } from './consumo.js';

export const MAXIMO_USD = 50;

export async function leer() {
  const { rows } = await query('SELECT empresa_usd, usuario_usd, actualizado FROM asistente_topes WHERE id = 1');
  if (!rows.length) throw new Error('No hay topes configurados para el asistente.');
  return { empresaUsd: Number(rows[0].empresa_usd), usuarioUsd: Number(rows[0].usuario_usd), actualizado: rows[0].actualizado };
}

/** Valida y guarda. Devuelve el error en texto o null. */
export async function guardar({ empresaUsd, usuarioUsd }, adminId) {
  for (const [nombre, v] of [['El tope de la empresa', empresaUsd], ['El tope por persona', usuarioUsd]]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAXIMO_USD) {
      return `${nombre} debe ser un número entre 0 y ${MAXIMO_USD} dólares.`;
    }
  }
  if (usuarioUsd > empresaUsd) return 'El tope por persona no puede ser mayor que el de la empresa.';
  await query(
    `UPDATE asistente_topes SET empresa_usd = ?, usuario_usd = ?, actualizado_por = ?, actualizado = datetime('now') WHERE id = 1`,
    [Math.round(empresaUsd * 100) / 100, Math.round(usuarioUsd * 100) / 100, adminId],
  );
  return null;
}

/** Estado de hoy para un usuario: gastos y lo que queda. Lanza si no puede leer. */
export async function estadoDeHoy(usuarioId) {
  const [t, empresa, propio] = await Promise.all([leer(), gastoDelDia(), gastoDelDia(undefined, usuarioId)]);
  const restante = Math.min(t.empresaUsd - empresa, t.usuarioUsd - propio);
  return {
    ...t,
    gastoEmpresaUsd: empresa,
    gastoUsuarioUsd: propio,
    restanteUsd: Math.max(0, restante),
    // Qué tope se alcanzó, para el mensaje en pantalla.
    agotado: restante > 0 ? null : t.empresaUsd - empresa <= t.usuarioUsd - propio ? 'empresa' : 'usuario',
  };
}

/** USD que quedan hoy para ese usuario (mínimo entre empresa y usuario). Lanza si no puede leer. */
export async function restante(usuarioId) {
  return (await estadoDeHoy(usuarioId)).restanteUsd;
}
