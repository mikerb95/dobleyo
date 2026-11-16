// Escrituras de pedidos y envíos. Solo admin, siempre con tarjeta.
//
// Fuera de alcance a propósito: marcar pagado, cancelar y reembolsar (tocan
// pagos e inventario). Solo se avanza el pedido hacia adelante:
// pagado → en preparación → enviado → entregado. Desde "pagado" el stock ya
// se descontó, así que ningún cambio de aquí mueve inventario.

import { z } from 'zod';
import { query } from '../../../db.js';
import { logger } from '../../../logger.js';
import { logAudit } from '../../audit.js';
import { sendOrderStatusEmail, sendShippingNotificationEmail } from '../../email.js';
import { ESTADO_PEDIDO } from '../herramientas/comun.js';
import { vistaCambio, propuesta, hecho, noSe, opcion } from './cambio.js';

const SITE_URL = process.env.SITE_BASE_URL || 'https://dobleyo.cafe';

/** Siguiente estado permitido desde cada estado. */
const AVANCES = { paid: ['processing'], processing: ['shipped'], shipped: ['delivered'] };

async function pedidoPorReferencia(referencia) {
  const { rows } = await query(
    `SELECT id, reference, status, customer_name, customer_email, total_cop, currency
       FROM customer_orders WHERE reference = ?`,
    [String(referencia).trim()],
  );
  return rows[0] ?? null;
}

const OPCION_AVISAR = (texto) => ({ id: 'avisar_cliente', etiqueta: texto, valor: true });

export const cambiarEstadoPedido = {
  nombre: 'cambiar_estado_pedido',
  descripcion:
    'Avanza un pedido de la tienda al siguiente estado: de pagado a en preparación (processing), de en preparación a enviado ' +
    '(shipped) o de enviado a entregado (delivered). No marca pagado, no cancela ni reembolsa. Para despachar con número de ' +
    'guía use registrar_guia_manual. No se ejecuta sola: la persona ve el cambio y decide. Busque antes la referencia con ' +
    'consultar_pedidos.',
  esquema: z.object({
    referencia: z.string().min(3).max(40).describe('Referencia del pedido (sale de consultar_pedidos), por ejemplo DY-1234.'),
    estado: z.enum(['processing', 'shipped', 'delivered']).describe('Estado nuevo.'),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const p = await pedidoPorReferencia(entrada.referencia);
    if (!p) return noSe(`No existe el pedido ${entrada.referencia}.`);
    if (p.status === entrada.estado) return noSe(`El pedido ${p.reference} ya está en "${ESTADO_PEDIDO[p.status]}".`);
    const permitidos = AVANCES[p.status] ?? [];
    if (!permitidos.includes(entrada.estado)) {
      return noSe(
        `El pedido ${p.reference} está en "${ESTADO_PEDIDO[p.status] ?? p.status}" y no puede pasar a "${ESTADO_PEDIDO[entrada.estado]}" ` +
          `desde el asistente. ${permitidos.length ? `Solo puede pasar a "${ESTADO_PEDIDO[permitidos[0]]}".` : 'Ese cambio se hace en la pantalla de Pedidos.'}`,
      );
    }
    const avisaCorreo = entrada.estado === 'delivered' && !!p.customer_email;
    const vista = vistaCambio({
      rotulo: 'Pedido',
      titulo: p.reference,
      contexto: p.customer_name,
      cambios: [{ campo: 'Estado', antes: ESTADO_PEDIDO[p.status], despues: ESTADO_PEDIDO[entrada.estado] }],
      avisos: avisaCorreo ? ['Si deja marcada la casilla, al cliente le llega un correo diciendo que su pedido fue entregado.'] : [],
      opciones: avisaCorreo ? [OPCION_AVISAR('Avisar al cliente por correo')] : [],
    });
    return propuesta(`Pedido ${p.reference}`, `${ESTADO_PEDIDO[p.status]} → ${ESTADO_PEDIDO[entrada.estado]}`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const p = await pedidoPorReferencia(entrada.referencia);
    const r = await query(
      `UPDATE customer_orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?`,
      [entrada.estado, p.id, p.status],
    );
    if (!r.rowCount) return noSe(`El pedido ${p.reference} cambió mientras tanto. Consúltelo de nuevo.`);
    await logAudit(ctx.usuario.id, 'update', 'customer_orders', p.id, { status: entrada.estado, previousStatus: p.status, via: 'asistente' });

    let correo = false;
    if (entrada.estado === 'delivered' && p.customer_email && opcion(ctx, prep.vista, 'avisar_cliente')) {
      correo = true;
      sendOrderStatusEmail(p.customer_email, p.customer_name, { reference: p.reference, status: 'delivered', total: p.total_cop })
        .catch((err) => logger.error({ err, ref: p.reference }, '[asistente] Error enviando correo de estado'));
    }
    return hecho(
      `Pedido ${p.reference} pasó a "${ESTADO_PEDIDO[entrada.estado]}".${correo ? ' Se envió el correo al cliente.' : ''}`,
      '/admin/pedidos',
      { correo_enviado: correo },
    );
  },
};

export const registrarGuiaManual = {
  nombre: 'registrar_guia_manual',
  descripcion:
    'Registra el despacho de un pedido pagado o en preparación con la transportadora y el número de guía que ya tiene la persona ' +
    '(no compra ni cotiza guías). El pedido pasa a enviado. No se ejecuta sola: la persona ve el cambio y decide. Busque antes la ' +
    'referencia con consultar_pedidos y pregunte la transportadora y la guía si no las dijo.',
  esquema: z.object({
    referencia: z.string().min(3).max(40).describe('Referencia del pedido.'),
    transportadora: z.string().min(2).max(60).describe('Nombre de la transportadora, tal como lo dijo la persona.'),
    guia: z.string().min(3).max(60).describe('Número de guía, tal como lo dijo la persona.'),
    url_rastreo: z.string().url().max(300).optional().describe('Enlace de rastreo, solo si la persona lo dio.'),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const p = await pedidoPorReferencia(entrada.referencia);
    if (!p) return noSe(`No existe el pedido ${entrada.referencia}.`);
    if (!['paid', 'processing'].includes(p.status)) {
      return noSe(`El pedido ${p.reference} está en "${ESTADO_PEDIDO[p.status] ?? p.status}" y no se puede despachar.`);
    }
    const { rows } = await query(
      `SELECT guide_number, delivery_company_name FROM shipments WHERE order_id = ? AND status NOT IN ('cancelled','error') LIMIT 1`,
      [p.id],
    );
    if (rows.length) return noSe(`El pedido ${p.reference} ya tiene un envío activo (guía ${rows[0].guide_number} de ${rows[0].delivery_company_name}).`);
    const vista = vistaCambio({
      rotulo: 'Despacho',
      titulo: `Pedido ${p.reference}`,
      contexto: p.customer_name,
      cambios: [
        { campo: 'Estado', antes: ESTADO_PEDIDO[p.status], despues: ESTADO_PEDIDO.shipped },
        { campo: 'Transportadora', antes: null, despues: entrada.transportadora.trim() },
        { campo: 'Guía', antes: null, despues: entrada.guia.trim() },
        ...(entrada.url_rastreo ? [{ campo: 'Rastreo', antes: null, despues: entrada.url_rastreo }] : []),
      ],
      avisos: p.customer_email ? ['Si deja marcada la casilla, al cliente le llega el correo de despacho con la guía.'] : [],
      opciones: p.customer_email ? [OPCION_AVISAR('Enviar al cliente el correo con la guía')] : [],
    });
    return propuesta(`Despacho del pedido ${p.reference}`, `${entrada.transportadora.trim()} · guía ${entrada.guia.trim()}`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const p = await pedidoPorReferencia(entrada.referencia);
    const transportadora = entrada.transportadora.trim();
    const guia = entrada.guia.trim();
    let envioId;
    try {
      const ins = await query(
        `INSERT INTO shipments
            (order_id, provider, payment_mode, delivery_company_id, delivery_company_name,
             guide_number, requested_pickup, created_by, status, guide_notified_at, tracking_url)
         VALUES (?, 'manual', 'prepaid', 'manual', ?, ?, 0, ?, 'in_transit', datetime('now'), ?)
         RETURNING id`,
        [p.id, transportadora, guia, ctx.usuario.id || null, entrada.url_rastreo ?? null],
      );
      envioId = ins.rows[0].id;
    } catch (err) {
      // El índice único de envío activo por pedido evita duplicados si se reintenta.
      if (String(err.message).includes('UNIQUE')) return noSe(`El pedido ${p.reference} ya tiene un envío activo.`);
      throw err;
    }
    await query(`UPDATE customer_orders SET status = 'shipped', updated_at = datetime('now') WHERE id = ? AND status IN ('paid','processing')`, [p.id]);
    await logAudit(ctx.usuario.id, 'create', 'shipments', envioId, { orderId: p.id, carrierName: transportadora, guideNumber: guia, manual: true, via: 'asistente' });

    let correo = false;
    if (p.customer_email && opcion(ctx, prep.vista, 'avisar_cliente')) {
      correo = true;
      const confirmUrl = p.currency === 'USD'
        ? `https://en.dobleyo.cafe/confirmation?ref=${p.reference}`
        : `${SITE_URL}/confirmacion?ref=${p.reference}`;
      sendShippingNotificationEmail(p.customer_email, p.customer_name, {
        reference: p.reference,
        guideNumber: guia,
        deliveryCompanyName: transportadora,
        trackingUrl: entrada.url_rastreo || confirmUrl,
        isCod: false,
        collectionValue: 0,
      }).catch((err) => logger.error({ err }, '[asistente] Error enviando correo de despacho manual'));
    }
    return hecho(
      `Pedido ${p.reference} despachado con ${transportadora}, guía ${guia}.${correo ? ' Se envió el correo al cliente.' : ''}`,
      '/admin/envios',
      { correo_enviado: correo },
    );
  },
};
