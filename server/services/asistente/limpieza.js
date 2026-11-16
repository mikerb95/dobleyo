// Limpieza de datos personales antes de mandar un texto a la API de Claude
// (docs/plan-asistente.md, "Privacidad": se ocultan todos, Ley 1581).
//
// Las herramientas ya no seleccionan columnas de contacto (correo, teléfono,
// documento, dirección). Esto cubre lo que llega dentro de textos libres: una
// nota del pedido o una interacción del CRM pueden traer el celular o la
// dirección del cliente.
//
// Lo delicado es no comerse los montos: "$1.500.000" también es una cifra con
// puntos. Por eso la cédula y el NIT solo se ocultan junto a su palabra clave,
// el celular solo con la forma de un número colombiano y la dirección solo con
// la nomenclatura de calles.
//
// Módulo puro.

const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Celular (3xx) o fijo nacional (60x), con o sin +57, con espacios o guiones.
const TELEFONO = /(?:\+?57[\s-]?)?(?:3\d{2}|60\d)[\s-]?\d{3}[\s-]?\d{4}\b/g;
// Cédula, NIT o documento: solo con la palabra delante.
const DOCUMENTO = /\b(c\.?\s?c\.?|c[ée]dula|nit|documento|identificaci[óo]n)(\s*(?:n[°ºo.]?|número|#|:)?\s*)\d[\d.\s-]{4,}\d/gi;
// Nomenclatura colombiana: "Calle 12 # 34-56", "Cra. 7 No. 45 - 10 apto 302".
const DIRECCION =
  /\b(?:calle|cll|cl|carrera|cra|cr|kr|avenida|av|diagonal|dg|transversal|tv|autopista|circular)\.?\s*\d+[a-z]?(?:\s*bis)?\s*(?:#|no\.?|n°|nº|número)\s*\d+[a-z]?\s*-?\s*\d*(?:[^\n,;.]{0,25}?(?:apto|apartamento|casa|torre|int|interior|of|oficina)\.?\s*\d+[a-z]?)?/gi;

/**
 * @param {string} texto
 * @returns {{ texto: string, ocultos: { correos: number, telefonos: number, documentos: number, direcciones: number } }}
 */
export function limpiarDatosPersonales(texto) {
  let correos = 0;
  let telefonos = 0;
  let documentos = 0;
  let direcciones = 0;
  const limpio = String(texto ?? '')
    .replace(CORREO, () => (correos++, '[correo oculto]'))
    .replace(DOCUMENTO, (_m, palabra, sep) => (documentos++, `${palabra}${sep}[documento oculto]`))
    .replace(DIRECCION, () => (direcciones++, '[dirección oculta]'))
    .replace(TELEFONO, () => (telefonos++, '[teléfono oculto]'));
  return { texto: limpio, ocultos: { correos, telefonos, documentos, direcciones } };
}

/** Texto escrito por terceros listo para la API: limpio y recortado. */
export function textoSeguro(texto, max = 600) {
  if (texto == null || texto === '') return null;
  const { texto: limpio } = limpiarDatosPersonales(texto);
  const plano = limpio.replace(/\s+/g, ' ').trim();
  return plano.length > max ? `${plano.slice(0, max - 1)}…` : plano;
}
