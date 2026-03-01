import express from 'express';
import { query as db } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

const router = express.Router();

// PROTECCIÓN: Requerir autenticación y rol admin/caficultor para todas las rutas de producción
router.use(authenticateToken);
router.use(requireRole(['admin', 'caficultor']));

// ==========================================
// BATCHES DE TOSTADO
// ==========================================

/**
 * GET /api/production/batches
 * Lista batches de tostado
 */
router.get('/', async (req, res) => {
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

    let query = `
      SELECT 
        rb.id, rb.batch_number, rb.production_order_id,
        rb.green_coffee_weight_kg, rb.roasted_coffee_weight_kg,
        rb.weight_loss_percentage, rb.roast_level_achieved,
        rb.roast_date, rb.actual_duration_minutes,
        rb.is_approved, rb.quality_score,
        u.name as operator_name,
        l.code as green_lot_code, l.origin,
        rp.profile_name, rp.roast_level as target_roast_level,
        re.equipment_name
      FROM roast_batches rb
      LEFT JOIN users u ON rb.operator_id = u.id
      LEFT JOIN lots l ON rb.green_coffee_lot_id = l.id
      LEFT JOIN roast_profiles rp ON rb.roast_profile_id = rp.id
      LEFT JOIN roasting_equipment re ON rb.roasting_equipment_id = re.id
      WHERE 1=1
    `;

    const params = [];

    if (production_order_id) {
      query += ` AND rb.production_order_id = ?`;
      params.push(production_order_id);
    }

    if (operator_id) {
      query += ` AND rb.operator_id = ?`;
      params.push(operator_id);
    }

    if (date_from) {
      query += ` AND DATE(rb.roast_date) >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND DATE(rb.roast_date) <= ?`;
      params.push(date_to);
    }

    if (is_approved !== undefined) {
      query += ` AND rb.is_approved = ?`;
      params.push(is_approved === 'true' ? 1 : 0);
    }

    query += ` ORDER BY rb.roast_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [batches] = await db.query(query, params);

    res.json({
      success: true,
      data: batches,
      pagination: { limit, offset, total: batches.length }
    });
  } catch (error) {
    console.error('Error fetching roast batches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/batches/:id
 * Obtiene detalle de un batch
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [batch] = await db.query(`
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
      WHERE rb.id = ?
    `, [id]);

    if (!batch.length) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    // Obtener QC relacionado
    const [qc] = await db.query(`
      SELECT * FROM production_quality_checks
      WHERE roast_batch_id = ?
      ORDER BY check_date DESC
      LIMIT 1
    `, [id]);

    // Obtener mermas
    const [waste] = await db.query(`
      SELECT * FROM production_waste_byproducts
      WHERE roast_batch_id = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        ...batch[0],
        quality_check: qc.length ? qc[0] : null,
        waste: waste
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
router.post('/', async (req, res) => {
  try {
    const {
      production_order_id,
      roast_profile_id,
      roasting_equipment_id,
      green_coffee_lot_id,
      green_coffee_weight_kg,
      operator_id
    } = req.body;

    // Validación
    if (!production_order_id || !roasting_equipment_id || !green_coffee_lot_id || !green_coffee_weight_kg || !operator_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Generar número de batch
    const timestamp = Date.now().toString().slice(-6);
    const batch_number = `BATCH-${timestamp}`;

    const [result] = await db.query(`
      INSERT INTO roast_batches (
        batch_number, production_order_id, roast_profile_id,
        roasting_equipment_id, green_coffee_lot_id, green_coffee_weight_kg,
        roast_date, roast_start_time, operator_id
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
    `, [
      batch_number, production_order_id, roast_profile_id || null,
      roasting_equipment_id, green_coffee_lot_id, green_coffee_weight_kg,
      operator_id
    ]);

    res.status(201).json({
      success: true,
      message: 'Roast batch created',
      data: {
        id: result.insertId,
        batch_number,
        production_order_id
      }
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
router.post('/:id/first-crack', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_minutes, temperature_celsius } = req.body;

    if (time_minutes === undefined || temperature_celsius === undefined) {
      return res.status(400).json({ success: false, error: 'Time and temperature required' });
    }

    await db.query(`
      UPDATE roast_batches 
      SET first_crack_time_minutes = ?, first_crack_temperature_celsius = ?, updated_at = NOW()
      WHERE id = ?
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
router.post('/:id/second-crack', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_minutes } = req.body;

    if (time_minutes === undefined) {
      return res.status(400).json({ success: false, error: 'Time required' });
    }

    await db.query(`
      UPDATE roast_batches 
      SET second_crack_time_minutes = ?, updated_at = NOW()
      WHERE id = ?
    `, [time_minutes, id]);

    res.json({ 
      success: true, 
      message: 'Second crack recorded'
    });
  } catch (error) {
    console.error('Error recording second crack:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/complete
 * Finaliza tostado y registra pesos finales
 */
router.post('/:id/complete', async (req, res) => {
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

    // Obtener verde weight para calcular merma
    const [batch] = await db.query(`
      SELECT green_coffee_weight_kg, first_crack_time_minutes
      FROM roast_batches
      WHERE id = ?
    `, [id]);

    if (!batch.length) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const green_weight = batch[0].green_coffee_weight_kg;
    const roasted_weight = parseFloat(roasted_coffee_weight_kg);
    const weight_loss_percentage = ((green_weight - roasted_weight) / green_weight * 100).toFixed(2);

    // Calcular DTR si hay primer crack
    let dtr = null;
    if (batch[0].first_crack_time_minutes) {
      const total_time = Math.ceil((new Date() - new Date(batch[0].roast_start_time)) / 1000 / 60);
      const development_time = total_time - batch[0].first_crack_time_minutes;
      dtr = (development_time / batch[0].first_crack_time_minutes * 100).toFixed(2);
    }

    const actual_duration_minutes = Math.ceil(
      (new Date() - new Date(batch[0].roast_start_time)) / 1000 / 60
    );

    await db.query(`
      UPDATE roast_batches 
      SET 
        roast_end_time = NOW(),
        actual_duration_minutes = ?,
        roasted_coffee_weight_kg = ?,
        weight_loss_percentage = ?,
        drop_temperature_celsius = ?,
        color_agtron = ?,
        development_time_ratio = ?,
        quality_score = ?,
        quality_notes = ?,
        ambient_temperature_celsius = ?,
        humidity_percentage = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      actual_duration_minutes,
      roasted_weight,
      weight_loss_percentage,
      drop_temperature_celsius,
      color_agtron || null,
      dtr,
      quality_score || null,
      quality_notes || null,
      ambient_temperature_celsius || null,
      humidity_percentage || null,
      id
    ]);

    res.json({
      success: true,
      message: 'Roast completed',
      data: {
        roasted_weight: roasted_weight,
        weight_loss_percentage: weight_loss_percentage,
        actual_duration_minutes: actual_duration_minutes,
        development_time_ratio: dtr
      }
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
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by_user_id } = req.body;

    if (!approved_by_user_id) {
      return res.status(400).json({ success: false, error: 'Approved by user required' });
    }

    await db.query(`
      UPDATE roast_batches 
      SET is_approved = TRUE, approved_by = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [approved_by_user_id, id]);

    res.json({
      success: true,
      message: 'Batch approved',
      is_approved: true
    });
  } catch (error) {
    console.error('Error approving batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/batches/:id/reject
 * Rechaza batch (QC)
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, approved_by_user_id } = req.body;

    if (!reason || !approved_by_user_id) {
      return res.status(400).json({ success: false, error: 'Reason and approved by user required' });
    }

    await db.query(`
      UPDATE roast_batches 
      SET defects_found = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `, [`Rechazado: ${reason}`, `Rechazado por: ${approved_by_user_id}`, id]);

    res.json({
      success: true,
      message: 'Batch rejected',
      reason: reason
    });
  } catch (error) {
    console.error('Error rejecting batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/batches/:id/comparison
 * Compara batch actual con perfil objetivo
 */
router.get('/:id/comparison', async (req, res) => {
  try {
    const { id } = req.params;

    const [batch] = await db.query(`
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
      WHERE rb.id = ?
    `, [id]);

    if (!batch.length) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const b = batch[0];

    // Calcular variaciones
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

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


