// Servicio de geocodificación usando Nominatim (OpenStreetMap) — Fase 8
// Convierte ciudad/departamento colombiano en coordenadas lat/lng
import { query } from '../db.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT   = 'DobleYoCafe/1.0 (contacto@dobleyo.cafe)'; // Requerido por Nominatim ToS

/**
 * Geocodifica una ciudad colombiana con Nominatim.
 * Retorna { lat, lng, displayName } o null si no se encuentra.
 * @param {string} city
 * @param {string} [department]
 * @returns {Promise<{lat: number, lng: number, displayName: string}|null>}
 */
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
    // No propagar errores de red — geocodificación es opcional
    console.warn(`[geocoding] No se pudo geocodificar "${city}":`, err.message);
    return null;
  }
}

/**
 * Geocodifica una orden de customer_orders y guarda el resultado en BD.
 * Llamada asíncrona, nunca bloquea el flujo de la orden.
 * @param {number} orderId
 * @param {string} city
 * @param {string} [department]
 */
export async function geocodeOrderAsync(orderId, city, department = '') {
  // Ejecutar sin await en el caller para no bloquear respuesta HTTP
  setImmediate(async () => {
    try {
      const result = await geocodeCity(city, department);
      if (result) {
        await query(
          `UPDATE customer_orders
           SET geocoding_lat = $1, geocoding_lng = $2, geocoding_city_norm = $3, geocoding_done = TRUE
           WHERE id = $4`,
          [result.lat, result.lng, city, orderId]
        );
      } else {
        // Marcar como procesado aunque haya fallado, para no reintentar indefinidamente
        await query(
          `UPDATE customer_orders SET geocoding_done = TRUE WHERE id = $1`,
          [orderId]
        );
      }
    } catch (err) {
      console.error(`[geocoding] Error al guardar geocodificación para orden ${orderId}:`, err.message);
    }
  });
}

/**
 * Geocodifica en lote las órdenes pendientes (para backfill de datos existentes).
 * Respeta el rate limit de Nominatim: máx 1 req/s.
 * @param {number} [limit=50] — Máximo de órdenes a procesar en este lote
 */
export async function backfillGeocodingBatch(limit = 50) {
  const { rows } = await query(
    `SELECT id, shipping_city, shipping_department
     FROM customer_orders
     WHERE geocoding_done = FALSE AND status != 'cancelled'
     ORDER BY created_at DESC
     LIMIT $1`,
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
           SET geocoding_lat = $1, geocoding_lng = $2, geocoding_city_norm = $3, geocoding_done = TRUE
           WHERE id = $4`,
          [result.lat, result.lng, row.shipping_city, row.id]
        );
        processed++;
      } else {
        await query(`UPDATE customer_orders SET geocoding_done = TRUE WHERE id = $1`, [row.id]);
        failed++;
      }
      // Respetar rate limit de Nominatim: 1 req/seg
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      console.error(`[geocoding backfill] Error orden ${row.id}:`, err.message);
      failed++;
    }
  }

  return { processed, failed, total: rows.length };
}
