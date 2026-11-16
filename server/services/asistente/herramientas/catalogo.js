// Herramientas de lectura del catálogo: productos (precio, variantes, stock,
// vínculo con MercadoLibre) e inventario (disponible, café verde y tostado en
// bodega, insumos de empaque). Solo admin.
//
// El disponible se calcula igual que en server/routes/stock.js: un producto
// con variantes activas vende por variante; sin variantes es stock_quantity -
// stock_reserved. Así el asistente y la tienda dicen lo mismo.

import { z } from 'zod';
import { ok, dinero, filas, kg, seguro, deTercero } from './comun.js';

const DISPONIBLE = `
  CASE
    WHEN p.is_active = 0 THEN 0
    WHEN EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
      THEN COALESCE((SELECT SUM(v.stock_quantity) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1), 0)
    ELSE MAX(p.stock_quantity - p.stock_reserved, 0)
  END`;

export const consultarProductos = {
  nombre: 'consultar_productos',
  descripcion:
    'Productos del catálogo con precio, variantes (tamaño y molienda, cada una con su id, precio y stock), disponible y si ' +
    'están vinculados a MercadoLibre. Úsela para "¿qué precio tiene el Huila de 500 g?" y antes de proponer un cambio de ' +
    'precio, textos o stock (da los ids).',
  esquema: z.object({
    buscar: z.string().max(60).optional().describe('Nombre o id del producto, o parte de él.'),
    categoria: z.string().max(30).optional().describe('Categoría, por ejemplo cafe, accesorios o cacao.'),
    incluir_inactivos: z.boolean().optional().describe('Incluir productos retirados de la tienda.'),
    limite: z.number().int().min(1).max(30).optional(),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_productos', async (a) => {
    const where = [];
    const args = [];
    if (!a.incluir_inactivos) where.push('p.is_active = 1');
    if (a.buscar) { where.push('(p.name LIKE ? OR p.id LIKE ? OR p.slug LIKE ?)'); args.push(`%${a.buscar}%`, `%${a.buscar}%`, `%${a.buscar}%`); }
    if (a.categoria) { where.push('p.category = ?'); args.push(a.categoria); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const productos = await filas(
      `SELECT p.id, p.name, p.category, p.origin, p.process, p.roast, p.price, p.is_active, p.stock_min,
              p.description, ${DISPONIBLE} AS disponible,
              (SELECT COUNT(*) FROM ml_listings l WHERE l.product_id = p.id AND l.is_active = 1) AS publicaciones_ml
         FROM products p ${w} ORDER BY p.name LIMIT ?`,
      [...args, a.limite ?? 15],
    );
    const ids = productos.map((p) => p.id);
    const variantes = ids.length
      ? await filas(
          `SELECT id, product_id, size_label, grind_label, price_cop, stock_quantity, is_active
             FROM product_variants WHERE product_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, id`,
          ids,
        )
      : [];
    return ok({
      mostrados: productos.length,
      productos: productos.map((p) => ({
        id: p.id,
        nombre: p.name,
        categoria: p.category,
        origen: p.origin,
        proceso: p.process,
        tueste: p.roast,
        precio: dinero(p.price),
        activo: Number(p.is_active) === 1,
        disponible: Number(p.disponible) || 0,
        stock_minimo: p.stock_min != null ? Number(p.stock_min) : null,
        vinculado_mercadolibre: Number(p.publicaciones_ml) > 0,
        descripcion: deTercero(p.description, 300),
        variantes: variantes
          .filter((v) => v.product_id === p.id)
          .map((v) => ({
            id_variante: Number(v.id),
            presentacion: [v.size_label, v.grind_label].filter(Boolean).join(' · '),
            precio: dinero(v.price_cop),
            stock: Number(v.stock_quantity) || 0,
            activa: Number(v.is_active) === 1,
          })),
        enlace: '/admin/productos',
      })),
    });
  }),
};

export const consultarInventario = {
  nombre: 'consultar_inventario',
  descripcion:
    'Inventario: productos agotados o por debajo del mínimo, café verde y tostado en bodega por lote, e insumos de empaque ' +
    '(bolsas, etiquetas) con poco stock. Úsela para "¿qué se está agotando?" o "¿cuánto café verde hay en bodega?".',
  esquema: z.object({
    seccion: z.enum(['todo', 'productos', 'cafe', 'insumos']).optional().describe('Qué parte del inventario (por defecto todo).'),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_inventario', async (a) => {
    const s = a.seccion ?? 'todo';
    const datos = {};
    if (s === 'todo' || s === 'productos') {
      const bajos = await filas(
        `SELECT p.id, p.name, p.stock_min, ${DISPONIBLE} AS disponible FROM products p
          WHERE p.is_active = 1 AND ${DISPONIBLE} <= COALESCE(p.stock_min, 0) + 2
          ORDER BY disponible ASC LIMIT 20`,
      );
      datos.productos_bajos = bajos.map((p) => ({
        id: p.id,
        producto: p.name,
        disponible: Number(p.disponible) || 0,
        stock_minimo: p.stock_min != null ? Number(p.stock_min) : 0,
        enlace: '/admin/inventario',
      }));
    }
    if (s === 'todo' || s === 'cafe') {
      const quants = await filas(
        `SELECT q.lot_id, q.stock_state, SUM(q.qty_kg) AS kilos FROM storage_quants q
          WHERE q.qty_kg > 0 GROUP BY q.lot_id, q.stock_state ORDER BY q.stock_state, kilos DESC LIMIT 40`,
      );
      const total = (estado) => kg(quants.filter((q) => q.stock_state === estado).reduce((t, q) => t + (Number(q.kilos) || 0), 0));
      datos.cafe_en_bodega = {
        verde_total_kg: total('green'),
        tostado_total_kg: total('roasted'),
        por_lote: quants.map((q) => ({
          lote: q.lot_id,
          estado: q.stock_state === 'green' ? 'verde' : q.stock_state === 'roasted' ? 'tostado' : q.stock_state,
          kilos: kg(q.kilos),
        })),
        enlace: '/admin/ubicaciones',
      };
    }
    if (s === 'todo' || s === 'insumos') {
      const insumos = await filas(
        `SELECT name, type, size_label, stock_units, stock_min FROM packaging_supplies
          WHERE is_active = 1 ORDER BY (stock_units - COALESCE(stock_min, 0)) ASC LIMIT 20`,
      );
      datos.insumos_empaque = insumos.map((i) => ({
        insumo: i.size_label && !String(i.name).includes(i.size_label) ? `${i.name} ${i.size_label}` : i.name,
        tipo: i.type,
        unidades: Number(i.stock_units) || 0,
        minimo: Number(i.stock_min) || 0,
        bajo_minimo: (Number(i.stock_units) || 0) <= (Number(i.stock_min) || 0),
      }));
    }
    return ok(datos);
  }),
};
