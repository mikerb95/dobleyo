// Tarjeta común de las escrituras del asistente: lo que la persona ve para
// aprobar o descartar. La arma SIEMPRE el servidor leyendo la base, nunca el
// modelo: se aprueba lo que dice la base, no lo que el modelo cree.
//
// Contrato de una escritura (docs/plan-asistente.md):
//   preparar(entrada, ctx)  -> lee la base y arma la tarjeta. NO escribe.
//   ejecutar(entrada, ctx)  -> solo tras "Aprobar". Vuelve a preparar (la base
//                              pudo cambiar) y entonces escribe. Nunca lanza.
// `ctx` = { usuario: { id, nombre, rol }, claveIdempotencia?, opciones? }.
// `opciones` son las casillas de la tarjeta (p. ej. "Avisar al cliente").

/** Texto para mostrar un valor en la tabla de antes y después. */
export const mostrar = (v) => (v == null || v === '' ? null : String(v));

/**
 * @param {object} p
 * @param {string} p.rotulo          "Pedido", "Producto", "Lote"
 * @param {string} p.titulo          el nombre de la cosa
 * @param {string|null} [p.contexto] una línea: cliente, finca, presentación
 * @param {{ campo: string, antes: unknown, despues: unknown }[]} p.cambios
 * @param {string[]} [p.avisos]      lo que pasa FUERA del panel al aprobar
 * @param {{ id: string, etiqueta: string, valor: boolean }[]} [p.opciones]
 * @param {string} [p.boton]
 * @param {string} [p.nota]
 */
export function vistaCambio({ rotulo, titulo, contexto = null, cambios, avisos = [], opciones = [], boton = 'Aprobar y guardar', nota }) {
  return {
    tipo: 'cambio',
    rotulo,
    titulo,
    contexto,
    cambios: cambios
      .map((c) => ({ campo: c.campo, antes: mostrar(c.antes), despues: mostrar(c.despues) }))
      .filter((c) => c.antes !== c.despues),
    avisos,
    opciones,
    boton,
    nota: nota ?? 'Nada se guarda hasta que usted apruebe. Si quiere cambiar algo, escríbalo en la caja.',
  };
}

/** Propuesta lista para la tarjeta. */
export const propuesta = (origen, motivo, vista) => ({ ok: true, origen, motivo, vista });

/** Resultado de una escritura hecha. */
export const hecho = (resumen, enlace, extra = {}) => ({ ok: true, datos: { hecho: true, resumen, enlace, ...extra } });

export const noSe = (error) => ({ ok: false, error });

/** Usuario en la forma que esperan los servicios del servidor ({ id, role }). */
export const usuarioServicio = (ctx) => ({ id: ctx.usuario.id, role: ctx.usuario.rol, name: ctx.usuario.nombre });

/** Valor de una casilla de la tarjeta, con su valor por defecto. */
export function opcion(ctx, vista, id) {
  const declarada = vista?.opciones?.find((o) => o.id === id);
  if (!declarada) return false;
  const elegida = ctx.opciones?.[id];
  return typeof elegida === 'boolean' ? elegida : declarada.valor;
}
