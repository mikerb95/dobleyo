// Escrituras de producción (solo admin): ingreso del café verde a bodega,
// envío a tostión, recepción del tostado y almacenamiento del tostado.
// Reutilizan coffeeService, que ya valida la máquina de estados del lote, las
// ubicaciones y el saldo disponible, y deja el movimiento en el ledger.
//
// Sin costos: los montos se digitan en las pantallas de cada etapa. La cosecha
// y el empaque (insumos, inventario de producto) también quedan en sus
// pantallas.
//
// `movementUid` lleva la clave de idempotencia de la propuesta: si una
// aprobación se reintenta, el ledger no duplica el movimiento.

import { z } from 'zod';
import { query } from '../../../db.js';
import { logAudit } from '../../audit.js';
import { storeGreenCoffee, sendToRoasting, receiveRoasted, storeRoasted } from '../../coffeeService.js';
import { getCurrentStage, canTransitionTo, STAGE_LABELS } from '../../lotStateMachine.js';
import { resolveLocationForIntake } from '../../storageService.js';
import { getLotJourney } from '../../workflowService.js';
import { hoy, kg } from '../herramientas/comun.js';
import { vistaCambio, propuesta, hecho, noSe, usuarioServicio } from './cambio.js';

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD');
const NIVELES = { LIGHT: 'Claro', MEDIUM: 'Medio', DARK: 'Oscuro' };
const RECIPIENTES = { 'BAG-1KG': 'Bolsa 1 kg', 'BAG-5KG': 'Bolsa 5 kg', 'BUCKET-25': 'Cubeta 25 kg', 'SACK-60': 'Saco 60 kg' };
const enlaceLote = (lotId) => `/admin/produccion?lote=${encodeURIComponent(lotId)}`;

/** Los errores de negocio de coffeeService traen `status`: se le explican al modelo tal cual. */
async function negocio(fn) {
  try {
    return { ok: true, valor: await fn() };
  } catch (err) {
    if (err?.status && err.status < 500) return noSe(err.message);
    throw err;
  }
}

async function exigirEtapa(lotId, destino) {
  const etapa = await getCurrentStage(query, lotId);
  if (etapa === 'unknown') return noSe(`No existe el lote ${lotId}.`);
  if (!canTransitionTo(etapa, destino)) {
    return noSe(`El lote ${lotId} está en "${STAGE_LABELS[etapa] ?? etapa}" y no puede pasar a "${STAGE_LABELS[destino]}".`);
  }
  return { ok: true, etapa };
}

async function ubicacionApta(codigo, estado) {
  const r = await negocio(() => resolveLocationForIntake(codigo, estado));
  if (r.ok === true) return r;
  const { rows } = await query(
    `SELECT code FROM storage_locations WHERE is_active = 1 AND COALESCE(is_blocked, 0) = 0
        AND (',' || allowed_states || ',') LIKE ? ORDER BY code LIMIT 15`,
    [`%,${estado},%`],
  );
  return noSe(`${r.error} Ubicaciones aptas: ${rows.map((x) => x.code).join(', ') || 'ninguna registrada'}.`);
}

export const almacenarCafeVerde = {
  nombre: 'almacenar_cafe_verde',
  descripcion:
    'Registra el ingreso a bodega del café verde de un lote cosechado: kilos, ubicación y fecha. No se ejecuta sola: la persona ve ' +
    'el cambio y decide. Busque antes el lote con consultar_produccion y pregunte los kilos y la ubicación si no los dijo.',
  esquema: z.object({
    lote: z.string().min(5).max(80).describe('Código del lote (sale de consultar_produccion).'),
    kilos: z.number().positive().max(20000).describe('Kilos de café verde que entran a bodega.'),
    ubicacion: z.string().min(1).max(40).describe('Código de la ubicación en bodega, como lo dijo la persona.'),
    fecha: DIA.optional().describe('Fecha de ingreso (AAAA-MM-DD). Por defecto, hoy.'),
    notas: z.string().max(300).optional(),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const e = await exigirEtapa(entrada.lote, 'in_storage_green');
    if (e.ok !== true) return e;
    const u = await ubicacionApta(entrada.ubicacion, 'green');
    if (u.ok !== true) return u;
    const vista = vistaCambio({
      rotulo: 'Lote',
      titulo: entrada.lote,
      contexto: 'Ingreso de café verde a bodega',
      cambios: [
        { campo: 'Etapa', antes: STAGE_LABELS[e.etapa], despues: STAGE_LABELS.in_storage_green },
        { campo: 'Kilos', antes: null, despues: `${kg(entrada.kilos)} kg` },
        { campo: 'Ubicación', antes: null, despues: u.valor.code },
        { campo: 'Fecha', antes: null, despues: entrada.fecha ?? hoy() },
        ...(entrada.notas ? [{ campo: 'Notas', antes: null, despues: entrada.notas }] : []),
      ],
    });
    return propuesta(`Lote ${entrada.lote}`, `Ingreso de ${kg(entrada.kilos)} kg de verde a ${u.valor.code}`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const r = await negocio(() =>
      storeGreenCoffee({
        lotId: entrada.lote, weight: entrada.kilos, weightUnit: 'kg', location: entrada.ubicacion,
        storageDate: entrada.fecha ?? hoy(), notes: entrada.notas, user: usuarioServicio(ctx),
        movementUid: `asistente:${ctx.claveIdempotencia}`,
      }),
    );
    if (r.ok !== true) return r;
    await logAudit(ctx.usuario.id, 'create', 'green_coffee_inventory', r.valor.storageId, { lotId: entrada.lote, kg: entrada.kilos, via: 'asistente' });
    return hecho(`Ingresaron ${kg(entrada.kilos)} kg de café verde del lote ${entrada.lote} a ${r.valor.location}.`, enlaceLote(entrada.lote));
  },
};

export const enviarATostion = {
  nombre: 'enviar_a_tostion',
  descripcion:
    'Registra el envío a tostión (maquila) de kilos de café verde de un lote que está en bodega. No se ejecuta sola: la persona ve ' +
    'el cambio y decide. Busque antes el lote y sus kilos en bodega con consultar_produccion.',
  esquema: z.object({
    lote: z.string().min(5).max(80).describe('Código del lote.'),
    kilos: z.number().positive().max(20000).describe('Kilos de café verde que salen a tostión.'),
    notas: z.string().max(300).optional(),
  }),
  roles: ['admin'],

  async preparar(entrada, ctx) {
    const e = await exigirEtapa(entrada.lote, 'sent_to_roasting');
    if (e.ok !== true) return e;
    const j = await getLotJourney(entrada.lote, { id: ctx.usuario.id, role: ctx.usuario.rol });
    const disponible = kg(j?.balance?.greenKg ?? 0);
    if (entrada.kilos > disponible) return noSe(`El lote ${entrada.lote} tiene ${disponible} kg de verde en bodega; no alcanza para ${kg(entrada.kilos)} kg.`);
    const vista = vistaCambio({
      rotulo: 'Lote',
      titulo: entrada.lote,
      contexto: j?.farmName ?? null,
      cambios: [
        { campo: 'Etapa', antes: STAGE_LABELS[e.etapa], despues: STAGE_LABELS.sent_to_roasting },
        { campo: 'Verde en bodega', antes: `${disponible} kg`, despues: `${kg(disponible - entrada.kilos)} kg` },
        { campo: 'Enviado a tostión', antes: null, despues: `${kg(entrada.kilos)} kg` },
        ...(entrada.notas ? [{ campo: 'Notas', antes: null, despues: entrada.notas }] : []),
      ],
    });
    return propuesta(`Lote ${entrada.lote}`, `Envío de ${kg(entrada.kilos)} kg a tostión`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const r = await negocio(() =>
      sendToRoasting({ lotId: entrada.lote, quantitySent: entrada.kilos, notes: entrada.notas, user: usuarioServicio(ctx), movementUid: `asistente:${ctx.claveIdempotencia}` }),
    );
    if (r.ok !== true) return r;
    await logAudit(ctx.usuario.id, 'create', 'roasting_batches', r.valor.roastingId, { lotId: entrada.lote, kg: entrada.kilos, via: 'asistente' });
    return hecho(`Salieron ${kg(entrada.kilos)} kg del lote ${entrada.lote} a tostión (tostión #${r.valor.roastingId}).`, enlaceLote(entrada.lote), { id_tostion: Number(r.valor.roastingId) });
  },
};

export const recibirTostado = {
  nombre: 'recibir_tostado',
  descripcion:
    'Registra la recepción del café tostado de una tostión: nivel de tueste y kilos que volvieron. El sistema calcula la merma. ' +
    'No se ejecuta sola: la persona ve el cambio y decide. Busque antes el id de la tostión con consultar_produccion (con el lote).',
  esquema: z.object({
    id_tostion: z.number().int().positive().describe('Id de la tostión (sale de consultar_produccion con el lote).'),
    nivel_tueste: z.enum(Object.keys(NIVELES)).describe('LIGHT (claro), MEDIUM (medio) o DARK (oscuro).'),
    kilos_tostados: z.number().positive().max(20000).describe('Kilos de café tostado recibidos.'),
    notas: z.string().max(300).optional(),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const { rows } = await query('SELECT id, lot_id, quantity_sent_kg, status FROM roasting_batches WHERE id = ?', [entrada.id_tostion]);
    const t = rows[0];
    if (!t) return noSe(`No existe la tostión ${entrada.id_tostion}.`);
    if (t.status === 'completed') return noSe(`La tostión ${t.id} ya se recibió.`);
    const enviados = Number(t.quantity_sent_kg);
    if (entrada.kilos_tostados >= enviados) return noSe(`Se enviaron ${kg(enviados)} kg: lo tostado siempre pesa menos por la evaporación.`);
    if (entrada.kilos_tostados < enviados * 0.6) return noSe(`${kg(entrada.kilos_tostados)} kg es muy poco para ${kg(enviados)} kg enviados (merma máxima esperada cerca de 35 %). Confirme el peso.`);
    if (t.lot_id) {
      const e = await exigirEtapa(t.lot_id, 'roasted');
      if (e.ok !== true) return e;
    }
    const merma = Math.round(((enviados - entrada.kilos_tostados) / enviados) * 1000) / 10;
    const vista = vistaCambio({
      rotulo: 'Tostión',
      titulo: `#${t.id}${t.lot_id ? ` · lote ${t.lot_id}` : ''}`,
      contexto: `Se enviaron ${kg(enviados)} kg`,
      cambios: [
        { campo: 'Estado', antes: 'En tostión', despues: 'Tostado recibido' },
        { campo: 'Nivel de tueste', antes: null, despues: NIVELES[entrada.nivel_tueste] },
        { campo: 'Kilos tostados', antes: null, despues: `${kg(entrada.kilos_tostados)} kg` },
        { campo: 'Merma', antes: null, despues: `${merma} %` },
        ...(entrada.notas ? [{ campo: 'Notas', antes: null, despues: entrada.notas }] : []),
      ],
    });
    return propuesta(`Tostión #${t.id}`, `Recepción de ${kg(entrada.kilos_tostados)} kg (${merma} % de merma)`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const r = await negocio(() =>
      receiveRoasted({ roastingId: entrada.id_tostion, roastLevel: entrada.nivel_tueste, roastedWeight: entrada.kilos_tostados, observations: entrada.notas, user: usuarioServicio(ctx) }),
    );
    if (r.ok !== true) return r;
    await logAudit(ctx.usuario.id, 'create', 'roasted_coffee', r.valor.roastedId, { roastingId: entrada.id_tostion, kg: entrada.kilos_tostados, via: 'asistente' });
    return hecho(`Se recibieron ${kg(entrada.kilos_tostados)} kg tostados de la tostión #${entrada.id_tostion} (${r.valor.weightLossPercent} % de merma).`, '/admin/produccion', { id_tostado: Number(r.valor.roastedId) });
  },
};

export const almacenarTostado = {
  nombre: 'almacenar_tostado',
  descripcion:
    'Registra dónde quedó guardado un café tostado recibido: ubicación, tipo de recipiente y cuántos. No se ejecuta sola: la ' +
    'persona ve el cambio y decide. Busque antes el id del tostado con consultar_produccion (con el lote).',
  esquema: z.object({
    id_tostado: z.number().int().positive().describe('Id del café tostado (sale de consultar_produccion con el lote).'),
    ubicacion: z.string().min(1).max(40).describe('Código de la ubicación en bodega.'),
    recipiente: z.enum(Object.keys(RECIPIENTES)).describe('BAG-1KG, BAG-5KG, BUCKET-25 o SACK-60.'),
    cantidad_recipientes: z.number().int().min(1).max(500).describe('Cuántos recipientes.'),
    notas: z.string().max(300).optional(),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const { rows } = await query(
      `SELECT rc.id, rc.weight_kg, rc.status, rb.lot_id FROM roasted_coffee rc
         JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rc.id = ?`,
      [entrada.id_tostado],
    );
    const t = rows[0];
    if (!t) return noSe(`No existe el café tostado ${entrada.id_tostado}.`);
    if (t.status === 'stored') return noSe(`El tostado ${t.id} ya está almacenado.`);
    if (t.lot_id) {
      const e = await exigirEtapa(t.lot_id, 'in_storage_roasted');
      if (e.ok !== true) return e;
    }
    const u = await ubicacionApta(entrada.ubicacion, 'roasted');
    if (u.ok !== true) return u;
    const vista = vistaCambio({
      rotulo: 'Café tostado',
      titulo: `#${t.id}${t.lot_id ? ` · lote ${t.lot_id}` : ''}`,
      contexto: `${kg(t.weight_kg)} kg tostados`,
      cambios: [
        { campo: 'Estado', antes: 'Listo para almacenar', despues: 'Almacenado' },
        { campo: 'Ubicación', antes: null, despues: u.valor.code },
        { campo: 'Recipientes', antes: null, despues: `${entrada.cantidad_recipientes} × ${RECIPIENTES[entrada.recipiente]}` },
        ...(entrada.notas ? [{ campo: 'Notas', antes: null, despues: entrada.notas }] : []),
      ],
    });
    return propuesta(`Tostado #${t.id}`, `Almacenar en ${u.valor.code}`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const r = await negocio(() =>
      storeRoasted({
        roastedId: entrada.id_tostado, location: entrada.ubicacion, container: entrada.recipiente,
        containerCount: entrada.cantidad_recipientes, notes: entrada.notas, user: usuarioServicio(ctx),
        movementUid: `asistente:${ctx.claveIdempotencia}`,
      }),
    );
    if (r.ok !== true) return r;
    await logAudit(ctx.usuario.id, 'create', 'roasted_coffee_inventory', r.valor.storageId, { roastedId: entrada.id_tostado, via: 'asistente' });
    return hecho(`El tostado #${entrada.id_tostado} quedó almacenado en ${r.valor.location}.`, '/admin/produccion');
  },
};
