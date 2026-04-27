// Migración: Agregar columnas de geocodificación a customer_orders — Fase 8
import { query } from '../db.js';

export async function addGeocodingToOrders() {
    console.log('🗺️  Iniciando migración de geocodificación en órdenes...');

    try {
        // SQLite no soporta múltiples ADD COLUMN en un solo ALTER TABLE
        const cols = [
            { name: 'geocoding_lat',       def: 'REAL' },
            { name: 'geocoding_lng',       def: 'REAL' },
            { name: 'geocoding_city_norm', def: 'TEXT' },
            { name: 'geocoding_done',      def: 'INTEGER NOT NULL DEFAULT 0' },
        ];
        for (const col of cols) {
            try {
                await query(`ALTER TABLE customer_orders ADD COLUMN ${col.name} ${col.def}`);
            } catch {
                // columna ya existe — ignorar
            }
        }
        console.log('  ✓ Columnas de geocodificación agregadas a customer_orders');

        await query(`
      CREATE INDEX IF NOT EXISTS idx_customer_orders_geocoded
        ON customer_orders(geocoding_done)
    `);
        console.log('  ✓ Índice geocoding creado');

        console.log('✅ Migración geocodificación completada.');
    } catch (err) {
        console.error('❌ Error en migración de geocodificación:', err);
        throw err;
    }
}

if (process.argv[1].endsWith('add_geocoding_to_orders.js')) {
    import('dotenv/config').then(() =>
        addGeocodingToOrders().then(() => process.exit(0)).catch(() => process.exit(1))
    );
}
