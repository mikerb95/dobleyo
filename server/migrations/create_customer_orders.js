import { query } from '../db.js';

/**
 * Migración: Tablas de órdenes de e-commerce (Fase 4)
 * - customer_orders: pedidos del storefront (estado, cliente, pago)
 * - customer_order_items: líneas de cada pedido
 * - Índices de búsqueda por referencia, estado, email
 */

export async function createCustomerOrdersTables() {
    console.log('🛒 Iniciando migración de órdenes de e-commerce...');

    try {
        // Tabla principal de órdenes
        await query(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        reference                TEXT UNIQUE NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'pending_payment',
        -- Estados: pending_payment, paid, processing, shipped, delivered, cancelled, refunded
        customer_name            TEXT NOT NULL,
        customer_email           TEXT NOT NULL,
        customer_phone           TEXT,
        shipping_address         TEXT NOT NULL,
        shipping_city            TEXT NOT NULL,
        shipping_department      TEXT,
        shipping_zip             TEXT,
        subtotal_cop             BIGINT NOT NULL,
        shipping_cop             BIGINT NOT NULL DEFAULT 0,
        total_cop                BIGINT NOT NULL,
        payment_method           TEXT,   -- wompi | mercadopago | cod
        payment_transaction_id   TEXT,
        payment_data             JSONB,
        notes                    TEXT,
        user_id                  BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at               TIMESTAMPTZ DEFAULT NOW(),
        updated_at               TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('  ✓ Tabla customer_orders creada');

        // Tabla de ítems de la orden
        await query(`
      CREATE TABLE IF NOT EXISTS customer_order_items (
        id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        order_id         BIGINT NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
        product_id       TEXT NOT NULL,
        product_name     TEXT NOT NULL,
        product_image    TEXT,
        unit_price_cop   BIGINT NOT NULL,
        quantity         INT NOT NULL CHECK (quantity > 0),
        subtotal_cop     BIGINT GENERATED ALWAYS AS (unit_price_cop * quantity) STORED
      )
    `);
        console.log('  ✓ Tabla customer_order_items creada');

        // Índices para búsquedas frecuentes
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_reference      ON customer_orders(reference)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_status         ON customer_orders(status)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_email          ON customer_orders(customer_email)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_created        ON customer_orders(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_order_items_order_id  ON customer_order_items(order_id)`,
        ];

        for (const sql of indexes) {
            await query(sql);
        }
        console.log('  ✓ Índices creados');

        // Trigger para actualizar updated_at automáticamente
        await query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language plpgsql
    `);

        await query(`
      DROP TRIGGER IF EXISTS customer_orders_updated_at ON customer_orders;
      CREATE TRIGGER customer_orders_updated_at
        BEFORE UPDATE ON customer_orders
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
        console.log('  ✓ Trigger updated_at configurado');

        console.log('✅ Migración de órdenes completada');
        return { success: true };
    } catch (err) {
        console.error('❌ Error en migración de órdenes:', err.message);
        throw err;
    }
}
