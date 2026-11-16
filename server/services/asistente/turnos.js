// Reconstruye una conversación para pintarla en el panel a partir del
// historial que se guarda para la API (solo por anexión). Así no hace falta
// una segunda copia "para la pantalla" que pueda desalinearse.
//
// Un turno empieza con cada pregunta: un mensaje de usuario de texto, o el
// rechazo de una propuesta con indicaciones ("cámbiele la fecha"), que viaja
// como tool_result y lleva el prefijo PREFIJO_CAMBIOS.
//
// Módulo puro.

export const PREFIJO_CAMBIOS = 'La persona no aprobó la propuesta y pidió cambios: ';

/** Lo que recibe el modelo cuando no se aprueba. Con indicación, `turnosDe` la recupera para pintarla. */
export function textoRechazo(comentario) {
  return comentario
    ? `${PREFIJO_CAMBIOS}"${comentario}". Ajuste la propuesta según su indicación y vuelva a proponer si corresponde.`
    : 'La persona no aprobó la propuesta. No la repita igual: pregúntele qué quiere cambiar.';
}

function indicacion(bloques) {
  for (const b of bloques) {
    if (b.type !== 'tool_result' || !b.is_error || typeof b.content !== 'string') continue;
    if (!b.content.startsWith(PREFIJO_CAMBIOS)) continue;
    const resto = b.content.slice(PREFIJO_CAMBIOS.length);
    const m = resto.match(/^"([\s\S]*)"\./);
    return m ? m[1] : resto;
  }
  return null;
}

/**
 * @returns {{ pregunta: string, respuesta: string, pasos: string[] }[]}
 */
export function turnosDe(mensajes) {
  const turnos = [];
  let actual = null;
  const abrir = (pregunta) => {
    actual = { pregunta, respuesta: '', pasos: [] };
    turnos.push(actual);
  };

  for (const m of mensajes ?? []) {
    if (m.role === 'user') {
      if (typeof m.content === 'string') abrir(m.content);
      else {
        const texto = m.content.find((b) => b.type === 'text' && b.text)?.text;
        const cambio = indicacion(m.content);
        if (texto && !m.content.some((b) => b.type === 'tool_result')) abrir(texto);
        else if (cambio) abrir(cambio);
      }
      continue;
    }
    if (!actual || typeof m.content === 'string') continue;
    for (const b of m.content) {
      if (b.type === 'text' && b.text?.trim()) {
        actual.respuesta = actual.respuesta ? `${actual.respuesta}\n\n${b.text.trim()}` : b.text.trim();
      }
      if (b.type === 'tool_use' && b.name && !actual.pasos.includes(b.name)) actual.pasos.push(b.name);
    }
  }
  return turnos;
}

/** Preguntas en la conversación. */
export const contarTurnos = (mensajes) => turnosDe(mensajes).length;
