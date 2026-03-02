// Migración: Agregar columnas de geocodificación a customer_orders — Fase 8
import { query } from '../db.js';

/**
 * Agrega lat/lng y ciudad normalizada a customer_orders para el mapa de calor.
 * Las coordenadas se rellenan de forma asíncrona por el servicio de geocodificación.
 */
export async function addGeocodingToOrders() {
  console.log('🗺️  Iniciando migración de geocodificación en órdenes...');

  try {
    await query(`
      ALTER TABLE customer_orders
        ADD COLUMN IF NOT EXISTS geocoding_lat       DECIMAL(10,7),
        ADD COLUMN IF NOT EXISTS geocoding_lng       DECIMAL(10,7),
        ADD COLUMN IF NOT EXISTS geocoding_city_norm TEXT,
        ADD COLUMN IF NOT EXISTS geocoding_done      BOOLEAN DEFAULT FALSE
    `);
    console.log('  ✓ Columnas de geocodificación agregadas a customer_orders');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_customer_orders_geocoded
        ON customer_orders(geocoding_done)
        WHERE geocoding_done = FALSE AND status != 'cancelled'
    `);
    console.log('  ✓ Índice parcial para pendientes de geocodificación creado');

    console.log('✅ Migración geocodificación completada.');
  } catch (err) {
    console.error('❌ Error en migración de geocodificación:', err);
    throw err;
  }
}

// Ejecutar si se llama directamente
if (process.argv[1].endsWith('add_geocoding_to_orders.js')) {
  addGeocodingToOrders()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
