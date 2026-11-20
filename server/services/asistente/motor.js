// Motor del asistente: une bucle, herramientas, permisos, prompt, topes,
// consumo, conversaciones y auditoría. Solo servidor.
//
// Cada pregunta o decisión se hace en dos pasos para que el router pueda
// responder con un código HTTP claro ANTES de abrir el SSE:
//   prepararX()  valida (clave, tope, conversación reclamable) y lanza
//                ErrorAsistente con su status si algo falla;
//   correrX()    corre el bucle y transmite los eventos.

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../logger.js';
import { query } from '../../db.js';
import { avanzar, decidir, nuevaEjecucion } from './bucle.js';
import { MODELO } from './costo.js';
import * as conversaciones from './conversaciones.js';
import * as consumo from './consumo.js';
import * as topes from './topes.js';
import * as auditoria from './auditoria.js';
import { textoRechazo, turnosDe } from './turnos.js';
import { cifrasDe, extraerCifras, verificarCifras } from './guardia.js';
import { systemPrompt } from './prompt.js';
import { GLOSARIO_CAFE, glosarioNegocio } from './glosario.js';
import { hoy } from './herramientas/comun.js';
import {
  ROLES_ASISTENTE, ETIQUETA_ROL, definiciones, escriturasDe, accionesDe,
  validarLlamada, lecturaPorNombre, escrituraPorNombre, puede,
} from './permisos.js';
import { modeloFalso } from './modeloFalso.js';

export class ErrorAsistente extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

/** 'real' con clave, 'falso' en pruebas (nunca en producción), o null. */
export function modoDelModelo(env = process.env) {
  if (env.ASISTENTE_MODELO_FALSO === '1' && env.NODE_ENV !== 'production') return 'falso';
  return env.ANTHROPIC_API_KEY ? 'real' : null;
}

// Raya larga (U+2014) y raya media (U+2013). Se arman por código para que el
// archivo no contenga los caracteres que el estilo del proyecto prohíbe.
const RAYAS = `[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`;
const RAYA_ENTRE_NUMEROS = new RegExp(`(\\d)\\s*${RAYAS}\\s*(\\d)`, 'g');
const RAYA = new RegExp(`\\s*${RAYAS}\\s*`, 'g');

/** Quita rayas largas y medias usadas como puntuación (el modelo las pone igual). */
export function sinRayas(texto) {
  return String(texto ?? '').replace(RAYA_ENTRE_NUMEROS, '$1-$2').replace(RAYA, ', ');
}

/**
 * Usuario con su rol ACTUAL leído de la base (no el del token, que pudo
 * cambiar). El usuario sintético de desarrollo (id 0) solo existe fuera de
 * producción.
 */
export async function usuarioActual(reqUser) {
  if (!reqUser) return null;
  if (Number(reqUser.id) === 0 && reqUser.role === 'admin' && process.env.NODE_ENV !== 'production') {
    return { id: 0, nombre: 'Equipo DobleYo', rol: 'admin' };
  }
  const { rows } = await query('SELECT id, role, first_name, name FROM users WHERE id = ?', [reqUser.id]);
  const u = rows[0];
  if (!u || !ROLES_ASISTENTE.includes(u.role)) return null;
  return { id: Number(u.id), nombre: u.first_name || u.name || 'equipo', rol: u.role };
}

// ---- Modelo ----------------------------------------------------------------

let cliente = null;
function clienteApi() {
  cliente ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 });
  return cliente;
}

function llamadorDelModelo(usuario, conversacionId, modo) {
  const system = [
    {
      type: 'text',
      text: systemPrompt(hoy(), { nombre: usuario.nombre, rol: usuario.rol, etiquetaRol: ETIQUETA_ROL[usuario.rol] }, accionesDe(usuario.rol)),
      cache_control: { type: 'ephemeral' },
    },
  ];
  const tools = definiciones(usuario.rol);

  return async (mensajes) => {
    const msg = modo === 'falso'
      ? await modeloFalso(mensajes)
      : await clienteApi()
        .beta.messages.stream({
          model: MODELO,
          max_tokens: 16_000,
          system,
          tools,
          messages: mensajes,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          // Si el modelo declina por un falso positivo de seguridad, la API
          // reintenta con otro modelo dentro de la misma llamada.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
        .finalMessage();
    // Por llamada, no al final: si la función muere a mitad, lo pagado cuenta.
    await consumo
      .registrar({ usuarioId: usuario.id, conversacionId, modelo: msg.model ?? MODELO, usage: msg.usage })
      .catch((err) => logger.error({ err }, '[asistente] No se pudo registrar el consumo'));
    return msg;
  };
}

// ---- Guardia de cifras -----------------------------------------------------

/** Cifras que el modelo puede citar sin consultarlas: las reglas del glosario de su rol. */
function cifrasDelGlosario(rol) {
  const texto = rol === 'admin' ? `${GLOSARIO_CAFE}\n${glosarioNegocio()}` : GLOSARIO_CAFE;
  return extraerCifras(texto).map((c) => c.valor);
}

export function cifrasPermitidas(mensajes, rol = 'caficultor') {
  const permitidas = cifrasDelGlosario(rol);
  for (const m of mensajes) {
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') {
      for (const c of extraerCifras(m.content)) permitidas.push(c.valor);
      continue;
    }
    for (const b of m.content) {
      if (b.type !== 'tool_result') continue;
      let datos = b.content;
      try {
        datos = JSON.parse(b.content);
      } catch {
        // Texto de error: igual puede traer cifras.
      }
      cifrasDe(datos, permitidas);
    }
  }
  return permitidas;
}

// ---- Dependencias del bucle ------------------------------------------------

/**
 * @param {{ id: number, nombre: string, rol: string }} usuario  quien pregunta o decide (rol actual)
 * @param {{ permitirEscritura?: boolean, opciones?: object, alEscribir?: Function }} [extra]
 */
function dependencias(usuario, conversacionId, emitir, modo, extra = {}) {
  const ctx = { usuario };
  const revisadas = new WeakSet();
  return {
    herramientasAprobacion: escriturasDe(usuario.rol).map((e) => e.nombre),
    llamarModelo: llamadorDelModelo(usuario, conversacionId, modo),
    validar: (nombre, entrada) => {
      const r = validarLlamada(usuario.rol, nombre, entrada);
      return r.ok === true ? null : r.error;
    },
    async ejecutar(nombre, entrada, { toolUseId }) {
      const v = validarLlamada(usuario.rol, nombre, entrada);
      if (v.ok !== true) return { ok: false, error: v.error };
      const esc = escrituraPorNombre(nombre);
      if (esc) {
        // Defensa en profundidad: una escritura solo corre desde una decisión aprobada.
        if (!extra.permitirEscritura) return { ok: false, error: 'Las acciones necesitan la aprobación de una persona.' };
        let r;
        try {
          r = await esc.ejecutar(v.entrada, { ...ctx, claveIdempotencia: toolUseId, opciones: extra.opciones ?? {} });
        } catch (err) {
          logger.error({ err, herramienta: nombre }, '[asistente] Error ejecutando escritura');
          r = { ok: false, error: 'No se pudo guardar el cambio por un error del servidor. Revise la pantalla correspondiente antes de intentarlo de nuevo.' };
        }
        await extra.alEscribir?.(r);
        return r;
      }
      return lecturaPorNombre(nombre).ejecutar(v.entrada, ctx);
    },
    async prepararPropuesta(nombre, entrada) {
      const v = validarLlamada(usuario.rol, nombre, entrada);
      if (v.ok !== true) return { ok: false, error: v.error };
      return escrituraPorNombre(nombre).preparar(v.entrada, ctx);
    },
    rechazo: textoRechazo,
    async guardar(e) {
      if (e.estado === 'terminada' && e.respuesta && !revisadas.has(e)) {
        revisadas.add(e);
        const g = verificarCifras(e.respuesta, cifrasPermitidas(e.mensajes, usuario.rol));
        if (!g.ok) {
          e.aviso = `Revise estas cifras: no salieron de ninguna consulta (${g.inventadas.map((c) => c.texto).join(', ')}).`;
          emitir({ tipo: 'aviso', texto: e.aviso });
        }
      }
      await conversaciones.guardar(e);
    },
    emitir: (ev) => emitir(ev.tipo === 'texto' ? { ...ev, texto: sinRayas(ev.texto) } : ev),
    presupuestoRestante: () => topes.restante(usuario.id),
  };
}

// ---- Preguntar -------------------------------------------------------------

async function exigirModeloYPresupuesto(usuario) {
  const modo = modoDelModelo();
  if (!modo) throw new ErrorAsistente(503, 'El asistente no tiene clave configurada. Por ahora la caja solo busca.', { soloBusca: true });
  let estado;
  try {
    estado = await topes.estadoDeHoy(usuario.id);
  } catch (err) {
    logger.error({ err }, '[asistente] No se pudo leer el gasto del día');
    throw new ErrorAsistente(503, 'No se pudo comprobar el gasto de hoy. Por seguridad el asistente no responde; la caja sigue buscando.', { soloBusca: true });
  }
  if (estado.agotado) {
    throw new ErrorAsistente(
      429,
      estado.agotado === 'usuario'
        ? 'Usted alcanzó su tope de consultas de hoy. Mañana vuelve a estar disponible; la caja sigue buscando.'
        : 'Se alcanzó el tope de consultas de hoy para todo el equipo. Mañana vuelve a estar disponible; la caja sigue buscando.',
      { soloBusca: true },
    );
  }
  return modo;
}

export async function prepararPregunta({ usuario, pregunta, id }) {
  const modo = await exigirModeloYPresupuesto(usuario);
  if (!id) {
    await conversaciones.purgarViejas().catch((err) => logger.error({ err }, '[asistente] No se pudieron purgar conversaciones viejas'));
    const e = nuevaEjecucion(conversaciones.nuevoId(), pregunta);
    await conversaciones.crear(e, usuario);
    return { tipo: 'nueva', e, usuario, modo, pregunta };
  }

  const actual = await conversaciones.obtener(id, usuario.id);
  if (!actual) throw new ErrorAsistente(404, 'No encontré esa conversación.', { nueva: true });
  if (actual.estado === 'corriendo') throw new ErrorAsistente(409, 'El asistente todavía está respondiendo en esta conversación.');
  if (actual.estado === 'fallida') throw new ErrorAsistente(409, 'Esa conversación terminó con un error. Empiece una nueva.', { nueva: true });

  if (actual.estado === 'esperando_aprobacion') {
    // Escribir con la tarjeta abierta = pedir cambios (rechazo con indicación).
    const e = await conversaciones.reclamar(id, ['esperando_aprobacion'], usuario.id);
    if (!e) throw new ErrorAsistente(409, 'Esa propuesta ya se decidió en otra pestaña.', { recargar: true });
    return { tipo: 'cambios', e, usuario, modo, pregunta };
  }

  if (turnosDe(actual.mensajes).length >= conversaciones.MAX_TURNOS) {
    throw new ErrorAsistente(409, 'Esta conversación ya es larga y cada pregunta cuesta más. Empiece una nueva.', { nueva: true });
  }
  const e = await conversaciones.reclamar(id, ['terminada'], usuario.id);
  if (!e) throw new ErrorAsistente(409, 'Esa conversación cambió en otra pestaña.', { recargar: true });
  return { tipo: 'seguir', e, usuario, modo, pregunta };
}

export async function correrPregunta(plan, enviar) {
  const { e, usuario, modo, pregunta } = plan;
  enviar({ tipo: 'conversacion', id: e.id });
  if (plan.tipo === 'cambios') {
    const p = e.propuesta;
    await auditoria.registrar({
      conversacionId: e.id, herramienta: p.herramienta, pidioId: usuario.id, decidioId: usuario.id,
      aprobada: false, entrada: p.entrada, vista: p.vista, resultado: { ok: false, error: `Pidió cambios: ${pregunta}` },
    });
    await decidir(e, false, dependencias(usuario, e.id, enviar, modo), pregunta);
    return;
  }
  const deps = dependencias(usuario, e.id, enviar, modo);
  if (plan.tipo === 'seguir') {
    e.mensajes.push({ role: 'user', content: pregunta });
    e.iteraciones = 0;
    e.respuesta = null;
    e.error = null;
    e.aviso = null;
    await conversaciones.guardar(e);
  }
  await avanzar(e, deps);
}

// ---- Decidir ---------------------------------------------------------------

export async function prepararDecision({ usuario, id, aprobado }) {
  const modo = await exigirModeloYPresupuesto(usuario);
  const actual = await conversaciones.obtener(id, usuario.id);
  if (!actual) throw new ErrorAsistente(404, 'No encontré esa conversación.');
  if (actual.estado !== 'esperando_aprobacion' || !actual.propuesta) {
    throw new ErrorAsistente(409, 'Esa propuesta ya se decidió.', { recargar: true });
  }
  // El rol ACTUAL de quien hace clic (leído de la base en esta petición).
  if (aprobado && !puede(usuario.rol, actual.propuesta.herramienta)) {
    throw new ErrorAsistente(403, 'Su rol ya no permite aprobar este cambio.');
  }
  const e = await conversaciones.reclamar(id, ['esperando_aprobacion'], usuario.id);
  if (!e) throw new ErrorAsistente(409, 'Esa propuesta ya se decidió en otra pestaña.', { recargar: true });
  return { e, usuario, modo, aprobado };
}

export async function correrDecision(plan, enviar, opciones = {}) {
  const { e, usuario, modo, aprobado } = plan;
  const p = e.propuesta;
  enviar({ tipo: 'conversacion', id: e.id });
  // Solo las casillas que declaró la tarjeta, y solo booleanos.
  const permitidas = new Set((p.vista?.opciones ?? []).map((o) => o.id));
  const elegidas = Object.fromEntries(Object.entries(opciones ?? {}).filter(([k, v]) => permitidas.has(k) && typeof v === 'boolean'));

  const registrar = (resultado) =>
    auditoria.registrar({
      conversacionId: e.id, herramienta: p.herramienta, pidioId: e.usuarioId, decidioId: usuario.id,
      aprobada: aprobado, entrada: p.entrada, vista: p.vista, resultado,
    });

  if (!aprobado) await registrar({ ok: false, error: 'Descartada por la persona.' });
  const deps = dependencias(usuario, e.id, enviar, modo, {
    permitirEscritura: aprobado,
    opciones: elegidas,
    alEscribir: aprobado ? registrar : undefined,
  });
  await decidir(e, aprobado, deps);
}

// ---- Lectura para la pantalla ----------------------------------------------

/** Conversación lista para pintar (`?c=<id>`), solo si es del usuario. */
export async function vistaConversacion(id, usuario) {
  const e = await conversaciones.obtener(id, usuario.id);
  if (!e) return null;
  return {
    id: e.id,
    estado: e.estado,
    turnos: turnosDe(e.mensajes).map((t) => ({ ...t, respuesta: sinRayas(t.respuesta) })),
    propuesta:
      e.estado === 'esperando_aprobacion' && e.propuesta
        ? { origen: e.propuesta.origen, motivo: e.propuesta.motivo, herramienta: e.propuesta.herramienta, vista: e.propuesta.vista }
        : null,
    aviso: e.aviso,
    error: e.error,
  };
}
