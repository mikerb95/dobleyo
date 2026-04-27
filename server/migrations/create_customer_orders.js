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
        await query(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        reference                TEXT UNIQUE NOT NULL,
        status                   TEXT NOT NULL DEFAULT 'pending_payment',
        customer_name            TEXT NOT NULL,
        customer_email           TEXT NOT NULL,
        customer_phone           TEXT,
        shipping_address         TEXT NOT NULL,
        shipping_city            TEXT NOT NULL,
        shipping_department      TEXT,
        shipping_zip             TEXT,
        subtotal_cop             INTEGER NOT NULL,
        shipping_cop             INTEGER NOT NULL DEFAULT 0,
        total_cop                INTEGER NOT NULL,
        payment_method           TEXT,
        payment_transaction_id   TEXT,
        payment_data             TEXT,
        notes                    TEXT,
        user_id                  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('  ✓ Tabla customer_orders creada');

        await query(`
      CREATE TABLE IF NOT EXISTS customer_order_items (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id         INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
        product_id       TEXT NOT NULL,
        product_name     TEXT NOT NULL,
        product_image    TEXT,
        unit_price_cop   INTEGER NOT NULL,
        quantity         INTEGER NOT NULL CHECK (quantity > 0),
        subtotal_cop     INTEGER NOT NULL
      )
    `);
        console.log('  ✓ Tabla customer_order_items creada');

        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_reference     ON customer_orders(reference)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_status        ON customer_orders(status)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_email         ON customer_orders(customer_email)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_orders_created       ON customer_orders(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_customer_order_items_order_id ON customer_order_items(order_id)`,
        ];
        for (const sql of indexes) await query(sql);
        console.log('  ✓ Índices creados');

        // Trigger updated_at (SQLite syntax)
        await query(`
      CREATE TRIGGER IF NOT EXISTS customer_orders_updated_at
        AFTER UPDATE ON customer_orders
        FOR EACH ROW
        BEGIN
          UPDATE customer_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    `);
        console.log('  ✓ Trigger updated_at configurado');

        console.log('✅ Migración de órdenes completada');
        return { success: true };
    } catch (err) {
        console.error('❌ Error en migración de órdenes:', err.message);
        throw err;
    }
}

if (process.argv[1].endsWith('create_customer_orders.js')) {
    import('dotenv/config').then(() =>
        createCustomerOrdersTables().then(() => process.exit(0)).catch(() => process.exit(1))
    );
}
