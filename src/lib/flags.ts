/**
 * Interruptores de lo que el sitio muestra al público.
 *
 * SHOW_CUPPING: notas de cata, perfil de taza (acidez, cuerpo, balance) y
 * puntaje SCA. La operación los sigue registrando (catación, empaque), pero
 * por ahora no se muestran en tienda, fichas de producto, trazabilidad ni
 * etiquetas impresas. Para volver a mostrarlos basta con ponerlo en true
 * (y el mismo cambio en public/assets/js/trazabilidad.js y en-traceability.js,
 * que no pasan por el bundler).
 */
export const SHOW_CUPPING = false;
