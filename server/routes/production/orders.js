import express from 'express';
import { query } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

export const ordersRouter = express.Router();

// Requerir autenticación y rol admin/caficultor para todas las rutas
ordersRouter.use(authenticateToken);
ordersRouter.use(requireRole(['admin', 'caficultor']));

// ==========================================
// ÓRDENES DE PRODUCCIÓN — CRUD
// ==========================================

/**
 * GET /api/production/orders
 * Lista órdenes de producción con filtros
 */
ordersRouter.get('/', async (req, res) => {
  try {
    const { state, work_center_id, date_from, date_to, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT
        po.id, po.order_number, po.product_id, p.name as product_name,
        po.planned_quantity, po.produced_quantity, po.quantity_unit,
        po.state, po.priority, po.scheduled_date,
        po.start_date, po.end_date, po.production_cost,
        u.name as responsible_user,
        re.equipment_name,
        wc.name as work_center_name
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN users u ON po.responsible_user_id = u.id
      LEFT JOIN roasting_equipment re ON po.roasting_equipment_id = re.id
      LEFT JOIN work_centers wc ON po.work_center_id = wc.id
      WHERE 1=1
    `;
    const params = [];

    if (state) {
      sql += ` AND po.state = $${params.length + 1}`;
      params.push(state);
    }

    if (work_center_id) {
      sql += ` AND po.work_center_id = $${params.length + 1}`;
      params.push(work_center_id);
    }

    if (date_from) {
      sql += ` AND po.scheduled_date >= $${params.length + 1}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND po.scheduled_date <= $${params.length + 1}`;
      params.push(date_to);
    }

    sql += ` ORDER BY po.scheduled_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows: orders } = await query(sql, params);

    res.json({
      success: true,
      data: orders,
      pagination: { limit: parseInt(limit), offset: parseInt(offset), total: orders.length }
    });
  } catch (error) {
    console.error('Error fetching production orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/orders/:id
 * Obtiene detalle de una orden con componentes, consumos y batches
 */
ordersRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: orderRows } = await query(`
      SELECT
        po.*, p.name as product_name,
        u.name as responsible_user, u.email as responsible_email,
        re.equipment_name, re.batch_capacity_kg,
        b.bom_code, b.loss_percentage as bom_loss_percentage,
        wc.name as work_center_name
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN users u ON po.responsible_user_id = u.id
      LEFT JOIN roasting_equipment re ON po.roasting_equipment_id = re.id
      LEFT JOIN bill_of_materials b ON po.bom_id = b.id
      LEFT JOIN work_centers wc ON po.work_center_id = wc.id
      WHERE po.id = $1
    `, [id]);

    if (!orderRows.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const { rows: components } = await query(`
      SELECT
        bc.id, bc.component_product_id, prd.name as component_name,
        bc.quantity, bc.quantity_unit,
        prd.stock_quantity, bc.component_type
      FROM bom_components bc
      JOIN products prd ON bc.component_product_id = prd.id
      WHERE bc.bom_id = $1
    `, [orderRows[0].bom_id]);

    const { rows: consumptions } = await query(`
      SELECT
        pmc.id, pmc.product_id, prd.name,
        pmc.planned_quantity, pmc.consumed_quantity, pmc.quantity_unit,
        pmc.consumption_date
      FROM production_material_consumption pmc
      JOIN products prd ON pmc.product_id = prd.id
      WHERE pmc.production_order_id = $1
    `, [id]);

    const { rows: batches } = await query(`
      SELECT
        rb.id, rb.batch_number, rb.green_coffee_weight_kg, rb.roasted_coffee_weight_kg,
        rb.weight_loss_percentage, rb.roast_level_achieved, rb.roast_date,
        rb.is_approved, u.name as operator_name
      FROM roast_batches rb
      LEFT JOIN users u ON rb.operator_id = u.id
      WHERE rb.production_order_id = $1
    `, [id]);

    res.json({
      success: true,
      data: { ...orderRows[0], components, consumptions, batches }
    });
  } catch (error) {
    console.error('Error fetching production order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/orders
 * Crea nueva orden de producción
 */
ordersRouter.post('/', async (req, res) => {
  try {
    const {
      bom_id,
      product_id,
      planned_quantity,
      quantity_unit,
      scheduled_date,
      work_center_id,
      roasting_equipment_id,
      responsible_user_id,
      priority,
      notes
    } = req.body;

    if (!bom_id || !product_id || !planned_quantity || !scheduled_date) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const timestamp = Date.now().toString().slice(-6);
    const order_number = `ORD-${timestamp}`;

    const { rows: bomRows } = await query(
      'SELECT loss_percentage FROM bill_of_materials WHERE id = $1',
      [bom_id]
    );
    const expected_loss_percentage = bomRows[0]?.loss_percentage || 15;

    const { rows } = await query(`
      INSERT INTO production_orders (
        order_number, bom_id, product_id, planned_quantity, quantity_unit,
        work_center_id, roasting_equipment_id, state, priority,
        scheduled_date, expected_loss_percentage, responsible_user_id, notes, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      order_number, bom_id, product_id, planned_quantity, quantity_unit || 'kg',
      work_center_id || null, roasting_equipment_id || null, 'borrador', priority || 'normal',
      scheduled_date, expected_loss_percentage, responsible_user_id || null, notes || null,
      req.user?.id || 1
    ]);

    res.status(201).json({
      success: true,
      message: 'Production order created',
      data: { id: rows[0].id, order_number, state: 'borrador' }
    });
  } catch (error) {
    console.error('Error creating production order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/production/orders/:id
 * Actualiza orden de producción
 */
ordersRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      planned_quantity,
      work_center_id,
      roasting_equipment_id,
      responsible_user_id,
      priority,
      notes
    } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (planned_quantity !== undefined) {
      updateFields.push(`planned_quantity = $${updateValues.length + 1}`);
      updateValues.push(planned_quantity);
    }
    if (work_center_id !== undefined) {
      updateFields.push(`work_center_id = $${updateValues.length + 1}`);
      updateValues.push(work_center_id);
    }
    if (roasting_equipment_id !== undefined) {
      updateFields.push(`roasting_equipment_id = $${updateValues.length + 1}`);
      updateValues.push(roasting_equipment_id);
    }
    if (responsible_user_id !== undefined) {
      updateFields.push(`responsible_user_id = $${updateValues.length + 1}`);
      updateValues.push(responsible_user_id);
    }
    if (priority !== undefined) {
      updateFields.push(`priority = $${updateValues.length + 1}`);
      updateValues.push(priority);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${updateValues.length + 1}`);
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    await query(
      `UPDATE production_orders SET ${updateFields.join(', ')} WHERE id = $${updateValues.length}`,
      updateValues
    );

    res.json({ success: true, message: 'Production order updated' });
  } catch (error) {
    console.error('Error updating production order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/production/orders/:id
 * Elimina orden de producción (solo si está en borrador)
 */
ordersRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: orderRows } = await query(
      'SELECT state FROM production_orders WHERE id = $1',
      [id]
    );

    if (!orderRows.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (orderRows[0].state !== 'borrador') {
      return res.status(400).json({ success: false, error: 'Can only delete draft orders' });
    }

    await query('DELETE FROM production_orders WHERE id = $1', [id]);

    res.json({ success: true, message: 'Production order deleted' });
  } catch (error) {
    console.error('Error deleting production order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CAMBIOS DE ESTADO
// ==========================================

/**
 * POST /api/production/orders/:id/confirm
 * Confirma orden: borrador → confirmada
 */
ordersRouter.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT state FROM production_orders WHERE id = $1', [id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Order not found' });
    if (rows[0].state !== 'borrador') {
      return res.status(400).json({ success: false, error: 'Order must be in draft state' });
    }

    await query(
      'UPDATE production_orders SET state = $1, updated_at = NOW() WHERE id = $2',
      ['confirmada', id]
    );

    res.json({ success: true, message: 'Order confirmed', state: 'confirmada' });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/orders/:id/start
 * Inicia orden: confirmada → en_progreso
 */
ordersRouter.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT state FROM production_orders WHERE id = $1', [id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Order not found' });
    if (rows[0].state !== 'confirmada') {
      return res.status(400).json({ success: false, error: 'Order must be confirmed' });
    }

    await query(
      'UPDATE production_orders SET state = $1, start_date = NOW(), updated_at = NOW() WHERE id = $2',
      ['en_progreso', id]
    );

    res.json({ success: true, message: 'Order started', state: 'en_progreso' });
  } catch (error) {
    console.error('Error starting order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/orders/:id/pause
 * Pausa orden: en_progreso → pausada
 */
ordersRouter.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT state FROM production_orders WHERE id = $1', [id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Order not found' });
    if (rows[0].state !== 'en_progreso') {
      return res.status(400).json({ success: false, error: 'Order must be in progress' });
    }

    await query(
      'UPDATE production_orders SET state = $1, updated_at = NOW() WHERE id = $2',
      ['pausada', id]
    );

    res.json({ success: true, message: 'Order paused', state: 'pausada' });
  } catch (error) {
    console.error('Error pausing order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/orders/:id/resume
 * Reanuda orden: pausada → en_progreso
 */
ordersRouter.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT state FROM production_orders WHERE id = $1', [id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Order not found' });
    if (rows[0].state !== 'pausada') {
      return res.status(400).json({ success: false, error: 'Order must be paused' });
    }

    await query(
      'UPDATE production_orders SET state = $1, updated_at = NOW() WHERE id = $2',
      ['en_progreso', id]
    );

    res.json({ success: true, message: 'Order resumed', state: 'en_progreso' });
  } catch (error) {
    console.error('Error resuming order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/orders/:id/complete
 * Completa orden: en_progreso → completada
 */
ordersRouter.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { produced_quantity } = req.body;

    const { rows } = await query('SELECT state FROM production_orders WHERE id = $1', [id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Order not found' });
    if (rows[0].state !== 'en_progreso') {
      return res.status(400).json({ success: false, error: 'Order must be in progress' });
    }
    if (!produced_quantity) {
      return res.status(400).json({ success: false, error: 'Produced quantity required' });
    }

    await query(
      'UPDATE production_orders SET state = $1, produced_quantity = $2, end_date = NOW(), updated_at = NOW() WHERE id = $3',
      ['completada', produced_quantity, id]
    );

    res.json({ success: true, message: 'Order completed', state: 'completada' });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/production/orders/:id/cancel
 * Cancela orden
 */
ordersRouter.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { rows } = await query('SELECT state FROM production_orders WHERE id = $1', [id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Order not found' });

    const cancelNote = `\nCancelada: ${reason || 'Sin motivo especificado'}`;

    await query(
      'UPDATE production_orders SET state = $1, notes = COALESCE(notes, \'\') || $2, updated_at = NOW() WHERE id = $3',
      ['cancelada', cancelNote, id]
    );

    res.json({ success: true, message: 'Order cancelled', state: 'cancelada' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
