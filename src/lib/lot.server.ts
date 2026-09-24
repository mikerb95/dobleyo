/**
 * Lote destacado de la portada (acceso a BD).
 *
 * Separado de `lot.ts` por la misma razón que `products.server.ts`: este módulo
 * importa el cliente de Turso y no debe llegar al bundle del navegador.
 */
import type { Lang } from '../i18n/index.ts';
import { EXAMPLE_LOT, toLotView, type LotRow, type LotView } from './lot.ts';

/**
 * Lote real con la cadena completa (cosecha, tostión y finca publicada), el de
 * mejor puntaje SCA y, a igualdad, el tostado más reciente. Es el mismo lote
 * que devuelve GET /api/traceability/:code, así que el QR lleva a datos reales.
 *
 * Si la BD no responde o no hay lotes completos, devuelve el ejemplo marcado
 * como ilustrativo: la portada nunca presenta datos inventados como reales.
 */
export async function getFeaturedLot(lang: Lang): Promise<LotView> {
  try {
    const { query } = await import('../../server/db.js');
    const result = await query(
      `SELECT ch.lot_id, ch.farm, fm.slug AS farm_slug, ch.region, fm.municipality,
              ch.altitude, ch.variety, ch.process, ch.taste_notes,
              ch.created_at AS harvest_date,
              rc.roast_level, rc.actual_temp, rc.roast_time_minutes,
              rc.created_at AS roast_date,
              pc.score
       FROM coffee_harvests ch
       JOIN roasting_batches rb  ON rb.lot_id = ch.lot_id
       JOIN roasted_coffee rc    ON rc.roasting_id = rb.id
       JOIN farms fm             ON fm.name = ch.farm AND fm.is_published = 1
       LEFT JOIN roasted_coffee_inventory rci ON rci.roasted_id = rc.id
       LEFT JOIN packaged_coffee pc           ON pc.roasted_storage_id = rci.id
       WHERE rc.actual_temp IS NOT NULL AND rc.roast_time_minutes IS NOT NULL
       ORDER BY COALESCE(pc.score, 0) DESC, rc.created_at DESC
       LIMIT 1`
    );
    const row = result.rows[0] as unknown as LotRow | undefined;
    if (row) return toLotView(row, lang);
  } catch (_) {
    // Sin BD (build local sin credenciales, caída): se usa el ejemplo.
  }
  return toLotView(EXAMPLE_LOT, lang, true);
}
