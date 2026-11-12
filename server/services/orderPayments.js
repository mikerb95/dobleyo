// Pago e inventario de los pedidos del sitio (customer_orders).
//
// Aquí vive todo lo que pasa cuando un pedido cambia de estado de pago, sin
// importar quién lo dispare: el webhook de Wompi, la conciliación (página de
// confirmación y cron), la creación de un contraentrega o un cambio manual del
// admin. Reglas:
//
// - Las transiciones de estado son UPDATE condicionales: dos eventos iguales o
//   simultáneos no pueden aplicar dos veces el mismo cambio.
// - El descuento y la reposición de stock se reclaman dentro de una transacción
//   (`stock_deducted_at`): o se hace completo una sola vez, o no se hace.
// - Los efectos de un pago aprobado (stock, alerta, correo) son reanudables: si
//   uno falla, el reintento del evento los completa en vez de darlos por hechos.
import { logger } from '../logger.js';
import { query, withTransaction } from '../db.js';
import { logSystemAudit } from './audit.js';
import { scheduleStockSync } from './mlStock.js';
import { sendOrderConfirmationEmail } from './email.js';
import { getTransaction, findTransactionsByReference, wompiConfig } from './wompi.js';
import {
    notifySaleConfirmed, notifyStockDepleted, notifyStockBelowMinimum, notifyOversold,
} from './alerts.js';

const CONFIRMED_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

// ─── Inventario ────────────────────────────────────────────────────────────
// Se descuenta SOLO cuando la orden queda confirmada ('paid' por Wompi, o COD
// que nace 'processing'), nunca en 'pending_payment'. No hay reserva de stock:
// el riesgo de sobreventa entre creación y pago se acepta para este catálogo de
// bajo volumen.

/**
 * Descuenta el inventario de una orden, una sola vez.
 * Devuelve true solo cuando efectivamente descontó (los llamadores lo usan para
 * avisar la venta exactamente una vez). Si algo falla, la transacción se
 * revierte completa y la orden queda sin reclamar para un reintento.
 */
export async function deductStockForOrder(orderId, reference) {
    // Alertas y auditoría se disparan después del commit: dentro de la
    // transacción de escritura no se toca la BD por otra conexión.
    const afterCommit = [];

    const productIds = await withTransaction(async ({ query: txq }) => {
        const claim = await txq(
            `UPDATE customer_orders SET stock_deducted_at = datetime('now')
              WHERE id = ? AND stock_deducted_at IS NULL
          RETURNING id`,
            [orderId]
        );
        if (!claim?.rows?.length) return null;

        const items = await txq(
            `SELECT i.product_id, i.quantity, p.name AS product_name, p.stock_min
               FROM customer_order_items i
          LEFT JOIN products p ON p.id = i.product_id
              WHERE i.order_id = ?`,
            [orderId]
        );

        for (const item of items.rows) {
            const nombre = item.product_name || `Producto #${item.product_id}`;
            const result = await txq(
                `UPDATE products SET stock_quantity = stock_quantity - ?
                 WHERE id = ? AND stock_quantity >= ?
                 RETURNING stock_quantity`,
                [item.quantity, item.product_id, item.quantity]
            );
            if (result.rows.length) {
                const after = result.rows[0].stock_quantity;
                await txq(
                    `INSERT INTO inventory_movements
                        (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference)
                     VALUES (?, 'salida', ?, ?, ?, 'Venta e-commerce', ?)`,
                    [item.product_id, item.quantity, after + item.quantity, after, reference]
                );

                // Agotado manda sobre "bajo el mínimo" para no mandar dos
                // notificaciones del mismo producto en la misma venta.
                const minimo = Number(item.stock_min ?? 0);
                if (after <= 0) {
                    afterCommit.push(() => notifyStockDepleted({ productName: nombre, reference }));
                } else if (minimo > 0 && after <= minimo) {
                    afterCommit.push(() => notifyStockBelowMinimum({ productName: nombre, remaining: after, minimum: minimo }));
                }
            } else {
                // Sobreventa: stock insuficiente en el momento del pago. La orden ya
                // está pagada/confirmada, así que sigue; queda registrada para que el
                // admin gestione reposición.
                afterCommit.push(() => {
                    logger.warn({ orderId, productId: item.product_id, quantity: item.quantity }, '[Inventory] Sobreventa detectada al descontar stock');
                    logSystemAudit('oversold', 'products', item.product_id, { orderId, reference, quantity: item.quantity }).catch(() => {});
                    notifyOversold({ productName: nombre, quantity: item.quantity, reference });
                });
            }
        }

        return items.rows.map((i) => i.product_id);
    });

    if (!productIds) return false;

    for (const fn of afterCommit) {
        try { fn(); } catch (err) { logger.error({ err, orderId }, '[Inventory] Error en aviso posterior al descuento'); }
    }
    // El stock cambió: MercadoLibre debe ofrecer lo mismo que queda en el sitio.
    scheduleStockSync(productIds);
    return true;
}

/**
 * Repone el stock de una orden que YA había descontado inventario y se cancela
 * o reembolsa. Si nunca se descontó (p. ej. seguía en pending_payment) no hace
 * nada. Devuelve true solo cuando repuso.
 */
export async function replenishStockForOrder(orderId, reference, reasonLabel) {
    const productIds = await withTransaction(async ({ query: txq }) => {
        const claim = await txq(
            `UPDATE customer_orders SET stock_deducted_at = NULL
              WHERE id = ? AND stock_deducted_at IS NOT NULL
          RETURNING id`,
            [orderId]
        );
        if (!claim?.rows?.length) return null;

        const items = await txq(`SELECT product_id, quantity FROM customer_order_items WHERE order_id = ?`, [orderId]);
        for (const item of items.rows) {
            const result = await txq(
                `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? RETURNING stock_quantity`,
                [item.quantity, item.product_id]
            );
            if (result.rows.length) {
                const after = result.rows[0].stock_quantity;
                await txq(
                    `INSERT INTO inventory_movements
                        (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference)
                     VALUES (?, 'devolucion', ?, ?, ?, ?, ?)`,
                    [item.product_id, item.quantity, after - item.quantity, after, reasonLabel, reference]
                );
            }
        }
        return items.rows.map((i) => i.product_id);
    });

    if (!productIds) return false;
    scheduleStockSync(productIds);
    return true;
}

// ─── Avisos ────────────────────────────────────────────────────────────────

/**
 * Publica la alerta de venta confirmada. Se llama solo cuando
 * deductStockForOrder devolvió true, así que no se duplica ante reintentos.
 */
export async function notifyConfirmedSale(orderId) {
    try {
        const orderRes = await query(
            `SELECT reference, customer_name, shipping_city, total_cop, currency, payment_method
               FROM customer_orders WHERE id = ?`,
            [orderId]
        );
        if (!orderRes?.rows?.length) return;
        const o = orderRes.rows[0];
        const itemsRes = await query(
            `SELECT product_name, quantity FROM customer_order_items WHERE order_id = ?`,
            [orderId]
        );
        notifySaleConfirmed({
            reference:     o.reference,
            customerName:  o.customer_name,
            city:          o.shipping_city,
            total:         o.total_cop,
            currency:      o.currency,
            paymentMethod: o.payment_method,
            items:         (itemsRes?.rows ?? []).map((r) => ({ name: r.product_name, quantity: r.quantity })),
        });
    } catch (err) {
        logger.error({ err, orderId }, '[Alerts] Error preparando la alerta de venta');
    }
}

/**
 * Envía el correo de confirmación de un pedido si aún no se ha enviado y marca
 * `confirmation_email_sent_at`. Nunca lanza. Devuelve true solo si lo envió.
 * La clave de idempotencia de Resend (`order-confirmation/<ref>`) cubre el caso
 * de dos envíos casi simultáneos.
 */
export async function sendConfirmationEmailForOrder(orderId) {
    try {
        const orderRes = await query(
            `SELECT id, reference, customer_name, customer_email, subtotal_cop, shipping_cop,
                    discount_amount_cop, total_cop, shipping_address, shipping_city, payment_method
               FROM customer_orders
              WHERE id = ? AND confirmation_email_sent_at IS NULL`,
            [orderId]
        );
        const order = orderRes?.rows?.[0];
        if (!order?.customer_email) return false;

        const itemsRes = await query(
            `SELECT product_name, quantity, unit_price_cop FROM customer_order_items WHERE order_id = ?`,
            [orderId]
        );
        const r = await sendOrderConfirmationEmail(order.customer_email, order.customer_name, {
            orderId: order.reference,
            date: new Date().toISOString(),
            items: (itemsRes?.rows ?? []).map((i) => ({ name: i.product_name, quantity: i.quantity, price: i.unit_price_cop })),
            subtotal: order.subtotal_cop,
            shipping: order.shipping_cop,
            discount: order.discount_amount_cop,
            total: order.total_cop,
            shippingAddress: `${order.shipping_address}, ${order.shipping_city}`,
            paymentMethod: order.payment_method,
        });
        if (!r?.success) throw r?.error ?? new Error('Envío rechazado');
        await query(`UPDATE customer_orders SET confirmation_email_sent_at = datetime('now') WHERE id = ?`, [orderId]);
        return true;
    } catch (err) {
        logger.error({ err, orderId }, '[Orders] Error enviando la confirmación del pedido; se reintentará en el mantenimiento');
        return false;
    }
}

// ─── Transacciones de Wompi ────────────────────────────────────────────────

// Una orden pendiente acepta cualquier transacción. Una cancelada solo revive
// con una transacción DISTINTA a la que la canceló: un APPROVED o PENDING viejo
// que llegue repetido después de un VOID de esa misma transacción no la reabre.
const OPEN_FOR_PAYMENT = `(status = 'pending_payment'
        OR (status = 'cancelled' AND (payment_transaction_id IS NULL OR payment_transaction_id <> ?)))`;

/**
 * Aplica una transacción de Wompi a su pedido. La usan el webhook y la
 * conciliación. Idempotente y reanudable.
 *
 * Lanza si falla la BD: el webhook responde 500, Wompi reintenta y el reintento
 * completa lo que faltó.
 *
 * @returns {Promise<{ outcome: string, status?: string }>} outcome:
 *   'invalid' | 'not_found' | 'ignored' | 'amount_mismatch' | 'applied' | 'resumed' | 'noop'
 */
export async function applyWompiTransaction(tx, source = 'wompi-webhook') {
    const { reference, status: txStatus, id: txId, payment_method_type, amount_in_cents, currency } = tx || {};
    if (!reference || !txId) return { outcome: 'invalid' };

    const lookup = await query(
        `SELECT id, status, total_cop, currency, expected_amount_cents, payment_transaction_id,
                discount_code, payment_method
           FROM customer_orders
          WHERE reference = ?`,
        [reference]
    );
    if (!lookup?.rows?.length) return { outcome: 'not_found' };
    const order = lookup.rows[0];

    // Los pedidos de suscripción los crea y gobierna subscriptions.js.
    if (order.payment_method === 'wompi_subscription') return { outcome: 'ignored', status: order.status };

    // Monto y moneda deben coincidir con lo firmado al crear la orden
    // (expected_amount_cents, en la moneda real de la orden). Órdenes anteriores
    // a esa columna caen al cálculo en COP.
    const expectedAmount = order.expected_amount_cents != null
        ? Number(order.expected_amount_cents)
        : Number(order.total_cop) * 100;
    const expectedCurrency = order.currency || 'COP';
    if (Number(amount_in_cents) !== expectedAmount || (currency && currency !== expectedCurrency)) {
        logger.warn({ reference, txId, expectedAmount, expectedCurrency, amount_in_cents, currency }, '[Wompi] Monto/moneda inválidos; se ignora');
        return { outcome: 'amount_mismatch', status: order.status };
    }

    const sameTx = order.payment_transaction_id === txId;
    const paymentCols = [payment_method_type || 'wompi', txId, JSON.stringify(tx)];
    const audit = (to) => logSystemAudit('update', 'customer_orders', order.id, {
        reference, from: order.status, to, txId, source,
    }).catch(() => {});

    // ── Pago aprobado ──
    if (txStatus === 'APPROVED') {
        // El cambio de estado y el uso del cupón van juntos: o los dos, o ninguno.
        const moved = await withTransaction(async ({ query: txq }) => {
            const r = await txq(
                `UPDATE customer_orders
                    SET status = 'paid', payment_method = ?, payment_transaction_id = ?, payment_data = ?
                  WHERE id = ? AND ${OPEN_FOR_PAYMENT}
              RETURNING id`,
                [...paymentCols, order.id, txId]
            );
            if (!r?.rows?.length) return false;
            if (order.discount_code) {
                // Tope-seguro: la condición evita superar max_uses.
                await txq(
                    `UPDATE discount_codes SET uses_count = uses_count + 1
                      WHERE code = ? AND (max_uses IS NULL OR uses_count < max_uses)`,
                    [order.discount_code]
                );
            }
            return true;
        });

        if (!moved) {
            if (!(sameTx && CONFIRMED_STATUSES.includes(order.status))) {
                if (CONFIRMED_STATUSES.includes(order.status) && !sameTx) {
                    // Dos pagos aprobados para el mismo pedido: hay que devolver uno.
                    logger.warn({ reference, txId, paidWith: order.payment_transaction_id }, '[Wompi] Pedido ya pagado por otra transacción; revisar posible doble cobro');
                    logSystemAudit('duplicate_payment', 'customer_orders', order.id, {
                        reference, txId, paidWith: order.payment_transaction_id, source,
                    }).catch(() => {});
                }
                return { outcome: 'noop', status: order.status };
            }
            // Mismo pago, pedido ya confirmado: es un reintento. No se toca el
            // estado (pudo avanzar a 'processing' o 'shipped'); solo se completa
            // lo que haya quedado pendiente.
        } else {
            audit('paid');
        }

        const deducted = await deductStockForOrder(order.id, reference);
        if (deducted) await notifyConfirmedSale(order.id);
        // Se espera el correo para que no se pierda al pausarse la instancia. No
        // lanza: si falla, queda pendiente para el mantenimiento.
        await sendConfirmationEmailForOrder(order.id);

        return { outcome: moved ? 'applied' : 'resumed', status: moved ? 'paid' : order.status };
    }

    // ── Pago rechazado o anulado ──
    if (txStatus === 'DECLINED' || txStatus === 'VOIDED') {
        // Solo cancela un pedido que sigue pendiente, o uno cuyo pago registrado es
        // esta misma transacción (VOID/contracargo). Un intento fallido tardío con
        // otra tarjeta no tumba un pedido ya pagado.
        const r = await query(
            `UPDATE customer_orders
                SET status = 'cancelled', payment_method = ?, payment_transaction_id = ?, payment_data = ?
              WHERE id = ? AND status NOT IN ('cancelled', 'refunded')
                AND (status = 'pending_payment' OR payment_transaction_id = ?)
          RETURNING id`,
            [...paymentCols, order.id, txId]
        );
        const moved = Boolean(r?.rows?.length);
        if (moved) audit('cancelled');
        // Si el pedido había descontado inventario (pago revertido), se repone.
        // Idempotente: también completa una reposición que falló en un intento previo.
        if (moved || (sameTx && order.status === 'cancelled')) {
            await replenishStockForOrder(order.id, reference, 'Pago revertido (Wompi)');
        }
        return { outcome: moved ? 'applied' : 'noop', status: moved ? 'cancelled' : order.status };
    }

    // ── En curso (PENDING) u otro estado no final (ERROR) ──
    // Solo PENDING reabre un pedido cancelado por un intento anterior.
    const reopens = txStatus === 'PENDING';
    const r = await query(
        `UPDATE customer_orders
            SET status = 'pending_payment', payment_method = ?, payment_transaction_id = ?, payment_data = ?
          WHERE id = ? AND ${reopens ? OPEN_FOR_PAYMENT : `status = 'pending_payment'`}
      RETURNING id`,
        reopens ? [...paymentCols, order.id, txId] : [...paymentCols, order.id]
    );
    const moved = Boolean(r?.rows?.length);
    if (moved && order.status !== 'pending_payment') audit('pending_payment');
    return { outcome: moved ? 'applied' : 'noop', status: moved ? 'pending_payment' : order.status };
}

// ─── Conciliación con Wompi ────────────────────────────────────────────────
// El webhook puede no llegar (caída nuestra, reintentos agotados). Para que un
// pedido pagado no se quede pendiente, se le pregunta a Wompi directamente.

const TX_ID_RE = /^[A-Za-z0-9_-]{6,80}$/;

/**
 * Consulta en Wompi las transacciones de una referencia y, si hay una
 * APROBADA, la aplica. Solo aplica pagos aprobados: un rechazo no se concilia
 * porque el cliente puede estar reintentando con la misma referencia.
 *
 * @param {string} reference
 * @param {{ transactionId?: string, source?: string }} [opts] transactionId: el
 *   `id` que Wompi agrega a la URL de regreso. Solo se usa si pertenece a la
 *   referencia.
 * @returns {Promise<{ checked: boolean, recovered: boolean }>}
 */
export async function reconcileOrderPayment(reference, { transactionId, source = 'wompi-reconcile' } = {}) {
    if (!wompiConfig.canQuery) return { checked: false, recovered: false };

    let txs = [];
    let checked = false;
    try {
        txs = await findTransactionsByReference(reference);
        checked = wompiConfig.configured; // sin llave privada no se consulta por referencia
    } catch (err) {
        logger.warn({ err: err.message, reference }, '[Wompi] No se pudo consultar las transacciones de la referencia');
    }

    if (transactionId && TX_ID_RE.test(String(transactionId)) && !txs.some((t) => t?.id === transactionId)) {
        try {
            const tx = await getTransaction(transactionId);
            if (tx?.reference === reference) txs.push(tx);
            checked = true;
        } catch (err) {
            logger.warn({ err: err.message, reference }, '[Wompi] No se pudo consultar la transacción');
        }
    }

    const approved = txs.find((t) => t?.status === 'APPROVED');
    if (!approved) return { checked, recovered: false };

    const result = await applyWompiTransaction(approved, source);
    return { checked: true, recovered: result.outcome === 'applied' };
}

/**
 * Concilia pedidos que siguen en pending_payment: los recientes (un evento
 * perdido se recupera en la siguiente pasada) y los que están por expirar (para
 * no cancelar un pedido pagado). Devuelve cuántos quedaron pagados.
 */
export async function reconcilePendingPayments({ limit = 10, timeLeft = () => Infinity } = {}) {
    if (!wompiConfig.configured) return 0;

    const pending = await query(
        `SELECT reference, payment_transaction_id
           FROM customer_orders
          WHERE status = 'pending_payment'
            AND (payment_method IS NULL OR payment_method NOT IN ('cod', 'wompi_subscription'))
            AND datetime(created_at) < datetime('now', '-5 minutes')
            AND (datetime(created_at) > datetime('now', '-3 hours')
                 OR datetime(created_at) < datetime('now', '-46 hours'))
          ORDER BY created_at ASC
          LIMIT ?`,
        [limit]
    );

    let recovered = 0;
    for (const row of pending?.rows ?? []) {
        if (timeLeft() < 1500) break;
        try {
            const r = await reconcileOrderPayment(row.reference, {
                transactionId: row.payment_transaction_id || undefined,
                source: 'wompi-reconcile-cron',
            });
            if (r.recovered) recovered++;
        } catch (err) {
            logger.error({ err, reference: row.reference }, '[Wompi] Error conciliando pedido pendiente');
        }
    }
    return recovered;
}
