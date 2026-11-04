/**
 * MercadoLibre Routes
 *
 * - Conexión OAuth con la cuenta de vendedor (/oauth/*): el token se renueva solo.
 * - Órdenes: sync manual, cron y webhook. Cada orden pagada descuenta el stock
 *   del sitio y cada cancelación lo repone (services/mlStock.js).
 * - Centralizador de stock (/stock/*): vínculos producto ↔ publicación y envío
 *   del disponible del sitio a ML.
 * - Lectura de ventas para el panel, el mapa de calor y la analítica.
 */

import crypto from 'crypto';
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { body, param, query as vquery, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import MercadoLibreService from '../services/mercadolibre.js';
import * as auth from '../auth.js';
import * as db from '../db.js';
import { logAudit } from '../services/audit.js';
import {
  MlAuthError, MlApiError, buildAuthorizationUrl, createPkcePair, disconnect,
  exchangeCodeAndSave, getConnectionStatus, getSellerId, isOAuthConfigured, mlApi,
} from '../services/mlAuth.js';
import {
  MlStockError, applyOrdersStockAndPush, linkListing, listListingsWithStock, listSellerItems,
  pushListing, pushListings, refreshListingFromMl, unlinkListing, updateListing,
} from '../services/mlStock.js';

export const mercadolibreRouter = Router();

const adminOnly = [auth.requireAuth, auth.requireAdmin];

const OAUTH_COOKIE = 'ml_oauth_state';
const OAUTH_COOKIE_PATH = '/api/mercadolibre/oauth';

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
});

/**
 * Responde un error de la integración. Los de negocio (sin conexión, publicación
 * inexistente, vínculo repetido) se muestran tal cual; el resto va al log y al
 * cliente le llega un mensaje genérico.
 */
function sendMlError(res, err, where) {
  if (err instanceof MlAuthError || err instanceof MlStockError) {
    return res.status(err.status || 400).json({
      success: false,
      error: err.message,
      ...(err.code && { code: err.code }),
      ...(err.variations && { variations: err.variations }),
    });
  }
  if (err instanceof MlApiError) {
    logger.warn({ err: err.message, path: err.path, status: err.status }, `[${where}] error de la API de MercadoLibre`);
    return res.status(502).json({ success: false, error: `MercadoLibre respondió: ${err.message}`, code: 'ML_API_ERROR' });
  }
  logger.error({ err }, `[${where}] Error:`);
  return res.status(500).json({ success: false, error: 'Error interno del servidor' });
}

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(422).json({ success: false, error: errors.array()[0].msg, errors: errors.array() });
  return false;
}

/** Comparación en tiempo constante de un secreto recibido contra el esperado. */
function safeEqual(received, expected) {
  const a = Buffer.from(String(received || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Conexión OAuth ─────────────────────────────────────────────────────────

/**
 * GET /api/mercadolibre/oauth/start
 * Lleva al admin a autorizar la app en MercadoLibre. Guarda state + PKCE en una
 * cookie HttpOnly de 10 minutos para validar el regreso.
 */
mercadolibreRouter.get('/oauth/start', ...adminOnly, (req, res) => {
  if (!isOAuthConfigured()) {
    return res.redirect('/admin/mercadolibre?ml_error=ML_OAUTH_NOT_CONFIGURED');
  }
  const state = crypto.randomBytes(24).toString('hex');
  const { verifier, challenge } = createPkcePair();
  res.cookie(OAUTH_COOKIE, { state, verifier }, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // el regreso desde mercadolibre.com.co es navegación de nivel superior
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(buildAuthorizationUrl({ state, codeChallenge: challenge }));
});

/**
 * GET /api/mercadolibre/oauth/callback
 * Regreso de MercadoLibre. Es una navegación del navegador, así que los errores
 * se devuelven como redirección al panel, no como JSON.
 */
mercadolibreRouter.get('/oauth/callback', async (req, res) => {
  const saved = req.cookies?.[OAUTH_COOKIE];
  res.clearCookie(OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });
  const back = (qs) => res.redirect(`/admin/mercadolibre?${qs}`);

  // Sesión de admin vigente (la cookie de acceso dura 15 min; si venció, a iniciar sesión).
  let user = null;
  try {
    const token = req.cookies?.auth_token;
    const verified = token ? auth.verifyToken(token) : null;
    if (verified && !verified.type && verified.role === 'admin') user = verified;
  } catch { /* token vencido */ }
  if (!user) return res.redirect('/admin/login?redirect=/admin/mercadolibre');

  if (req.query.error) return back('ml_error=ML_OAUTH_DENIED');

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string' || !saved?.state || !safeEqual(state, saved.state)) {
    return back('ml_error=ML_OAUTH_STATE');
  }

  try {
    const conn = await exchangeCodeAndSave({ code, codeVerifier: saved.verifier, connectedBy: user.id });
    await logAudit(user.id, 'connect', 'mercadolibre', conn.ml_user_id, { nickname: conn.nickname });
    return back('ml=connected');
  } catch (err) {
    logger.error({ err: err.message }, '[GET /api/mercadolibre/oauth/callback] no se pudo completar la conexión');
    const codeParam = err instanceof MlAuthError ? err.code : 'ML_OAUTH_EXCHANGE';
    return back(`ml_error=${encodeURIComponent(codeParam)}`);
  }
});

/**
 * POST /api/mercadolibre/oauth/disconnect
 * Borra la conexión OAuth. Los vínculos de publicaciones se conservan.
 */
mercadolibreRouter.post('/oauth/disconnect', ...adminOnly, async (req, res) => {
  try {
    await disconnect();
    await logAudit(req.user.id, 'disconnect', 'mercadolibre', null, {});
    res.json({ success: true, data: await getConnectionStatus() });
  } catch (err) {
    sendMlError(res, err, 'POST /api/mercadolibre/oauth/disconnect');
  }
});

// ── Órdenes ────────────────────────────────────────────────────────────────

/**
 * POST /api/mercadolibre/sync
 * Trae las órdenes (incremental por defecto, ?full=1 completo), las guarda y
 * aplica su efecto en el stock del sitio.
 */
mercadolibreRouter.post('/sync', ...adminOnly, async (req, res) => {
  try {
    const mlService = new MercadoLibreService();
    const incremental = req.query.full !== '1';
    const summary = await mlService.syncOrders({ incremental });

    if (summary.total_orders_fetched === 0) {
      return res.json({ success: true, message: 'No hay órdenes nuevas', count: 0, ...summary });
    }
    res.json({ success: true, message: 'Sincronización completada', ...summary });
  } catch (err) {
    sendMlError(res, err, 'POST /api/mercadolibre/sync');
  }
});

/**
 * GET|POST /api/mercadolibre/cron-sync
 * Para un cron (Vercel Cron o uno externo). Sincroniza órdenes y reintenta los
 * envíos de stock pendientes. Autentica con CRON_SECRET por cabecera:
 * `Authorization: Bearer <CRON_SECRET>` (lo que manda Vercel Cron) o
 * `x-cron-secret: <CRON_SECRET>`. Nunca por query string.
 */
async function cronSync(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ success: false, error: 'CRON_SECRET no configurado' });
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(bearer, secret) && !safeEqual(req.get('x-cron-secret'), secret)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  const result = { orders: null, stock: null };
  try {
    result.orders = await new MercadoLibreService().syncOrders({ incremental: true });
  } catch (err) {
    logger.error({ err: err.message }, '[cron-sync] falló el sync de órdenes');
    result.orders = { error: err.message };
  }
  try {
    const s = await pushListings({});
    result.stock = { total: s.total, pushed: s.pushed, unchanged: s.unchanged, errors: s.errors };
  } catch (err) {
    logger.error({ err: err.message }, '[cron-sync] falló el envío de stock pendiente');
    result.stock = { error: err.message };
  }
  logger.info(result, '[cron-sync] completado');
  const ok = !result.orders?.error && !result.stock?.error;
  res.status(ok ? 200 : 207).json({ success: ok, data: result });
}
mercadolibreRouter.get('/cron-sync', cronSync);
mercadolibreRouter.post('/cron-sync', cronSync);

/**
 * POST /api/mercadolibre/webhook
 * Notificaciones de MercadoLibre. Público: ML no firma las notificaciones, así
 * que nunca se confía en el cuerpo; solo se usa para saber qué recurso consultar
 * con nuestro token. Responde 200 de inmediato (ML reintenta si tarda).
 *   orders_v2 / orders → guarda la orden y aplica su efecto en el stock.
 *   items              → refresca lo que ML reporta de una publicación vinculada.
 */
mercadolibreRouter.post('/webhook', webhookLimiter, async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const { topic, resource, user_id, application_id } = req.body || {};
    if (!topic || !resource) return;

    if (process.env.ML_CLIENT_ID && application_id != null && String(application_id) !== String(process.env.ML_CLIENT_ID)) {
      logger.warn({ application_id }, '[webhook] ignorado: application_id de otra app');
      return;
    }
    const sellerId = await getSellerId();
    if (sellerId && user_id != null && String(user_id) !== String(sellerId)) {
      logger.warn(`[webhook] ignorado: user_id ${user_id} != seller ${sellerId}`);
      return;
    }

    const t = String(topic);
    const orderMatch = String(resource).match(/\/orders\/(\d+)/);
    if (t.includes('order') && orderMatch) {
      const orderId = orderMatch[1];
      const mlService = new MercadoLibreService();
      const orderDetails = await mlService.fetchOrderDetails(orderId);

      let shipment = null;
      if (orderDetails.shipping?.id) {
        try {
          shipment = await mlService.fetchShipment(orderDetails.shipping.id);
        } catch (e) {
          logger.warn(`[webhook] shipment ${orderDetails.shipping.id} no disponible: ${e.message}`);
        }
      }

      const transformed = await mlService.transformOrderData(orderDetails, orderDetails, shipment);
      await mlService.saveSalesData([transformed]);
      const stock = await applyOrdersStockAndPush([orderDetails]);
      logger.info({ orderId, stock }, '[webhook] orden sincronizada');
      return;
    }

    const itemMatch = String(resource).match(/\/items\/(M[A-Z]{2}\d+)/i);
    if (t === 'items' && itemMatch) {
      const n = await refreshListingFromMl(itemMatch[1]);
      if (n) logger.info({ item: itemMatch[1] }, '[webhook] publicación vinculada refrescada');
      return;
    }

    logger.info(`[webhook] topic '${t}' resource '${resource}': sin acción`);
  } catch (error) {
    logger.error({ err: error.message }, '[webhook] error procesando la notificación');
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
      limit = 50, offset = 0,
      city = null, state = null, dateFrom = null, dateTo = null, status = null,
      search = null, sort = 'purchase_date', sortDir = 'desc',
    } = req.query;

    const mlService = new MercadoLibreService();
    const result = await mlService.getSalesData({
      limit: parseInt(limit),
      offset: parseInt(offset),
      city, state, dateFrom, dateTo, status,
      search, sort, sortDir,
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
    const mlService = new MercadoLibreService();
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

    const [kpisR, prevKpisR, timelineR, byStatusR, topCitiesR, allProductsR, filterOptsR, prevTimelineR] = await Promise.all([
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
        ? db.query(`SELECT COUNT(*) as orders, COALESCE(SUM(total_amount),0) as revenue, COALESCE(AVG(total_amount),0) as aov,
                   SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
              FROM sales_tracking ${pw}`, pp)
        : Promise.resolve({ rows: [null] }),
      db.query(`SELECT ${timeFmt} as period, COUNT(*) as orders, SUM(total_amount) as revenue FROM sales_tracking ${w} GROUP BY period ORDER BY period`, [...p]),
      db.query(`SELECT order_status as status, COUNT(*) as count, SUM(total_amount) as revenue FROM sales_tracking ${w} GROUP BY status ORDER BY count DESC`, [...p]),
      db.query(`SELECT recipient_city as city, recipient_state as state, COUNT(*) as orders, SUM(total_amount) as revenue FROM sales_tracking ${w} GROUP BY city ORDER BY orders DESC LIMIT 12`, [...p]),
      db.query(`SELECT products FROM sales_tracking ${w}`, [...p]),
      db.query(`SELECT DISTINCT recipient_city as city, recipient_state as state FROM sales_tracking WHERE recipient_city IS NOT NULL AND recipient_city != 'Unknown' ORDER BY recipient_city`, []),
      // Serie del periodo anterior para comparar en la gráfica (se alinea por posición).
      pw
        ? db.query(`SELECT ${timeFmt} as period, COUNT(*) as orders, SUM(total_amount) as revenue FROM sales_tracking ${pw} GROUP BY period ORDER BY period`, pp)
        : Promise.resolve({ rows: [] }),
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
      prev_timeline: prevTimelineR.rows,
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
 * Estado real de la integración. Con ?check=1 además llama a ML (/users/me)
 * para confirmar que el token sirve; sin eso solo reporta lo guardado.
 * No revela tokens ni secretos.
 */
mercadolibreRouter.get('/status', ...adminOnly, async (req, res) => {
  try {
    const connection = await getConnectionStatus();

    let live = null;
    if (req.query.check === '1' && connection.connected) {
      try {
        const me = await mlApi('/users/me');
        live = { ok: true, ml_user_id: String(me.id), nickname: me.nickname || null };
      } catch (err) {
        live = { ok: false, error: err.message, code: err.code || null };
      }
    }

    let lastSync = null;
    try {
      const r = await db.query('SELECT MAX(sync_date) AS last_sync FROM sales_tracking', []);
      lastSync = r.rows[0]?.last_sync ?? null;
    } catch { /* tabla puede no existir aún */ }

    let stock = null;
    try {
      const r = await db.query(
        `SELECT COUNT(*) AS linked,
                SUM(CASE WHEN is_active = 1 AND pending_push = 1 THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN is_active = 1 AND last_error IS NOT NULL THEN 1 ELSE 0 END) AS errors,
                MAX(last_pushed_at) AS last_push
           FROM ml_listings`,
      );
      stock = {
        linked: Number(r.rows[0]?.linked || 0),
        pending: Number(r.rows[0]?.pending || 0),
        errors: Number(r.rows[0]?.errors || 0),
        last_push: r.rows[0]?.last_push || null,
      };
    } catch { /* migración pendiente */ }

    res.json({
      success: true,
      data: {
        connection,
        live,
        // El cron solo corre si alguien lo programa: aquí se informa si el secreto
        // existe, no que haya un cron agendado.
        cron_secret_configured: Boolean(process.env.CRON_SECRET),
        webhook_url: `${(process.env.SITE_BASE_URL || 'https://dobleyo.cafe').replace(/\/+$/, '')}/api/mercadolibre/webhook`,
        last_sync: lastSync,
        stock,
      },
    });
  } catch (error) {
    sendMlError(res, error, 'GET /api/mercadolibre/status');
  }
});

// ── Centralizador de stock ─────────────────────────────────────────────────

/**
 * GET /api/mercadolibre/stock/listings
 * Vínculos con el disponible del sitio, lo que se envió y lo que ML reporta.
 */
mercadolibreRouter.get('/stock/listings', ...adminOnly, async (req, res) => {
  try {
    res.json({ success: true, data: await listListingsWithStock() });
  } catch (err) {
    sendMlError(res, err, 'GET /api/mercadolibre/stock/listings');
  }
});

/**
 * GET /api/mercadolibre/stock/products
 * Catálogo del sitio (productos y variantes) para el selector de vínculos.
 */
mercadolibreRouter.get('/stock/products', ...adminOnly, async (req, res) => {
  try {
    const products = await db.query(
      `SELECT id, name, sku, is_active, stock_quantity FROM products ORDER BY is_active DESC, name`,
    );
    const variants = await db.query(
      `SELECT id, product_id, size_label, grind_label, sku_suffix, stock_quantity, is_active
         FROM product_variants ORDER BY product_id, sort_order, id`,
    );
    const byProduct = new Map();
    for (const v of variants.rows) {
      if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
      byProduct.get(v.product_id).push({
        id: v.id,
        label: [v.size_label, v.grind_label].filter(Boolean).join(' · ') || `Variante ${v.id}`,
        sku_suffix: v.sku_suffix,
        stock_quantity: v.stock_quantity,
        is_active: Boolean(v.is_active),
      });
    }
    res.json({
      success: true,
      data: products.rows.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        is_active: Boolean(p.is_active),
        stock_quantity: p.stock_quantity,
        variants: byProduct.get(p.id) || [],
      })),
    });
  } catch (err) {
    sendMlError(res, err, 'GET /api/mercadolibre/stock/products');
  }
});

/**
 * GET /api/mercadolibre/stock/items
 * Publicaciones del vendedor en ML, marcando las vinculadas y sugiriendo
 * producto cuando el SKU coincide.
 */
mercadolibreRouter.get('/stock/items', ...adminOnly,
  [
    vquery('status').optional().isIn(['active', 'paused', 'closed', '']).withMessage('Estado inválido'),
    vquery('offset').optional().isInt({ min: 0 }).toInt(),
    vquery('search').optional().isString().trim().isLength({ max: 80 }),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const data = await listSellerItems({
        status: req.query.status ?? 'active',
        offset: req.query.offset || 0,
        search: req.query.search || '',
      });
      res.json({ success: true, data });
    } catch (err) {
      sendMlError(res, err, 'GET /api/mercadolibre/stock/items');
    }
  });

/**
 * POST /api/mercadolibre/stock/listings
 * Vincula una publicación (y variación) a un producto o variante del sitio y
 * envía el stock de inmediato.
 */
mercadolibreRouter.post('/stock/listings', ...adminOnly,
  [
    body('product_id').isString().trim().notEmpty().withMessage('Producto requerido'),
    body('variant_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Variante inválida').toInt(),
    body('ml_item_id').isString().trim().notEmpty().withMessage('ID de publicación requerido'),
    body('ml_variation_id').optional({ values: 'null' }).isString().trim().matches(/^\d*$/).withMessage('Variación inválida'),
    body('stock_buffer').optional().isInt({ min: 0, max: 100000 }).withMessage('El colchón debe ser un entero de 0 en adelante').toInt(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { listing, push } = await linkListing({
        productId: req.body.product_id,
        variantId: req.body.variant_id ?? null,
        mlItemId: req.body.ml_item_id,
        mlVariationId: req.body.ml_variation_id || '',
        stockBuffer: req.body.stock_buffer ?? 0,
        userId: req.user.id,
      });
      await logAudit(req.user.id, 'create', 'ml_listing', listing.id, {
        product_id: listing.product_id, variant_id: listing.variant_id,
        ml_item_id: listing.ml_item_id, ml_variation_id: listing.ml_variation_id || null,
      });
      res.status(201).json({ success: true, data: { listing, push } });
    } catch (err) {
      sendMlError(res, err, 'POST /api/mercadolibre/stock/listings');
    }
  });

/**
 * PATCH /api/mercadolibre/stock/listings/:id
 * Cambia el colchón o pausa/reactiva el vínculo, y reenvía el stock.
 */
mercadolibreRouter.patch('/stock/listings/:id', ...adminOnly,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('stock_buffer').optional().isInt({ min: 0, max: 100000 }).withMessage('El colchón debe ser un entero de 0 en adelante').toInt(),
    body('is_active').optional().isBoolean().withMessage('is_active debe ser verdadero o falso').toBoolean(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const listing = await updateListing(req.params.id, {
        stockBuffer: req.body.stock_buffer,
        isActive: req.body.is_active,
      });
      const push = await pushListing(listing, { force: true });
      await logAudit(req.user.id, 'update', 'ml_listing', listing.id, {
        stock_buffer: req.body.stock_buffer, is_active: req.body.is_active,
      });
      res.json({ success: true, data: { listing, push } });
    } catch (err) {
      sendMlError(res, err, 'PATCH /api/mercadolibre/stock/listings/:id');
    }
  });

/**
 * DELETE /api/mercadolibre/stock/listings/:id
 * Quita el vínculo. ML se queda con la última cantidad enviada.
 */
mercadolibreRouter.delete('/stock/listings/:id', ...adminOnly,
  [param('id').isInt({ min: 1 }).toInt()],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const removed = await unlinkListing(req.params.id);
      await logAudit(req.user.id, 'delete', 'ml_listing', removed.id, {
        product_id: removed.product_id, ml_item_id: removed.ml_item_id,
      });
      res.json({ success: true, data: { id: removed.id } });
    } catch (err) {
      sendMlError(res, err, 'DELETE /api/mercadolibre/stock/listings/:id');
    }
  });

/**
 * POST /api/mercadolibre/stock/listings/:id/push
 * Envía ya el stock de un vínculo, aunque no haya cambiado.
 */
mercadolibreRouter.post('/stock/listings/:id/push', ...adminOnly,
  [param('id').isInt({ min: 1 }).toInt()],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await pushListing(req.params.id, { force: true });
      if (result.status === 'not_found') {
        return res.status(404).json({ success: false, error: 'Vínculo no encontrado' });
      }
      const failed = result.status === 'error' || result.status === 'orphan';
      res.status(failed ? 502 : 200).json({ success: !failed, data: result, ...(result.error && { error: result.error }) });
    } catch (err) {
      sendMlError(res, err, 'POST /api/mercadolibre/stock/listings/:id/push');
    }
  });

/**
 * POST /api/mercadolibre/stock/push
 * Envía los pendientes. { all: true } revisa todos los vínculos activos;
 * { force: true } envía aunque el valor no haya cambiado.
 */
mercadolibreRouter.post('/stock/push', ...adminOnly,
  [
    body('all').optional().isBoolean().toBoolean(),
    body('force').optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const summary = await pushListings({ all: Boolean(req.body.all), force: Boolean(req.body.force) });
      await logAudit(req.user.id, 'sync', 'ml_stock', null, {
        all: Boolean(req.body.all), force: Boolean(req.body.force),
        pushed: summary.pushed, errors: summary.errors,
      });
      res.json({ success: true, data: summary });
    } catch (err) {
      sendMlError(res, err, 'POST /api/mercadolibre/stock/push');
    }
  });
