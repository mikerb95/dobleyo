// Herramientas de lectura: pedidos de la tienda, envíos, suscripciones y lo
// pendiente del día. Solo admin.
//
// Nunca se seleccionan correo, teléfono, documento ni dirección del cliente
// (privacidad, docs/plan-asistente.md). La ciudad sí, porque sirve para
// responder y no identifica a nadie.

import { z } from 'zod';
import {
  ok, dinero, fecha, filas, deTercero, seguro, diasDesde, hoy, desdeUtc, hastaUtc,
  ESTADO_PEDIDO, ESTADO_ENVIO,
} from './comun.js';
import { getWorkQueue } from '../../workflowService.js';

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD');

export const consultarPedidos = {
  nombre: 'consultar_pedidos',
  descripcion:
    'Pedidos de la tienda online por estado, referencia, cliente o fecha, con sus productos y total. ' +
    'Úsela para "¿qué pedidos faltan por despachar?" (estados paid y processing) o "¿cómo va el pedido DY-1234?".',
  esquema: z.object({
    estado: z.enum(Object.keys(ESTADO_PEDIDO)).optional().describe('Filtra por estado del pedido.'),
    referencia: z.string().max(40).optional().describe('Referencia exacta o parcial, por ejemplo DY-1234.'),
    cliente: z.string().max(60).optional().describe('Nombre del cliente o parte de él.'),
    desde: DIA.optional().describe('Fecha inicial (AAAA-MM-DD, hora de Colombia).'),
    hasta: DIA.optional().describe('Fecha final incluida (AAAA-MM-DD).'),
    limite: z.number().int().min(1).max(30).optional().describe('Máximo de pedidos a listar (por defecto 15).'),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_pedidos', async (a) => {
    const where = [];
    const args = [];
    if (a.estado) { where.push('o.status = ?'); args.push(a.estado); }
    if (a.referencia) { where.push('o.reference LIKE ?'); args.push(`%${a.referencia}%`); }
    if (a.cliente) { where.push('o.customer_name LIKE ?'); args.push(`%${a.cliente}%`); }
    if (a.desde) { where.push('o.created_at >= ?'); args.push(desdeUtc(a.desde)); }
    if (a.hasta) { where.push('o.created_at < ?'); args.push(hastaUtc(a.hasta)); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [resumen] = await filas(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(o.total_cop), 0) AS total FROM customer_orders o ${w}`,
      args,
    );
    const pedidos = await filas(
      `SELECT o.id, o.reference, o.status, o.customer_name, o.shipping_city, o.total_cop,
              o.payment_method, o.notes, o.created_at,
              (SELECT s.guide_number FROM shipments s WHERE s.order_id = o.id AND s.status NOT IN ('cancelled','error') LIMIT 1) AS guia
         FROM customer_orders o ${w}
        ORDER BY o.created_at DESC LIMIT ?`,
      [...args, a.limite ?? 15],
    );
    const ids = pedidos.map((p) => p.id);
    const items = ids.length
      ? await filas(
          `SELECT order_id, product_name, quantity FROM customer_order_items WHERE order_id IN (${ids.map(() => '?').join(',')})`,
          ids,
        )
      : [];

    return ok({
      cantidad: Number(resumen?.cantidad ?? 0),
      total: dinero(resumen?.total),
      mostrados: pedidos.length,
      pedidos: pedidos.map((p) => ({
        referencia: p.reference,
        estado: ESTADO_PEDIDO[p.status] ?? p.status,
        estado_codigo: p.status,
        fecha: fecha(p.created_at),
        cliente: p.customer_name,
        ciudad: p.shipping_city,
        total: dinero(p.total_cop),
        pago: p.payment_method,
        guia: p.guia ?? null,
        productos: items.filter((i) => i.order_id === p.id).map((i) => ({ producto: i.product_name, cantidad: Number(i.quantity) })),
        escritoPorTerceros: p.notes ? { nota_del_pedido: deTercero(p.notes, 300) } : undefined,
        enlace: '/admin/pedidos',
      })),
    });
  }),
};

export const consultarEnvios = {
  nombre: 'consultar_envios',
  descripcion:
    'Envíos (guías) de los pedidos: transportadora, número de guía, estado y días sin novedad. ' +
    'Úsela para "¿qué envíos están quietos?" o "¿con qué guía salió el pedido DY-1234?".',
  esquema: z.object({
    estado: z.enum(Object.keys(ESTADO_ENVIO)).optional().describe('Estado del envío.'),
    referencia: z.string().max(40).optional().describe('Referencia del pedido.'),
    sin_novedad_dias: z.number().int().min(1).max(60).optional().describe('Solo envíos en tránsito sin novedad hace al menos estos días.'),
    limite: z.number().int().min(1).max(30).optional(),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_envios', async (a) => {
    const where = [];
    const args = [];
    if (a.estado) { where.push('s.status = ?'); args.push(a.estado); }
    if (a.referencia) { where.push('o.reference LIKE ?'); args.push(`%${a.referencia}%`); }
    if (a.sin_novedad_dias) {
      where.push("s.status IN ('created','pickup_requested','in_transit')");
      where.push("COALESCE(s.tracking_updated_at, s.updated_at, s.created_at) <= datetime('now', ?)");
      args.push(`-${a.sin_novedad_dias} days`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const envios = await filas(
      `SELECT o.reference, o.status AS estado_pedido, s.delivery_company_name, s.guide_number, s.status,
              s.provider, s.error_detail, s.created_at, COALESCE(s.tracking_updated_at, s.updated_at, s.created_at) AS ultima_novedad
         FROM shipments s JOIN customer_orders o ON o.id = s.order_id ${w}
        ORDER BY s.created_at DESC LIMIT ?`,
      [...args, a.limite ?? 15],
    );
    return ok({
      mostrados: envios.length,
      envios: envios.map((s) => ({
        pedido: s.reference,
        estado_pedido: ESTADO_PEDIDO[s.estado_pedido] ?? s.estado_pedido,
        transportadora: s.delivery_company_name,
        guia: s.guide_number,
        estado: ESTADO_ENVIO[s.status] ?? s.status,
        creado: fecha(s.created_at),
        ultima_novedad: fecha(s.ultima_novedad),
        dias_sin_novedad: diasDesde(s.ultima_novedad),
        error: s.error_detail ? deTercero(s.error_detail, 200) : null,
        enlace: '/admin/envios',
      })),
    });
  }),
};

export const consultarSuscripciones = {
  nombre: 'consultar_suscripciones',
  descripcion:
    'Suscripciones de café: cuántas hay por estado, próximos cobros y cobros fallidos. ' +
    'Úsela para "¿cuántas suscripciones activas hay?" o "¿qué cobros fallaron?".',
  esquema: z.object({
    estado: z.string().max(20).optional().describe('Estado de la suscripción, por ejemplo active, paused o cancelled.'),
    con_fallas: z.boolean().optional().describe('Solo las que tienen cobros fallidos.'),
    limite: z.number().int().min(1).max(30).optional(),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_suscripciones', async (a) => {
    const porEstado = await filas(
      'SELECT status, COUNT(*) AS cantidad, COALESCE(SUM(amount_cop), 0) AS monto FROM subscriptions GROUP BY status',
    );
    const where = [];
    const args = [];
    if (a.estado) { where.push('status = ?'); args.push(a.estado); }
    if (a.con_fallas) where.push('failed_attempts > 0');
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const lista = await filas(
      `SELECT reference, customer_name, product_name, variant_size, quantity, frequency_days, amount_cop,
              status, next_billing_date, last_charged_at, failed_attempts
         FROM subscriptions ${w} ORDER BY next_billing_date ASC LIMIT ?`,
      [...args, a.limite ?? 15],
    );
    return ok({
      por_estado: porEstado.map((r) => ({ estado: r.status, cantidad: Number(r.cantidad), monto_por_cobro: dinero(r.monto) })),
      suscripciones: lista.map((s) => ({
        referencia: s.reference,
        cliente: s.customer_name,
        producto: [s.product_name, s.variant_size].filter(Boolean).join(' '),
        cantidad: Number(s.quantity),
        cada_dias: Number(s.frequency_days),
        monto_por_cobro: dinero(s.amount_cop),
        estado: s.status,
        proximo_cobro: fecha(s.next_billing_date),
        ultimo_cobro: fecha(s.last_charged_at),
        cobros_fallidos: Number(s.failed_attempts ?? 0),
      })),
    });
  }),
};

const ETIQUETA_TAREA = {
  store_green: 'Ingresar café verde a bodega',
  send_roasting: 'Enviar a tostión',
  receive_roast: 'Recibir café tostado',
  store_roasted: 'Almacenar café tostado',
  pack: 'Empacar',
  label: 'Etiquetar',
  cup: 'Catar',
};

export const pendientesDelDia = {
  nombre: 'pendientes_del_dia',
  descripcion:
    'Resumen de lo pendiente hoy: pedidos por despachar, envíos quietos, tareas de producción atrasadas, ' +
    'cobros de suscripción y productos agotados. Úsela para "¿qué está pendiente?" o "¿qué hago hoy?".',
  esquema: z.object({}),
  roles: ['admin'],
  ejecutar: seguro('pendientes_del_dia', async (_a, ctx) => {
    const [porDespachar, enviosQuietos, cobrosHoy, agotados] = await Promise.all([
      filas(
        `SELECT o.reference, o.status, o.customer_name, o.created_at, o.total_cop FROM customer_orders o
          WHERE o.status IN ('paid','processing')
            AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id AND s.status NOT IN ('cancelled','error'))
          ORDER BY o.created_at ASC LIMIT 10`,
      ),
      filas(
        `SELECT COUNT(*) AS n FROM shipments
          WHERE status IN ('created','pickup_requested','in_transit')
            AND COALESCE(tracking_updated_at, updated_at, created_at) <= datetime('now', '-5 days')`,
      ),
      filas(
        `SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?`,
        [hoy()],
      ),
      filas(
        `SELECT p.id, p.name FROM products p
          WHERE p.is_active = 1 AND (
            CASE WHEN EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
                 THEN (SELECT COALESCE(SUM(v.stock_quantity), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
                 ELSE p.stock_quantity - p.stock_reserved END) <= 0
          LIMIT 10`,
      ),
    ]);

    let produccion = { tareas: [], conteo: null };
    try {
      const cola = await getWorkQueue({ id: ctx.usuario.id, role: ctx.usuario.rol });
      produccion = {
        conteo: { atrasadas: cola.counts.late, para_hoy: cola.counts.now, en_espera: cola.counts.waiting },
        tareas: cola.tasks
          .filter((t) => t.urgency === 'late' || t.urgency === 'now')
          .slice(0, 8)
          .map((t) => ({
            tarea: ETIQUETA_TAREA[t.kind] ?? t.kind,
            urgencia: t.urgency === 'late' ? 'atrasada' : 'para hoy',
            lote: t.lot?.lotId,
            finca: t.lot?.farmName,
            enlace: `/admin/produccion?lote=${encodeURIComponent(t.lot?.lotId ?? '')}`,
          })),
      };
    } catch {
      produccion = { tareas: [], conteo: null, error: 'No se pudo leer la bandeja de producción.' };
    }

    return ok({
      fecha: hoy(),
      pedidos_por_despachar: {
        cantidad: porDespachar.length,
        pedidos: porDespachar.map((p) => ({
          referencia: p.reference,
          estado: ESTADO_PEDIDO[p.status] ?? p.status,
          cliente: p.customer_name,
          dias_esperando: diasDesde(p.created_at),
          total: dinero(p.total_cop),
        })),
        enlace: '/admin/pedidos',
      },
      envios_sin_novedad_5_dias: { cantidad: Number(enviosQuietos[0]?.n ?? 0), enlace: '/admin/envios' },
      suscripciones_por_cobrar_hoy: Number(cobrosHoy[0]?.n ?? 0),
      productos_agotados: agotados.map((p) => ({ producto: p.name, id: p.id, enlace: '/admin/productos' })),
      produccion,
    });
  }),
};

