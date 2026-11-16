// Costo de una conversación del asistente, calculado con el `usage` que
// devuelve cada respuesta de la API. Sirve para el tope diario y el registro
// de consumo (docs/plan-asistente.md).
//
// Es una ESTIMACIÓN con la tarifa del modelo. La cifra que manda es la de la
// consola de Claude Platform. Tarifas verificadas con la skill `claude-api`
// (tabla de modelos con fecha 2026-11-03).
//
// Módulo puro.

export const MODELO = 'claude-sonnet-5-5';

/** USD por millón de tokens. La escritura de caché cuesta 1,25 veces la entrada. */
export const TARIFAS = {
  'claude-sonnet-5-5': { entrada: 2, salida: 10, cacheLectura: 0.1, cacheEscritura: 2.5 },
  'claude-sonnet-5': { entrada: 2, salida: 10, cacheLectura: 0.2, cacheEscritura: 2.5 },
  'claude-opus-5-5': { entrada: 4, salida: 20, cacheLectura: 0.2, cacheEscritura: 5 },
};

/**
 * Con `fallbacks: 'default'` la API puede responder con otro modelo si el
 * principal declina. Un modelo sin tarifa conocida se cobra con la más cara
 * de la tabla: el tope prefiere sobrestimar a quedarse corto.
 */
const TARIFA_DESCONOCIDA = TARIFAS['claude-opus-5-5'];

export const TARIFA_VIGENTE_DESDE = '2026-11-03';

export const USO_CERO = Object.freeze({ entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 });

export function sumarUso(a, u) {
  return {
    entrada: a.entrada + (u?.input_tokens ?? 0),
    salida: a.salida + (u?.output_tokens ?? 0),
    cacheLectura: a.cacheLectura + (u?.cache_read_input_tokens ?? 0),
    cacheEscritura: a.cacheEscritura + (u?.cache_creation_input_tokens ?? 0),
  };
}

export function tarifaDe(modelo) {
  return TARIFAS[modelo] ?? TARIFA_DESCONOCIDA;
}

export function costoUsd(u, modelo = MODELO) {
  const t = tarifaDe(modelo);
  const m = 1_000_000;
  return (
    (u.entrada * t.entrada) / m +
    (u.salida * t.salida) / m +
    (u.cacheLectura * t.cacheLectura) / m +
    (u.cacheEscritura * t.cacheEscritura) / m
  );
}
