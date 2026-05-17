import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken, requireRole('admin'));

const ok = (res, data) => res.json({ success: true, data });

// GET /api/dashboard/kpis
dashboardRouter.get('/kpis', async (req, res) => {
  try {
    const [usersRes, inventoryRes, lotsRes, salesRes] = await Promise.allSettled([
      query('SELECT COUNT(*) AS n FROM users WHERE is_verified = 1 OR is_verified IS NULL'),
      query(`SELECT COUNT(*) AS low FROM products WHERE stock IS NOT NULL AND stock <= min_stock AND min_stock IS NOT NULL`),
      query(`SELECT COUNT(*) AS n FROM lots WHERE created_at >= datetime('now', '-30 days')`),
      query(`SELECT IFNULL(SUM(total_cop), 0) AS total FROM sales_tracking WHERE created_at >= datetime('now', '-30 days')`),
    ]);

    const users     = usersRes.status     === 'fulfilled' ? usersRes.value.rows[0].n     : null;
    const lowStock  = inventoryRes.status === 'fulfilled' ? inventoryRes.value.rows[0].low : null;
    const newLots   = lotsRes.status      === 'fulfilled' ? lotsRes.value.rows[0].n       : null;
    const sales30d  = salesRes.status     === 'fulfilled' ? Number(salesRes.value.rows[0].total) : null;

    const fmtCOP = (n) => n == null ? '—' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

    ok(res, [
      { id: 'sales',    label: 'Ventas 30 días',  value: fmtCOP(sales30d), delta: null, icon: '$',  tone: 'primary', spark: null },
      { id: 'lots',     label: 'Lotes activos',   value: newLots ?? '—',   delta: null, icon: '☕', tone: 'accent',  spark: null },
      { id: 'users',    label: 'Usuarios',        value: users ?? '—',     delta: null, icon: '👥', tone: 'neutral', spark: null },
      { id: 'lowstock', label: 'Stock bajo',      value: lowStock ?? '—',  delta: null, icon: '⚠', tone: lowStock > 0 ? 'warn' : 'neutral', spark: null },
    ]);
  } catch (e) {
    console.error('[GET /api/dashboard/kpis]', e);
    res.status(500).json({ success: false, error: { code: 'db_error', message: e.message } });
  }
});

// GET /api/dashboard/alerts
dashboardRouter.get('/alerts', async (req, res) => {
  try {
    const alerts = [];

    const lowStockRes = await query(
      `SELECT name, stock, min_stock FROM products
        WHERE stock IS NOT NULL AND min_stock IS NOT NULL AND stock <= min_stock
        ORDER BY stock ASC LIMIT 5`
    );
    for (const p of lowStockRes.rows) {
      alerts.push({
        id:          `low_stock_${p.id ?? p.name}`,
        severity:    p.stock === 0 ? 'critical' : 'warning',
        title:       `Stock bajo: ${p.name}`,
        description: `${p.stock} unidades disponibles (mínimo: ${p.min_stock})`,
        action:      { label: 'Ver inventario', href: '/admin/inventario' },
      });
    }

    ok(res, alerts);
  } catch (e) {
    console.error('[GET /api/dashboard/alerts]', e);
    res.status(500).json({ success: false, error: { code: 'db_error', message: e.message } });
  }
});

// GET /api/dashboard/activity  (wraps audit_logs en formato estándar)
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
    console.error('[GET /api/dashboard/activity]', e);
    res.status(500).json({ success: false, error: { code: 'db_error', message: e.message } });
  }
});
