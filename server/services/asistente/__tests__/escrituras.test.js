// Escrituras del asistente contra una base real (US$0, sin modelo).
//
// Para cada una: `preparar` arma la tarjeta SIN tocar la base, y `ejecutar`
// hace exactamente el cambio, una sola vez. Producción se prueba en cadena:
// verde a bodega, envío a tostión, recepción y almacenamiento del tostado.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ADMIN, sembrar, migrarBaseTemporal } from './escenario.js';

const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-escrituras-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.JWT_SECRET ??= 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET ??= 'secreto-de-prueba-2';

const correos = vi.hoisted(() => ({ estado: [], despacho: [] }));
vi.mock('../../email.js', async (original) => ({
  ...(await original()),
  sendOrderStatusEmail: vi.fn(async (...a) => { correos.estado.push(a); return true; }),
  sendShippingNotificationEmail: vi.fn(async (...a) => { correos.despacho.push(a); return true; }),
}));
// MercadoLibre no se toca en pruebas: solo se registra que se pidió sincronizar.
const ml = vi.hoisted(() => ({ sync: [] }));
vi.mock('../../mlStock.js', async (original) => ({
  ...(await original()),
  scheduleStockSync: vi.fn((ids) => { ml.sync.push(ids); }),
}));

let query;
let E;

async function volcado() {
  const { rows } = await query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out = {};
  for (const { name } of rows) out[name] = JSON.stringify((await query(`SELECT * FROM "${name}"`)).rows);
  return out;
}

/** preparar no escribe; devuelve la propuesta. */
async function prepararSinEscribir(nombre, entrada) {
  const esc = E.find((x) => x.nombre === nombre);
  const antes = await volcado();
  const p = await esc.preparar(esc.esquema.parse(entrada), ADMIN);
  expect(await volcado()).toEqual(antes);
  return p;
}

const ejecutar = (nombre, entrada, extra = {}) => {
  const esc = E.find((x) => x.nombre === nombre);
  return esc.ejecutar(esc.esquema.parse(entrada), { ...ADMIN, claveIdempotencia: `toolu_${nombre}`, ...extra });
};

beforeAll(async () => {
  migrarBaseTemporal(dbFile);
  ({ query } = await import('../../../db.js'));
  await sembrar(query);
  await query(`INSERT INTO products (id, name, category, price, stock_quantity, stock_reserved, is_active)
               VALUES ('molinillo', 'Molinillo manual', 'accesorio', 120000, 4, 0, 1)`);
  await query(`INSERT INTO ml_listings (product_id, ml_item_id, is_active) VALUES ('molinillo', 'MCO123', 1)`);
  ({ ESCRITURAS: E } = await import('../escrituras/index.js'));
}, 120_000);

describe('pedidos', () => {
  it('cambiar_estado_pedido: no permite saltos ni retrocesos', async () => {
    const p = await prepararSinEscribir('cambiar_estado_pedido', { referencia: 'DY-1001', estado: 'delivered' });
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/En preparación/);
  });

  it('registrar_guia_manual: tarjeta con casilla, despacha y avisa solo si la casilla queda marcada', async () => {
    const p = await prepararSinEscribir('registrar_guia_manual', { referencia: 'DY-1001', transportadora: 'Servientrega', guia: 'SV-778899' });
    expect(p.ok).toBe(true);
    expect(p.vista.opciones).toEqual([{ id: 'avisar_cliente', etiqueta: expect.any(String), valor: true }]);
    expect(p.vista.avisos.join(' ')).toMatch(/correo/);

    const r = await ejecutar('registrar_guia_manual', { referencia: 'DY-1001', transportadora: 'Servientrega', guia: 'SV-778899' }, { opciones: { avisar_cliente: false } });
    expect(r.ok).toBe(true);
    expect(r.datos.correo_enviado).toBe(false);
    expect(correos.despacho).toHaveLength(0);
    const { rows } = await query("SELECT o.status, s.guide_number FROM customer_orders o JOIN shipments s ON s.order_id = o.id WHERE o.reference = 'DY-1001'");
    expect(rows).toEqual([expect.objectContaining({ status: 'shipped', guide_number: 'SV-778899' })]);

    const otra = await ejecutar('registrar_guia_manual', { referencia: 'DY-1001', transportadora: 'Servientrega', guia: 'SV-778899' });
    expect(otra.ok).toBe(false);
  });

  it('cambiar_estado_pedido: de enviado a entregado con correo', async () => {
    const r = await ejecutar('cambiar_estado_pedido', { referencia: 'DY-1001', estado: 'delivered' }, { opciones: {} });
    expect(r.ok).toBe(true);
    expect(r.datos.correo_enviado).toBe(true);
    expect(correos.estado).toHaveLength(1);
  });
});

describe('catálogo', () => {
  it('ajustar_stock de variante: exige la variante, deja movimiento y avisa a MercadoLibre', async () => {
    const sinVariante = await prepararSinEscribir('ajustar_stock', { producto_id: 'cafe-huila-500', cantidad: 10, motivo: 'Conteo' });
    expect(sinVariante.ok).toBe(false);
    const { rows: [v] } = await query("SELECT id FROM product_variants WHERE product_id = 'cafe-huila-500'");
    const p = await prepararSinEscribir('ajustar_stock', { producto_id: 'cafe-huila-500', variante_id: Number(v.id), cantidad: 10, motivo: 'Conteo físico' });
    expect(p.vista.cambios[0]).toEqual({ campo: 'Unidades', antes: '3', despues: '10' });

    const r = await ejecutar('ajustar_stock', { producto_id: 'cafe-huila-500', variante_id: Number(v.id), cantidad: 10, motivo: 'Conteo físico' });
    expect(r.ok).toBe(true);
    const mov = await query("SELECT quantity, quantity_before, quantity_after, reason FROM inventory_movements WHERE product_id = 'cafe-huila-500'");
    expect(mov.rows).toEqual([expect.objectContaining({ quantity: 7, quantity_before: 3, quantity_after: 10, reason: 'Conteo físico (asistente)' })]);
    expect(ml.sync.at(-1)).toEqual(['cafe-huila-500']);
  });

  it('ajustar_stock sin variantes: la tarjeta avisa que cambia MercadoLibre', async () => {
    const p = await prepararSinEscribir('ajustar_stock', { producto_id: 'molinillo', cantidad: 6, motivo: 'Llegó pedido del proveedor' });
    expect(p.vista.avisos.join(' ')).toMatch(/MercadoLibre/);
    const r = await ejecutar('ajustar_stock', { producto_id: 'molinillo', cantidad: 6, motivo: 'Llegó pedido del proveedor' });
    expect(r.ok).toBe(true);
    expect((await query("SELECT stock_quantity FROM products WHERE id = 'molinillo'")).rows[0].stock_quantity).toBe(6);
  });

  it('editar_producto: precio de variante y descripción, con aviso de cambio grande', async () => {
    const { rows: [v] } = await query("SELECT id FROM product_variants WHERE product_id = 'cafe-huila-500'");
    const sinVar = await prepararSinEscribir('editar_producto', { producto_id: 'cafe-huila-500', precio: 45000 });
    expect(sinVar.ok).toBe(false);
    const p = await prepararSinEscribir('editar_producto', { producto_id: 'cafe-huila-500', variante_id: Number(v.id), precio: 90000 });
    expect(p.vista.cambios[0]).toMatchObject({ antes: '$42.000', despues: '$90.000' });
    expect(p.vista.avisos.join(' ')).toMatch(/más de la mitad/);

    const r = await ejecutar('editar_producto', { producto_id: 'cafe-huila-500', variante_id: Number(v.id), precio: 45000 });
    expect(r.ok).toBe(true);
    expect((await query('SELECT price_cop FROM product_variants WHERE id = ?', [v.id])).rows[0].price_cop).toBe(45000);

    const d = await ejecutar('editar_producto', { producto_id: 'molinillo', descripcion: 'Molinillo de muelas cerámicas, ajuste de molienda.' });
    expect(d.ok).toBe(true);
  });
});

describe('CRM', () => {
  it('registrar_interaccion_crm y mover_etapa_crm', async () => {
    const p = await prepararSinEscribir('registrar_interaccion_crm', { cuenta_id: 1, tipo: 'call', asunto: 'Seguimiento de muestra' });
    expect(p.ok).toBe(true);
    expect((await ejecutar('registrar_interaccion_crm', { cuenta_id: 1, tipo: 'call', asunto: 'Seguimiento de muestra' })).ok).toBe(true);

    const misma = await prepararSinEscribir('mover_etapa_crm', { cuenta_id: 1, etapa: 'negotiation' });
    expect(misma.ok).toBe(false);
    const r = await ejecutar('mover_etapa_crm', { cuenta_id: 1, etapa: 'active', motivo: 'Firmó el primer pedido' });
    expect(r.ok).toBe(true);
    expect((await query('SELECT pipeline_stage FROM crm_accounts WHERE id = 1')).rows[0].pipeline_stage).toBe('active');
  });
});

describe('producción en cadena', () => {
  const LOTE = 'COL-CAU-1800-Castillo-Natural-BBBB';

  it('almacenar_cafe_verde valida la ubicación y registra el ingreso', async () => {
    const mala = await prepararSinEscribir('almacenar_cafe_verde', { lote: LOTE, kilos: 280, ubicacion: 'ROASTED-A-01' });
    expect(mala.ok).toBe(false);
    expect(mala.error).toMatch(/GREEN-A-01/);
    const r = await ejecutar('almacenar_cafe_verde', { lote: LOTE, kilos: 280, ubicacion: 'GREEN-A-01', fecha: '2026-11-10' });
    expect(r.ok).toBe(true);
  });

  it('enviar_a_tostion no deja enviar más de lo que hay', async () => {
    const mucho = await prepararSinEscribir('enviar_a_tostion', { lote: LOTE, kilos: 500 });
    expect(mucho.ok).toBe(false);
    const r = await ejecutar('enviar_a_tostion', { lote: LOTE, kilos: 100 });
    expect(r.ok).toBe(true);
    expect(r.datos.id_tostion).toBeGreaterThan(0);
  });

  it('recibir_tostado y almacenar_tostado', async () => {
    const { rows: [t] } = await query('SELECT id FROM roasting_batches WHERE lot_id = ?', [LOTE]);
    const absurdo = await prepararSinEscribir('recibir_tostado', { id_tostion: Number(t.id), nivel_tueste: 'MEDIUM', kilos_tostados: 120 });
    expect(absurdo.ok).toBe(false);
    const r = await ejecutar('recibir_tostado', { id_tostion: Number(t.id), nivel_tueste: 'MEDIUM', kilos_tostados: 84 });
    expect(r.ok).toBe(true);
    const a = await ejecutar('almacenar_tostado', { id_tostado: r.datos.id_tostado, ubicacion: 'ROASTED-A-01', recipiente: 'BAG-5KG', cantidad_recipientes: 17 });
    expect(a.ok).toBe(true);
    const dos = await prepararSinEscribir('almacenar_tostado', { id_tostado: r.datos.id_tostado, ubicacion: 'ROASTED-A-01', recipiente: 'BAG-5KG', cantidad_recipientes: 17 });
    expect(dos.ok).toBe(false);
  });
});
