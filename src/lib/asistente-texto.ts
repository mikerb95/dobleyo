// Piezas puras de la caja del asistente del panel: convierten la respuesta del
// modelo en bloques que el cliente pinta con nodos y textContent (nunca
// innerHTML: el modelo leyó texto de clientes y podría devolver HTML).
//
// Solo entiende lo que pide el prompt: párrafos, listas con "- ", **negrita**
// y enlaces [texto](/admin/...). Un enlace que no sea una ruta relativa del
// panel se muestra como texto.

/** Ruta relativa del sitio, sin protocolo ni dominio (nada de javascript: ni //otro.com). */
export function rutaSegura(href: string): boolean {
  return /^\/(?!\/)[\w\-./?=&#%]*$/.test(href);
}

export type Parte =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrita'; texto: string }
  | { tipo: 'enlace'; texto: string; href: string };

export type Bloque = { tipo: 'parrafo'; partes: Parte[] } | { tipo: 'lista'; items: Parte[][] };

const EN_LINEA = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Negrita y enlaces dentro de una línea. */
export function partesDe(linea: string): Parte[] {
  const partes: Parte[] = [];
  let ultimo = 0;
  for (const m of linea.matchAll(EN_LINEA)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push({ tipo: 'texto', texto: linea.slice(ultimo, i) });
    if (m[1] !== undefined) partes.push({ tipo: 'negrita', texto: m[1] });
    else if (m[2] !== undefined && m[3] !== undefined) {
      partes.push(rutaSegura(m[3]) ? { tipo: 'enlace', texto: m[2], href: m[3] } : { tipo: 'texto', texto: m[2] });
    }
    ultimo = i + m[0].length;
  }
  if (ultimo < linea.length) partes.push({ tipo: 'texto', texto: linea.slice(ultimo) });
  return partes;
}

/** Párrafos y listas. Las líneas seguidas sin "- " forman un párrafo. */
export function bloquesDe(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: Parte[][] | null = null;
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: 'parrafo', partes: partesDe(parrafo.join(' ')) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista?.length) bloques.push({ tipo: 'lista', items: lista });
    lista = null;
  };
  for (const cruda of String(texto ?? '').split('\n')) {
    const linea = cruda.trim();
    if (!linea) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    const item = /^[-*•]\s+(.*)$/.exec(linea);
    if (item) {
      cerrarParrafo();
      lista ??= [];
      lista.push(partesDe(item[1]!));
    } else {
      cerrarLista();
      parrafo.push(linea.replace(/^#+\s*/, ''));
    }
  }
  cerrarParrafo();
  cerrarLista();
  return bloques;
}

/** Lo que se muestra mientras el asistente consulta (nunca el nombre técnico). */
export const ETIQUETA_PASO: Record<string, string> = {
  buscar_en_panel: 'Buscando en el panel',
  pendientes_del_dia: 'Revisando lo pendiente de hoy',
  consultar_pedidos: 'Revisando los pedidos',
  consultar_envios: 'Revisando los envíos',
  consultar_crm: 'Revisando el CRM',
  consultar_suscripciones: 'Revisando las suscripciones',
  consultar_produccion: 'Revisando producción',
  mi_finca: 'Revisando su finca',
  consultar_inventario: 'Revisando el inventario',
  consultar_productos: 'Revisando los productos',
  consultar_ventas: 'Revisando las ventas',
  consultar_costos: 'Revisando el costeo',
  consultar_finanzas: 'Revisando las finanzas',
};

export const etiquetaPaso = (herramienta: string): string => ETIQUETA_PASO[herramienta] ?? 'Consultando';

const USD = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Dólares con coma decimal: "US$ 0,42". */
export const usd = (n: number): string => `US$ ${USD.format(Number(n) || 0)}`;
