/**
 * Middleware de autorización por finca — E-03
 *
 * Verifica que el usuario autenticado sea dueño de la finca que intenta
 * usar en operaciones del pipeline de café. Los admins siempre pasan.
 *
 * Uso como helper en handlers:
 *   await assertFarmOwnership(farmSlug, req.user);
 *   await assertLotAccess('lot', lotId, req.user);
 *   const visibles = await filterRowsByLotAccess(rows, req.user);
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
      'SELECT caficultor_id FROM farms WHERE slug = ? LIMIT 1',
      [farmSlug]
    ));
  } catch (err) {
    // Si la tabla farms no existe aún → permitir (migración pendiente).
    // Cualquier otro error se relanza: no se debe fallar en "permitir".
    if (/no such table/i.test(err.message)) return;
    throw err;
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

// ── Alcance por lote ─────────────────────────────────────────────────────────
// Mismo criterio que canSeeLot (workflowService): un caficultor solo ve y opera
// lotes de fincas suyas o de fincas sin dueño registrado. Admin, sin filtro.

const LOT_SOURCES = {
  lot:            null,
  roastingBatch:  'SELECT lot_id FROM roasting_batches WHERE id = ?',
  roasted:        'SELECT rb.lot_id FROM roasted_coffee rc JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rc.id = ?',
  roastedStorage: `SELECT rb.lot_id FROM roasted_coffee_inventory rci
                   JOIN roasted_coffee rc ON rc.id = rci.roasted_id
                   JOIN roasting_batches rb ON rb.id = rc.roasting_id
                   WHERE rci.id = ?`,
};

async function ownersByLot() {
  const [harvests, farms] = await Promise.all([
    query('SELECT lot_id, farm FROM coffee_harvests'),
    query('SELECT slug, caficultor_id FROM farms').catch((err) => {
      if (/no such table/i.test(err.message)) return { rows: [] };
      throw err;
    }),
  ]);
  const ownerBySlug = new Map(farms.rows.map((f) => [f.slug, f.caficultor_id]));
  return new Map(harvests.rows.map((h) => [h.lot_id, ownerBySlug.has(h.farm) ? ownerBySlug.get(h.farm) : null]));
}

function ownerAllows(ownerId, user) {
  return ownerId == null || Number(ownerId) === Number(user.id);
}

/**
 * Verifica que el usuario pueda operar sobre el lote al que pertenece el registro.
 * `kind` indica qué id llega: 'lot' (lot_id), 'roastingBatch', 'roasted' o
 * 'roastedStorage'. Si el registro no existe se deja pasar: el servicio responde 404.
 */
export async function assertLotAccess(kind, id, user) {
  if (user.role === 'admin' || id == null || id === '') return;

  let lotId = id;
  const sql = LOT_SOURCES[kind];
  if (sql) {
    const { rows } = await query(sql, [id]);
    if (!rows.length) return;
    lotId = rows[0].lot_id;
  }

  const { rows } = await query(
    `SELECT f.caficultor_id FROM coffee_harvests ch
     LEFT JOIN farms f ON f.slug = ch.farm
     WHERE ch.lot_id = ? LIMIT 1`,
    [lotId]
  );
  if (!rows.length || ownerAllows(rows[0].caficultor_id, user)) return;

  const err = new Error('No tiene autorización para operar este lote');
  err.status = 403;
  throw err;
}

/**
 * Filtra filas con `lot_id` a los lotes que el usuario puede ver.
 * Filas sin lote asociado solo las ve el admin.
 */
export async function filterRowsByLotAccess(rows, user) {
  if (user.role === 'admin') return rows;
  const owners = await ownersByLot();
  return rows.filter((r) => r.lot_id != null && owners.has(r.lot_id) && ownerAllows(owners.get(r.lot_id), user));
}
