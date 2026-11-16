// API del asistente de punta a punta con el MODELO SIMULADO (US$0): base real
// con todas las migraciones, SSE real, escrituras reales. Se mockea solo la
// autenticación (el JWT ya se prueba en auth.test.js).

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sembrar, migrarBaseTemporal } from '../../services/asistente/__tests__/escenario.js';

const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-asistente-api-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.ASISTENTE_MODELO_FALSO = '1';
process.env.RESEND_API_KEY = '';

const sesion = { user: { id: 1, role: 'admin' } };

vi.mock('../../auth.js', () => ({
  authenticateToken: (req, _res, next) => { req.user = sesion.user; next(); },
  requireRole: (roles) => (req, res, next) => {
    const permitidos = Array.isArray(roles) ? roles : [roles];
    if (permitidos.includes(req.user?.role)) return next();
    res.status(403).json({ error: 'Permisos insuficientes' });
  },
}));

// El correo no sale en pruebas.
vi.mock('../../services/email.js', async (original) => ({
  ...(await original()),
  sendOrderStatusEmail: vi.fn(async () => true),
  sendShippingNotificationEmail: vi.fn(async () => true),
}));

let app;
let query;

/** Lee un cuerpo SSE como lista de eventos. */
const eventos = (texto) =>
  texto
    .split('\n\n')
    .map((b) => b.trim())
    .filter((b) => b.startsWith('data: '))
    .map((b) => JSON.parse(b.slice(6)));

const como = (id, role) => { sesion.user = { id, role }; };
const estadoPedido = async (ref) => (await query('SELECT status FROM customer_orders WHERE reference = ?', [ref])).rows[0].status;

beforeAll(async () => {
  migrarBaseTemporal(dbFile);
  ({ query } = await import('../../db.js'));
  await sembrar(query);
  const { asistenteRouter } = await import('../asistente.js');
  app = express();
  app.use(express.json());
  app.use('/api/asistente', asistenteRouter);
}, 120_000);

beforeEach(async () => {
  como(1, 'admin');
  process.env.ASISTENTE_MODELO_FALSO = '1';
  await query('UPDATE asistente_topes SET empresa_usd = 3, usuario_usd = 1 WHERE id = 1');
});

describe('preguntar', () => {
  it('consulta, responde por SSE y registra el consumo por llamada', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: '¿Qué pedidos hay?' });
    expect(res.status).toBe(200);
    const ev = eventos(res.text);
    expect(ev[0].tipo).toBe('conversacion');
    expect(ev.some((e) => e.tipo === 'paso' && e.herramienta === 'consultar_pedidos')).toBe(true);
    expect(ev.find((e) => e.tipo === 'texto' && e.texto.includes('$148.000'))).toBeTruthy();
    expect(ev.at(-1)).toMatchObject({ tipo: 'fin', estado: 'terminada' });

    const { rows } = await query('SELECT COUNT(*) AS n FROM asistente_consumo WHERE conversacion_id = ?', [ev[0].id]);
    expect(Number(rows[0].n)).toBe(2);
  });

  it('sigue una conversación terminada y la reconstruye para retomarla', async () => {
    const r1 = await request(app).post('/api/asistente').send({ pregunta: 'Hola' });
    const id = eventos(r1.text)[0].id;
    const r2 = await request(app).post('/api/asistente').send({ pregunta: '¿Qué pedidos hay?', id });
    expect(eventos(r2.text).at(-1).estado).toBe('terminada');
    const v = await request(app).get(`/api/asistente/conversacion/${id}`);
    expect(v.body.data.turnos.map((t) => t.pregunta)).toEqual(['Hola', '¿Qué pedidos hay?']);
    const rec = await request(app).get('/api/asistente/recientes');
    expect(rec.body.data[0].id).toBe(id);
  });

  it('rechaza una pregunta vacía', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: '  ' });
    expect(res.status).toBe(422);
  });
});

describe('proponer y decidir', () => {
  it('propone sin escribir, aprueba una sola vez y deja auditoría', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: 'Pase el pedido DY-1001 a preparación' });
    const ev = eventos(res.text);
    const id = ev[0].id;
    const tarjeta = ev.find((e) => e.tipo === 'aprobacion');
    expect(tarjeta.vista.cambios).toEqual([{ campo: 'Estado', antes: 'Pagado', despues: 'En preparación' }]);
    expect(ev.some((e) => e.tipo === 'fin')).toBe(false);
    expect(await estadoPedido('DY-1001')).toBe('paid');

    const ok = await request(app).post('/api/asistente/decision').send({ id, aprobado: true });
    const evOk = eventos(ok.text);
    expect(evOk.some((e) => e.tipo === 'decision' && e.aprobado === true)).toBe(true);
    expect(evOk.at(-1).estado).toBe('terminada');
    expect(await estadoPedido('DY-1001')).toBe('processing');

    const otra = await request(app).post('/api/asistente/decision').send({ id, aprobado: true });
    expect(otra.status).toBe(409);

    const { rows } = await query('SELECT decision, ok, herramienta FROM asistente_auditoria WHERE conversacion_id = ?', [id]);
    expect(rows).toEqual([expect.objectContaining({ decision: 'aprobada', ok: 1, herramienta: 'cambiar_estado_pedido' })]);
    const logs = await query("SELECT action FROM audit_logs WHERE entity_type = 'asistente' AND entity_id = ?", [id]);
    expect(logs.rows.map((r) => r.action)).toEqual(['asistente_aprobada']);
  });

  it('descartar no cambia la base', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: 'Pase DY-1002 a preparación' });
    const id = eventos(res.text)[0].id;
    const no = await request(app).post('/api/asistente/decision').send({ id, aprobado: false });
    expect(eventos(no.text).some((e) => e.tipo === 'decision' && e.aprobado === false)).toBe(true);
    expect(await estadoPedido('DY-1002')).toBe('paid');
    const { rows } = await query('SELECT decision FROM asistente_auditoria WHERE conversacion_id = ?', [id]);
    expect(rows.map((r) => r.decision)).toEqual(['rechazada']);
  });

  it('solo `true` explícito aprueba', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: 'Pase DY-1002 a preparación' });
    const id = eventos(res.text)[0].id;
    await request(app).post('/api/asistente/decision').send({ id, aprobado: 'true' });
    expect(await estadoPedido('DY-1002')).toBe('paid');
  });

  it('escribir con la tarjeta abierta pide cambios sin ejecutar', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: 'Pase DY-1002 a preparación' });
    const id = eventos(res.text)[0].id;
    const cambios = await request(app).post('/api/asistente').send({ pregunta: 'mejor espere a mañana', id });
    expect(eventos(cambios.text).some((e) => e.tipo === 'decision' && e.aprobado === false)).toBe(true);
    expect(await estadoPedido('DY-1002')).toBe('paid');
    const v = await request(app).get(`/api/asistente/conversacion/${id}`);
    expect(v.body.data.turnos.at(-1).pregunta).toBe('mejor espere a mañana');
  });
});

describe('roles y privacidad', () => {
  it('el caficultor no recibe escrituras: pide un cambio y no aparece tarjeta', async () => {
    como(2, 'caficultor');
    const res = await request(app).post('/api/asistente').send({ pregunta: 'Pase DY-1002 a preparación' });
    const ev = eventos(res.text);
    expect(ev.some((e) => e.tipo === 'aprobacion')).toBe(false);
    expect(ev.find((e) => e.tipo === 'texto' && /Sin permiso/.test(e.texto))).toBeTruthy();
    expect(await estadoPedido('DY-1002')).toBe('paid');
  });

  it('el caficultor no ve topes ni conversaciones ajenas', async () => {
    const r = await request(app).post('/api/asistente').send({ pregunta: 'Hola' });
    const idAdmin = eventos(r.text)[0].id;
    como(2, 'caficultor');
    expect((await request(app).get('/api/asistente/topes')).status).toBe(403);
    expect((await request(app).get(`/api/asistente/conversacion/${idAdmin}`)).status).toBe(404);
    expect((await request(app).post('/api/asistente').send({ pregunta: 'x', id: idAdmin })).status).toBe(404);
  });

  it('el admin tampoco ve las conversaciones del caficultor', async () => {
    como(2, 'caficultor');
    const r = await request(app).post('/api/asistente').send({ pregunta: '¿Cuánto café verde tengo?' });
    const idCaf = eventos(r.text)[0].id;
    expect(eventos(r.text).some((e) => e.tipo === 'paso' && e.herramienta === 'mi_finca')).toBe(true);
    como(1, 'admin');
    expect((await request(app).get(`/api/asistente/conversacion/${idCaf}`)).status).toBe(404);
  });

  it('quien perdió el rol no puede aprobar', async () => {
    const res = await request(app).post('/api/asistente').send({ pregunta: 'Pase DY-1002 a preparación' });
    const id = eventos(res.text)[0].id;
    await query("UPDATE users SET role = 'client' WHERE id = 1");
    try {
      const r = await request(app).post('/api/asistente/decision').send({ id, aprobado: true });
      expect(r.status).toBe(403);
      expect(await estadoPedido('DY-1002')).toBe('paid');
    } finally {
      await query("UPDATE users SET role = 'admin' WHERE id = 1");
    }
  });
});

describe('topes y clave', () => {
  it('con el tope agotado responde 429 y no llama al modelo', async () => {
    await query('UPDATE asistente_topes SET empresa_usd = 0, usuario_usd = 0 WHERE id = 1');
    const antes = (await query('SELECT COUNT(*) AS n FROM asistente_consumo')).rows[0].n;
    const res = await request(app).post('/api/asistente').send({ pregunta: '¿Qué pedidos hay?' });
    expect(res.status).toBe(429);
    expect(res.body.soloBusca).toBe(true);
    expect((await query('SELECT COUNT(*) AS n FROM asistente_consumo')).rows[0].n).toBe(antes);
    const estado = await request(app).get('/api/asistente/estado');
    expect(estado.body.data.disponible).toBe(false);
  });

  it('el admin cambia los topes con validación', async () => {
    expect((await request(app).put('/api/asistente/topes').send({ empresaUsd: 5, usuarioUsd: 9 })).status).toBe(422);
    expect((await request(app).put('/api/asistente/topes').send({ empresaUsd: -1, usuarioUsd: 0 })).status).toBe(422);
    const ok = await request(app).put('/api/asistente/topes').send({ empresaUsd: 4, usuarioUsd: 1.5 });
    expect(ok.body.data).toMatchObject({ empresaUsd: 4, usuarioUsd: 1.5 });
    const t = await request(app).get('/api/asistente/topes');
    expect(t.body.data.mes.usd).toBeGreaterThan(0);
  });

  it('sin clave la caja solo busca, y el buscador sigue', async () => {
    delete process.env.ASISTENTE_MODELO_FALSO;
    const clave = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const res = await request(app).post('/api/asistente').send({ pregunta: 'Hola' });
      expect(res.status).toBe(503);
      const b = await request(app).get('/api/asistente/buscar').query({ q: 'envíos' });
      expect(b.body.data.some((r) => r.enlace === '/admin/envios')).toBe(true);
    } finally {
      if (clave) process.env.ANTHROPIC_API_KEY = clave;
    }
  });
});
