import express from 'express';
import { logger } from '../../logger.js';
import { query } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

export const lotsRouter = express.Router();

// Requerir autenticación y rol admin/caficultor para todas las rutas
lotsRouter.use(authenticateToken);
lotsRouter.use(requireRole(['admin', 'caficultor']));

// ==========================================
// LÍNEA DE PRODUCCIÓN — TRAZABILIDAD POR LOTE
// Alimenta el componente ProductionPipeline.jsx (/admin/produccion)
//
// El pipeline se reconstruye a partir de las tablas operativas, todas
// encadenadas por lot_id (código de texto de coffee_harvests):
//   harvest  → coffee_harvests
//   green    → green_coffee_inventory
//   roast    → roasting_batches
//   roasted  → roasted_coffee_inventory (vía roasted_coffee)
//   pack     → packaged_coffee
//   label    → generated_labels (lot_code = lot_id)
// ==========================================

// Orden canónico de etapas tal como las espera el frontend.
const STAGE_ORDER = ['harvest', 'green', 'roast', 'roasted', 'pack', 'label'];

// Página de registro asociada a cada etapa, para guiar al usuario en /advance.
const STAGE_PAGE = {
  harvest: '/admin/harvest',
  green:   '/admin/inventory-storage',
  roast:   '/admin/send-roasting',
  roasted: '/admin/roasted-storage',
  pack:    '/admin/packaging',
  label:   '/admin/etiquetas',
};

const STAGE_LABEL = {
  harvest: 'Cosecha',
  green:   'Almacén verde',
  roast:   'Tostión',
  roasted: 'Almacén tostado',
  pack:    'Empaque',
  label:   'Etiquetado',
};

// Días transcurridos entre una fecha ISO y hoy.
function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

// A partir de los conteos por etapa determina la etapa actual del lote.
// La etapa actual es la más avanzada que ya tiene registro.
function resolveStages(counts) {
  const reached = {
    harvest: true, // si está en la lista, la cosecha existe
    green:   counts.n_green   > 0,
    roast:   counts.n_roast   > 0,
    roasted: counts.n_roasted > 0,
    pack:    counts.n_pack    > 0,
    label:   counts.n_label   > 0,
  };

  let current = 'harvest';
  for (const stage of STAGE_ORDER) {
    if (reached[stage]) current = stage;
  }

  return { reached, current };
}

/**
 * GET /api/production/lots
 * Lista de lotes con su etapa actual, para el selector del pipeline.
 */
lotsRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        ch.lot_id AS code,
        ch.created_at,
        (SELECT COUNT(*) FROM green_coffee_inventory g
           WHERE g.lot_id = ch.lot_id) AS n_green,
        (SELECT COUNT(*) FROM roasting_batches rb
           WHERE rb.lot_id = ch.lot_id) AS n_roast,
        (SELECT COUNT(*) FROM roasted_coffee_inventory rci
           JOIN roasted_coffee rc  ON rc.id = rci.roasted_id
           JOIN roasting_batches rb ON rb.id = rc.roasting_id
           WHERE rb.lot_id = ch.lot_id) AS n_roasted,
        (SELECT COUNT(*) FROM packaged_coffee pc
           JOIN roasted_coffee_inventory rci ON rci.id = pc.roasted_storage_id
           JOIN roasted_coffee rc  ON rc.id = rci.roasted_id
           JOIN roasting_batches rb ON rb.id = rc.roasting_id
           WHERE rb.lot_id = ch.lot_id) AS n_pack,
        (SELECT COUNT(*) FROM generated_labels gl
           WHERE gl.lot_code = ch.lot_id) AS n_label
      FROM coffee_harvests ch
      ORDER BY ch.created_at DESC
      LIMIT 200
    `);

    const lots = rows.map((r) => {
      const { current } = resolveStages(r);
      // Si el lote ya tiene etiquetas, el pipeline está completo.
      const currentStage = current === 'label' ? 'done' : current;
      return { id: r.code, code: r.code, current_stage: currentStage };
    });

    res.json({ success: true, data: lots });
  } catch (error) {
    logger.error('[GET /production/lots] Error:', error);
    res.status(500).json({ success: false, error: 'Error al cargar los lotes de producción' });
  }
});

/**
 * GET /api/production/lots/:id
 * Trazabilidad completa de un lote: datos del lote + detalle por etapa.
 */
lotsRouter.get('/:id', async (req, res) => {
  const lotId = req.params.id;
  try {
    const harvest = await query(
      `SELECT lot_id AS code, farm AS origin_farm, region, variety, altitude,
              climate, process, aroma, taste_notes, created_at
       FROM coffee_harvests WHERE lot_id = ?`,
      [lotId]
    );
    if (!harvest.rows.length) {
      return res.status(404).json({ success: false, error: 'Lote no encontrado' });
    }
    const h = harvest.rows[0];

    // Registros de cada etapa (agregados por lote).
    const [green, roast, roasted, pack, label, score] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(weight_kg), 0) AS kg, COUNT(*) AS n,
                MIN(storage_date) AS started_at, MIN(created_at) AS created_at,
                GROUP_CONCAT(DISTINCT location) AS warehouse
         FROM green_coffee_inventory WHERE lot_id = ?`,
        [lotId]
      ),
      query(
        `SELECT COALESCE(SUM(quantity_sent_kg), 0) AS kg, COUNT(*) AS n,
                MIN(created_at) AS started_at, AVG(target_temp) AS target_temp
         FROM roasting_batches WHERE lot_id = ?`,
        [lotId]
      ),
      query(
        `SELECT COALESCE(SUM(rc.weight_kg), 0) AS kg, COUNT(*) AS n,
                MIN(rci.created_at) AS started_at, MIN(rc.created_at) AS roast_at,
                GROUP_CONCAT(DISTINCT rci.location) AS warehouse,
                AVG(rc.weight_loss_percent) AS merma_pct,
                AVG(rc.roast_time_minutes) AS duration_min,
                AVG(rc.actual_temp) AS drop_temp_c
         FROM roasted_coffee_inventory rci
         JOIN roasted_coffee rc  ON rc.id = rci.roasted_id
         JOIN roasting_batches rb ON rb.id = rc.roasting_id
         WHERE rb.lot_id = ?`,
        [lotId]
      ),
      query(
        `SELECT COUNT(*) AS n, COALESCE(SUM(pc.unit_count), 0) AS total_units,
                MIN(pc.created_at) AS started_at,
                GROUP_CONCAT(DISTINCT pc.package_size) AS skus
         FROM packaged_coffee pc
         JOIN roasted_coffee_inventory rci ON rci.id = pc.roasted_storage_id
         JOIN roasted_coffee rc  ON rc.id = rci.roasted_id
         JOIN roasting_batches rb ON rb.id = rc.roasting_id
         WHERE rb.lot_id = ?`,
        [lotId]
      ),
      query(
        `SELECT COUNT(*) AS n, MIN(created_at) AS started_at
         FROM generated_labels WHERE lot_code = ?`,
        [lotId]
      ),
      query(
        `SELECT AVG(score) AS cup_score FROM generated_labels
         WHERE lot_code = ? AND score IS NOT NULL`,
        [lotId]
      ),
    ]);

    const g = green.rows[0],  r = roast.rows[0],   rd = roasted.rows[0];
    const p = pack.rows[0],   l = label.rows[0];

    const counts = {
      n_green:   Number(g.n)  || 0,
      n_roast:   Number(r.n)  || 0,
      n_roasted: Number(rd.n) || 0,
      n_pack:    Number(p.n)  || 0,
      n_label:   Number(l.n)  || 0,
    };
    const { reached, current } = resolveStages(counts);

    // status por etapa: completed (etapa anterior a la actual o etapa final
    // alcanzada), in_progress (etapa actual no final), pending (sin registro).
    const statusFor = (stage) => {
      if (!reached[stage]) return 'pending';
      if (stage === current) return current === 'label' ? 'completed' : 'in_progress';
      return 'completed';
    };

    const stages = {
      harvest: {
        status: statusFor('harvest'),
        kg: null,
        when: h.created_at,
        started_at: h.created_at,
        ended_at: null,
        responsible: null,
        details: {
          variety: h.variety,
          altitude: h.altitude,
          humidity_pct: null,
          defects_per_300g: null,
        },
      },
      green: {
        status: statusFor('green'),
        kg: reached.green ? Number(g.kg) || 0 : null,
        when: g.started_at || g.created_at,
        started_at: g.started_at || g.created_at,
        ended_at: null,
        responsible: null,
        details: {
          warehouse: g.warehouse,
          merma_pct: null,
          humidity_pct: null,
          days_in_storage: daysSince(g.started_at || g.created_at),
        },
      },
      roast: {
        status: statusFor('roast'),
        kg: reached.roast ? Number(r.kg) || 0 : null,
        when: r.started_at,
        started_at: r.started_at,
        ended_at: reached.roasted ? rd.roast_at : null,
        responsible: null,
        details: {
          roaster: null,
          profile: null,
          drop_temp_c: rd.drop_temp_c != null ? Math.round(rd.drop_temp_c) : r.target_temp,
          duration_min: rd.duration_min != null ? Math.round(rd.duration_min) : null,
          merma_pct: rd.merma_pct != null ? Number(rd.merma_pct.toFixed?.(1) ?? rd.merma_pct) : null,
          eta: null,
        },
      },
      roasted: {
        status: statusFor('roasted'),
        kg: reached.roasted ? Number(rd.kg) || 0 : null,
        when: rd.started_at,
        started_at: rd.started_at,
        ended_at: null,
        responsible: null,
        details: {
          warehouse: rd.warehouse,
          days_since_roast: daysSince(rd.roast_at),
        },
      },
      pack: {
        status: statusFor('pack'),
        kg: null,
        when: p.started_at,
        started_at: p.started_at,
        ended_at: null,
        responsible: null,
        details: {
          skus: p.skus ? p.skus.split(',') : null,
          total_units: reached.pack ? Number(p.total_units) || 0 : null,
          line: null,
        },
      },
      label: {
        status: statusFor('label'),
        kg: null,
        when: l.started_at,
        started_at: l.started_at,
        ended_at: null,
        responsible: null,
        details: {
          label_count: reached.label ? Number(l.n) || 0 : null,
          qr_template: null,
          trace_url: reached.label ? `https://dobleyo.cafe/trazabilidad?lote=${encodeURIComponent(lotId)}` : null,
        },
      },
    };

    const lot = {
      code: h.code,
      origin_farm: h.origin_farm,
      caficultor: null,
      region: h.region,
      variety: h.variety,
      altitude: h.altitude,
      cherry_kg: reached.green ? Number(g.kg) || null : null,
      cup_score: score.rows[0]?.cup_score != null ? Number(Number(score.rows[0].cup_score).toFixed(1)) : null,
    };

    res.json({ success: true, data: { lot, stages } });
  } catch (error) {
    logger.error(`[GET /production/lots/${lotId}] Error:`, error);
    res.status(500).json({ success: false, error: 'Error al cargar la trazabilidad del lote' });
  }
});

/**
 * POST /api/production/lots/:id/advance
 * Cada etapa requiere datos propios (peso, ubicación, perfil de tueste, etc.)
 * que se capturan en su página de registro. Por eso el avance no se ejecuta
 * aquí: se redirige al operador a la página correspondiente.
 */
lotsRouter.post('/:id/advance', async (req, res) => {
  const { from } = req.body ?? {};
  const idx = STAGE_ORDER.indexOf(from);
  const next = idx >= 0 ? STAGE_ORDER[idx + 1] : null;

  if (!next) {
    return res.status(400).json({
      success: false,
      error: 'El lote ya está en la etapa final del pipeline.',
    });
  }

  return res.status(409).json({
    success: false,
    error: `Para avanzar a «${STAGE_LABEL[next]}» registre los datos en ${STAGE_PAGE[next]}`,
  });
});
