// Núcleo puro del asistente: bucle, costo, turnos, limpieza y guardia.
// Sin red ni base: el modelo es una lista de respuestas fijas. Cuesta US$0.

import { describe, it, expect } from 'vitest';
import { avanzar, decidir, nuevaEjecucion, MAX_ITERACIONES } from '../bucle.js';
import { costoUsd, sumarUso, USO_CERO, TARIFAS } from '../costo.js';
import { turnosDe, textoRechazo, PREFIJO_CAMBIOS } from '../turnos.js';
import { limpiarDatosPersonales, textoSeguro } from '../limpieza.js';
import { extraerCifras, verificarCifras, cifrasDe } from '../guardia.js';

const uso = { input_tokens: 1000, output_tokens: 100 };
const texto = (t) => ({ model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: t }] });
const herramientas = (...usos) => ({
  model: 'claude-sonnet-5-5',
  stop_reason: 'tool_use',
  usage: uso,
  content: usos.map(([id, name, input = {}]) => ({ type: 'tool_use', id, name, input })),
});

function falsas(respuestas, extra = {}) {
  const eventos = [];
  const ejecutadas = [];
  const llamadas = [];
  const deps = {
    llamarModelo: async (mensajes) => {
      llamadas.push(structuredClone(mensajes));
      const r = respuestas.shift();
      if (!r) throw new Error('sin más respuestas');
      return r;
    },
    validar: () => null,
    ejecutar: async (nombre, entrada) => {
      ejecutadas.push({ nombre, entrada });
      return { ok: true, datos: { nombre } };
    },
    guardar: async () => {},
    emitir: (e) => eventos.push(e),
    presupuestoRestante: async () => 1,
    herramientasAprobacion: ['cambiar_estado_pedido', 'ajustar_stock'],
    prepararPropuesta: async (nombre) => ({ ok: true, origen: 'Pedido DY-1', motivo: 'Cambio de estado', vista: { tipo: 'cambio', nombre } }),
    rechazo: textoRechazo,
    ...extra,
  };
  return { deps, eventos, ejecutadas, llamadas };
}

describe('bucle', () => {
  it('ejecuta una lectura y sigue hasta la respuesta', async () => {
    const { deps, ejecutadas } = falsas([herramientas(['t1', 'consultar_pedidos']), texto('Hay 2 pedidos.')]);
    const e = await avanzar(nuevaEjecucion('c1', '¿pedidos?'), deps);
    expect(e.estado).toBe('terminada');
    expect(e.respuesta).toBe('Hay 2 pedidos.');
    expect(ejecutadas.map((x) => x.nombre)).toEqual(['consultar_pedidos']);
    expect(e.iteraciones).toBe(2);
  });

  it('una escritura pausa sin ejecutarse', async () => {
    const { deps, ejecutadas, eventos } = falsas([herramientas(['w1', 'cambiar_estado_pedido', { referencia: 'DY-1' }])]);
    const e = await avanzar(nuevaEjecucion('c1', 'entregado'), deps);
    expect(e.estado).toBe('esperando_aprobacion');
    expect(e.propuesta.herramienta).toBe('cambiar_estado_pedido');
    expect(ejecutadas).toEqual([]);
    expect(eventos.some((x) => x.tipo === 'aprobacion')).toBe(true);
    expect(eventos.some((x) => x.tipo === 'fin')).toBe(false);
  });

  it('rechazar no ejecuta y el modelo recibe el rechazo', async () => {
    const { deps, ejecutadas, llamadas } = falsas([herramientas(['w1', 'cambiar_estado_pedido']), texto('Entendido.')]);
    const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
    await decidir(e, false, deps, 'mejor mañana');
    expect(ejecutadas).toEqual([]);
    const ultimo = llamadas.at(-1).at(-1);
    expect(ultimo.content[0].is_error).toBe(true);
    expect(ultimo.content[0].content.startsWith(PREFIJO_CAMBIOS)).toBe(true);
    expect(e.estado).toBe('terminada');
  });

  it('aprobar ejecuta una sola vez', async () => {
    const { deps, ejecutadas } = falsas([herramientas(['w1', 'cambiar_estado_pedido']), texto('Listo.')]);
    const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
    await decidir(e, true, deps);
    expect(ejecutadas.map((x) => x.nombre)).toEqual(['cambiar_estado_pedido']);
    await expect(decidir(e, true, deps)).rejects.toThrow(/ninguna propuesta/);
    expect(ejecutadas).toHaveLength(1);
  });

  it('dos escrituras en el mismo turno: la segunda recibe "una a la vez"', async () => {
    const { deps, llamadas } = falsas([
      herramientas(['w1', 'cambiar_estado_pedido'], ['w2', 'ajustar_stock']),
      texto('Listo.'),
    ]);
    const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
    expect(e.propuesta.toolUseId).toBe('w1');
    await decidir(e, true, deps);
    const resultados = llamadas.at(-1).at(-1).content;
    expect(resultados.map((r) => r.tool_use_id)).toEqual(['w1', 'w2']);
    expect(resultados[1].content).toMatch(/un cambio a la vez/);
  });

  it('lecturas del mismo turno que la escritura vuelven en el orden de los tool_use', async () => {
    const { deps, llamadas } = falsas([
      herramientas(['r1', 'consultar_pedidos'], ['w1', 'cambiar_estado_pedido'], ['r2', 'consultar_envios']),
      texto('Listo.'),
    ]);
    const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
    await decidir(e, true, deps);
    expect(llamadas.at(-1).at(-1).content.map((r) => r.tool_use_id)).toEqual(['r1', 'w1', 'r2']);
  });

  it('max_tokens y refusal terminan sin ejecutar herramientas', async () => {
    for (const stop of ['max_tokens', 'refusal']) {
      const r = herramientas(['t1', 'consultar_pedidos']);
      r.stop_reason = stop;
      const { deps, ejecutadas } = falsas([r]);
      const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
      expect(e.estado).toBe('fallida');
      expect(ejecutadas).toEqual([]);
    }
  });

  it('sin presupuesto, o sin poder leerlo, no llama al modelo', async () => {
    for (const presupuestoRestante of [async () => 0, async () => { throw new Error('bd caída'); }]) {
      const { deps, llamadas } = falsas([texto('no')], { presupuestoRestante });
      const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
      expect(e.estado).toBe('fallida');
      expect(llamadas).toHaveLength(0);
    }
  });

  it('respeta el tope de iteraciones', async () => {
    const respuestas = Array.from({ length: MAX_ITERACIONES + 2 }, (_, i) => herramientas([`t${i}`, 'consultar_pedidos']));
    const { deps } = falsas(respuestas);
    const e = await avanzar(nuevaEjecucion('c1', 'x'), deps);
    expect(e.estado).toBe('fallida');
    expect(e.iteraciones).toBe(MAX_ITERACIONES);
  });

  it('una herramienta inválida devuelve error al modelo sin ejecutarse', async () => {
    const { deps, ejecutadas, llamadas } = falsas([herramientas(['t1', 'consultar_finanzas']), texto('No puedo.')], {
      validar: () => 'Sin permiso para esa herramienta.',
    });
    await avanzar(nuevaEjecucion('c1', 'x'), deps);
    expect(ejecutadas).toEqual([]);
    expect(llamadas.at(-1).at(-1).content[0].content).toBe('Sin permiso para esa herramienta.');
  });
});

describe('costo', () => {
  it('suma uso y calcula USD con la tarifa del modelo', () => {
    const u = sumarUso(USO_CERO, { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000 });
    const t = TARIFAS['claude-sonnet-5-5'];
    expect(costoUsd(u)).toBeCloseTo(t.entrada + t.salida / 10 + t.cacheLectura, 6);
  });

  it('un modelo desconocido se cobra con la tarifa más cara', () => {
    const u = sumarUso(USO_CERO, { input_tokens: 1_000_000 });
    expect(costoUsd(u, 'modelo-raro')).toBe(TARIFAS['claude-opus-5-5'].entrada);
  });
});

describe('turnos', () => {
  it('reconstruye pregunta, pasos, respuesta y el "pedir cambios"', () => {
    const mensajes = [
      { role: 'user', content: '¿Qué pedidos faltan?' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'consultar_pedidos', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: '{}' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Faltan 2.' }, { type: 'tool_use', id: 'b', name: 'cambiar_estado_pedido', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b', content: textoRechazo('mejor el otro'), is_error: true }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Propongo el otro.' }] },
    ];
    const t = turnosDe(mensajes);
    expect(t).toHaveLength(2);
    expect(t[0]).toEqual({ pregunta: '¿Qué pedidos faltan?', respuesta: 'Faltan 2.', pasos: ['consultar_pedidos', 'cambiar_estado_pedido'] });
    expect(t[1].pregunta).toBe('mejor el otro');
    expect(t[1].respuesta).toBe('Propongo el otro.');
  });
});

describe('limpieza', () => {
  it('oculta correo, celular, fijo, documento y dirección sin comerse montos', () => {
    const { texto: t, ocultos } = limpiarDatosPersonales(
      'Escribir a ana@correo.co o al 310 555 1234 / +57 601 234 5678. CC 1.020.304.050. ' +
        'Enviar a Calle 12 # 34-56 apto 302. Total $1.500.000 y 2.000.000 COP.',
    );
    expect(t).not.toMatch(/ana@correo/);
    expect(t).not.toMatch(/555 1234/);
    expect(t).not.toMatch(/234 5678/);
    expect(t).not.toMatch(/1\.020\.304\.050/);
    expect(t).not.toMatch(/Calle 12 # 34-56/);
    expect(t).toMatch(/\$1\.500\.000/);
    expect(t).toMatch(/2\.000\.000 COP/);
    expect(ocultos).toEqual({ correos: 1, telefonos: 2, documentos: 1, direcciones: 1 });
  });

  it('textoSeguro recorta y devuelve null si no hay texto', () => {
    expect(textoSeguro('')).toBeNull();
    expect(textoSeguro('a'.repeat(700))).toHaveLength(600);
  });
});

describe('guardia', () => {
  it('detecta una cifra de dinero inventada', () => {
    const r = verificarCifras('El total es $185.000 y el envío $12.000.', [185000]);
    expect(r.ok).toBe(false);
    expect(r.inventadas.map((c) => c.valor)).toEqual([12000]);
  });

  it('"20 kg", "8 horas" y "15 días" no disparan', () => {
    expect(extraerCifras('20 kg en 8 horas, 15 días y 50 %')).toEqual([]);
  });

  it('lee "US$ 2.250,00" como una sola cifra', () => {
    expect(extraerCifras('US$ 2.250,00').map((c) => c.valor)).toEqual([2250]);
  });

  it('cifrasDe junta números y montos formateados de los datos', () => {
    const permitidas = cifrasDe({ total: { valor: 185000, texto: '$185.000' }, filas: [{ precio: 42000 }] });
    expect(permitidas).toEqual(expect.arrayContaining([185000, 42000]));
  });
});
