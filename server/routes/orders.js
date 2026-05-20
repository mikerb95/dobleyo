import { Router } from 'express';
import { logger } from '../logger.js';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';
import { sendOrderConfirmationEmail } from '../services/email.js';
import { geocodeOrderAsync } from '../services/geocoding.js';

export const ordersRouter = Router();

const SITE_URL = process.env.SITE_BASE_URL || 'https://dobleyo.cafe';
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';

// ─── Utilidades Wompi ───────────────────────────────────────────────────────

/**
 * Genera la firma de integridad para Wompi Checkout.
 * SHA256(reference + amountInCents + currency + integritySecret)
 */
function wompiIntegrityHash(reference, amountCents, currency = 'COP') {
    const str = `${reference}${amountCents}${currency}${WOMPI_INTEGRITY_SECRET}`;
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Construye la URL del checkout hosted de Wompi.
 * No requiere llamada a la API de Wompi — solo parámetros firmados.
 */
function buildWompiCheckoutUrl(reference, amountCopPesos, customerEmail, redirectUrl) {
    const amountCents = amountCopPesos * 100;
    const currency = 'COP';
    const hash = wompiIntegrityHash(reference, amountCents, currency);

    const params = new URLSearchParams({
        'public-key': WOMPI_PUBLIC_KEY,
        currency,
        'amount-in-cents': String(amountCents),
        reference,
        'signature:integrity': hash,
        'redirect-url': redirectUrl,
        'customer-data:email': customerEmail,
    });
    return `https://checkout.wompi.co/p/?${params.toString()}`;
}

// ─── POST /api/orders ─────────────────────────────────────────────────────
// Crea una orden en estado pending_payment y devuelve la URL de pago Wompi

ordersRouter.post('/',
    [
        body('customerName').trim().notEmpty().withMessage('Nombre requerido'),
        body('customerEmail').isEmail().withMessage('Correo inválido'),
        body('customerPhone').optional().trim(),
        body('shippingAddress').trim().notEmpty().withMessage('Dirección requerida'),
        body('shippingCity').trim().notEmpty().withMessage('Ciudad requerida'),
        body('shippingDepartment').optional().trim(),
        body('items').isArray({ min: 1 }).withMessage('El carrito está vacío'),
        body('items.*.productId').notEmpty(),
        body('items.*.quantity').isInt({ min: 1 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ success: false, errors: errors.array() });
        }

        try {
            const {
                customerName, customerEmail, customerPhone,
                shippingAddress, shippingCity, shippingDepartment, shippingZip,
                items, notes, couponCode
            } = req.body;

            const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
            if (!productIds.length) {
                return res.status(422).json({ success: false, error: 'El carrito está vacío' });
            }

            const placeholders = productIds.map(() => '?').join(', ');
            const productsResult = await query(
                `SELECT id, name, price, image_url
         FROM products
         WHERE id IN (${placeholders}) AND is_active = 1`,
                productIds
            );

            if (productsResult.rows.length !== productIds.length) {
                return res.status(422).json({ success: false, error: 'Uno o más productos no están disponibles' });
            }

            const productMap = new Map(productsResult.rows.map((p) => [p.id, p]));

            // Calcular totales en COP desde la BD (evita manipulación del cliente)
            let subtotal = 0;
            const normalizedItems = items.map((item) => {
                const product = productMap.get(item.productId);
                const quantity = Number(item.quantity);
                const unitPrice = Number(product.price);
                const itemSubtotal = unitPrice * quantity;
                subtotal += itemSubtotal;
                return {
                    productId: item.productId,
                    productName: product.name,
                    productImage: product.image_url,
                    unitPrice,
                    quantity,
                    subtotal: itemSubtotal
                };
            });

            // Aplicar cupón si viene en el request
            let discountAmount = 0;
            let appliedCode = null;
            if (couponCode) {
                const code = couponCode.trim().toUpperCase();
                const codeResult = await query(
                    `SELECT * FROM discount_codes WHERE code = ? AND active = 1`,
                    [code]
                );
                if (codeResult.rows.length) {
                    const dc = codeResult.rows[0];
                    const notExpired = !dc.expires_at || new Date(dc.expires_at) >= new Date();
                    const withinLimit = dc.max_uses === null || dc.uses_count < dc.max_uses;

                    let firstPurchaseOk = true;
                    if (dc.first_purchase_only) {
                        const prev = await query(
                            `SELECT COUNT(*) as cnt FROM customer_orders
                             WHERE customer_email = ? AND status IN ('paid','processing','shipped','delivered')`,
                            [customerEmail.toLowerCase()]
                        );
                        firstPurchaseOk = Number(prev.rows[0].cnt) === 0;
                    }

                    if (notExpired && withinLimit && firstPurchaseOk) {
                        discountAmount = dc.discount_type === 'percent'
                            ? Math.round(subtotal * dc.discount_value / 100)
                            : Math.min(Math.round(dc.discount_value), subtotal);
                        appliedCode = code;
                    }
                }
            }

            const discountedSubtotal = subtotal - discountAmount;
            const shipping = discountedSubtotal >= 120000 ? 0 : 12000;
            const total = discountedSubtotal + shipping;

            // Referencia única: DY-timestamp-random4chars
            const ref = `DY-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

            // Insertar orden
            const orderResult = await query(
                `INSERT INTO customer_orders
           (reference, status, customer_name, customer_email, customer_phone,
            shipping_address, shipping_city, shipping_department, shipping_zip,
            subtotal_cop, shipping_cop, discount_amount_cop, total_cop,
            discount_code, notes, user_id)
         VALUES (?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id, reference`,
                [ref, customerName, customerEmail, customerPhone || null,
                    shippingAddress, shippingCity, shippingDepartment || null, shippingZip || null,
                    subtotal, shipping, discountAmount, total,
                    appliedCode, notes || null,
                    req.user?.id || null]
            );

            const { id: orderId, reference } = orderResult.rows[0];

            // Insertar ítems
            for (const item of normalizedItems) {
                await query(
                    `INSERT INTO customer_order_items
             (order_id, product_id, product_name, product_image, unit_price_cop, quantity, subtotal_cop)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [orderId, item.productId, item.productName, item.productImage || null,
                        item.unitPrice, item.quantity, item.subtotal]
                );
            }

            // Generar URL de checkout Wompi
            const redirectUrl = `${SITE_URL}/confirmacion?ref=${reference}`;
            let checkoutUrl = null;

            if (WOMPI_PUBLIC_KEY && WOMPI_INTEGRITY_SECRET) {
                checkoutUrl = buildWompiCheckoutUrl(reference, total, customerEmail, redirectUrl);
            }

            if (appliedCode) {
                await query(
                    `UPDATE discount_codes SET uses_count = uses_count + 1 WHERE code = ?`,
                    [appliedCode]
                );
            }

            await logAudit(null, 'create', 'customer_orders', orderId, { reference, total, discount: discountAmount });

            // Geocodificación asíncrona — no bloquea la respuesta HTTP
            geocodeOrderAsync(orderId, shippingCity, shippingDepartment);

            return res.status(201).json({
                success: true,
                data: { orderId, reference, subtotal, discountAmount, shipping, total, checkoutUrl }
            });
        } catch (err) {
            logger.error({ err }, '[POST /api/orders] Error:');
            return res.status(500).json({ success: false, error: 'Error al crear la orden' });
        }
    }
);

// ─── GET /api/orders/:ref ────────────────────────────────────────────────
// Consulta pública de estado de orden (para página de confirmación)

ordersRouter.get('/:ref', async (req, res) => {
    try {
        const { ref } = req.params;

        const orderResult = await query(
            `SELECT o.id, o.reference, o.status,
                            o.shipping_city, o.subtotal_cop, o.shipping_cop, o.total_cop,
                            o.payment_method, o.created_at, o.updated_at
       FROM customer_orders o
       WHERE o.reference = ?`,
            [ref]
        );

        if (!orderResult.rows.length) {
            return res.status(404).json({ success: false, error: 'Orden no encontrada' });
        }

        const order = orderResult.rows[0];

        const itemsResult = await query(
            `SELECT product_id, product_name, product_image, unit_price_cop, quantity, subtotal_cop
       FROM customer_order_items
       WHERE order_id = ?
       ORDER BY id`,
            [order.id]
        );

        // Exponer solo datos no sensibles para el cliente
        return res.json({
            success: true,
            data: { ...order, items: itemsResult.rows }
        });
    } catch (err) {
        logger.error({ err }, '[GET /api/orders/:ref] Error:');
        return res.status(500).json({ success: false, error: 'Error al consultar la orden' });
    }
});

// ─── GET /api/orders (admin) ─────────────────────────────────────────────

ordersRouter.get('/',
    authenticateToken,
    requireRole('admin'),
    async (req, res) => {
        try {
            const { status, limit = 50, offset = 0 } = req.query;

            let sql = `
        SELECT o.id, o.reference, o.status, o.customer_name, o.customer_email,
               o.shipping_city, o.total_cop, o.payment_method, o.created_at
        FROM customer_orders o
        WHERE 1=1
      `;
            const params = [];

            if (status) {
                params.push(status);
                sql += ` AND o.status = ?`;
            }

            sql += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));

            const result = await query(sql, params);

            const countResult = await query(
                `SELECT COUNT(*) as count FROM customer_orders${status ? ' WHERE status = ?' : ''}`,
                status ? [status] : []
            );

            return res.json({
                success: true,
                data: result.rows,
                total: Number(countResult.rows[0].count),
                limit: Number(limit),
                offset: Number(offset)
            });
        } catch (err) {
            logger.error({ err }, '[GET /api/orders] Error:');
            return res.status(500).json({ success: false, error: 'Error al listar órdenes' });
        }
    }
);

// ─── PATCH /api/orders/:ref/status (admin) ───────────────────────────────

ordersRouter.patch('/:ref/status',
    authenticateToken,
    requireRole('admin'),
    [body('status').isIn(['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
        .withMessage('Estado inválido')],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ success: false, errors: errors.array() });
        }
        try {
            const { ref } = req.params;
            const { status, notes } = req.body;

            const result = await query(
                `UPDATE customer_orders
         SET status = ?, notes = COALESCE(?, notes)
         WHERE reference = ?
         RETURNING id, reference, status`,
                [status, notes || null, ref]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, error: 'Orden no encontrada' });
            }

            await logAudit(req.user.id, 'update', 'customer_orders', result.rows[0].id, { status });

            return res.json({ success: true, data: result.rows[0] });
        } catch (err) {
            logger.error({ err }, '[PATCH /api/orders/:ref/status] Error:');
            return res.status(500).json({ success: false, error: 'Error actualizando estado' });
        }
    }
);

// ─── POST /api/orders/wompi/webhook ──────────────────────────────────────
// Notificación server-to-server de Wompi al confirmar un pago

ordersRouter.post('/wompi/webhook', async (req, res) => {
    try {
        const event = req.body;
        if (process.env.NODE_ENV === 'production' && !WOMPI_EVENTS_SECRET) {
            logger.error('[Wompi webhook] WOMPI_EVENTS_SECRET no configurado en producción');
            return res.sendStatus(500);
        }

        const checksum = event?.signature?.checksum;
        const tsStr = event?.timestamp;
        if (!checksum || !tsStr) {
            return res.sendStatus(400);
        }
        if (WOMPI_EVENTS_SECRET) {
            const expected = crypto
                .createHash('sha256')
                .update(`${tsStr}${WOMPI_EVENTS_SECRET}`, 'utf8')
                .digest('hex');
            if (expected !== checksum) {
                logger.warn('[Wompi webhook] Firma inválida');
                return res.sendStatus(401);
            }
        }

        if (event?.event !== 'transaction.updated') return res.sendStatus(200);

        const tx = event.data?.transaction;
        if (!tx) return res.sendStatus(400);

        const { reference, status: txStatus, id: txId, payment_method_type, amount_in_cents, currency } = tx;
        if (!reference) return res.sendStatus(400);

        const orderLookup = await query(
            `SELECT id, status, total_cop, payment_transaction_id
       FROM customer_orders
       WHERE reference = ?`,
            [reference]
        );

        if (!orderLookup.rows.length) return res.sendStatus(200);

        const order = orderLookup.rows[0];
        if (order.payment_transaction_id && order.payment_transaction_id === txId) {
            return res.sendStatus(200);
        }
        if (order.payment_transaction_id && order.payment_transaction_id !== txId) {
            logger.warn('[Wompi webhook] Transacción distinta para ref:', reference);
            return res.sendStatus(200);
        }

        const expectedAmount = Number(order.total_cop) * 100;
        if (Number(amount_in_cents) !== expectedAmount || (currency && currency !== 'COP')) {
            logger.warn('[Wompi webhook] Monto/moneda inválidos para ref:', reference);
            const existingOrder = orderLookup.rows[0];
        }

        // Mapear estado de Wompi → estado interno
        const statusMap = { APPROVED: 'paid', DECLINED: 'cancelled', VOIDED: 'cancelled', ERROR: 'pending_payment' };
        const newStatus = statusMap[txStatus] || 'pending_payment';

        if (order.status !== 'pending_payment' && order.status !== newStatus) {
            return res.sendStatus(200);
        }

        const orderResult = await query(
            `UPDATE customer_orders
       SET status = ?, payment_method = ?, payment_transaction_id = ?,
           payment_data = ?
       WHERE reference = ?
       RETURNING id, customer_name, customer_email, total_cop, subtotal_cop, shipping_cop,
                 shipping_address, shipping_city`,
            [newStatus, payment_method_type || 'wompi', txId, JSON.stringify(tx), reference]
        );

        if (!orderResult.rows.length) return;

        const updatedOrder = orderResult.rows[0];

        // Enviar email de confirmación solo si el pago fue aprobado
        if (newStatus === 'paid') {
            const itemsResult = await query(
                `SELECT product_name, quantity, unit_price_cop
         FROM customer_order_items WHERE order_id = ?`,
                [updatedOrder.id]
            );

            await sendOrderConfirmationEmail(
                updatedOrder.customer_email,
                updatedOrder.customer_name,
                {
                    orderId: reference,
                    date: new Date().toISOString(),
                    items: itemsResult.rows.map(r => ({
                        name: r.product_name,
                        quantity: r.quantity,
                        price: r.unit_price_cop
                    })),
                    subtotal: updatedOrder.subtotal_cop,
                    shipping: updatedOrder.shipping_cop,
                    total: updatedOrder.total_cop,
                    shippingAddress: `${updatedOrder.shipping_address}, ${updatedOrder.shipping_city}`
                }
            );
        }

        return res.sendStatus(200);
    } catch (err) {
        logger.error({ err }, '[Wompi webhook] Error procesando evento:');
        return res.sendStatus(500);
    }
});
