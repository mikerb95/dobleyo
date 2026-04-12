/**
 * State machine para el pipeline de lotes de café.
 *
 * Stages del pipeline (mapeadas a las tablas de BD):
 *   harvested           → registro en coffee_harvests
 *   in_storage_green    → registro en green_coffee_inventory
 *   sent_to_roasting    → registro en roasting_batches (status='in_roasting')
 *   roasted             → registro en roasted_coffee
 *   in_storage_roasted  → registro en roasted_coffee_inventory
 *   packaged            → registro en packaged_coffee
 */

// Transiciones válidas: stage → [stages siguientes permitidos]
export const TRANSITIONS = {
  harvested:          ['in_storage_green'],
  in_storage_green:   ['sent_to_roasting'],
  sent_to_roasting:   ['roasted', 'returned_to_green'],
  returned_to_green:  ['sent_to_roasting'],
  roasted:            ['in_storage_roasted', 'quality_check'],
  quality_check:      ['in_storage_roasted', 'rejected'],
  in_storage_roasted: ['packaged'],
  packaged:           [],          // estado final
  rejected:           [],          // estado final
};

// Tabla BD que debe tener un registro para validar que el stage existe
const STAGE_TABLE = {
  harvested:          'coffee_harvests',
  in_storage_green:   'green_coffee_inventory',
  sent_to_roasting:   'roasting_batches',
  roasted:            'roasted_coffee',
  in_storage_roasted: 'roasted_coffee_inventory',
  packaged:           'packaged_coffee',
};

/**
 * Verifica si la transición de currentStage → nextStage es válida.
 * @returns {boolean}
 */
export function canTransitionTo(currentStage, nextStage) {
  const allowed = TRANSITIONS[currentStage];
  if (!allowed) return false;
  return allowed.includes(nextStage);
}

/**
 * Determina el stage actual de un lote basándose en cuáles tablas
 * tienen registros para ese lot_id. Consulta la BD en orden inverso
 * (del más avanzado al más inicial).
 *
 * @param {Function} queryFn  — función query de db.js
 * @param {string}   lotId
 * @returns {Promise<string>} stage actual
 */
export async function getCurrentStage(queryFn, lotId) {
  const checks = [
    { stage: 'packaged',           sql: `SELECT 1 FROM packaged_coffee     pc JOIN roasted_coffee_inventory rci ON rci.id = pc.roasted_storage_id JOIN roasted_coffee rc ON rc.id = rci.roasted_id JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rb.lot_id = $1 LIMIT 1` },
    { stage: 'in_storage_roasted', sql: `SELECT 1 FROM roasted_coffee_inventory rci JOIN roasted_coffee rc ON rc.id = rci.roasted_id JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rb.lot_id = $1 LIMIT 1` },
    { stage: 'roasted',            sql: `SELECT 1 FROM roasted_coffee rc JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rb.lot_id = $1 LIMIT 1` },
    { stage: 'sent_to_roasting',   sql: `SELECT 1 FROM roasting_batches WHERE lot_id = $1 LIMIT 1` },
    { stage: 'in_storage_green',   sql: `SELECT 1 FROM green_coffee_inventory WHERE lot_id = $1 LIMIT 1` },
    { stage: 'harvested',          sql: `SELECT 1 FROM coffee_harvests WHERE lot_id = $1 LIMIT 1` },
  ];

  for (const { stage, sql } of checks) {
    try {
      const { rows } = await queryFn(sql, [lotId]);
      if (rows.length > 0) return stage;
    } catch (_) {
      // tabla puede no existir aún — continuar
    }
  }
  return 'unknown';
}

/**
 * Valida que un lot_id pueda avanzar al siguiente stage.
 * Si el stage actual es 'unknown' (tablas nuevas o lote sin historial completo),
 * la validación es permisiva y deja pasar la operación.
 *
 * @param {Function} queryFn
 * @param {string}   lotId
 * @param {string}   targetStage
 * @throws {Error} con mensaje legible si la transición es claramente inválida
 */
export async function assertCanAdvance(queryFn, lotId, targetStage) {
  let currentStage;
  try {
    currentStage = await getCurrentStage(queryFn, lotId);
  } catch (_) {
    return; // No bloquear si no se puede determinar el stage
  }

  // Stage desconocido → permitir (sistema nuevo o historial incompleto)
  if (currentStage === 'unknown') return;

  if (!canTransitionTo(currentStage, targetStage)) {
    const allowed = TRANSITIONS[currentStage] ?? [];
    throw new Error(
      `Transición inválida para lote ${lotId}: ` +
      `el lote está en '${currentStage}' y no puede ir a '${targetStage}'. ` +
      `Próximos stages permitidos: ${allowed.join(', ') || 'ninguno (estado final)'}`
    );
  }
}

export const STAGE_LABELS = {
  harvested:          'Cosecha registrada',
  in_storage_green:   'Café verde en almacén',
  sent_to_roasting:   'Enviado a tueste',
  returned_to_green:  'Devuelto a verde',
  roasted:            'Tostado recibido',
  quality_check:      'En control de calidad',
  in_storage_roasted: 'Tostado en almacén',
  packaged:           'Empacado',
  rejected:           'Rechazado',
  unknown:            'Sin registro',
};
