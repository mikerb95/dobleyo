import express from 'express';
import { query } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

export const dashboardRouter = express.Router();

// Requerir autenticación y rol admin/caficultor para todas las rutas
dashboardRouter.use(authenticateToken);
dashboardRouter.use(requireRole(['admin', 'caficultor']));

// ==========================================
// DASHBOARD OPERATIVO
// ==========================================

/**
 * GET /api/production/dashboard
 * Dashboard operativo con KPIs del día
 */
dashboardRouter.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // KPI 1: Órdenes del día
    const { rows: ordersToday } = await query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN state = 'completada' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN state = 'en_progreso' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN state = 'confirmada' THEN 1 ELSE 0 END) as pending
      FROM production_orders
      WHERE scheduled_date::date = $1
    `, [today]);

    // KPI 2: Producción del día (kg tostados)
    const { rows: productionToday } = await query(`
      SELECT
        ROUND(SUM(COALESCE(rb.roasted_coffee_weight_kg, 0))::numeric, 2) as total_kg_roasted,
        COUNT(DISTINCT rb.id) as total_batches,
        ROUND(AVG(rb.weight_loss_percentage)::numeric, 2) as avg_loss_percentage
      FROM roast_batches rb
      WHERE rb.roast_date::date = $1
    `, [today]);

    // KPI 3: Control de calidad
    const { rows: qualityToday } = await query(`
      SELECT
        COUNT(*) as total_checks,
        SUM(CASE WHEN passed = TRUE THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN passed = FALSE THEN 1 ELSE 0 END) as failed,
        ROUND(AVG(overall_score)::numeric, 1) as avg_score
      FROM production_quality_checks
      WHERE check_date::date = $1
    `, [today]);

    // KPI 4: Alertas del día
    const { rows: alerts } = await query(`
      SELECT 'Equipos en Mantenimiento' as alert_type, COUNT(*) as count
      FROM equipment_maintenance
      WHERE state = 'programado' AND scheduled_date::date = $1
      UNION ALL
      SELECT 'Órdenes Pendientes', COUNT(*)
      FROM production_orders
      WHERE state = 'confirmada' AND scheduled_date::date <= $1
      UNION ALL
      SELECT 'Equipos no Operacionales', COUNT(*)
      FROM roasting_equipment
      WHERE is_operational = FALSE
    `, [today]);

    // KPI 5: Equipos disponibles
    const { rows: equipment } = await query(`
      SELECT
        COUNT(*) as total_equipment,
        SUM(CASE WHEN is_operational = TRUE THEN 1 ELSE 0 END) as operational,
        SUM(CASE WHEN is_operational = FALSE THEN 1 ELSE 0 END) as maintenance
      FROM roasting_equipment
    `);

    // KPI 6: Operadores activos hoy
    const { rows: operators } = await query(`
      SELECT
        COUNT(DISTINCT operator_id) as active_operators,
        SUM(CASE WHEN roast_date::date = $1 THEN 1 ELSE 0 END) as batches_today
      FROM roast_batches
    `, [today]);

    // KPI 7: Órdenes por estado (últimos 7 días)
    const { rows: ordersByState } = await query(`
      SELECT state, COUNT(*) as count
      FROM production_orders
      WHERE scheduled_date::date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY state
    `);

    // KPI 8: Producción últimos 7 días
    const { rows: production7Days } = await query(`
      SELECT
        roast_date::date as date,
        ROUND(SUM(roasted_coffee_weight_kg)::numeric, 2) as kg_roasted,
        COUNT(*) as batches,
        ROUND(AVG(weight_loss_percentage)::numeric, 2) as avg_loss
      FROM roast_batches
      WHERE roast_date >= NOW() - INTERVAL '7 days'
      GROUP BY roast_date::date
      ORDER BY date ASC
    `);

    // KPI 9: Próximas órdenes
    const { rows: nextOrders } = await query(`
      SELECT
        po.id, po.order_number, po.product_id, po.planned_quantity,
        p.name as product_name,
        po.scheduled_date, po.priority, po.state
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      WHERE po.state IN ('confirmada', 'en_progreso')
      ORDER BY po.scheduled_date ASC, po.priority DESC
      LIMIT 5
    `);

    // KPI 10: Mermas vs meta (últimos 30 días)
    const { rows: lossAnalysis } = await query(`
      SELECT
        COUNT(*) as total_batches,
        ROUND(AVG(weight_loss_percentage)::numeric, 2) as avg_actual_loss,
        15.0 as expected_loss,
        ROUND((AVG(weight_loss_percentage) - 15.0)::numeric, 2) as variance
      FROM roast_batches
      WHERE roast_date >= NOW() - INTERVAL '30 days'
    `);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: today,
      data: {
        orders_today: {
          total: parseInt(ordersToday[0]?.total_orders) || 0,
          completed: parseInt(ordersToday[0]?.completed) || 0,
          in_progress: parseInt(ordersToday[0]?.in_progress) || 0,
          pending: parseInt(ordersToday[0]?.pending) || 0,
          completion_percentage: ordersToday[0]?.total_orders > 0
            ? Math.round((ordersToday[0].completed / ordersToday[0].total_orders) * 100)
            : 0
        },
        production_today: {
          total_kg: parseFloat(productionToday[0]?.total_kg_roasted) || 0,
          total_batches: parseInt(productionToday[0]?.total_batches) || 0,
          avg_loss_percentage: parseFloat(productionToday[0]?.avg_loss_percentage) || 0
        },
        quality_today: {
          total_checks: parseInt(qualityToday[0]?.total_checks) || 0,
          passed: parseInt(qualityToday[0]?.passed) || 0,
          failed: parseInt(qualityToday[0]?.failed) || 0,
          pass_rate: qualityToday[0]?.total_checks > 0
            ? Math.round((qualityToday[0].passed / qualityToday[0].total_checks) * 100)
            : 0,
          avg_score: parseFloat(qualityToday[0]?.avg_score) || 0
        },
        equipment: {
          total: parseInt(equipment[0]?.total_equipment) || 0,
          operational: parseInt(equipment[0]?.operational) || 0,
          maintenance: parseInt(equipment[0]?.maintenance) || 0,
          availability: equipment[0]?.total_equipment > 0
            ? Math.round((equipment[0].operational / equipment[0].total_equipment) * 100)
            : 0
        },
        active_operators: parseInt(operators[0]?.active_operators) || 0,
        batches_today: parseInt(operators[0]?.batches_today) || 0,
        alerts,
        orders_by_state: ordersByState,
        production_7_days: production7Days,
        next_orders: nextOrders,
        loss_analysis: {
          batches_analyzed: parseInt(lossAnalysis[0]?.total_batches) || 0,
          avg_actual_loss: parseFloat(lossAnalysis[0]?.avg_actual_loss) || 0,
          expected_loss: 15.0,
          variance: parseFloat(lossAnalysis[0]?.variance) || 0,
          status: (parseFloat(lossAnalysis[0]?.variance) || 0) <= 0 ? 'OK' : 'ABOVE_EXPECTED'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching production dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/dashboard/efficiency
 * Análisis de eficiencia por período
 */
dashboardRouter.get('/efficiency', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let sql = `
      SELECT
        po.scheduled_date::date as date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN po.state = 'completada' THEN 1 ELSE 0 END) as completed,
        ROUND(SUM(po.planned_quantity)::numeric, 2) as planned_quantity,
        ROUND(SUM(po.produced_quantity)::numeric, 2) as produced_quantity,
        ROUND(AVG(po.actual_loss_percentage)::numeric, 2) as avg_loss,
        ROUND(AVG(rb.actual_duration_minutes)::numeric, 0) as avg_duration,
        COUNT(DISTINCT po.responsible_user_id) as operators
      FROM production_orders po
      LEFT JOIN roast_batches rb ON po.id = rb.production_order_id
      WHERE 1=1
    `;
    const params = [];

    if (date_from) {
      sql += ` AND po.scheduled_date >= $${params.length + 1}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND po.scheduled_date <= $${params.length + 1}`;
      params.push(date_to);
    }

    sql += ` GROUP BY po.scheduled_date::date ORDER BY date ASC`;

    const { rows: efficiency } = await query(sql, params);

    res.json({
      success: true,
      data: efficiency.map(row => ({
        ...row,
        completion_rate: row.total_orders > 0
          ? Math.round((row.completed / row.total_orders) * 100)
          : 0,
        production_rate: row.planned_quantity > 0
          ? Math.round((row.produced_quantity / row.planned_quantity) * 100)
          : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching efficiency data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/dashboard/operators
 * Performance de operadores
 */
dashboardRouter.get('/operators', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let sql = `
      SELECT
        u.id, u.name, u.email,
        COUNT(*) as total_batches,
        ROUND(SUM(rb.roasted_coffee_weight_kg)::numeric, 2) as total_kg,
        ROUND(AVG(rb.weight_loss_percentage)::numeric, 2) as avg_loss,
        ROUND(AVG(rb.quality_score)::numeric, 1) as avg_quality_score,
        SUM(CASE WHEN pqc.passed = TRUE THEN 1 ELSE 0 END) as passed_checks,
        ROUND(AVG(rb.actual_duration_minutes)::numeric, 0) as avg_duration
      FROM roast_batches rb
      JOIN users u ON rb.operator_id = u.id
      LEFT JOIN production_quality_checks pqc ON rb.id = pqc.roast_batch_id
      WHERE 1=1
    `;
    const params = [];

    if (date_from) {
      sql += ` AND rb.roast_date >= $${params.length + 1}`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND rb.roast_date <= $${params.length + 1}`;
      params.push(date_to);
    }

    sql += ` GROUP BY u.id, u.name, u.email ORDER BY total_kg DESC`;

    const { rows: operatorsData } = await query(sql, params);

    res.json({ success: true, data: operatorsData });
  } catch (error) {
    console.error('Error fetching operator performance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/dashboard/alerts
 * Alertas y anomalías del sistema
 */
dashboardRouter.get('/alerts', async (req, res) => {
  try {
    const alerts = [];

    // Equipos en mantenimiento
    const { rows: maintenanceAlerts } = await query(`
      SELECT
        'EQUIPMENT_MAINTENANCE' as type,
        'Equipo en mantenimiento' as title,
        COUNT(*) as count,
        STRING_AGG(equipment_name, ', ') as details
      FROM roasting_equipment
      WHERE is_operational = FALSE
    `);

    if (parseInt(maintenanceAlerts[0]?.count) > 0) {
      alerts.push({ severity: 'warning', ...maintenanceAlerts[0] });
    }

    // Órdenes pendientes vencidas
    const { rows: overdueAlerts } = await query(`
      SELECT
        'OVERDUE_ORDERS' as type,
        'Órdenes pendientes vencidas' as title,
        COUNT(*) as count
      FROM production_orders
      WHERE state IN ('confirmada', 'borrador')
        AND scheduled_date < CURRENT_DATE
    `);

    if (parseInt(overdueAlerts[0]?.count) > 0) {
      alerts.push({ severity: 'critical', ...overdueAlerts[0] });
    }

    // Mermas por encima del esperado (últimos 7 días)
    const { rows: lossAlerts } = await query(`
      SELECT
        'HIGH_LOSS_RATE' as type,
        'Tasa de merma superior al esperado' as title,
        COUNT(*) as count,
        ROUND(AVG(weight_loss_percentage)::numeric, 2) as avg_loss
      FROM roast_batches
      WHERE weight_loss_percentage > 18
        AND roast_date >= CURRENT_DATE - INTERVAL '7 days'
    `);

    if (parseInt(lossAlerts[0]?.count) > 0) {
      alerts.push({ severity: 'warning', ...lossAlerts[0] });
    }

    // Inspecciones con defectos (últimas 24 horas)
    const { rows: qualityAlerts } = await query(`
      SELECT
        'QUALITY_ISSUES' as type,
        'Inspecciones con defectos' as title,
        COUNT(*) as count
      FROM production_quality_checks
      WHERE passed = FALSE
        AND check_date >= NOW() - INTERVAL '1 day'
    `);

    if (parseInt(qualityAlerts[0]?.count) > 0) {
      alerts.push({ severity: 'warning', ...qualityAlerts[0] });
    }

    res.json({ success: true, alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
