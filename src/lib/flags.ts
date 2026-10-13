/**
 * Interruptores de lo que el sitio muestra al público.
 *
 * SHOW_CUPPING: notas de cata, perfil de taza (acidez, cuerpo, balance) y
 * puntaje SCA. La operación los sigue registrando (catación, empaque), pero
 * por ahora no se muestran en tienda, fichas de producto, trazabilidad ni
 * etiquetas impresas. Para volver a mostrarlos basta con ponerlo en true
 * (y el mismo cambio en public/assets/js/trazabilidad.js y en-traceability.js,
 * que no pasan por el bundler).
 *
 * SHOW_TRACEABILITY: consulta pública de lotes (/trazabilidad, /traceability,
 * /t/[code]), los enlaces que llevan a ella y el QR de la portada. Apagado,
 * esas rutas redirigen a la tienda y el sitio no promete rastrear el café.
 * La operación sigue registrando la historia de cada lote en el admin. Al
 * volver a ponerlo en true, revisar también el copy de marketing, que se
 * reescribió sin la palabra "trazabilidad" mientras estuvo apagado.
 */
export const SHOW_CUPPING = false;
export const SHOW_TRACEABILITY = false;
