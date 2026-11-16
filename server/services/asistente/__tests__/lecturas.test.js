// Herramientas de lectura contra una base real (todas las migraciones sobre un
// SQLite temporal). Cuesta US$0: no llama a ningún modelo.
//
//  - Lectura no escribe: volcado de la base antes y después de ejecutar cada
//    herramienta con cada rol, idéntico.
//  - Privacidad: se siembran correo, celular, cédula, NIT, dirección y un
//    secreto, y ninguno sale de ninguna herramienta.
//  - Caficultor: solo ve sus fincas y lotes.

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ADMIN, CAFICULTOR, sembrar, migrarBaseTemporal } from './escenario.js';

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

let query;
let HERRAMIENTAS;

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
  migrarBaseTemporal(dbFile);
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
