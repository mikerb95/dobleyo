/**
 * MercadoLibre Routes
 * Endpoints for synchronizing and retrieving sales data
 */

import { Router } from 'express';
import { logger } from '../logger.js';
import MercadoLibreService from '../services/mercadolibre.js';
import * as auth from '../auth.js';
import * as db from '../db.js';

export const mercadolibreRouter = Router();

/**
 * POST /api/mercadolibre/sync
 * Synchronize orders from MercadoLibre
 * Requires: admin role, ML_ACCESS_TOKEN env var, ML_SELLER_ID env var
 */
mercadolibreRouter.post('/sync', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const accessToken = process.env.ML_ACCESS_TOKEN;
    const sellerId = process.env.ML_SELLER_ID;

    if (!accessToken || !sellerId) {
      return res.status(400).json({
        error: 'MercadoLibre credentials not configured',
        details: 'Please set ML_ACCESS_TOKEN and ML_SELLER_ID environment variables'
      });
    }

    const mlService = new MercadoLibreService(accessToken);

    // full=1 fuerza una sincronización completa; por defecto es incremental.
    const incremental = req.query.full !== '1';
    console.log(`Sincronizando órdenes (${incremental ? 'incremental' : 'completo'}) para seller ${sellerId}...`);
    const summary = await mlService.syncOrders({ incremental });

    if (summary.total_orders_fetched === 0) {
      return res.json({ success: true, message: 'No new orders found', count: 0, ...summary });
    }

    res.json({ success: true, message: 'Synchronization completed', ...summary });
  } catch (error) {
    logger.error('Error in /sync endpoint:', error);
    res.status(500).json({
      error: 'Synchronization failed',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/cron-sync
 * Sincronización automática disparada por el cron de Vercel.
 * No usa sesión de admin; se protege con CRON_SECRET (header Authorization:
 * Bearer <CRON_SECRET>, que Vercel Cron envía automáticamente si la env existe).
 */
mercadolibreRouter.get('/cron-sync', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'CRON_SECRET no configurado' });
  }
  const authHeader = req.get('authorization') || '';
  if (authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  if (!process.env.ML_ACCESS_TOKEN || !process.env.ML_SELLER_ID) {
    return res.status(400).json({ error: 'MercadoLibre credentials not configured' });
  }

  try {
    const mlService = new MercadoLibreService(process.env.ML_ACCESS_TOKEN);
    const summary = await mlService.syncOrders({ incremental: true });
    logger.info('[cron-sync] completado', summary);
    res.json({ success: true, ...summary });
  } catch (error) {
    logger.error('Error in /cron-sync endpoint:', error);
    res.status(500).json({ error: 'Synchronization failed', details: error.message });
  }
});

/**
 * POST /api/mercadolibre/webhook
 * Receptor de notifications de MercadoLibre (topic orders_v2 / orders / payments).
 * Público (ML lo invoca sin sesión). Responde 200 rápido y sincroniza la orden
 * referenciada de forma best-effort. Filtra por ML_SELLER_ID cuando viene.
 */
mercadolibreRouter.post('/webhook', async (req, res) => {
  // Responder de inmediato: ML reintenta si no recibe 200 a tiempo.
  res.status(200).json({ received: true });

  try {
    const { topic, resource, user_id } = req.body || {};
    if (!topic || !resource) return;

    // Si el seller está configurado, ignorar notifications de otros vendedores.
    const sellerId = process.env.ML_SELLER_ID;
    if (sellerId && user_id != null && String(user_id) !== String(sellerId)) {
      logger.warn(`[webhook] ignorado: user_id ${user_id} != seller ${sellerId}`);
      return;
    }
    if (!process.env.ML_ACCESS_TOKEN) {
      logger.warn('[webhook] sin ML_ACCESS_TOKEN, no se procesa');
      return;
    }

    // resource viene como "/orders/123" o "/payments/123"; solo procesamos órdenes.
    const match = String(resource).match(/\/orders\/(\d+)/);
    if (!String(topic).includes('order') || !match) {
      logger.info(`[webhook] topic '${topic}' resource '${resource}' — sin acción`);
      return;
    }
    const orderId = match[1];

    const mlService = new MercadoLibreService(process.env.ML_ACCESS_TOKEN);
    const orderDetails = await mlService.fetchOrderDetails(orderId);

    let shipment = null;
    if (orderDetails.shipping && orderDetails.shipping.id) {
      try {
        shipment = await mlService.fetchShipment(orderDetails.shipping.id);
      } catch (e) {
        logger.warn(`[webhook] shipment ${orderDetails.shipping.id} no disponible:`, e.message);
      }
    }

    const transformed = await mlService.transformOrderData(orderDetails, orderDetails, shipment);
    await mlService.saveSalesData([transformed]);
    logger.info(`[webhook] orden ${orderId} sincronizada`);
  } catch (error) {
    logger.error('Error in /webhook handler:', error.message);
  }
});

/**
 * GET /api/mercadolibre/sales
 * Get synced sales data from database
 * Requires: admin role
 * Query params: limit, offset, city, state, dateFrom, dateTo
 */
mercadolibreRouter.get('/sales', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      city = null,
      state = null,
      dateFrom = null,
      dateTo = null,
      status = null
    } = req.query;

    const mlService = new MercadoLibreService(process.env.ML_ACCESS_TOKEN);
    const result = await mlService.getSalesData({
      limit: parseInt(limit),
      offset: parseInt(offset),
      city,
      state,
      dateFrom,
      dateTo,
      status
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(result.total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error in /sales endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve sales data',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/heatmap-data
 * Get aggregated sales data by location for heatmap
 * Requires: admin role
 */
mercadolibreRouter.get('/heatmap-data', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const mlService = new MercadoLibreService(process.env.ML_ACCESS_TOKEN);
    const data = await mlService.getSalesHeatmapData();

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Error in /heatmap-data endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve heatmap data',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/stats
 * Get sales statistics
 * Requires: admin role
 */
mercadolibreRouter.get('/stats', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT recipient_city) as unique_cities,
        COUNT(DISTINCT recipient_state) as unique_states,
        MIN(purchase_date) as first_order_date,
        MAX(purchase_date) as last_order_date
      FROM sales_tracking
    `, []);

    const topCitiesResult = await db.query(`
      SELECT 
        recipient_city,
        COUNT(*) as order_count,
        SUM(total_amount) as total_sales
      FROM sales_tracking
      GROUP BY recipient_city
      ORDER BY order_count DESC
      LIMIT 10
    `, []);

    res.json({
      success: true,
      overview: statsResult.rows[0],
      top_cities: topCitiesResult.rows
    });
  } catch (error) {
    logger.error('Error in /stats endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/analytics
 * Dashboard de ventas: KPIs, timeline, top productos/ciudades, distribución por estado.
 * Query params: dateFrom, dateTo, city, state, status, granularity (day|week|month)
 */
mercadolibreRouter.get('/analytics', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, city, state, status, granularity = 'day' } = req.query;

    function buildWhere(from, to, filterCity, filterState, filterStatus) {
      const clauses = [];
      const params = [];
      if (from)         { clauses.push("purchase_date >= ?");    params.push(from); }
      if (to)           { clauses.push("purchase_date <= ?");     params.push(to + ' 23:59:59'); }
      if (filterCity)   { clauses.push("recipient_city = ?");     params.push(filterCity); }
      if (filterState)  { clauses.push("recipient_state = ?");    params.push(filterState); }
      if (filterStatus) { clauses.push("order_status = ?");       params.push(filterStatus); }
      return { w: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', p: params };
    }

    const { w, p } = buildWhere(dateFrom, dateTo, city, state, status);

    // Período anterior (misma duración, desplazado atrás)
    let pw = '', pp = [];
    if (dateFrom && dateTo) {
      const dFrom  = new Date(dateFrom);
      const dTo    = new Date(dateTo);
      const diffMs = dTo.getTime() - dFrom.getTime() + 86400000;
      const pTo    = new Date(dFrom.getTime() - 1);
      const pFrom  = new Date(pTo.getTime() - diffMs + 86400000);
      const fmt    = d => d.toISOString().slice(0, 10);
      const prev   = buildWhere(fmt(pFrom), fmt(pTo), city, state, status);
      pw = prev.w; pp = prev.p;
    }

    const timeFmt = granularity === 'month'
      ? "strftime('%Y-%m', purchase_date)"
      : granularity === 'week'
        ? "strftime('%Y-W%W', purchase_date)"
        : "strftime('%Y-%m-%d', purchase_date)";

    const [kpisR, prevKpisR, timelineR, byStatusR, topCitiesR, allProductsR, filterOptsR] = await Promise.all([
      db.query(`SELECT
          COUNT(*) as orders,
          COALESCE(SUM(total_amount), 0) as revenue,
          COALESCE(AVG(total_amount), 0) as aov,
          COALESCE(MAX(total_amount), 0) as max_ticket,
          COALESCE(MIN(CASE WHEN order_status != 'cancelled' THEN total_amount END), 0) as min_ticket,
          COUNT(DISTINCT recipient_city) as cities,
          SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM sales_tracking ${w}`, p),
      pw
        ? db.query(`SELECT COUNT(*) as orders, COALESCE(SUM(total_amount),0) as revenue, COALESCE(AVG(total_amount),0) as aov FROM sales_tracking ${pw}`, pp)
        : Promise.resolve({ rows: [null] }),
      db.query(`SELECT ${timeFmt} as period, COUNT(*) as orders, SUM(total_amount) as revenue FROM sales_tracking ${w} GROUP BY period ORDER BY period`, [...p]),
      db.query(`SELECT order_status as status, COUNT(*) as count, SUM(total_amount) as revenue FROM sales_tracking ${w} GROUP BY status ORDER BY count DESC`, [...p]),
      db.query(`SELECT recipient_city as city, recipient_state as state, COUNT(*) as orders, SUM(total_amount) as revenue FROM sales_tracking ${w} GROUP BY city ORDER BY orders DESC LIMIT 12`, [...p]),
      db.query(`SELECT products FROM sales_tracking ${w}`, [...p]),
      db.query(`SELECT DISTINCT recipient_city as city, recipient_state as state FROM sales_tracking WHERE recipient_city IS NOT NULL AND recipient_city != 'Unknown' ORDER BY recipient_city`, []),
    ]);

    // Parsear productos del JSON almacenado
    const productMap = {};
    for (const row of allProductsR.rows) {
      try {
        const prods = JSON.parse(row.products);
        for (const prod of (prods || [])) {
          const key = (prod.title || 'Producto desconocido').slice(0, 70);
          if (!productMap[key]) productMap[key] = { title: key, units: 0, revenue: 0 };
          productMap[key].units   += Number(prod.quantity)   || 1;
          productMap[key].revenue += (Number(prod.unit_price) || 0) * (Number(prod.quantity) || 1);
        }
      } catch { /* skip malformed */ }
    }
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 12);

    res.json({
      success: true,
      kpis:         kpisR.rows[0],
      prev_kpis:    prevKpisR.rows[0] || null,
      timeline:     timelineR.rows,
      by_status:    byStatusR.rows,
      top_cities:   topCitiesR.rows,
      top_products: topProducts,
      filter_options: {
        cities: filterOptsR.rows,
      },
    });
  } catch (err) {
    logger.error('[GET /analytics] Error:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/mercadolibre/status
 * Estado real de la integración: si las credenciales están configuradas y la
 * última fecha de sincronización. No revela los valores de los secretos.
 * Requires: admin role
 */
mercadolibreRouter.get('/status', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const hasToken  = !!process.env.ML_ACCESS_TOKEN;
    const hasSeller = !!process.env.ML_SELLER_ID;

    let lastSync = null;
    try {
      const r = await db.query('SELECT MAX(sync_date) AS last_sync FROM sales_tracking', []);
      lastSync = r.rows[0]?.last_sync ?? null;
    } catch { /* tabla puede no existir aún */ }

    res.json({
      success: true,
      credentials: {
        ml_access_token: hasToken,
        ml_seller_id: hasSeller,
        configured: hasToken && hasSeller,
      },
      cron_configured: !!process.env.CRON_SECRET,
      last_sync: lastSync,
    });
  } catch (error) {
    logger.error('Error in /status endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve status', details: error.message });
  }
});
