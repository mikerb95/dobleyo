// Buscador del panel SIN IA: pantallas del menú y fichas (pedidos, productos,
// lotes, cuentas del CRM). Sirve aunque falte la clave de la API o se haya
// alcanzado el tope del día, y es también la herramienta `buscar_en_panel`
// del asistente.
//
// Las pantallas y sus roles espejan el menú de src/layouts/AdminLayout.astro
// (atributo data-roles). Si se agrega una pantalla allá, se agrega aquí.

import { filas, ESTADO_PEDIDO } from './herramientas/comun.js';

export const PANTALLAS = [
  { titulo: 'Resumen', enlace: '/admin', roles: ['admin', 'caficultor'], claves: 'inicio dashboard tablero' },
  { titulo: 'Pedidos', enlace: '/admin/pedidos', roles: ['admin'], claves: 'ordenes compras tienda clientes pagos' },
  { titulo: 'Envíos', enlace: '/admin/envios', roles: ['admin'], claves: 'guias transportadora despacho rastreo envia interrapidisimo' },
  { titulo: 'CRM', enlace: '/admin/crm', roles: ['admin'], claves: 'mayoristas cuentas clientes b2b embudo prospectos' },
  { titulo: 'Boletín', enlace: '/admin/boletin', roles: ['admin'], claves: 'newsletter correos campañas suscriptores' },
  { titulo: 'Qué sigue (producción)', enlace: '/admin/produccion', roles: ['admin', 'caficultor'], claves: 'tareas pendientes lotes produccion bandeja' },
  { titulo: 'Mi finca', enlace: '/admin/mi-finca', roles: ['caficultor'], claves: 'finca perfil historia ubicacion' },
  { titulo: 'Catación', enlace: '/admin/cupping', roles: ['admin'], claves: 'cupping sca puntaje calidad' },
  { titulo: 'Etiquetas', enlace: '/admin/etiquetas', roles: ['admin'], claves: 'qr etiquetas empaque imprimir' },
  { titulo: 'Lotes entregados', enlace: '/admin/lotes-entregados', roles: ['caficultor'], claves: 'entregas venta cafe verde' },
  { titulo: 'Cosechas', enlace: '/admin/harvest', roles: ['admin', 'caficultor'], claves: 'cosecha registrar lote nuevo recoleccion' },
  { titulo: 'Almacén verde', enlace: '/admin/inventory-storage', roles: ['admin', 'caficultor'], claves: 'cafe verde bodega almacenamiento' },
  { titulo: 'Envíos a maquila', enlace: '/admin/send-roasting', roles: ['admin', 'caficultor'], claves: 'tostion maquila enviar tostar' },
  { titulo: 'Recepción de tostado', enlace: '/admin/roast-retrieval', roles: ['admin'], claves: 'recibir tostado tostion merma' },
  { titulo: 'Almacén tostado', enlace: '/admin/roasted-storage', roles: ['admin'], claves: 'cafe tostado bodega' },
  { titulo: 'Empaques', enlace: '/admin/packaging', roles: ['admin'], claves: 'empacar bolsas paquetes empaque' },
  { titulo: 'Productos', enlace: '/admin/productos', roles: ['admin'], claves: 'catalogo precios variantes descripcion' },
  { titulo: 'Inventario', enlace: '/admin/inventario', roles: ['admin'], claves: 'stock existencias movimientos ajuste' },
  { titulo: 'Lotes', enlace: '/admin/lotes', roles: ['admin'], claves: 'lotes trazabilidad' },
  { titulo: 'Ubicaciones', enlace: '/admin/ubicaciones', roles: ['admin'], claves: 'bodegas estantes ubicaciones' },
  { titulo: 'Conteo cíclico', enlace: '/admin/conteos', roles: ['admin'], claves: 'conteo inventario fisico' },
  { titulo: 'Blog', enlace: '/admin/blog', roles: ['admin'], claves: 'articulos publicaciones' },
  { titulo: 'MercadoLibre', enlace: '/admin/mercadolibre', roles: ['admin'], claves: 'ml publicaciones sincronizar mercado libre' },
  { titulo: 'Ventas', enlace: '/admin/ventas', roles: ['admin'], claves: 'ventas ingresos kpi reportes' },
  { titulo: 'Mapa de ventas', enlace: '/admin/sales-map', roles: ['admin'], claves: 'mapa calor ciudades' },
  { titulo: 'Finanzas', enlace: '/admin/finanzas', roles: ['admin'], claves: 'contabilidad facturas gastos balance' },
  { titulo: 'Costeo', enlace: '/admin/costos', roles: ['admin'], claves: 'costos margen costo por kilo' },
  { titulo: 'Precio FNC', enlace: '/admin/precio-fnc', roles: ['admin'], claves: 'federacion precio carga cafe' },
  { titulo: 'Estadísticas', enlace: '/admin/estadisticas', roles: ['admin'], claves: 'estadisticas graficas' },
  { titulo: 'Demanda', enlace: '/admin/demanda', roles: ['admin'], claves: 'pronostico demanda forecast' },
  { titulo: 'Auditoría', enlace: '/admin/auditoria', roles: ['admin'], claves: 'registro cambios logs quien' },
  { titulo: 'Usuarios', enlace: '/admin/usuarios', roles: ['admin'], claves: 'usuarios roles caficultores cuentas' },
  { titulo: 'Sistema', enlace: '/admin/sistema', roles: ['admin'], claves: 'sistema errores configuracion' },
  { titulo: 'Presupuesto', enlace: '/admin/presupuesto', roles: ['admin'], claves: 'presupuesto' },
];

/** Minúsculas y sin tildes, para comparar. */
export const normalizar = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

function pantallasDe(texto, rol) {
  const palabras = normalizar(texto).split(/\s+/).filter((p) => p.length >= 3);
  if (!palabras.length) return [];
  return PANTALLAS.filter((p) => p.roles.includes(rol))
    .map((p) => {
      const heno = normalizar(`${p.titulo} ${p.claves}`);
      const puntos = palabras.filter((w) => heno.includes(w)).length;
      return { p, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 5)
    .map(({ p }) => ({ tipo: 'pantalla', titulo: p.titulo, enlace: p.enlace }));
}

/**
 * @param {string} texto
 * @param {{ id: number, rol: string }} usuario
 * @returns {Promise<{ tipo: string, titulo: string, detalle?: string, enlace: string }[]>}
 */
export async function buscarEnPanel(texto, usuario) {
  const t = String(texto ?? '').trim().slice(0, 80);
  if (t.length < 2) return [];
  const resultados = pantallasDe(t, usuario.rol);
  const like = `%${t}%`;

  if (usuario.rol === 'admin') {
    const [pedidos, productos, lotes, cuentas] = await Promise.all([
      filas(
        `SELECT reference, status, customer_name FROM customer_orders
          WHERE reference LIKE ? OR customer_name LIKE ? ORDER BY created_at DESC LIMIT 5`,
        [like, like],
      ),
      filas('SELECT id, name, price FROM products WHERE name LIKE ? OR id LIKE ? ORDER BY name LIMIT 5', [like, like]),
      filas('SELECT lot_id, farm, variety FROM coffee_harvests WHERE lot_id LIKE ? OR farm LIKE ? ORDER BY created_at DESC LIMIT 5', [like, like]),
      filas(
        `SELECT id, display_name, legal_name, pipeline_stage FROM crm_accounts
          WHERE display_name LIKE ? OR legal_name LIKE ? ORDER BY updated_at DESC LIMIT 5`,
        [like, like],
      ),
    ]);
    for (const p of pedidos) {
      resultados.push({ tipo: 'pedido', titulo: `Pedido ${p.reference}`, detalle: `${p.customer_name ?? ''} · ${ESTADO_PEDIDO[p.status] ?? p.status}`, enlace: '/admin/pedidos' });
    }
    for (const p of productos) resultados.push({ tipo: 'producto', titulo: p.name, detalle: String(p.id), enlace: '/admin/productos' });
    for (const l of lotes) {
      resultados.push({ tipo: 'lote', titulo: `Lote ${l.lot_id}`, detalle: `${l.farm} · ${l.variety}`, enlace: `/admin/produccion?lote=${encodeURIComponent(l.lot_id)}` });
    }
    for (const c of cuentas) {
      resultados.push({ tipo: 'cuenta', titulo: c.display_name || c.legal_name, detalle: `CRM · ${c.pipeline_stage}`, enlace: '/admin/crm' });
    }
  } else if (usuario.rol === 'caficultor') {
    const lotes = await filas(
      `SELECT ch.lot_id, ch.farm, ch.variety FROM coffee_harvests ch
         JOIN farms f ON f.slug = ch.farm
        WHERE f.caficultor_id = ? AND (ch.lot_id LIKE ? OR ch.variety LIKE ?)
        ORDER BY ch.created_at DESC LIMIT 5`,
      [usuario.id, like, like],
    );
    for (const l of lotes) {
      resultados.push({ tipo: 'lote', titulo: `Lote ${l.lot_id}`, detalle: `${l.farm} · ${l.variety}`, enlace: `/admin/produccion?lote=${encodeURIComponent(l.lot_id)}` });
    }
  }
  return resultados.slice(0, 12);
}
