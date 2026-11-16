// Escenario compartido por las pruebas del asistente: base temporal con todas
// las migraciones y un puñado de datos, con datos sensibles por todos lados
// para que la prueba de privacidad tenga qué atrapar.

import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Corre todas las migraciones sobre un SQLite temporal (nunca sobre Turso). */
export function migrarBaseTemporal(dbFile) {
  execFileSync(process.execPath, [join(raiz, 'server/migrations/run_all_migrations.js')], {
    env: { ...process.env, TURSO_DATABASE_URL: `file:${dbFile}`, TURSO_AUTH_TOKEN: '' },
    stdio: 'ignore',
  });
}

export const ADMIN = { usuario: { id: 1, nombre: 'Admin', rol: 'admin' } };
export const CAFICULTOR = { usuario: { id: 2, nombre: 'Rosa', rol: 'caficultor' } };

/** Siembra un escenario pequeño con datos sensibles por todos lados. */
export async function sembrar(q) {
  await q(`INSERT INTO users (id, email, password_hash, first_name, last_name, name, role, is_verified)
           VALUES (1, 'admin@dobleyo.cafe', 'x', 'Admin', 'DY', 'Admin DY', 'admin', 1),
                  (2, 'rosa@finca.co', 'x', 'Rosa', 'Rengifo', 'Rosa Rengifo', 'caficultor', 1),
                  (3, 'otro@finca.co', 'x', 'Otro', 'Caficultor', 'Otro Caficultor', 'caficultor', 1)`);
  await q(`INSERT INTO farms (caficultor_id, name, slug, region, municipality, altitude_min)
           VALUES (2, 'Finca Rosa', 'finca-rosa', 'Huila', 'Pitalito', 1700),
                  (3, 'Finca Ajena', 'finca-ajena', 'Cauca', 'Popayán', 1800)`);
  await q(`INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, region, altitude, harvest_weight_kg)
           VALUES ('COL-HUI-1700-Caturra-Lavado-AAAA', 'finca-rosa', 'Caturra', 'Templado', 'Lavado', '', '', 'HUI', 1700, 500),
                  ('COL-CAU-1800-Castillo-Natural-BBBB', 'finca-ajena', 'Castillo', 'Frío', 'Natural', '', '', 'CAU', 1800, 300)`);
  await q(`INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date)
           VALUES (1, 'COL-HUI-1700-Caturra-Lavado-AAAA', 420, 'B1', '2026-11-01')`);
  await q(`INSERT INTO products (id, name, category, price, stock_quantity, stock_reserved, is_active, description)
           VALUES ('cafe-huila-500', 'Café Huila 500 g', 'cafe', 42000, 3, 0, 1, 'Escríbanos a ana.perez@correo.co')`);
  await q(`INSERT INTO product_variants (product_id, size_label, grind_label, price_cop, stock_quantity, is_active)
           VALUES ('cafe-huila-500', '500 g', 'Grano', 42000, 3, 1)`);
  await q(`INSERT INTO customer_orders
             (reference, status, customer_name, customer_email, customer_phone, shipping_address, shipping_city,
              shipping_department, subtotal_cop, shipping_cop, total_cop, payment_method, notes,
              customer_document_type, customer_document_number)
           VALUES ('DY-1001', 'paid', 'Ana Pérez', 'ana.perez@correo.co', '3105551234', 'Calle 12 # 34-56', 'Bogotá',
                   'Cundinamarca', 84000, 12000, 96000, 'epayco',
                   'Llamar al 310 555 1234 antes. Mi cédula 1020304050. Dejar en Carrera 7 No. 45-10',
                   'CC', '1020304050')`);
  await q(`INSERT INTO customer_orders (reference, status, customer_name, customer_email, shipping_address, shipping_city, subtotal_cop, shipping_cop, total_cop, payment_method)
           VALUES ('DY-1002', 'paid', 'Luis Gómez', 'luis@correo.co', 'Carrera 7 No. 45-10', 'Cali', 42000, 10000, 52000, 'epayco')`);
  await q(`INSERT INTO customer_order_items (order_id, product_id, product_name, unit_price_cop, quantity, subtotal_cop)
           VALUES (1, 'cafe-huila-500', 'Café Huila 500 g', 42000, 2, 84000)`);
  await q(`INSERT INTO crm_accounts (legal_name, display_name, segment, country, city, tax_id, pipeline_stage, pipeline_value, notes)
           VALUES ('Tostadores del Norte S.A.S.', 'Tostadores del Norte', 'distributor_co', 'CO', 'Medellín', '900123456-7',
                   'negotiation', 5000000, 'Contacto: ana.perez@correo.co, NIT 900123456')`);
  await q(`INSERT INTO crm_contacts (account_id, full_name, email, phone) VALUES (1, 'Ana Pérez', 'ana.perez@correo.co', '3105551234')`);
  await q(`INSERT INTO crm_interactions (account_id, kind, subject, body)
           VALUES (1, 'call', 'Llamada', 'Pidió que la llamen al 3105551234 o escriban a ana.perez@correo.co')`);
  await q(`INSERT INTO subscriptions
             (reference, user_id, product_id, product_name, variant_size, quantity, frequency_days, unit_price_cop,
              amount_cop, customer_name, customer_email, customer_phone, shipping_address, shipping_city, status,
              next_billing_date, epayco_token_card, customer_document_number)
           VALUES ('SUB-1', NULL, 'cafe-huila-500', 'Café Huila', '500 g', 1, 30, 42000, 42000, 'Ana Pérez',
                   'ana.perez@correo.co', '3105551234', 'Calle 12 # 34-56', 'Bogotá', 'active', '2026-11-20',
                   'tarjeta_tok_999', '1020304050')`);
  await q(`INSERT INTO ml_oauth (id, ml_user_id, access_token_enc, refresh_token_enc, expires_at)
           VALUES (1, '123', 'tok_secreto_ml_123', 'tok_secreto_ml_123', '2030-01-01')`);
}
