// Router de pronóstico de demanda — Fase analítica (Python + Node).
// Node SOLO lee la tabla demand_forecasts (la escribe api/ml/recompute.py).
// El recálculo manual se proxea a la función Python con CRON_SECRET (server-to-server).
import { Router } from 'express';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';

export const forecastRouter = Router();

// Normaliza para emparejar títulos de MercadoLibre con productos del catálogo.
function norm(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

// ───────────────────────────────────────────────
// GET /api/ml/forecast
// Devuelve la última corrida: demanda por SKU (unidades) + ingresos totales.
// ───────────────────────────────────────────────
forecastRouter.get('/forecast', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT product_key, product_ml_id, metric, period_start, horizon_index,
             forecast_value, lower_bound, upper_bound, model_used, history_weeks, generated_at
      FROM demand_forecasts
      WHERE generated_at = (SELECT MAX(generated_at) FROM demand_forecasts)
      ORDER BY metric, product_key, horizon_index
    `);

    if (rows.length === 0) {
      return res.json({ success: true, data: { generated_at: null, units: [], revenue: null } });
    }

    const generated_at = rows[0].generated_at;

    // Stock actual para la señal de reorden (best-effort por nombre).
    const { rows: products } = await query(
      `SELECT name, stock_quantity, stock_min FROM products WHERE is_active = 1`
    );
    const matchStock = (title) => {
      const t = norm(title);
      return products.find((p) => {
        const n = norm(p.name);
        return n && (t.includes(n) || n.includes(t));
      });
    };

    // Agrupar por (metric, product_key)
    const seriesMap = new Map();
    for (const r of rows) {
      const key = `${r.metric}::${r.product_key}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          product_key: r.product_key,
          product_ml_id: r.product_ml_id,
          metric: r.metric,
          model_used: r.model_used,
          history_weeks: r.history_weeks,
          points: [],
        });
      }
      seriesMap.get(key).points.push({
        period_start: r.period_start,
        horizon_index: r.horizon_index,
        forecast_value: r.forecast_value,
        lower_bound: r.lower_bound,
        upper_bound: r.upper_bound,
      });
    }

    const units = [];
    let revenue = null;
    for (const s of seriesMap.values()) {
      // Demanda proyectada de las próximas 4 semanas
      s.next_4w = Math.round(
        s.points.filter((p) => p.horizon_index <= 4).reduce((a, p) => a + p.forecast_value, 0)
      );
      if (s.metric === 'revenue') {
        revenue = s;
      } else {
        const stock = matchStock(s.product_key);
        s.stock_quantity = stock ? stock.stock_quantity : null;
        s.stock_min = stock ? stock.stock_min : null;
        // Reorden: la demanda de 4 semanas supera el stock disponible
        s.reorder = stock ? s.next_4w > stock.stock_quantity : null;
        units.push(s);
      }
    }
    units.sort((a, b) => b.next_4w - a.next_4w);

    res.json({ success: true, data: { generated_at, units, revenue } });
  } catch (err) {
    logger.error({ err }, '[GET /api/ml/forecast]');
    res.status(500).json({ success: false, error: 'Error al obtener el pronóstico de demanda' });
  }
});

// ───────────────────────────────────────────────
// POST /api/ml/forecast/demo-sale
// Inserta una venta de demostración con fecha de hoy para que el pronóstico cambie
// al hacer clic en "Recalcular ahora". Solo disponible para admin.
// ───────────────────────────────────────────────
const DEMO_PRODUCTS = [
  { title: 'Café Sierra Nevada 500g',   unit_price: 48000 },
  { title: 'Café Nariño Castillo 500g', unit_price: 48000 },
  { title: 'Café Huila Geisha 500g',    unit_price: 48000 },
  { title: 'Kit Iniciación Barista',    unit_price: 89900 },
  { title: 'Kit Regalo Especial',       unit_price: 89900 },
  { title: 'Molinillo Manual',          unit_price: 52800 },
];
const DEMO_CITIES = [
  { city: 'Bogotá',       state: 'Cundinamarca', lat: 4.6545,  lon: -74.0886 },
  { city: 'Medellín',     state: 'Antioquia',    lat: 6.2530,  lon: -75.5699 },
  { city: 'Cali',         state: 'Valle del Cauca', lat: 3.4372, lon: -76.5225 },
  { city: 'Barranquilla', state: 'Atlántico',    lat: 10.9878, lon: -74.7889  },
  { city: 'Bucaramanga',  state: 'Santander',    lat: 7.1254,  lon: -73.1198  },
];

forecastRouter.post('/forecast/demo-sale', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Elegir 1-3 productos aleatorios
    const shuffled = [...DEMO_PRODUCTS].sort(() => Math.random() - 0.5);
    const items = shuffled.slice(0, 1 + Math.floor(Math.random() * 3)).map(p => ({
      title: p.title,
      quantity: 1 + Math.floor(Math.random() * 3),
      unit_price: p.unit_price,
    }));
    const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const place = DEMO_CITIES[Math.floor(Math.random() * DEMO_CITIES.length)];
    const orderId = '91' + String(Date.now()).slice(-7);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await query(
      `INSERT OR IGNORE INTO sales_tracking
         (ml_order_id, purchase_date, total_amount, order_status, shipping_method,
          recipient_city, recipient_state, recipient_country,
          latitude, longitude, products, sync_date, created_at)
       VALUES (?, ?, ?, 'delivered', 'Mercado Envíos', ?, ?, 'Colombia', ?, ?, ?, datetime('now'), datetime('now'))`,
      [orderId, now, total, place.city, place.state, place.lat, place.lon, JSON.stringify(items)]
    );

    await logAudit(req.user.id, 'create', 'sales_tracking', null, { orderId, total, city: place.city, items });

    res.json({ success: true, data: { orderId, total, city: place.city, items } });
  } catch (err) {
    logger.error({ err }, '[POST /api/ml/forecast/demo-sale]');
    res.status(500).json({ success: false, error: 'No se pudo insertar la venta de demostración.' });
  }
});

// ───────────────────────────────────────────────
// POST /api/ml/forecast/recompute
// Dispara la función Python (server-to-server con CRON_SECRET) y devuelve su resultado.
// ───────────────────────────────────────────────
forecastRouter.post('/forecast/recompute', authenticateToken, requireRole('admin'), async (req, res) => {
  const base = process.env.SITE_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 4000}`);
  const secret = process.env.CRON_SECRET || '';

  try {
    const upstream = await fetch(`${base}/api/ml/recompute`, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });

    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 300) }; }

    if (!upstream.ok) {
      logger.warn({ status: upstream.status, payload }, '[recompute] upstream no-ok');
      return res.status(502).json({
        success: false,
        error: 'La función de pronóstico (Python) no respondió correctamente. '
             + 'En local solo corre en el deploy de Vercel; ejecute api/ml/recompute.py manualmente.',
        upstream: payload,
      });
    }

    await logAudit(req.user.id, 'recompute', 'demand_forecast', null, {
      rows_written: payload?.rows_written, series: payload?.series,
    });

    res.json({ success: true, data: payload });
  } catch (err) {
    logger.error({ err }, '[POST /api/ml/forecast/recompute]');
    res.status(502).json({
      success: false,
      error: 'No se pudo contactar la función de pronóstico. '
           + 'Verifique que esté desplegada en Vercel y que CRON_SECRET esté configurado.',
    });
  }
});
