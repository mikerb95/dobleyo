import express from 'express';
import { query } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';
import { v4 as uuidv4 } from 'uuid';

export const ordersRouter = express.Router();

// PROTECCIÓN: Requerir autenticación y rol admin/caficultor para todas las rutas de producción
ordersRouter.use(authenticateToken);
ordersRouter.use(requireRole(['admin', 'caficultor']));

// ==========================================
// ÓRDENES DE PRODUCCIÓN - CRUD
// ==========================================

/**
 * GET /api/production/orders
 * Lista órdenes de producción con filtros
 */
router.get('/', async (req, res) => {
  try {
    const { state, work_center_id, date_from, date_to, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        po.id, po.order_number, po.product_id, p.name as product_name,
        po.planned_quantity, po.produced_quantity, po.quantity_unit,
        po.state, po.priority, po.scheduled_date,
        po.start_date, po.end_date, po.production_cost,
        u.name as responsible_user,
        re.equipment_name,
        b.bom_code,
        po.created_at, po.updated_at
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN users u ON po.responsible_user_id = u.id
      LEFT JOIN roasting_equipment re ON po.roasting_equipment_id = re.id
      LEFT JOIN bill_of_materials b ON po.bom_id = b.id
      WHERE 1=1
    `;

    const params = [];

    if (state) {
      query += ` AND po.state = ?`;
      params.push(state);
    }

    if (work_center_id) {
      query += ` AND po.work_center_id = ?`;
      params.push(work_center_id);
    }

    if (date_from) {
      query += ` AND po.scheduled_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND po.scheduled_date <= ?`;
      params.push(date_to);
    }

    query += ` ORDER BY po.scheduled_date DESC, po.priority LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [orders] = await db.query(query, params);

    res.json({
      success: true,
      data: orders,
      pagination: { limit, offset, total: orders.length }
    });
  } catch (error) {
    console.error('Error fetching production orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/orders/:id
 * Obtiene detalle de una orden
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [order] = await db.query(`
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
      WHERE po.id = ?
    `, [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Obtener componentes de la orden
    const [components] = await db.query(`
      SELECT 
        bc.id, bc.component_product_id, prd.name as component_name,
        bc.quantity, bc.quantity_unit,
        prd.stock_quantity, bc.component_type
      FROM bom_components bc
      JOIN products prd ON bc.component_product_id = prd.id
      WHERE bc.bom_id = ?
    `, [order[0].bom_id]);

    // Obtener consumos realizados
    const [consumptions] = await db.query(`
      SELECT 
        pmc.id, pmc.product_id, prd.name,
        pmc.planned_quantity, pmc.consumed_quantity, pmc.quantity_unit,
        pmc.consumption_date
      FROM production_material_consumption pmc
      JOIN products prd ON pmc.product_id = prd.id
      WHERE pmc.production_order_id = ?
    `, [id]);

    // Obtener batches de tostado
    const [batches] = await db.query(`
      SELECT 
        rb.id, rb.batch_number, rb.green_coffee_weight_kg, rb.roasted_coffee_weight_kg,
        rb.weight_loss_percentage, rb.roast_level_achieved, rb.roast_date,
        rb.is_approved, u.name as operator_name
      FROM roast_batches rb
      LEFT JOIN users u ON rb.operator_id = u.id
      WHERE rb.production_order_id = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        ...order[0],
        components,
        consumptions,
        batches
      }
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
router.post('/', async (req, res) => {
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

    // Validación básica
    if (!bom_id || !product_id || !planned_quantity || !scheduled_date) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Generar número de orden
    const timestamp = Date.now().toString().slice(-6);
    const order_number = `ORD-${timestamp}`;

    // Obtener BOM para obtener % de merma esperado
    const [bom] = await db.query('SELECT loss_percentage FROM bill_of_materials WHERE id = ?', [bom_id]);
    const expected_loss_percentage = bom[0]?.loss_percentage || 15;

    const [result] = await db.query(`
      INSERT INTO production_orders (
        order_number, bom_id, product_id, planned_quantity, quantity_unit,
        work_center_id, roasting_equipment_id, state, priority,
        scheduled_date, expected_loss_percentage, responsible_user_id, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      order_number, bom_id, product_id, planned_quantity, quantity_unit || 'kg',
      work_center_id || null, roasting_equipment_id || null, 'borrador', priority || 'normal',
      scheduled_date, expected_loss_percentage, responsible_user_id || null, notes || null, req.user?.id || 1
    ]);

    res.status(201).json({
      success: true,
      message: 'Production order created',
      data: {
        id: result.insertId,
        order_number,
        state: 'borrador'
      }
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
router.put('/:id', async (req, res) => {
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
      updateFields.push('planned_quantity = ?');
      updateValues.push(planned_quantity);
    }
    if (work_center_id !== undefined) {
      updateFields.push('work_center_id = ?');
      updateValues.push(work_center_id);
    }
    if (roasting_equipment_id !== undefined) {
      updateFields.push('roasting_equipment_id = ?');
      updateValues.push(roasting_equipment_id);
    }
    if (responsible_user_id !== undefined) {
      updateFields.push('responsible_user_id = ?');
      updateValues.push(responsible_user_id);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    await db.query(
      `UPDATE production_orders SET ${updateFields.join(', ')} WHERE id = ?`,
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que esté en borrador
    const [order] = await db.query('SELECT state FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order[0].state !== 'borrador') {
      return res.status(400).json({ success: false, error: 'Can only delete draft orders' });
    }

    await db.query('DELETE FROM production_orders WHERE id = ?', [id]);

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
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;

    const [order] = await db.query('SELECT state FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order[0].state !== 'borrador') {
      return res.status(400).json({ success: false, error: 'Order must be in draft state' });
    }

    await db.query('UPDATE production_orders SET state = ?, updated_at = NOW() WHERE id = ?', 
      ['confirmada', id]);

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
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const [order] = await db.query('SELECT state FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order[0].state !== 'confirmada') {
      return res.status(400).json({ success: false, error: 'Order must be confirmed' });
    }

    await db.query(
      'UPDATE production_orders SET state = ?, start_date = NOW(), updated_at = NOW() WHERE id = ?',
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
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    const [order] = await db.query('SELECT state FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order[0].state !== 'en_progreso') {
      return res.status(400).json({ success: false, error: 'Order must be in progress' });
    }

    await db.query('UPDATE production_orders SET state = ?, updated_at = NOW() WHERE id = ?',
      ['pausada', id]);

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
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    const [order] = await db.query('SELECT state FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order[0].state !== 'pausada') {
      return res.status(400).json({ success: false, error: 'Order must be paused' });
    }

    await db.query('UPDATE production_orders SET state = ?, updated_at = NOW() WHERE id = ?',
      ['en_progreso', id]);

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
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { produced_quantity } = req.body;

    const [order] = await db.query('SELECT state, bom_id FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order[0].state !== 'en_progreso') {
      return res.status(400).json({ success: false, error: 'Order must be in progress' });
    }

    if (!produced_quantity) {
      return res.status(400).json({ success: false, error: 'Produced quantity required' });
    }

    await db.query(
      'UPDATE production_orders SET state = ?, produced_quantity = ?, end_date = NOW(), updated_at = NOW() WHERE id = ?',
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
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [order] = await db.query('SELECT state FROM production_orders WHERE id = ?', [id]);

    if (!order.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    await db.query(
      'UPDATE production_orders SET state = ?, notes = CONCAT(IFNULL(notes, \'\'), ? ), updated_at = NOW() WHERE id = ?',
      ['cancelada', `\nCancelada: ${reason || 'Sin motivo especificado'}`, id]
    );

    res.json({ success: true, message: 'Order cancelled', state: 'cancelada' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
