// Herramientas de lectura de ventas, costos y finanzas. Solo admin.
//
// Todas las sumas de dinero las hace la base, no el modelo: cada total llega
// ya sumado y formateado en COP.

import { z } from 'zod';
import { ok, fallo, dinero, fecha, filas, seguro, inicioDeMes, hoy, desdeUtc, hastaUtc, ESTADOS_VENDIDOS } from './comun.js';
import { getLotCostSummary, getCostOverview } from '../../costService.js';
import { getDashboard } from '../../financeService.js';
import { humanizeFarm } from '../../workflowService.js';

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD');
const VENDIDOS = ESTADOS_VENDIDOS.map((e) => `'${e}'`).join(',');

export const consultarVentas = {
  nombre: 'consultar_ventas',
  descripcion:
    'Ventas en un rango de fechas: total y número de ventas por canal (tienda online, MercadoLibre y ventas externas), ' +
    'productos más vendidos y ciudades. Por defecto, el mes en curso. Úsela para "¿cuánto vendimos en octubre?" o ' +
    '"¿qué se vende más, el sitio o MercadoLibre?".',
  esquema: z.object({
    desde: DIA.optional().describe('Fecha inicial (AAAA-MM-DD). Por defecto, el primer día del mes en curso.'),
    hasta: DIA.optional().describe('Fecha final incluida (AAAA-MM-DD). Por defecto, hoy.'),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_ventas', async (a) => {
    const desde = a.desde ?? inicioDeMes();
    const hasta = a.hasta ?? hoy();
    if (desde > hasta) return fallo('La fecha inicial es posterior a la final.');
    const [d, h] = [desdeUtc(desde), hastaUtc(hasta)];

    const [sitio, ml, externas, top, ciudades] = await Promise.all([
      filas(`SELECT COUNT(*) AS n, COALESCE(SUM(total_cop), 0) AS total FROM customer_orders
              WHERE status IN (${VENDIDOS}) AND created_at >= ? AND created_at < ?`, [d, h]),
      // sales_tracking guarda la fecha de compra que reporta ML (ISO con hora).
      filas(`SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS total FROM sales_tracking
              WHERE COALESCE(order_status, '') NOT IN ('cancelled', 'invalid')
                AND substr(purchase_date, 1, 10) >= ? AND substr(purchase_date, 1, 10) <= ?`, [desde, hasta]),
      filas(`SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total FROM external_sales
              WHERE substr(sale_date, 1, 10) >= ? AND substr(sale_date, 1, 10) <= ?`, [desde, hasta]),
      filas(`SELECT i.product_name, SUM(i.quantity) AS unidades, SUM(i.subtotal_cop) AS total
               FROM customer_order_items i JOIN customer_orders o ON o.id = i.order_id
              WHERE o.status IN (${VENDIDOS}) AND o.created_at >= ? AND o.created_at < ?
              GROUP BY i.product_name ORDER BY unidades DESC LIMIT 8`, [d, h]),
      filas(`SELECT shipping_city AS ciudad, COUNT(*) AS n, SUM(total_cop) AS total FROM customer_orders
              WHERE status IN (${VENDIDOS}) AND created_at >= ? AND created_at < ?
              GROUP BY shipping_city ORDER BY n DESC LIMIT 8`, [d, h]),
    ]);

    const canal = (r) => ({ ventas: Number(r[0]?.n ?? 0), total: dinero(r[0]?.total) });
    const totalGeneral = [sitio, ml, externas].reduce((t, r) => t + (Number(r[0]?.total) || 0), 0);
    return ok({
      desde,
      hasta,
      tienda_online: canal(sitio),
      mercadolibre: canal(ml),
      ventas_externas: canal(externas),
      total_todos_los_canales: dinero(totalGeneral),
      mas_vendidos_tienda: top.map((t) => ({ producto: t.product_name, unidades: Number(t.unidades), total: dinero(t.total) })),
      ciudades_tienda: ciudades.map((c) => ({ ciudad: c.ciudad || 'Sin ciudad', ventas: Number(c.n), total: dinero(c.total) })),
      enlace: '/admin/ventas',
    });
  }),
};

export const consultarCostos = {
  nombre: 'consultar_costos',
  descripcion:
    'Costeo de producción: sin lote, los lotes recientes con costo total, costo por unidad, precio de venta y margen; con lote, ' +
    'el desglose por etapa (compra, transporte, tostión, empaque). Úsela para "¿cuál es el margen del último lote?".',
  esquema: z.object({
    lote: z.string().max(80).optional().describe('Código del lote para ver su desglose.'),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_costos', async (a) => {
    if (a.lote) {
      const r = await getLotCostSummary(a.lote);
      return ok({
        lote: a.lote,
        por_etapa: (r.by_stage ?? []).map((s) => ({ etapa: s.label, total: dinero(s.amount_cop) })),
        etapas_sin_costo: r.missing_stages ?? [],
        total: dinero(r.totals?.total_cop),
        costo_por_kg_verde: r.cost_per_kg?.green != null ? dinero(r.cost_per_kg.green) : null,
        costo_por_kg_tostado: r.cost_per_kg?.roasted != null ? dinero(r.cost_per_kg.roasted) : null,
        costo_por_unidad: r.unit_cost_cop != null ? dinero(r.unit_cost_cop) : null,
        enlace: '/admin/costos',
      });
    }
    const { lots, total } = await getCostOverview({ limit: 10 });
    return ok({
      lotes_con_costeo: total,
      lotes: lots.map((l) => ({
        lote: l.lot_id,
        finca: humanizeFarm(l.farm),
        variedad: l.variety,
        fecha: fecha(l.created_at),
        costo_total: dinero(l.totals?.total_cop),
        costo_por_unidad: l.unit_cost_cop != null ? dinero(l.unit_cost_cop) : null,
        precio_venta: l.sale_price_cop != null ? dinero(l.sale_price_cop) : null,
        margen_pct: l.margin_pct,
      })),
      enlace: '/admin/costos',
    });
  }),
};

export const consultarFinanzas = {
  nombre: 'consultar_finanzas',
  descripcion:
    'Finanzas del mes: ingresos, costos, gastos y balance; cuentas por pagar; gastos por categoría; presupuesto vigente y el ' +
    'último precio de la Federación (FNC). Úsela para "¿cómo vamos este mes?" o "¿a cuánto está la carga?".',
  esquema: z.object({}),
  roles: ['admin'],
  ejecutar: seguro('consultar_finanzas', async () => {
    const mes = inicioDeMes();
    // Mismo cálculo que el tablero de /admin/finanzas (financeService.getDashboard).
    const [tablero, porCategoria, presupuesto, fnc] = await Promise.all([
      getDashboard(),
      filas(`SELECT category, COALESCE(SUM(amount), 0) AS total FROM expenses
              WHERE state IN ('aprobado','pagado') AND expense_date >= ?
              GROUP BY category ORDER BY total DESC LIMIT 8`, [mes]),
      filas(`SELECT b.name, b.start_date, b.end_date, b.total_budget,
                    (SELECT COALESCE(SUM(actual_amount), 0) FROM budget_lines bl WHERE bl.budget_id = b.id) AS ejecutado
               FROM budgets b WHERE b.start_date <= ? AND b.end_date >= ? ORDER BY b.start_date DESC LIMIT 1`, [hoy(), hoy()]),
      filas(`SELECT price_date, carga_cop, excelso_cop_kg FROM fnc_price_history ORDER BY price_date DESC LIMIT 1`),
    ]);
    const p = presupuesto[0];
    return ok({
      mes_desde: mes,
      ingresos_facturados: dinero(tablero.month_revenue),
      costos_facturados: dinero(tablero.month_costs),
      gastos: dinero(tablero.month_expenses),
      balance: dinero(tablero.month_balance),
      cuentas_por_pagar: { total: dinero(tablero.pending_payables), facturas: tablero.pending_invoices_count },
      gastos_por_categoria: porCategoria.map((r) => ({ categoria: r.category, total: dinero(r.total) })),
      presupuesto_vigente: p
        ? { nombre: p.name, desde: fecha(p.start_date), hasta: fecha(p.end_date), presupuestado: dinero(p.total_budget), ejecutado: dinero(p.ejecutado) }
        : null,
      precio_fnc: fnc[0]
        ? { fecha: fecha(fnc[0].price_date), carga: dinero(fnc[0].carga_cop), excelso_por_kg: dinero(fnc[0].excelso_cop_kg) }
        : null,
      enlace: '/admin/finanzas',
    });
  }),
};
