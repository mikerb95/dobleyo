// Router unificado de mapa de calor — Fase 8
// Combina ventas web directas (customer_orders) + MercadoLibre (sales_tracking)
import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { backfillGeocodingBatch } from '../services/geocoding.js';

export const heatmapRouter = Router();

/**
 * Procesa el parámetro de días y retorna una expresión SQL de intervalo.
 * Acepta: 7 | 30 | 90 | 365 | 'all'
 */
function buildDateFilter(days, tableAlias, column = 'created_at') {
    const col = tableAlias ? `${tableAlias}.${column}` : column;
    if (!days || days === 'all') return '';
    const n = parseInt(days, 10);
    if (isNaN(n) || n <= 0) return '';
    return `AND ${col} >= NOW() - INTERVAL '${n} days'`;
}

// ───────────────────────────────────────────────
// GET /api/heatmap
// Datos combinados para el mapa de calor
// Query params: days (7|30|90|365|all), channel (web|ml|all), product (texto libre)
// ───────────────────────────────────────────────
heatmapRouter.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { days = '30', channel = 'all', product = '' } = req.query;

        // Rama web directa — customer_orders con geocodificación
        let webRows = [];
        if (channel === 'all' || channel === 'web') {
            const dateFilter = buildDateFilter(days, 'o');
            const productFilter = product
                ? `AND EXISTS (
             SELECT 1 FROM customer_order_items i
             WHERE i.order_id = o.id
               AND LOWER(i.product_name) LIKE $1
           )`
                : '';
            const params = product ? [`%${product.toLowerCase()}%`] : [];

            const { rows } = await query(`
        SELECT
          COALESCE(o.geocoding_city_norm, o.shipping_city) AS city,
          o.shipping_department                            AS state,
          AVG(o.geocoding_lat)::DECIMAL(10,7)             AS latitude,
          AVG(o.geocoding_lng)::DECIMAL(10,7)             AS longitude,
          COUNT(*)::INT                                    AS order_count,
          SUM(o.total_cop)                                 AS total_sales,
          'web'                                            AS channel
        FROM customer_orders o
        WHERE o.geocoding_lat IS NOT NULL
          AND o.geocoding_lng IS NOT NULL
          AND o.status NOT IN ('cancelled')
          ${dateFilter}
          ${productFilter}
        GROUP BY COALESCE(o.geocoding_city_norm, o.shipping_city), o.shipping_department
        ORDER BY order_count DESC
      `, params);

            webRows = rows;
        }

        // Rama MercadoLibre — sales_tracking
        let mlRows = [];
        if (channel === 'all' || channel === 'ml') {
            const dateFilter = buildDateFilter(days, 's', 'purchase_date');
            const productFilter = product
                ? `AND LOWER(s.products::text) LIKE $1`
                : '';
            const params = product ? [`%${product.toLowerCase()}%`] : [];

            const { rows } = await query(`
        SELECT
          s.recipient_city                           AS city,
          s.recipient_state                          AS state,
          AVG(s.latitude)::DECIMAL(10,7)             AS latitude,
          AVG(s.longitude)::DECIMAL(10,7)            AS longitude,
          COUNT(*)::INT                              AS order_count,
          SUM(s.total_amount)                        AS total_sales,
          'ml'                                       AS channel
        FROM sales_tracking s
        WHERE s.latitude IS NOT NULL
          AND s.longitude IS NOT NULL
          ${dateFilter}
          ${productFilter}
        GROUP BY s.recipient_city, s.recipient_state
        ORDER BY order_count DESC
      `, params);

            mlRows = rows;
        }

        // Combinar: agrupar por ciudad normalizada (lower-case primera letra)
        const cityMap = new Map();
        const mergeRows = (rows) => {
            for (const row of rows) {
                const key = (row.city ?? '').toLowerCase().trim();
                if (!key) continue;
                if (cityMap.has(key)) {
                    const existing = cityMap.get(key);
                    existing.order_count += parseInt(row.order_count, 10);
                    existing.total_sales += parseFloat(row.total_sales ?? 0);
                    existing.channels[row.channel] = (existing.channels[row.channel] ?? 0) + parseInt(row.order_count, 10);
                } else {
                    cityMap.set(key, {
                        city: row.city,
                        state: row.state,
                        latitude: parseFloat(row.latitude),
                        longitude: parseFloat(row.longitude),
                        order_count: parseInt(row.order_count, 10),
                        total_sales: parseFloat(row.total_sales ?? 0),
                        channels: { [row.channel]: parseInt(row.order_count, 10) },
                    });
                }
            }
        };

        mergeRows(webRows);
        mergeRows(mlRows);

        const combined = Array.from(cityMap.values())
            .sort((a, b) => b.order_count - a.order_count);

        // Estadísticas globales
        const stats = {
            total_orders: combined.reduce((s, r) => s + r.order_count, 0),
            total_sales: combined.reduce((s, r) => s + r.total_sales, 0),
            cities_count: combined.length,
            web_orders: webRows.reduce((s, r) => s + parseInt(r.order_count, 10), 0),
            ml_orders: mlRows.reduce((s, r) => s + parseInt(r.order_count, 10), 0),
        };

        res.json({ success: true, data: combined, stats, filters: { days, channel, product } });
    } catch (err) {
        console.error('[GET /api/heatmap]', err);
        res.status(500).json({ success: false, error: 'Error al obtener datos del mapa de calor' });
    }
});

// ───────────────────────────────────────────────
// GET /api/heatmap/stats
// Resumen rápido de órdenes sin geocodificación (para admin)
// ───────────────────────────────────────────────
heatmapRouter.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { rows } = await query(`
      SELECT
        COUNT(*)                                               AS total_orders,
        COUNT(*) FILTER (WHERE geocoding_done = FALSE
          AND status != 'cancelled')                          AS pending_geocoding,
        COUNT(*) FILTER (WHERE geocoding_lat IS NOT NULL)     AS geocoded,
        COUNT(*) FILTER (WHERE geocoding_lat IS NULL
          AND geocoding_done = TRUE)                          AS geocoding_failed
      FROM customer_orders
    `, []);

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[GET /api/heatmap/stats]', err);
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
    }
});

// ───────────────────────────────────────────────
// POST /api/heatmap/backfill
// Admin dispara geocodificación masiva de órdenes pendientes
// ───────────────────────────────────────────────
heatmapRouter.post('/backfill', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.body.limit ?? 50, 10), 200);
        const result = await backfillGeocodingBatch(limit);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('[POST /api/heatmap/backfill]', err);
        res.status(500).json({ success: false, error: 'Error en geocodificación masiva' });
    }
});
