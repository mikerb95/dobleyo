// Modelo SIMULADO para las pruebas automáticas y Playwright: respuestas fijas
// según la última pregunta, sin red y sin costo. Solo se usa con
// ASISTENTE_MODELO_FALSO=1 y fuera de producción (motor.js lo verifica y una
// prueba comprueba que en producción se ignora).

import { MODELO } from './costo.js';

const USO = { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
let contador = 0;

const texto = (t) => ({ id: `msg_falso_${++contador}`, model: MODELO, role: 'assistant', stop_reason: 'end_turn', usage: USO, content: [{ type: 'text', text: t }] });
const herramienta = (name, input) => ({
  id: `msg_falso_${++contador}`,
  model: MODELO,
  role: 'assistant',
  stop_reason: 'tool_use',
  usage: USO,
  content: [{ type: 'text', text: 'Reviso.' }, { type: 'tool_use', id: `toolu_falso_${contador}`, name, input }],
});

const leer = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/** Responde a la conversación como lo haría el modelo, con un guion fijo. */
export async function modeloFalso(mensajes) {
  const ultimo = mensajes.at(-1);

  // Vuelve el resultado de una herramienta: se resume.
  if (Array.isArray(ultimo?.content) && ultimo.content.some((b) => b.type === 'tool_result')) {
    const r = ultimo.content.find((b) => b.type === 'tool_result');
    if (r.is_error) {
      if (String(r.content).startsWith('La persona no aprobó')) return texto('Entendido, no hice el cambio. ¿Qué quiere ajustar?');
      return texto(`No pude hacerlo: ${r.content}`);
    }
    const datos = leer(r.content) ?? {};
    if (datos.hecho) return texto(`Listo. ${datos.resumen} [Ver](${datos.enlace})`);
    if (Array.isArray(datos.pedidos)) {
      const lista = datos.pedidos.map((p) => `- **${p.referencia}**: ${p.estado}, ${p.total.texto}`).join('\n');
      return texto(`Hay ${datos.cantidad} pedido(s) por ${datos.total.texto}.\n\n${lista}\n\n[Ver pedidos](/admin/pedidos)`);
    }
    if (Array.isArray(datos.lotes) && Array.isArray(datos.fincas)) {
      return texto(`Tiene ${datos.lotes.length} lote(s) en ${datos.fincas.map((f) => f.nombre).join(', ')}.`);
    }
    return texto('Ya consulté la información.');
  }

  const pregunta = typeof ultimo?.content === 'string' ? ultimo.content : '';
  const ref = pregunta.match(/DY-\d+/i)?.[0]?.toUpperCase();
  if (ref && /entregad/i.test(pregunta)) return herramienta('cambiar_estado_pedido', { referencia: ref, estado: 'delivered' });
  if (ref && /prepara/i.test(pregunta)) return herramienta('cambiar_estado_pedido', { referencia: ref, estado: 'processing' });
  if (/pedido/i.test(pregunta)) return herramienta('consultar_pedidos', { limite: 5 });
  if (/finca|verde/i.test(pregunta)) return herramienta('mi_finca', {});
  return texto('Puedo consultar pedidos, producción e inventario. ¿Qué necesita?');
}
