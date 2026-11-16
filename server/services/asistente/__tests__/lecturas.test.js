// Herramientas de lectura contra una base real (todas las migraciones sobre un
// SQLite temporal). Cuesta US$0: no llama a ningún modelo.
//
//  - Lectura no escribe: volcado de la base antes y después de ejecutar cada
//    herramienta con cada rol, idéntico.
//  - Privacidad: se siembran correo, celular, cédula, NIT, dirección y un
//    secreto, y ninguno sale de ninguna herramienta.
//  - Caficultor: solo ve sus fincas y lotes.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-asistente-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

const SENSIBLES = [
  'ana.perez@correo.co',
  '3105551234',
  '310 555 1234',
  '1020304050',
  '900123456',
  'Calle 12 # 34-56',
  'Carrera 7 No. 45-10',
  'tok_secreto_ml_123',
  'tarjeta_tok_999',
];

export const ADMIN = { usuario: { id: 1, nombre: 'Admin', rol: 'admin' } };
export const CAFICULTOR = { usuario: { id: 2, nombre: 'Rosa', rol: 'caficultor' } };

let query;
let HERRAMIENTAS;

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

/** Volcado completo de la base: tabla por tabla, filas ordenadas. */
async function volcado() {
  const { rows: tablas } = await query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out = {};
  for (const { name } of tablas) {
    const { rows } = await query(`SELECT * FROM "${name}"`);
    out[name] = JSON.stringify(rows.map((r) => Object.values(r))).length + ':' + JSON.stringify(rows.map((r) => Object.values(r)));
  }
  return out;
}

/** Argumentos de prueba para cada herramienta: una corrida vacía y una con filtros. */
const ARGUMENTOS = {
  buscar_en_panel: [{ texto: 'pedidos' }, { texto: 'DY-1001' }, { texto: 'COL' }],
  pendientes_del_dia: [{}],
  consultar_pedidos: [{}, { referencia: 'DY-1001' }, { estado: 'paid', desde: '2020-01-01', hasta: '2030-12-31' }],
  consultar_envios: [{}, { sin_novedad_dias: 3 }],
  consultar_crm: [{}, { cuenta_id: 1 }, { sin_contacto_dias: 10 }],
  consultar_suscripciones: [{}, { con_fallas: true }],
  consultar_produccion: [{}, { lote: 'COL-HUI-1700-Caturra-Lavado-AAAA' }],
  mi_finca: [{}, { lote: 'COL-HUI-1700-Caturra-Lavado-AAAA' }],
  consultar_inventario: [{}],
  consultar_productos: [{}, { buscar: 'Huila' }],
  consultar_ventas: [{}, { desde: '2020-01-01', hasta: '2030-12-31' }],
  consultar_costos: [{}, { lote: 'COL-HUI-1700-Caturra-Lavado-AAAA' }],
  consultar_finanzas: [{}],
};

beforeAll(async () => {
  execFileSync(process.execPath, [join(raiz, 'server/migrations/run_all_migrations.js')], {
    env: { ...process.env, TURSO_DATABASE_URL: `file:${dbFile}`, TURSO_AUTH_TOKEN: '' },
    stdio: 'ignore',
  });
  ({ query } = await import('../../../db.js'));
  await sembrar(query);
  ({ HERRAMIENTAS } = await import('../herramientas/index.js'));
}, 120_000);

describe('herramientas de lectura', () => {
  it('cada herramienta tiene argumentos de prueba', () => {
    expect(HERRAMIENTAS.map((h) => h.nombre).sort()).toEqual(Object.keys(ARGUMENTOS).sort());
  });

  it('ninguna escribe en la base, con ningún rol', async () => {
    const antes = await volcado();
    for (const h of HERRAMIENTAS) {
      for (const ctx of [ADMIN, CAFICULTOR]) {
        if (!h.roles.includes(ctx.usuario.rol)) continue;
        for (const args of ARGUMENTOS[h.nombre]) {
          const r = await h.ejecutar(h.esquema.parse(args), ctx);
          expect(r.ok, `${h.nombre} ${JSON.stringify(args)}: ${r.error}`).toBe(true);
        }
      }
    }
    expect(await volcado()).toEqual(antes);
  });

  it('ningún dato personal ni secreto sale de ninguna herramienta', async () => {
    for (const h of HERRAMIENTAS) {
      for (const ctx of [ADMIN, CAFICULTOR]) {
        if (!h.roles.includes(ctx.usuario.rol)) continue;
        for (const args of ARGUMENTOS[h.nombre]) {
          const salida = JSON.stringify(await h.ejecutar(h.esquema.parse(args), ctx));
          for (const s of SENSIBLES) expect(salida, `${h.nombre} dejó salir ${s}`).not.toContain(s);
        }
      }
    }
  });

  it('el texto de clientes viaja dentro de escritoPorTerceros', async () => {
    const h = HERRAMIENTAS.find((x) => x.nombre === 'consultar_pedidos');
    const r = await h.ejecutar({ referencia: 'DY-1001' }, ADMIN);
    expect(r.datos.pedidos[0].escritoPorTerceros.nota_del_pedido).toMatch(/\[teléfono oculto\]/);
    expect(r.datos.total).toEqual({ valor: 96000, moneda: 'COP', texto: '$96.000' });
  });

  it('el caficultor solo ve sus fincas y lotes', async () => {
    const h = HERRAMIENTAS.find((x) => x.nombre === 'mi_finca');
    const r = await h.ejecutar({}, CAFICULTOR);
    expect(r.datos.fincas.map((f) => f.nombre)).toEqual(['Finca Rosa']);
    expect(r.datos.lotes.map((l) => l.lote)).toEqual(['COL-HUI-1700-Caturra-Lavado-AAAA']);
    expect(JSON.stringify(r)).not.toContain('Ajena');
    expect(JSON.stringify(r)).not.toContain('500');

    const ajeno = await h.ejecutar({ lote: 'COL-CAU-1800-Castillo-Natural-BBBB' }, CAFICULTOR);
    expect(ajeno.ok).toBe(false);

    const buscar = HERRAMIENTAS.find((x) => x.nombre === 'buscar_en_panel');
    const b = await buscar.ejecutar({ texto: 'COL' }, CAFICULTOR);
    expect(JSON.stringify(b)).not.toContain('BBBB');
    expect(JSON.stringify(b)).not.toContain('/admin/pedidos');
  });
});
