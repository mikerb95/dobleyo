// Qué herramientas ve cada rol, y la validación de cada llamada.
//
// El rol manda dos veces: el modelo solo recibe las herramientas del rol de
// quien pregunta (definiciones), y el servidor lo vuelve a comprobar al
// validar, al ejecutar y al aprobar (validarLlamada). Quitar una herramienta
// del prompt no es seguridad; este chequeo sí.

import { z } from 'zod';
import { HERRAMIENTAS } from './herramientas/index.js';
import { ESCRITURAS } from './escrituras/index.js';

/** Roles del panel que pueden usar el asistente (los de data-roles="admin,caficultor"). */
export const ROLES_ASISTENTE = ['admin', 'caficultor'];

export const ETIQUETA_ROL = { admin: 'administrador', caficultor: 'caficultor' };

export const herramientasDe = (rol) => HERRAMIENTAS.filter((h) => h.roles.includes(rol));
export const escriturasDe = (rol) => ESCRITURAS.filter((e) => e.roles.includes(rol));
export const lecturaPorNombre = (nombre) => HERRAMIENTAS.find((h) => h.nombre === nombre) ?? null;
export const escrituraPorNombre = (nombre) => ESCRITURAS.find((e) => e.nombre === nombre) ?? null;
export const esEscritura = (nombre) => !!escrituraPorNombre(nombre);

export const puede = (rol, nombre) =>
  [...herramientasDe(rol), ...escriturasDe(rol)].some((h) => h.nombre === nombre);

/**
 * Valida permiso y entrada de una llamada del modelo.
 * @returns {{ ok: true, entrada: object } | { ok: false, error: string }}
 */
export function validarLlamada(rol, nombre, entrada) {
  const h = lecturaPorNombre(nombre) ?? escrituraPorNombre(nombre);
  if (!h) return { ok: false, error: `No existe la herramienta ${nombre}.` };
  if (!puede(rol, nombre)) return { ok: false, error: 'Sin permiso para esa herramienta con el rol de esta persona.' };
  const r = h.esquema.safeParse(entrada ?? {});
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ');
    return { ok: false, error: `Entrada inválida para ${nombre}: ${detalle}` };
  }
  return { ok: true, entrada: r.data };
}

function esquemaJson(esquema) {
  const { $schema: _omitido, ...resto } = z.toJSONSchema(esquema);
  return resto;
}

/**
 * Definiciones para la API, en orden fijo (la caché depende de que no cambie).
 * `cache_control` va en la última: así se cachean herramientas + system.
 */
export function definiciones(rol) {
  const lista = [...herramientasDe(rol), ...escriturasDe(rol)].map((h) => ({
    name: h.nombre,
    description: h.descripcion,
    input_schema: esquemaJson(h.esquema),
  }));
  if (lista.length) lista[lista.length - 1] = { ...lista.at(-1), cache_control: { type: 'ephemeral' } };
  return lista;
}

/** Una línea por escritura del rol, para el prompt. */
export const accionesDe = (rol) => escriturasDe(rol).map((e) => `${e.nombre}: ${e.descripcion.split('. No se ejecuta sola')[0]}.`);
