// Servicio de geocodificación usando Nominatim (OpenStreetMap) — Fase 8
// Convierte ciudad/departamento colombiano en coordenadas lat/lng
import { query } from '../db.js';
import { logger } from '../logger.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'DobleYoCafe/1.0 (contacto@dobleyo.cafe)';

export async function geocodeCity(city, department = '') {
    if (!city) return null;

    try {
        const queryStr = department ? `${city}, ${department}, Colombia` : `${city}, Colombia`;
        const params = new URLSearchParams({
            q: queryStr,
            format: 'json',
            limit: '1',
            countrycodes: 'co',
        });

        const res = await fetch(`${NOMINATIM_URL}?${params}`, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'es',
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;
        const results = await res.json();
        if (!results.length) return null;

        const { lat, lon, display_name } = results[0];
        return {
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            displayName: display_name,
        };
    } catch (err) {
        logger.warn(`[geocoding] No se pudo geocodificar "${city}":`, err.message);
        return null;
    }
}

export async function geocodeOrderAsync(orderId, city, department = '') {
    setImmediate(async () => {
        try {
            const result = await geocodeCity(city, department);
            if (result) {
                await query(
                    `UPDATE customer_orders
           SET geocoding_lat = ?, geocoding_lng = ?, geocoding_city_norm = ?, geocoding_done = 1
           WHERE id = ?`,
                    [result.lat, result.lng, city, orderId]
                );
            } else {
                await query(
                    `UPDATE customer_orders SET geocoding_done = 1 WHERE id = ?`,
                    [orderId]
                );
            }
        } catch (err) {
            logger.error(`[geocoding] Error al guardar geocodificación para orden ${orderId}:`, err.message);
        }
    });
}

export async function backfillGeocodingBatch(limit = 50) {
    const { rows } = await query(
        `SELECT id, shipping_city, shipping_department
     FROM customer_orders
     WHERE geocoding_done = 0 AND status != 'cancelled'
     ORDER BY created_at DESC
     LIMIT ?`,
        [limit]
    );

    if (!rows.length) {
        return { processed: 0, message: 'No hay órdenes pendientes de geocodificación' };
    }

    let processed = 0;
    let failed = 0;

    for (const row of rows) {
        try {
            const result = await geocodeCity(row.shipping_city, row.shipping_department);
            if (result) {
                await query(
                    `UPDATE customer_orders
           SET geocoding_lat = ?, geocoding_lng = ?, geocoding_city_norm = ?, geocoding_done = 1
           WHERE id = ?`,
                    [result.lat, result.lng, row.shipping_city, row.id]
                );
                processed++;
            } else {
                await query(`UPDATE customer_orders SET geocoding_done = 1 WHERE id = ?`, [row.id]);
                failed++;
            }
            await new Promise(r => setTimeout(r, 1100));
        } catch (err) {
            logger.error(`[geocoding backfill] Error orden ${row.id}:`, err.message);
            failed++;
        }
    }

    return { processed, failed, total: rows.length };
}
