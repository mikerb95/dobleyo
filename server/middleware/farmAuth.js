/**
 * Middleware de autorización por finca — E-03
 *
 * Verifica que el usuario autenticado sea dueño de la finca que intenta
 * usar en operaciones del pipeline de café. Los admins siempre pasan.
 *
 * Uso como helper en handlers:
 *   await assertFarmOwnership(query, farmSlug, req.user);
 */

import { query } from '../db.js';

/**
 * Verifica que el usuario sea dueño de la finca (por slug).
 * - Admin → siempre permitido.
 * - Finca no registrada en BD → permitido (backward compat).
 * - Finca registrada con otro caficultor_id → 403.
 *
 * @param {string} farmSlug  — valor del campo `farm` en coffee_harvests
 * @param {{ id: number, role: string }} user  — req.user del token JWT
 * @throws {{ status: 403, message: string }} si no autorizado
 */
export async function assertFarmOwnership(farmSlug, user) {
  // Admins tienen acceso universal
  if (user.role === 'admin') return;

  if (!farmSlug) return; // sin farm → la validación de campos requeridos lo captura

  let rows;
  try {
    ({ rows } = await query(
      'SELECT caficultor_id FROM farms WHERE slug = $1 LIMIT 1',
      [farmSlug]
    ));
  } catch {
    // Si la tabla farms no existe aún → permitir (migración pendiente)
    return;
  }

  // Finca no registrada en el sistema → permisivo (backward compat / finca nueva)
  if (rows.length === 0) return;

  const ownerId = rows[0].caficultor_id;
  if (Number(ownerId) !== Number(user.id)) {
    const err = new Error('No tienes autorización para crear cosechas en esta finca');
    err.status = 403;
    throw err;
  }
}
