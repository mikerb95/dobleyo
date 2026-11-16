// Bucle del asistente del panel: habla con la API de Claude, ejecuta las
// herramientas de lectura y, cuando el modelo propone una escritura, SE PAUSA.
//
// Por qué un bucle propio y no el Tool Runner del SDK: una propuesta puede
// esperar el clic de una persona durante horas, y una función serverless no
// puede quedarse esperando. La conversación se guarda (estado
// `esperando_aprobacion`), la función termina y `decidir()` la retoma en otra
// petición con el `tool_result` que falta.
//
// Reglas de la API que este bucle respeta:
//  - Historial solo por anexión: el `content` de cada respuesta se guarda tal
//    cual (bloques de thinking incluidos). Editar turnos previos invalida el
//    thinking.
//  - Nunca se ejecutan herramientas de un turno cortado (`max_tokens`,
//    `refusal`): su entrada puede venir truncada.
//  - Los tool_result vuelven en el orden de los tool_use del turno.
//
// Módulo sin BD ni red: todo lo externo llega por `deps`, para poder probar
// cada rama con un modelo falso. Portado de la skill `panel-ia`.

import { costoUsd, sumarUso, USO_CERO } from './costo.js';

export const MAX_ITERACIONES = 15;

/**
 * @typedef {'corriendo'|'esperando_aprobacion'|'terminada'|'fallida'} EstadoEjecucion
 * @typedef {{ ok: true, datos: unknown } | { ok: false, error: string }} ResultadoHerramienta
 * @typedef {{ ok: true, origen: string, motivo: string, vista?: unknown } | { ok: false, error: string }} PropuestaPreparada
 *
 * @typedef {object} Dependencias
 * @property {(mensajes: object[]) => Promise<object>} llamarModelo
 * @property {(nombre: string, entrada: unknown) => string|null} validar  Valida entrada Y permiso sin ejecutar.
 * @property {(nombre: string, entrada: unknown, extra: { toolUseId: string }) => Promise<ResultadoHerramienta>} ejecutar
 * @property {(e: object) => Promise<void>} guardar
 * @property {(evento: object) => void} emitir
 * @property {() => Promise<number>} presupuestoRestante  USD que quedan hoy. Si no se puede saber, lanza.
 * @property {string[]} herramientasAprobacion  Escrituras que el rol puede proponer.
 * @property {(nombre: string, entrada: unknown) => Promise<PropuestaPreparada>} prepararPropuesta
 * @property {(comentario: string|null) => string} rechazo
 */

export function nuevaEjecucion(id, pregunta) {
  return {
    id,
    estado: 'corriendo',
    pregunta,
    mensajes: [{ role: 'user', content: pregunta }],
    propuesta: null,
    respuesta: null,
    error: null,
    iteraciones: 0,
    uso: { ...USO_CERO },
    costoUsd: 0,
  };
}

const aResultado = (toolUseId, r) =>
  r.ok === true
    ? { type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(r.datos) }
    : { type: 'tool_result', tool_use_id: toolUseId, content: r.error, is_error: true };

const enOrden = (orden, resultados) =>
  orden.map((id) => resultados.find((r) => r.tool_use_id === id)).filter(Boolean);

const mensajeError = (err) => (err instanceof Error ? err.message : String(err));

async function terminar(e, deps, estado, error) {
  e.estado = estado;
  e.error = error;
  e.propuesta = null;
  await deps.guardar(e);
  deps.emitir({ tipo: 'fin', estado, iteraciones: e.iteraciones, costoUsd: e.costoUsd, error });
  return e;
}

/** Hace avanzar una ejecución `corriendo` hasta que termina, falla o se pausa. Nunca lanza. */
export async function avanzar(e, deps) {
  while (true) {
    if (e.iteraciones >= MAX_ITERACIONES) {
      return terminar(e, deps, 'fallida', `Se superó el máximo de ${MAX_ITERACIONES} pasos.`);
    }
    let restante;
    try {
      restante = await deps.presupuestoRestante();
    } catch {
      return terminar(e, deps, 'fallida', 'No se pudo comprobar el gasto del día; por seguridad no se sigue gastando.');
    }
    if (!(restante > 0)) return terminar(e, deps, 'fallida', 'Se alcanzó el tope de gasto diario.');

    let msg;
    try {
      msg = await deps.llamarModelo(e.mensajes);
    } catch (err) {
      return terminar(e, deps, 'fallida', `La API de Claude falló: ${mensajeError(err)}`);
    }
    e.iteraciones++;
    e.uso = sumarUso(e.uso, msg.usage);
    e.costoUsd += costoUsd(sumarUso(USO_CERO, msg.usage), msg.model);
    e.mensajes.push({ role: 'assistant', content: msg.content });

    const textos = msg.content.filter((b) => b.type === 'text' && b.text?.trim());
    for (const t of textos) deps.emitir({ tipo: 'texto', texto: t.text.trim() });

    switch (msg.stop_reason) {
      case 'end_turn':
      case 'stop_sequence':
        e.respuesta = textos.map((t) => t.text.trim()).join('\n\n') || null;
        return terminar(e, deps, 'terminada', null);
      case 'pause_turn':
        await deps.guardar(e);
        continue;
      case 'refusal':
        return terminar(e, deps, 'fallida', 'El modelo declinó continuar.');
      case 'max_tokens':
        return terminar(e, deps, 'fallida', 'La respuesta del modelo se cortó por longitud.');
      case 'tool_use':
        break;
      default:
        return terminar(e, deps, 'fallida', `El modelo se detuvo de forma inesperada (${msg.stop_reason}).`);
    }

    const usos = msg.content.filter((b) => b.type === 'tool_use');
    if (!usos.length) return terminar(e, deps, 'fallida', 'El modelo pidió herramientas sin nombrar ninguna.');

    const aprobacion = new Set(deps.herramientasAprobacion);
    const resultados = [];
    let propuesta = null;
    for (const uso of usos) {
      const invalida = deps.validar(uso.name, uso.input);
      if (invalida) {
        resultados.push(aResultado(uso.id, { ok: false, error: invalida }));
        continue;
      }
      if (aprobacion.has(uso.name)) {
        if (propuesta) {
          resultados.push(aResultado(uso.id, { ok: false, error: 'Proponga un cambio a la vez y espere la decisión.' }));
          continue;
        }
        let preparada;
        try {
          preparada = await deps.prepararPropuesta(uso.name, uso.input);
        } catch (err) {
          preparada = { ok: false, error: `No se pudo preparar la propuesta: ${mensajeError(err)}` };
        }
        if (preparada.ok !== true) {
          resultados.push(aResultado(uso.id, { ok: false, error: preparada.error }));
          continue;
        }
        propuesta = {
          toolUseId: uso.id,
          herramienta: uso.name,
          origen: preparada.origen,
          motivo: preparada.motivo,
          ...(preparada.vista !== undefined ? { vista: preparada.vista } : {}),
          entrada: uso.input,
          resultadosPrevios: [],
          orden: usos.map((u) => u.id),
        };
        continue;
      }
      deps.emitir({ tipo: 'paso', id: uso.id, herramienta: uso.name, entrada: uso.input ?? {} });
      let r;
      try {
        r = await deps.ejecutar(uso.name, uso.input, { toolUseId: uso.id });
      } catch (err) {
        r = { ok: false, error: mensajeError(err) };
      }
      if (r.ok === true) deps.emitir({ tipo: 'dato', herramienta: uso.name, datos: r.datos });
      resultados.push(aResultado(uso.id, r));
    }

    if (propuesta) {
      propuesta.resultadosPrevios = resultados;
      e.propuesta = propuesta;
      e.estado = 'esperando_aprobacion';
      await deps.guardar(e);
      deps.emitir({
        tipo: 'aprobacion',
        origen: propuesta.origen,
        motivo: propuesta.motivo,
        herramienta: propuesta.herramienta,
        ...(propuesta.vista !== undefined ? { vista: propuesta.vista } : {}),
      });
      return e;
    }

    e.mensajes.push({ role: 'user', content: enOrden(usos.map((u) => u.id), resultados) });
    await deps.guardar(e);
  }
}

/**
 * Aplica la decisión sobre la propuesta pendiente y retoma. Quien llama debe
 * haber reclamado la conversación de forma atómica (dos clics no la deciden
 * dos veces) y comprobado el rol ACTUAL de quien decide.
 * `comentario` = la persona escribió otra cosa con la tarjeta abierta.
 */
export async function decidir(e, aprobado, deps, comentario = null) {
  const p = e.propuesta;
  if (!p) throw new Error('La conversación no tiene ninguna propuesta pendiente.');

  let resultado;
  if (aprobado) {
    let r;
    try {
      r = await deps.ejecutar(p.herramienta, p.entrada, { toolUseId: p.toolUseId });
    } catch (err) {
      r = { ok: false, error: mensajeError(err) };
    }
    if (r.ok === true) deps.emitir({ tipo: 'dato', herramienta: p.herramienta, datos: r.datos });
    resultado = aResultado(p.toolUseId, r);
  } else {
    resultado = aResultado(p.toolUseId, { ok: false, error: deps.rechazo(comentario) });
  }
  deps.emitir({ tipo: 'decision', origen: p.origen, aprobado, herramienta: p.herramienta });

  e.mensajes.push({ role: 'user', content: enOrden(p.orden, [...p.resultadosPrevios, resultado]) });
  e.propuesta = null;
  e.estado = 'corriendo';
  await deps.guardar(e);
  return avanzar(e, deps);
}
