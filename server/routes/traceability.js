import { Router } from 'express';
import { query } from '../db.js';

export const traceabilityRouter = Router();

/**
 * GET /api/traceability/:code
 * Endpoint público — sin autenticación.
 * Acepta label_code (de generated_labels) o lot_id (de coffee_harvests).
 * Devuelve la cadena completa: cosecha → almacenamiento → tostión → empaque → etiqueta.
 */
traceabilityRouter.get('/:code', async (req, res) => {
    const { code } = req.params;

    if (!code || code.length > 200) {
        return res.status(400).json({ success: false, error: 'Código inválido' });
    }

    try {
        // 1. Buscar por código de etiqueta generada (generated_labels)
        let data = await lookupByLabelCode(code);

        // 2. Si no aparece como etiqueta, buscar directamente por lot_id de cosecha
        if (!data) {
            data = await lookupByLotId(code);
        }

        if (!data) {
            return res.status(404).json({ success: false, error: 'Lote no encontrado' });
        }

        return res.json({ success: true, data });
    } catch (err) {
        console.error('[GET /api/traceability/:code] Error:', err);
        return res.status(500).json({ success: false, error: 'Error al consultar trazabilidad' });
    }
});

// ─────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────

/**
 * Busca por label_code en generated_labels y une toda la cadena de producción.
 */
async function lookupByLabelCode(code) {
    const result = await query(`
    SELECT
      gl.label_code             AS code,
      gl.lot_code,
      ch.lot_id,
      ch.farm,
      ch.region,
      ch.altitude,
      ch.variety,
      ch.climate,
      ch.process,
      ch.aroma,
      ch.taste_notes,
      ch.created_at             AS harvest_date,
      gci.weight_kg             AS green_weight_kg,
      gci.location              AS green_location,
      gci.storage_date,
      rb.quantity_sent_kg       AS sent_kg,
      rb.status                 AS roasting_status,
      rb.created_at             AS roasting_date,
      rc.roast_level,
      rc.weight_kg              AS roasted_kg,
      rc.weight_loss_percent,
      rc.actual_temp,
      rc.roast_time_minutes,
      rc.observations           AS roast_observations,
      rc.created_at             AS roast_date,
      pc.acidity,
      pc.body,
      pc.balance,
      pc.score,
      pc.presentation,
      pc.grind_size,
      pc.package_size,
      pc.unit_count,
      gl.flavor_notes,
      gl.created_at             AS label_date
    FROM generated_labels gl
    LEFT JOIN coffee_harvests           ch  ON gl.lot_code = ch.lot_id
    LEFT JOIN green_coffee_inventory    gci ON gci.lot_id  = ch.lot_id
    LEFT JOIN roasting_batches          rb  ON rb.lot_id   = ch.lot_id
    LEFT JOIN roasted_coffee            rc  ON rc.roasting_id = rb.id
    LEFT JOIN roasted_coffee_inventory  rci ON rci.roasted_id = rc.id
    LEFT JOIN packaged_coffee           pc  ON pc.roasted_storage_id = rci.id
    WHERE gl.label_code = $1
    ORDER BY rb.created_at DESC
    LIMIT 1
  `, [code]);

    return result.rows.length ? formatRow(result.rows[0]) : null;
}

/**
 * Busca directamente por lot_id en coffee_harvests.
 */
async function lookupByLotId(lotId) {
    const result = await query(`
    SELECT
      ch.lot_id                 AS code,
      ch.lot_id                 AS lot_code,
      ch.lot_id,
      ch.farm,
      ch.region,
      ch.altitude,
      ch.variety,
      ch.climate,
      ch.process,
      ch.aroma,
      ch.taste_notes,
      ch.created_at             AS harvest_date,
      gci.weight_kg             AS green_weight_kg,
      gci.location              AS green_location,
      gci.storage_date,
      rb.quantity_sent_kg       AS sent_kg,
      rb.status                 AS roasting_status,
      rb.created_at             AS roasting_date,
      rc.roast_level,
      rc.weight_kg              AS roasted_kg,
      rc.weight_loss_percent,
      rc.actual_temp,
      rc.roast_time_minutes,
      rc.observations           AS roast_observations,
      rc.created_at             AS roast_date,
      pc.acidity,
      pc.body,
      pc.balance,
      pc.score,
      pc.presentation,
      pc.grind_size,
      pc.package_size,
      pc.unit_count,
      NULL                      AS flavor_notes,
      NULL                      AS label_date
    FROM coffee_harvests           ch
    LEFT JOIN green_coffee_inventory    gci ON gci.lot_id  = ch.lot_id
    LEFT JOIN roasting_batches          rb  ON rb.lot_id   = ch.lot_id
    LEFT JOIN roasted_coffee            rc  ON rc.roasting_id = rb.id
    LEFT JOIN roasted_coffee_inventory  rci ON rci.roasted_id = rc.id
    LEFT JOIN packaged_coffee           pc  ON pc.roasted_storage_id = rci.id
    WHERE ch.lot_id = $1
    ORDER BY rb.created_at DESC
    LIMIT 1
  `, [lotId]);

    return result.rows.length ? formatRow(result.rows[0]) : null;
}

/**
 * Transforma una fila de BD al objeto de respuesta estructurado.
 */
function formatRow(row) {
    return {
        code: row.code,
        lot_code: row.lot_code,

        // Etapa 1 — Cosecha en finca
        harvest: {
            lot_id: row.lot_id,
            farm: row.farm,
            region: row.region,
            altitude: row.altitude,
            variety: row.variety,
            climate: row.climate,
            process: row.process,
            aroma: row.aroma,
            taste_notes: row.taste_notes,
            date: row.harvest_date,
        },

        // Etapa 2 — Almacenamiento café verde
        storage: row.green_weight_kg ? {
            weight_kg: row.green_weight_kg,
            location: row.green_location,
            date: row.storage_date,
        } : null,

        // Etapa 3 — Envío a tostión
        roasting: row.sent_kg ? {
            sent_kg: row.sent_kg,
            status: row.roasting_status,
            date: row.roasting_date,
        } : null,

        // Etapa 4 — Tueste
        roasted: row.roast_level ? {
            roast_level: row.roast_level,
            weight_kg: row.roasted_kg,
            weight_loss_percent: row.weight_loss_percent,
            actual_temp: row.actual_temp,
            roast_time_minutes: row.roast_time_minutes,
            observations: row.roast_observations,
            date: row.roast_date,
        } : null,

        // Etapa 5 — Empaque
        packaged: row.acidity != null ? {
            acidity: row.acidity,
            body: row.body,
            balance: row.balance,
            score: row.score,
            presentation: row.presentation,
            grind_size: row.grind_size,
            package_size: row.package_size,
            unit_count: row.unit_count,
        } : null,

        // Etiqueta (solo si viene de generated_labels)
        label: row.label_date ? {
            code: row.code,
            flavor_notes: row.flavor_notes,
            date: row.label_date,
        } : null,
    };
}
