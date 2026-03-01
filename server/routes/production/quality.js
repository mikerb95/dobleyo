import express from 'express';
import { query } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

export const qualityRouter = express.Router();

// Requerir autenticación y rol admin/caficultor para todas las rutas
qualityRouter.use(authenticateToken);
qualityRouter.use(requireRole(['admin', 'caficultor']));

// ==========================================
// CONTROL DE CALIDAD
// ==========================================

/**
 * GET /api/production/quality
 * Lista inspecciones de calidad con filtros
 */
qualityRouter.get('/', async (req, res) => {
  try {
    const {
      check_type,
      passed,
      date_from,
      date_to,
      inspector_id,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT
        pqc.id, pqc.check_number, pqc.check_type, pqc.check_date,
        pqc.passed, pqc.overall_score, pqc.observations,
        pqc.production_order_id, pqc.roast_batch_id,
        u.name as inspector_name,
        rb.batch_number,
        po.order_number
      FROM production_quality_checks pqc
      LEFT JOIN users u ON pqc.inspector_id = u.id
      LEFT JOIN roast_batches rb ON pqc.roast_batch_id = rb.id
      LEFT JOIN production_orders po ON pqc.production_order_id = po.id
      WHERE 1=1
    `;
    const params = [];

    if (check_type) {
      sql += ` AND pqc.check_type = $${params.length + 1}`;
      params.push(check_type);
    }

    if (passed !== undefined) {
      sql += ` AND pqc.passed = $${params.length + 1}`;
      params.push(passed === 'true');
    }

    if (date_from) {
      sql += ` AND pqc.check_date::date >= $${params.length + 1}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND pqc.check_date::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    if (inspector_id) {
      sql += ` AND pqc.inspector_id = $${params.length + 1}`;
      params.push(inspector_id);
    }

    sql += ` ORDER BY pqc.check_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows: checks } = await query(sql, params);

    res.json({
      success: true,
      data: checks,
      pagination: { limit: parseInt(limit), offset: parseInt(offset), total: checks.length }
    });
  } catch (error) {
    console.error('Error fetching quality checks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/quality/stats/summary
 * Resumen de calidad del período
 */
qualityRouter.get('/stats/summary', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let sql = `
      SELECT
        COUNT(*) as total_checks,
        SUM(CASE WHEN passed = TRUE THEN 1 ELSE 0 END) as passed_checks,
        SUM(CASE WHEN passed = FALSE THEN 1 ELSE 0 END) as failed_checks,
        ROUND(AVG(overall_score)::numeric, 2) as avg_score,
        MIN(overall_score) as min_score,
        MAX(overall_score) as max_score,
        check_type
      FROM production_quality_checks
      WHERE 1=1
    `;
    const params = [];

    if (date_from) {
      sql += ` AND check_date::date >= $${params.length + 1}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND check_date::date <= $${params.length + 1}`;
      params.push(date_to);
    }

    sql += ` GROUP BY check_type`;

    const { rows: stats } = await query(sql, params);

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting quality stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/quality/:id
 * Obtiene detalle de inspección
 */
qualityRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(`
      SELECT
        pqc.*,
        u.name as inspector_name, u.email as inspector_email,
        ab.name as approver_name,
        rb.batch_number,
        po.order_number
      FROM production_quality_checks pqc
      LEFT JOIN users u ON pqc.inspector_id = u.id
      LEFT JOIN users ab ON pqc.approved_by = ab.id
      LEFT JOIN roast_batches rb ON pqc.roast_batch_id = rb.id
      LEFT JOIN production_orders po ON pqc.production_order_id = po.id
      WHERE pqc.id = $1
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Quality check not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching quality check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/quality
 * Crea nueva inspección de calidad
 */
qualityRouter.post('/', async (req, res) => {
  try {
    const {
      production_order_id,
      roast_batch_id,
      check_type,
      inspector_id,
      overall_score,
      passed,
      observations,
      defects_found
    } = req.body;

    if (!check_type || !inspector_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const check_number = `QC-${Date.now().toString().slice(-6)}`;

    const { rows } = await query(`
      INSERT INTO production_quality_checks (
        check_number, production_order_id, roast_batch_id,
        check_type, check_date, inspector_id, passed,
        overall_score, observations, defects_found
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      check_number, production_order_id || null, roast_batch_id || null,
      check_type, inspector_id, passed ? true : false,
      overall_score || null, observations || null, defects_found || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Quality check created',
      data: { id: rows[0].id, check_number }
    });
  } catch (error) {
    console.error('Error creating quality check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/quality/cupping
 * Registra catación (cupping SCA)
 */
qualityRouter.post('/cupping', async (req, res) => {
  try {
    const {
      roast_batch_id,
      production_order_id,
      inspector_id,
      aroma_score,
      flavor_score,
      acidity_score,
      body_score,
      balance_score,
      aftertaste_score,
      sweetness_score,
      uniformity_score,
      clean_cup_score,
      moisture_percentage,
      observations
    } = req.body;

    if (!inspector_id) {
      return res.status(400).json({ success: false, error: 'Inspector ID required' });
    }

    // Calcular puntuación total (escala SCA 0-100)
    const scores = [
      aroma_score, flavor_score, acidity_score, body_score, balance_score,
      aftertaste_score, sweetness_score, uniformity_score, clean_cup_score
    ].filter(s => s !== undefined && s !== null);

    const overall_score = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : null;

    const check_number = `CUP-${Date.now().toString().slice(-6)}`;

    const { rows } = await query(`
      INSERT INTO production_quality_checks (
        check_number, production_order_id, roast_batch_id,
        check_type, check_date, inspector_id, passed,
        overall_score, aroma_score, flavor_score, acidity_score,
        body_score, balance_score, aftertaste_score, sweetness_score,
        uniformity_score, clean_cup_score, moisture_percentage,
        observations
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id
    `, [
      check_number, production_order_id || null, roast_batch_id || null,
      'catacion', inspector_id, overall_score >= 80,
      overall_score,
      aroma_score || null, flavor_score || null, acidity_score || null,
      body_score || null, balance_score || null, aftertaste_score || null,
      sweetness_score || null, uniformity_score || null, clean_cup_score || null,
      moisture_percentage || null, observations || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Cupping recorded',
      data: { id: rows[0].id, check_number, overall_score, passed: overall_score >= 80 }
    });
  } catch (error) {
    console.error('Error recording cupping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/production/quality/:id
 * Actualiza inspección de calidad
 */
qualityRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { overall_score, passed, defects_found, corrective_actions, observations } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (overall_score !== undefined) {
      updateFields.push(`overall_score = $${updateValues.length + 1}`);
      updateValues.push(overall_score);
    }
    if (passed !== undefined) {
      updateFields.push(`passed = $${updateValues.length + 1}`);
      updateValues.push(passed ? true : false);
    }
    if (defects_found !== undefined) {
      updateFields.push(`defects_found = $${updateValues.length + 1}`);
      updateValues.push(defects_found);
    }
    if (corrective_actions !== undefined) {
      updateFields.push(`corrective_actions = $${updateValues.length + 1}`);
      updateValues.push(corrective_actions);
    }
    if (observations !== undefined) {
      updateFields.push(`observations = $${updateValues.length + 1}`);
      updateValues.push(observations);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    await query(
      `UPDATE production_quality_checks SET ${updateFields.join(', ')} WHERE id = $${updateValues.length}`,
      updateValues
    );

    res.json({ success: true, message: 'Quality check updated' });
  } catch (error) {
    console.error('Error updating quality check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/quality/:id/approve
 * Aprueba inspección de calidad
 */
qualityRouter.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by_user_id } = req.body;

    if (!approved_by_user_id) {
      return res.status(400).json({ success: false, error: 'Approved by user required' });
    }

    await query(`
      UPDATE production_quality_checks
      SET approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [approved_by_user_id, id]);

    res.json({ success: true, message: 'Quality check approved' });
  } catch (error) {
    console.error('Error approving quality check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
