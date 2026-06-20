import { Router } from 'express';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken, requireRole('admin'));

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, e, tag) => {
  logger.error(tag, e);
  res.status(500).json({ success: false, error: { code: 'db_error', message: e.message } });
};

const num = (v) => (v == null ? 0 : Number(v));
const pct = (cur, prev) => {
  if (prev == null || prev === 0) return null;
  return Number((((cur - prev) / prev) * 100).toFixed(1));
};

// Rangos soportados por el resumen ejecutivo.
const RANGES = {
  '30d': { days: 30,  pattern: '%Y-%m-%d', points: 30 },
  '90d': { days: 90,  pattern: '%Y-W%W',   points: 13 },
  '12m': { days: 365, pattern: '%Y-%m',    points: 12 },
};
const tf = (pattern, col) => `strftime('${pattern}', ${col})`;

// ──────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/kpis — KPIs con tendencia (delta vs período anterior) y
// sparkline (últimos 14 días de ventas).
// ──────────────────────────────────────────────────────────────────────────
dashboardRouter.get('/kpis', async (req, res) => {
  try {
    const [curRes, prevRes, sparkRes, lowStockRes] = await Promise.allSettled([
      query(`SELECT COUNT(*) AS orders, IFNULL(SUM(total_amount), 0) AS revenue
               FROM sales_tracking
              WHERE purchase_date >= datetime('now', '-30 days')`),
      query(`SELECT COUNT(*) AS orders, IFNULL(SUM(total_amount), 0) AS revenue
               FROM sales_tracking
              WHERE purchase_date >= datetime('now', '-60 days')
                AND purchase_date <  datetime('now', '-30 days')`),
      query(`SELECT strftime('%Y-%m-%d', purchase_date) AS d, IFNULL(SUM(total_amount), 0) AS revenue
               FROM sales_tracking
              WHERE purchase_date >= datetime('now', '-14 days')
           GROUP BY d ORDER BY d`),
      query(`SELECT COUNT(*) AS low
               FROM products
              WHERE stock_min IS NOT NULL AND stock_min > 0
                AND stock_quantity <= stock_min`),
    ]);

    const cur  = curRes.status  === 'fulfilled' ? curRes.value.rows[0]  : { orders: 0, revenue: 0 };
    const prev = prevRes.status === 'fulfilled' ? prevRes.value.rows[0] : { orders: 0, revenue: 0 };
    const spark = sparkRes.status === 'fulfilled' ? sparkRes.value.rows.map((r) => num(r.revenue)) : [];
    const lowStock = lowStockRes.status === 'fulfilled' ? num(lowStockRes.value.rows[0].low) : null;

    const curRev = num(cur.revenue),  prevRev = num(prev.revenue);
    const curOrd = num(cur.orders),   prevOrd = num(prev.orders);
    const curAov = curOrd ? curRev / curOrd : 0;
    const prevAov = prevOrd ? prevRev / prevOrd : 0;

    const fmtCOP = (n) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

    ok(res, [
      { id: 'sales',  label: 'Ventas 30 días',   value: fmtCOP(curRev), delta: pct(curRev, prevRev), icon: '$',  tone: 'primary', spark },
      { id: 'orders', label: 'Pedidos 30 días',  value: curOrd,         delta: pct(curOrd, prevOrd), icon: '🧾', tone: 'accent',  spark: null },
      { id: 'aov',    label: 'Ticket promedio',  value: fmtCOP(curAov), delta: pct(curAov, prevAov), icon: '📈', tone: 'neutral', spark: null },
      { id: 'lowstock', label: 'Stock bajo',     value: lowStock ?? '—', delta: null, icon: '⚠', tone: lowStock > 0 ? 'warn' : 'neutral', spark: null },
    ]);
  } catch (e) {
    fail(res, e, '[GET /api/dashboard/kpis]');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/summary?range=30d|90d|12m — Resumen ejecutivo:
// tendencia de ventas, top productos, top ciudades, estados, producción e
// inventario.
// ──────────────────────────────────────────────────────────────────────────
dashboardRouter.get('/summary', async (req, res) => {
  const range = RANGES[req.query.range] ? req.query.range : '30d';
  const { days, pattern } = RANGES[range];
  const fmt = tf(pattern, 'purchase_date');
  const since = `datetime('now', '-${days} days')`;
  const prevSince = `datetime('now', '-${days * 2} days')`;

  try {
    const [
      curR, prevR, timelineR, statusR, citiesR, productsR,
      productionR, scoreR, inventoryR, prodRegR, prodRoastR,
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS orders, IFNULL(SUM(total_amount),0) AS revenue
               FROM sales_tracking WHERE purchase_date >= ${since}`),
      query(`SELECT COUNT(*) AS orders, IFNULL(SUM(total_amount),0) AS revenue
               FROM sales_tracking
              WHERE purchase_date >= ${prevSince} AND purchase_date < ${since}`),
      query(`SELECT ${fmt} AS period, COUNT(*) AS orders, IFNULL(SUM(total_amount),0) AS revenue
               FROM sales_tracking WHERE purchase_date >= ${since}
           GROUP BY period ORDER BY period`),
      query(`SELECT order_status AS status, COUNT(*) AS count, IFNULL(SUM(total_amount),0) AS revenue
               FROM sales_tracking WHERE purchase_date >= ${since}
           GROUP BY status ORDER BY count DESC`),
      query(`SELECT recipient_city AS city, recipient_state AS state,
                    COUNT(*) AS orders, IFNULL(SUM(total_amount),0) AS revenue
               FROM sales_tracking
              WHERE purchase_date >= ${since} AND recipient_city IS NOT NULL AND recipient_city != 'Unknown'
           GROUP BY city ORDER BY revenue DESC LIMIT 6`),
      query(`SELECT products FROM sales_tracking WHERE purchase_date >= ${since}`),
      query(`SELECT estado, COUNT(*) AS n FROM lots GROUP BY estado`),
      query(`SELECT IFNULL(AVG(score),0) AS avg_score FROM lots WHERE score IS NOT NULL AND score > 0`),
      query(`SELECT
                COUNT(*) AS total_products,
                SUM(CASE WHEN stock_min IS NOT NULL AND stock_min > 0 AND stock_quantity <= stock_min THEN 1 ELSE 0 END) AS low_stock,
                SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
                IFNULL(SUM(stock_quantity * IFNULL(cost, price)), 0) AS inventory_value
               FROM products WHERE is_active = 1`),
    ]);

    // Top productos: parsear el JSON de cada venta.
    const productMap = {};
    for (const row of productsR.rows) {
      try {
        for (const p of (JSON.parse(row.products) || [])) {
          const key = (p.title || 'Producto desconocido').slice(0, 70);
          if (!productMap[key]) productMap[key] = { title: key, units: 0, revenue: 0 };
          productMap[key].units   += Number(p.quantity) || 1;
          productMap[key].revenue += (Number(p.unit_price) || 0) * (Number(p.quantity) || 1);
        }
      } catch { /* venta con products malformado */ }
    }
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    const cur = curR.rows[0], prev = prevR.rows[0];
    const curRev = num(cur.revenue), prevRev = num(prev.revenue);
    const curOrd = num(cur.orders);
    const production = { green: 0, roasted: 0 };
    for (const r of productionR.rows) {
      if (r.estado === 'verde') production.green = num(r.n);
      if (r.estado === 'tostado') production.roasted = num(r.n);
    }

    ok(res, {
      range,
      sales: {
        revenue: curRev,
        orders: curOrd,
        aov: curOrd ? Math.round(curRev / curOrd) : 0,
        delta_revenue: pct(curRev, prevRev),
        delta_orders: pct(curOrd, num(prev.orders)),
        timeline: timelineR.rows.map((r) => ({ period: r.period, revenue: num(r.revenue), orders: num(r.orders) })),
      },
      by_status: statusR.rows.map((r) => ({ status: r.status || 'desconocido', count: num(r.count), revenue: num(r.revenue) })),
      top_cities: citiesR.rows.map((r) => ({ ...r, orders: num(r.orders), revenue: num(r.revenue) })),
      top_products: topProducts,
      production: {
        green_lots: production.green,
        roasted_lots: production.roasted,
        avg_score: Number(num(scoreR.rows[0].avg_score).toFixed(1)),
      },
      inventory: {
        total_products: num(inventoryR.rows[0].total_products),
        low_stock: num(inventoryR.rows[0].low_stock),
        out_of_stock: num(inventoryR.rows[0].out_of_stock),
        inventory_value: num(inventoryR.rows[0].inventory_value),
      },
    });
  } catch (e) {
    fail(res, e, '[GET /api/dashboard/summary]');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/alerts — Alertas operativas (stock bajo / agotado).
// ──────────────────────────────────────────────────────────────────────────
dashboardRouter.get('/alerts', async (req, res) => {
  try {
    const alerts = [];
    const lowStockRes = await query(
      `SELECT id, name, stock_quantity, stock_min FROM products
        WHERE is_active = 1 AND stock_min IS NOT NULL AND stock_min > 0
          AND stock_quantity <= stock_min
        ORDER BY stock_quantity ASC LIMIT 5`
    );
    for (const p of lowStockRes.rows) {
      alerts.push({
        id:          `low_stock_${p.id ?? p.name}`,
        severity:    p.stock_quantity <= 0 ? 'critical' : 'warning',
        title:       `Stock bajo: ${p.name}`,
        description: `${p.stock_quantity} unidades disponibles (mínimo: ${p.stock_min})`,
        action:      { label: 'Ver inventario', href: '/admin/inventario' },
      });
    }
    ok(res, alerts);
  } catch (e) {
    fail(res, e, '[GET /api/dashboard/alerts]');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/activity — Actividad reciente desde audit_logs.
// ──────────────────────────────────────────────────────────────────────────
dashboardRouter.get('/activity', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 10), 50);
  try {
    const logsRes = await query(
      `SELECT al.*, u.name AS user_name, u.role AS user_role
         FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT ?`,
      [limit]
    );
    ok(res, logsRes.rows);
  } catch (e) {
    fail(res, e, '[GET /api/dashboard/activity]');
  }
});
