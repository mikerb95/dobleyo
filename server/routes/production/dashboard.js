import express from 'express';
import { query as db } from '../../db.js';
import { authenticateToken, requireRole } from '../../auth.js';

const router = express.Router();

// PROTECCIÓN: Requerir autenticación y rol admin/caficultor para todas las rutas de producción
router.use(authenticateToken);
router.use(requireRole(['admin', 'caficultor']));

// ==========================================
// DASHBOARD OPERATIVO
// ==========================================

/**
 * GET /api/production/dashboard
 * Dashboard operativo con KPIs del día
 */
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // KPI 1: Órdenes del día
    const [ordersToday] = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN state = 'completada' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN state = 'en_progreso' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN state = 'confirmada' THEN 1 ELSE 0 END) as pending
      FROM production_orders
      WHERE DATE(scheduled_date) = ?
    `, [today]);

    // KPI 2: Producción del día (kg tostados)
    const [productionToday] = await db.query(`
      SELECT 
        ROUND(SUM(COALESCE(rb.roasted_coffee_weight_kg, 0)), 2) as total_kg_roasted,
        COUNT(DISTINCT rb.id) as total_batches,
        AVG(rb.weight_loss_percentage) as avg_loss_percentage
      FROM roast_batches rb
      WHERE DATE(rb.roast_date) = ?
    `, [today]);

    // KPI 3: Control de calidad
    const [qualityToday] = await db.query(`
      SELECT 
        COUNT(*) as total_checks,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed,
        ROUND(AVG(overall_score), 1) as avg_score
      FROM production_quality_checks
      WHERE DATE(check_date) = ?
    `, [today]);

    // KPI 4: Alertas
    const [alerts] = await db.query(`
      SELECT 
        'Equipos en Mantenimiento' as alert_type,
        COUNT(*) as count
      FROM equipment_maintenance
      WHERE state = 'programado' AND DATE(scheduled_date) = ?
      UNION ALL
      SELECT 
        'Órdenes Pendientes',
        COUNT(*)
      FROM production_orders
      WHERE state = 'confirmada' AND DATE(scheduled_date) <= ?
      UNION ALL
      SELECT 
        'Equipos no Operacionales',
        COUNT(*)
      FROM roasting_equipment
      WHERE is_operational = FALSE
    `, [today, today]);

    // KPI 5: Equipos disponibles
    const [equipment] = await db.query(`
      SELECT 
        COUNT(*) as total_equipment,
        SUM(CASE WHEN is_operational = TRUE THEN 1 ELSE 0 END) as operational,
        SUM(CASE WHEN is_operational = FALSE THEN 1 ELSE 0 END) as maintenance
      FROM roasting_equipment
    `);

    // KPI 6: Operadores activos
    const [operators] = await db.query(`
      SELECT 
        COUNT(DISTINCT operator_id) as active_operators,
        SUM(CASE WHEN DATE(roast_date) = ? THEN 1 ELSE 0 END) as batches_today
      FROM roast_batches
    `, [today]);

    // KPI 7: Órdenes por estado
    const [ordersByState] = await db.query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM production_orders
      WHERE DATE(scheduled_date) >= DATE_SUB(?, INTERVAL 7 DAY)
      GROUP BY state
    `, [today]);

    // KPI 8: Producción últimos 7 días
    const [production7Days] = await db.query(`
      SELECT 
        DATE(roast_date) as date,
        ROUND(SUM(roasted_coffee_weight_kg), 2) as kg_roasted,
        COUNT(*) as batches,
        ROUND(AVG(weight_loss_percentage), 2) as avg_loss
      FROM roast_batches
      WHERE roast_date >= DATE_SUB(?, INTERVAL 7 DAY)
      GROUP BY DATE(roast_date)
      ORDER BY date ASC
    `, [today]);

    // KPI 9: Próximas órdenes
    const [nextOrders] = await db.query(`
      SELECT 
        id, order_number, product_id, planned_quantity,
        (SELECT name FROM products WHERE id = product_id) as product_name,
        scheduled_date, priority, state
      FROM production_orders
      WHERE state IN ('confirmada', 'en_progreso')
      ORDER BY scheduled_date ASC, priority DESC
      LIMIT 5
    `);

    // KPI 10: Mermas vs Meta
    const [lossAnalysis] = await db.query(`
      SELECT 
        COUNT(*) as total_batches,
        ROUND(AVG(weight_loss_percentage), 2) as avg_actual_loss,
        ROUND(15.0, 2) as expected_loss,
        ROUND(AVG(weight_loss_percentage) - 15.0, 2) as variance
      FROM roast_batches
      WHERE roast_date >= DATE_SUB(?, INTERVAL 30 DAY)
    `, [today]);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: today,
      data: {
        orders_today: {
          total: ordersToday[0].total_orders || 0,
          completed: ordersToday[0].completed || 0,
          in_progress: ordersToday[0].in_progress || 0,
          pending: ordersToday[0].pending || 0,
          completion_percentage: ordersToday[0].total_orders > 0
            ? Math.round((ordersToday[0].completed / ordersToday[0].total_orders) * 100)
            : 0
        },
        production_today: {
          total_kg: productionToday[0].total_kg_roasted || 0,
          total_batches: productionToday[0].total_batches || 0,
          avg_loss_percentage: productionToday[0].avg_loss_percentage || 0
        },
        quality_today: {
          total_checks: qualityToday[0].total_checks || 0,
          passed: qualityToday[0].passed || 0,
          failed: qualityToday[0].failed || 0,
          pass_rate: qualityToday[0].total_checks > 0
            ? Math.round((qualityToday[0].passed / qualityToday[0].total_checks) * 100)
            : 0,
          avg_score: qualityToday[0].avg_score || 0
        },
        equipment: {
          total: equipment[0].total_equipment || 0,
          operational: equipment[0].operational || 0,
          maintenance: equipment[0].maintenance || 0,
          availability: equipment[0].total_equipment > 0
            ? Math.round((equipment[0].operational / equipment[0].total_equipment) * 100)
            : 0
        },
        active_operators: operators[0].active_operators || 0,
        batches_today: operators[0].batches_today || 0,
        alerts: alerts,
        orders_by_state: ordersByState,
        production_7_days: production7Days,
        next_orders: nextOrders,
        loss_analysis: {
          batches_analyzed: lossAnalysis[0].total_batches,
          avg_actual_loss: parseFloat(lossAnalysis[0].avg_actual_loss) || 0,
          expected_loss: 15.0,
          variance: parseFloat(lossAnalysis[0].variance) || 0,
          status: lossAnalysis[0].variance <= 0 ? 'OK' : 'ABOVE_EXPECTED'
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
 * Análisis de eficiencia
 */
router.get('/efficiency', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let query = `
      SELECT 
        DATE(po.scheduled_date) as date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN po.state = 'completada' THEN 1 ELSE 0 END) as completed,
        ROUND(SUM(po.planned_quantity), 2) as planned_quantity,
        ROUND(SUM(po.produced_quantity), 2) as produced_quantity,
        ROUND(AVG(po.actual_loss_percentage), 2) as avg_loss,
        ROUND(AVG(rb.actual_duration_minutes), 0) as avg_duration,
        COUNT(DISTINCT po.responsible_user_id) as operators
      FROM production_orders po
      LEFT JOIN roast_batches rb ON po.id = rb.production_order_id
      WHERE 1=1
    `;

    const params = [];

    if (date_from) {
      query += ` AND po.scheduled_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND po.scheduled_date <= ?`;
      params.push(date_to);
    }

    query += ` GROUP BY DATE(po.scheduled_date) ORDER BY date ASC`;

    const [efficiency] = await db.query(query, params);

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
router.get('/operators', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let query = `
      SELECT 
        u.id, u.name, u.email,
        COUNT(*) as total_batches,
        ROUND(SUM(rb.roasted_coffee_weight_kg), 2) as total_kg,
        ROUND(AVG(rb.weight_loss_percentage), 2) as avg_loss,
        ROUND(AVG(rb.quality_score), 1) as avg_quality_score,
        SUM(CASE WHEN pqc.passed = 1 THEN 1 ELSE 0 END) as passed_checks,
        ROUND(AVG(rb.actual_duration_minutes), 0) as avg_duration
      FROM roast_batches rb
      JOIN users u ON rb.operator_id = u.id
      LEFT JOIN production_quality_checks pqc ON rb.id = pqc.roast_batch_id
      WHERE 1=1
    `;

    const params = [];

    if (date_from) {
      query += ` AND rb.roast_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND rb.roast_date <= ?`;
      params.push(date_to);
    }

    query += ` GROUP BY u.id, u.name, u.email ORDER BY total_kg DESC`;

    const [operators] = await db.query(query, params);

    res.json({
      success: true,
      data: operators
    });
  } catch (error) {
    console.error('Error fetching operator performance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/production/dashboard/alerts
 * Alertas y anomalías
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];

    // Equipos en mantenimiento
    const [maintenanceAlerts] = await db.query(`
      SELECT 
        'EQUIPMENT_MAINTENANCE' as type,
        'Equipo en mantenimiento' as title,
        COUNT(*) as count,
        GROUP_CONCAT(equipment_name) as details
      FROM roasting_equipment re
      WHERE is_operational = FALSE
    `);

    if (maintenanceAlerts[0]?.count > 0) {
      alerts.push({
        severity: 'warning',
        ...maintenanceAlerts[0]
      });
    }

    // Órdenes pendientes vencidas
    const [overdueAlerts] = await db.query(`
      SELECT 
        'OVERDUE_ORDERS' as type,
        'Órdenes pendientes vencidas' as title,
        COUNT(*) as count
      FROM production_orders
      WHERE state IN ('confirmada', 'borrador') 
        AND scheduled_date < CURDATE()
    `);

    if (overdueAlerts[0]?.count > 0) {
      alerts.push({
        severity: 'critical',
        ...overdueAlerts[0]
      });
    }

    // Mermas por encima del esperado
    const [lossAlerts] = await db.query(`
      SELECT 
        'HIGH_LOSS_RATE' as type,
        'Tasa de merma superior al esperado' as title,
        COUNT(*) as count,
        ROUND(AVG(weight_loss_percentage), 2) as avg_loss
      FROM roast_batches
      WHERE weight_loss_percentage > 18 
        AND DATE(roast_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);

    if (lossAlerts[0]?.count > 0) {
      alerts.push({
        severity: 'warning',
        ...lossAlerts[0]
      });
    }

    // Inspecciones con defectos
    const [qualityAlerts] = await db.query(`
      SELECT 
        'QUALITY_ISSUES' as type,
        'Inspecciones con defectos' as title,
        COUNT(*) as count
      FROM production_quality_checks
      WHERE passed = FALSE 
        AND DATE(check_date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);

    if (qualityAlerts[0]?.count > 0) {
      alerts.push({
        severity: 'warning',
        ...qualityAlerts[0]
      });
    }

    res.json({
      success: true,
      alerts: alerts
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


