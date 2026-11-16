// Guardia de cifras: toda cantidad de dinero que el asistente escriba en su
// respuesta tiene que salir de una herramienta. Las que no, se marcan para
// revisión (el modelo no hace cuentas de dinero; ver prompt.js).
//
// Solo se miran cantidades MARCADAS como dinero ($, US$, COP, USD, "millones",
// "mil"): "20 kg", "8 horas", "50 %" o "15 días" no son precio y no deben
// disparar la guardia. Se aceptan las dos convenciones de separadores
// (es: 1.500.000 y 1,5 millones; en: 1,500 y 1.5k).
//
// Copia de la guardia de la skill `chat-ia` (ya corrige el caso
// "US$ 2.250,00"). Módulo puro.

const MULTIPLICADOR = {
  millones: 1e6,
  millón: 1e6,
  millon: 1e6,
  m: 1e6,
  mil: 1e3,
  k: 1e3,
};

// $ o US$ delante, o COP/USD/millones/mil/M/k detrás (al menos una marca).
const PATRON =
  /(US\$|COP\s?\$|\$)?\s?(\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?|\d+(?:[.,]\d{1,2})?)(?:\s?(millones|millón|millon|mil|M|k)\b)?(?:\s?(COP|USD|pesos|dólares|dolares))?/gi;

/** Lee un número con separadores de miles o un decimal corto. Devuelve [valor, decimales]. */
function leerNumero(crudo) {
  // "2.250,00" (miles con punto y centavos con coma).
  const conCentavos = /^(\d{1,3}(?:\.\d{3})+),(\d{2})$/.exec(crudo);
  if (conCentavos) return [Number(`${conCentavos[1].replace(/\./g, '')}.${conCentavos[2]}`), 2];
  if (/^\d{1,3}([.,]\d{3})+$/.test(crudo)) return [Number(crudo.replace(/[.,]/g, '')), 0];
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(crudo);
  if (!m) return [NaN, 0];
  const dec = m[2] ?? '';
  return [Number(`${m[1]}.${dec || '0'}`), dec.length];
}

/** @returns {{ texto: string, valor: number, tolerancia: number }[]} */
export function extraerCifras(texto) {
  const out = [];
  for (const m of String(texto ?? '').matchAll(PATRON)) {
    const [entero, prefijo, numero, mult, sufijo] = m;
    if (!prefijo && !mult && !sufijo) continue;
    // "mil" y "M" sueltos sin moneda son ambiguos ("2 mil personas"): solo
    // cuentan si además hay una marca de dinero.
    if (!prefijo && !sufijo && mult && !/^millon|^millón/i.test(mult)) continue;
    const [base, decimales] = leerNumero(numero);
    if (!Number.isFinite(base)) continue;
    const factor = mult ? MULTIPLICADOR[mult.toLowerCase()] ?? 1 : 1;
    const valor = Math.round(base * factor);
    // La precisión escrita da el margen ("4,8 millones" cubre ±50.000), pero
    // nunca más del 3 %.
    const tolerancia = mult ? Math.min(factor / 10 ** decimales / 2, valor * 0.03) : 0.5;
    out.push({ texto: entero.trim(), valor, tolerancia });
  }
  return out;
}

/** Compara las cifras de dinero del texto con las que trajeron las herramientas. */
export function verificarCifras(texto, permitidas) {
  const inventadas = extraerCifras(texto).filter(
    (c) => !permitidas.some((p) => Math.abs(p - c.valor) <= c.tolerancia),
  );
  return { ok: inventadas.length === 0, inventadas };
}

/**
 * Recorre los datos devueltos por las herramientas y junta todo número que
 * pueda ser dinero: los `valor` de los montos formateados y cualquier número
 * suelto (un total, un precio). Es generoso a propósito: la guardia busca
 * cifras que NO salieron de ningún lado.
 */
export function cifrasDe(datos, acumulado = []) {
  if (datos == null) return acumulado;
  if (typeof datos === 'number' && Number.isFinite(datos)) acumulado.push(Math.round(datos));
  else if (typeof datos === 'string') {
    for (const c of extraerCifras(datos)) acumulado.push(c.valor);
  } else if (Array.isArray(datos)) for (const d of datos) cifrasDe(d, acumulado);
  else if (typeof datos === 'object') for (const v of Object.values(datos)) cifrasDe(v, acumulado);
  return acumulado;
}
