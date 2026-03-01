import express from 'express';
import { query } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

export const batchesRouter = express.Router();

// Requerir autenticación y rol admin/caficultor para todas las rutas
batchesRouter.use(authenticateToken);
batchesRouter.use(requireRole(['admin', 'caficultor']));

// ==========================================
// BATCHES DE TOSTADO
// ==========================================

/**
 * GET /api/production/batches
 * Lista batches de tostado con filtros opcionales
 */
batchesRouter.get('/', async (req, res) => {
  try {
    const {
      production_order_id,
      operator_id,
      date_from,
      date_to,
      is_approved,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT
        rb.id, rb.batch_number, rb.production_order_id,
        rb.green_coffee_weight_kg, rb.roasted_coffee_weight_kg,
        rb.weight_loss_percentage, rb.roast_level_achieved,
        rb.roast_date, rb.roast_start_time, rb.roast_end_time,
        rb.actual_duration_minutes, rb.first_crack_time_minutes,
        rb.quality_score, rb.is_approved, rb.approved_at,
        u.name as operator_name,
        po.order_number
      FROM roast_batches rb
      LEFT JOIN users u ON rb.operator_id = u.id
      LEFT JOIN production_orders po ON rb.production_order_id = po.id
      WHERE 1=1
    `;
    const params = [];

    if (production_order_id) {
      sql += ` AND rb.production_order_id = $${params.length + 1}`;
      params.push(production_order_id);
    }

    if (operator_id) {
      sql += ` AND rb.operator_id = $${params.length + 1}`;
      params.push(operator_id);
    }

    if (date_from) {
      sql += ` AND rb.roast_date::date >= $${params.length + 1}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND rb.roast_date::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    if (is_approved !== undefined) {
      sql += ` AND rb.is_approved = $${params.length + 1}`;
      params.push(is_approved === 'true');
    }

    sql += ` ORDER BY rb.roast_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows: batches } = await query(sql, params);

    res.json({
      success: true,
      data: batches,
      pagination: { limit: parseInt(limit), offset: parseInt(offset), total: batches.length }
    });
  } catch (error) {
    console.error('Error fetching roast batches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/batches/:id
 * Obtiene detalle de un batch con QC y mermas
 */
batchesRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: batchRows } = await query(`
      SELECT
        rb.*,
        u.name as operator_name, u.email as operator_email,
        l.code as green_lot_code, l.origin, l.variety,
        rp.profile_code, rp.profile_name, rp.roast_level as target_roast_level,
        rp.development_time_ratio as target_dtr, rp.color_agtron as target_agtron,
        re.equipment_name, re.batch_capacity_kg,
        po.order_number
      FROM roast_batches rb
      LEFT JOIN users u ON rb.operator_id = u.id
      LEFT JOIN lots l ON rb.green_coffee_lot_id = l.id
      LEFT JOIN roast_profiles rp ON rb.roast_profile_id = rp.id
      LEFT JOIN roasting_equipment re ON rb.roasting_equipment_id = re.id
      LEFT JOIN production_orders po ON rb.production_order_id = po.id
      WHERE rb.id = $1
    `, [id]);

    if (!batchRows.length) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const { rows: qcRows } = await query(`
      SELECT * FROM production_quality_checks
      WHERE roast_batch_id = $1
      ORDER BY check_date DESC
      LIMIT 1
    `, [id]);

    const { rows: wasteRows } = await query(`
      SELECT * FROM production_waste_byproducts
      WHERE roast_batch_id = $1
    `, [id]);

    res.json({
      success: true,
      data: {
        ...batchRows[0],
        quality_check: qcRows.length ? qcRows[0] : null,
        waste: wasteRows
      }
    });
  } catch (error) {
    console.error('Error fetching roast batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches
 * Crea nuevo batch de tostado
 */
batchesRouter.post('/', async (req, res) => {
  try {
    const {
      production_order_id,
      roast_profile_id,
      roasting_equipment_id,
      green_coffee_lot_id,
      green_coffee_weight_kg,
      operator_id
    } = req.body;

    if (!production_order_id || !roasting_equipment_id || !green_coffee_lot_id || !green_coffee_weight_kg || !operator_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const timestamp = Date.now().toString().slice(-6);
    const batch_number = `BATCH-${timestamp}`;

    const { rows } = await query(`
      INSERT INTO roast_batches (
        batch_number, production_order_id, roast_profile_id,
        roasting_equipment_id, green_coffee_lot_id, green_coffee_weight_kg,
        roast_date, roast_start_time, operator_id
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)
      RETURNING id
    `, [
      batch_number, production_order_id, roast_profile_id || null,
      roasting_equipment_id, green_coffee_lot_id, green_coffee_weight_kg,
      operator_id
    ]);

    res.status(201).json({
      success: true,
      message: 'Roast batch created',
      data: { id: rows[0].id, batch_number, production_order_id }
    });
  } catch (error) {
    console.error('Error creating roast batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/first-crack
 * Registra primer crack
 */
batchesRouter.post('/:id/first-crack', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_minutes, temperature_celsius } = req.body;

    if (time_minutes === undefined || temperature_celsius === undefined) {
      return res.status(400).json({ success: false, error: 'Time and temperature required' });
    }

    await query(`
      UPDATE roast_batches
      SET first_crack_time_minutes = $1, first_crack_temperature_celsius = $2, updated_at = NOW()
      WHERE id = $3
    `, [time_minutes, temperature_celsius, id]);

    res.json({
      success: true,
      message: 'First crack recorded',
      first_crack: { time: time_minutes, temperature: temperature_celsius }
    });
  } catch (error) {
    console.error('Error recording first crack:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/second-crack
 * Registra segundo crack
 */
batchesRouter.post('/:id/second-crack', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_minutes } = req.body;

    if (time_minutes === undefined) {
      return res.status(400).json({ success: false, error: 'Time required' });
    }

    await query(`
      UPDATE roast_batches
      SET second_crack_time_minutes = $1, updated_at = NOW()
      WHERE id = $2
    `, [time_minutes, id]);

    res.json({ success: true, message: 'Second crack recorded' });
  } catch (error) {
    console.error('Error recording second crack:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/complete
 * Finaliza tostado y registra pesos finales
 */
batchesRouter.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      roasted_coffee_weight_kg,
      drop_temperature_celsius,
      color_agtron,
      quality_score,
      quality_notes,
      ambient_temperature_celsius,
      humidity_percentage
    } = req.body;

    if (!roasted_coffee_weight_kg || drop_temperature_celsius === undefined) {
      return res.status(400).json({ success: false, error: 'Roasted weight and drop temperature required' });
    }

    const { rows: batchRows } = await query(`
      SELECT green_coffee_weight_kg, first_crack_time_minutes, roast_start_time
      FROM roast_batches
      WHERE id = $1
    `, [id]);

    if (!batchRows.length) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const green_weight = batchRows[0].green_coffee_weight_kg;
    const roasted_weight = parseFloat(roasted_coffee_weight_kg);
    const weight_loss_percentage = ((green_weight - roasted_weight) / green_weight * 100).toFixed(2);

    let dtr = null;
    if (batchRows[0].first_crack_time_minutes) {
      const total_time = Math.ceil((Date.now() - new Date(batchRows[0].roast_start_time).getTime()) / 60000);
      const development_time = total_time - batchRows[0].first_crack_time_minutes;
      dtr = (development_time / batchRows[0].first_crack_time_minutes * 100).toFixed(2);
    }

    const actual_duration_minutes = Math.ceil(
      (Date.now() - new Date(batchRows[0].roast_start_time).getTime()) / 60000
    );

    await query(`
      UPDATE roast_batches
      SET
        roast_end_time = NOW(),
        actual_duration_minutes = $1,
        roasted_coffee_weight_kg = $2,
        weight_loss_percentage = $3,
        drop_temperature_celsius = $4,
        color_agtron = $5,
        development_time_ratio = $6,
        quality_score = $7,
        quality_notes = $8,
        ambient_temperature_celsius = $9,
        humidity_percentage = $10,
        updated_at = NOW()
      WHERE id = $11
    `, [
      actual_duration_minutes, roasted_weight, weight_loss_percentage,
      drop_temperature_celsius, color_agtron || null, dtr,
      quality_score || null, quality_notes || null,
      ambient_temperature_celsius || null, humidity_percentage || null,
      id
    ]);

    res.json({
      success: true,
      message: 'Roast completed',
      data: { roasted_weight, weight_loss_percentage, actual_duration_minutes, development_time_ratio: dtr }
    });
  } catch (error) {
    console.error('Error completing roast batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/approve
 * Aprueba batch (QC)
 */
batchesRouter.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by_user_id } = req.body;

    if (!approved_by_user_id) {
      return res.status(400).json({ success: false, error: 'Approved by user required' });
    }

    await query(`
      UPDATE roast_batches
      SET is_approved = TRUE, approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [approved_by_user_id, id]);

    res.json({ success: true, message: 'Batch approved', is_approved: true });
  } catch (error) {
    console.error('Error approving batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/reject
 * Rechaza batch (QC)
 */
batchesRouter.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, approved_by_user_id } = req.body;

    if (!reason || !approved_by_user_id) {
      return res.status(400).json({ success: false, error: 'Reason and approved by user required' });
    }

    await query(`
      UPDATE roast_batches
      SET defects_found = $1, notes = $2, updated_at = NOW()
      WHERE id = $3
    `, [`Rechazado: ${reason}`, `Rechazado por: ${approved_by_user_id}`, id]);

    res.json({ success: true, message: 'Batch rejected', reason });
  } catch (error) {
    console.error('Error rejecting batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/batches/:id/comparison
 * Compara batch actual con perfil objetivo
 */
batchesRouter.get('/:id/comparison', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(`
      SELECT
        rb.roast_level_achieved, rb.actual_duration_minutes,
        rb.first_crack_time_minutes, rb.development_time_ratio,
        rb.color_agtron, rb.drop_temperature_celsius,
        rp.roast_level as target_roast_level, rp.roast_duration_minutes as target_duration,
        rp.first_crack_time_minutes as target_first_crack,
        rp.development_time_ratio as target_dtr, rp.color_agtron as target_agtron,
        rp.target_temperature_celsius
      FROM roast_batches rb
      LEFT JOIN roast_profiles rp ON rb.roast_profile_id = rp.id
      WHERE rb.id = $1
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const b = rows[0];
    const comparison = {
      roast_level: {
        target: b.target_roast_level,
        actual: b.roast_level_achieved,
        match: b.roast_level_achieved === b.target_roast_level
      },
      duration: {
        target: b.target_duration,
        actual: b.actual_duration_minutes,
        variance: b.actual_duration_minutes ? b.actual_duration_minutes - b.target_duration : null
      },
      first_crack: {
        target: b.target_first_crack,
        actual: b.first_crack_time_minutes,
        variance: b.first_crack_time_minutes ? b.first_crack_time_minutes - b.target_first_crack : null
      },
      dtr: {
        target: b.target_dtr,
        actual: b.development_time_ratio,
        variance: b.development_time_ratio ? (b.development_time_ratio - b.target_dtr).toFixed(2) : null
      },
      color_agtron: {
        target: b.target_agtron,
        actual: b.color_agtron,
        variance: b.color_agtron ? b.color_agtron - b.target_agtron : null
      }
    };

    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('Error comparing batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
