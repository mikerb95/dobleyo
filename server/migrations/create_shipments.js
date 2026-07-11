import { query } from '../db.js';

/**
 * Migración: Logística de envíos (Mipaquete.com)
 * - shipments: guía generada por orden (transportadora, tracking, recaudo COD)
 * - shipment_events: histórico de estados (webhook + polling)
 * - dane_locations: cache de códigos DANE resueltos desde ciudad/departamento
 *
 * customer_orders NO se altera: contraentrega reutiliza payment_method='cod'
 * + status='processing' (evita tocar los enums existentes en orders.js).
 */

export async function createShipmentsTables() {
    console.log('🚚 Iniciando migración de envíos (Mipaquete)...');

    try {
        await query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id                  INTEGER NOT NULL REFERENCES customer_orders(id),
        mp_code                   TEXT,
        guide_number              TEXT,
        pickup_code               TEXT,
        delivery_company_id       TEXT,
        delivery_company_name     TEXT,
        quoted_shipping_cost_cop  INTEGER,
        actual_shipping_cost_cop  INTEGER,
        collection_value_cop      INTEGER NOT NULL DEFAULT 0,
        commission_cop            INTEGER,
        payment_mode              TEXT NOT NULL DEFAULT 'prepaid' CHECK (payment_mode IN ('prepaid','cod')),
        status                    TEXT NOT NULL DEFAULT 'created' CHECK (status IN
                                    ('created','pickup_requested','in_transit','delivered','returned','cancelled','error')),
        cod_reconciled            INTEGER NOT NULL DEFAULT 0,
        cod_reconciled_at         TEXT,
        pdf_guide_urls            TEXT,
        tracking_snapshot         TEXT,
        tracking_updated_at       TEXT,
        guide_notified_at         TEXT,
        requested_pickup          INTEGER NOT NULL DEFAULT 1,
        declared_value_cop        INTEGER,
        package_weight_kg         REAL,
        package_width_cm          INTEGER,
        package_length_cm         INTEGER,
        package_height_cm         INTEGER,
        destiny_dane_code         TEXT,
        error_detail              TEXT,
        created_by                INTEGER REFERENCES users(id),
        created_at                TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
        console.log('  ✓ Tabla shipments creada');

        await query(`
      CREATE TABLE IF NOT EXISTS shipment_events (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_id    INTEGER NOT NULL REFERENCES shipments(id),
        source         TEXT NOT NULL CHECK (source IN ('webhook','poll','manual','system')),
        update_state   TEXT,
        description    TEXT,
        raw_payload    TEXT,
        event_date     TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
        console.log('  ✓ Tabla shipment_events creada');

        await query(`
      CREATE TABLE IF NOT EXISTS dane_locations (
        location_code    TEXT PRIMARY KEY,
        location_name    TEXT NOT NULL,
        department_name  TEXT NOT NULL,
        normalized_key   TEXT NOT NULL,
        raw_json         TEXT,
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
        console.log('  ✓ Tabla dane_locations creada');

        const indexes = [
            // Idempotencia: una guía activa por orden (permite reintentar tras cancelled/error)
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_active_order ON shipments(order_id) WHERE status NOT IN ('cancelled','error')`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_mp_code ON shipments(mp_code) WHERE mp_code IS NOT NULL`,
            `CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status)`,
            `CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON shipment_events(shipment_id)`,
            `CREATE INDEX IF NOT EXISTS idx_dane_normalized ON dane_locations(normalized_key)`,
        ];
        for (const sql of indexes) await query(sql);
        console.log('  ✓ Índices creados');

        await query(`
      CREATE TRIGGER IF NOT EXISTS shipments_updated_at
        AFTER UPDATE ON shipments
        FOR EACH ROW
        BEGIN
          UPDATE shipments SET updated_at = datetime('now') WHERE id = NEW.id;
        END
    `);
        console.log('  ✓ Trigger updated_at configurado');

        console.log('✅ Migración de envíos completada');
        return { success: true };
    } catch (err) {
        console.error('❌ Error en migración de envíos:', err.message);
        throw err;
    }
}

if (process.argv[1].endsWith('create_shipments.js')) {
    import('dotenv/config').then(() =>
        createShipmentsTables().then(() => process.exit(0)).catch(() => process.exit(1))
    );
}
