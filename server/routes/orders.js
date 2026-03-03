import { Router } from 'express';
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
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_EVENTS_SECRET || '';

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
        body('items.*.productName').notEmpty(),
        body('items.*.unitPrice').isInt({ min: 1 }),
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
                items, notes
            } = req.body;

            // Calcular totales en COP
            const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
            const shipping = subtotal >= 120000 ? 0 : 12000; // Gratis sobre $120.000
            const total = subtotal + shipping;

            // Referencia única: DY-timestamp-random4chars
            const ref = `DY-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

            // Insertar orden
            const orderResult = await query(
                `INSERT INTO customer_orders
           (reference, status, customer_name, customer_email, customer_phone,
            shipping_address, shipping_city, shipping_department, shipping_zip,
            subtotal_cop, shipping_cop, total_cop, notes, user_id)
         VALUES ($1, 'pending_payment', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, reference`,
                [ref, customerName, customerEmail, customerPhone || null,
                    shippingAddress, shippingCity, shippingDepartment || null, shippingZip || null,
                    subtotal, shipping, total, notes || null,
                    req.user?.id || null]
            );

            const { id: orderId, reference } = orderResult.rows[0];

            // Insertar ítems
            for (const item of items) {
                await query(
                    `INSERT INTO customer_order_items
             (order_id, product_id, product_name, product_image, unit_price_cop, quantity)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                    [orderId, item.productId, item.productName, item.productImage || null,
                        item.unitPrice, item.quantity]
                );
            }

            // Generar URL de checkout Wompi
            const redirectUrl = `${SITE_URL}/confirmacion?ref=${reference}`;
            let checkoutUrl = null;

            if (WOMPI_PUBLIC_KEY && WOMPI_INTEGRITY_SECRET) {
                checkoutUrl = buildWompiCheckoutUrl(reference, total, customerEmail, redirectUrl);
            }

            await logAudit(null, 'create', 'customer_orders', orderId, { reference, total });

            // Geocodificación asíncrona — no bloquea la respuesta HTTP
            geocodeOrderAsync(orderId, shippingCity, shippingDepartment);

            return res.status(201).json({
                success: true,
                data: { orderId, reference, total, shipping, checkoutUrl }
            });
        } catch (err) {
            console.error('[POST /api/orders] Error:', err);
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
            `SELECT o.id, o.reference, o.status, o.customer_name, o.customer_email,
              o.shipping_city, o.subtotal_cop, o.shipping_cop, o.total_cop,
              o.payment_method, o.created_at, o.updated_at
       FROM customer_orders o
       WHERE o.reference = $1`,
            [ref]
        );

        if (!orderResult.rows.length) {
            return res.status(404).json({ success: false, error: 'Orden no encontrada' });
        }

        const order = orderResult.rows[0];

        const itemsResult = await query(
            `SELECT product_id, product_name, product_image, unit_price_cop, quantity, subtotal_cop
       FROM customer_order_items
       WHERE order_id = $1
       ORDER BY id`,
            [order.id]
        );

        // Exponer solo datos no sensibles para el cliente
        return res.json({
            success: true,
            data: { ...order, items: itemsResult.rows }
        });
    } catch (err) {
        console.error('[GET /api/orders/:ref] Error:', err);
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
                sql += ` AND o.status = $${params.length}`;
            }

            sql += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(Number(limit), Number(offset));

            const result = await query(sql, params);

            const countResult = await query(
                `SELECT COUNT(*) FROM customer_orders${status ? ' WHERE status = $1' : ''}`,
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
            console.error('[GET /api/orders] Error:', err);
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
         SET status = $1, notes = COALESCE($2, notes)
         WHERE reference = $3
         RETURNING id, reference, status`,
                [status, notes || null, ref]
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, error: 'Orden no encontrada' });
            }

            await logAudit(req.user.id, 'update', 'customer_orders', result.rows[0].id, { status });

            return res.json({ success: true, data: result.rows[0] });
        } catch (err) {
            console.error('[PATCH /api/orders/:ref/status] Error:', err);
            return res.status(500).json({ success: false, error: 'Error actualizando estado' });
        }
    }
);

// ─── POST /api/orders/wompi/webhook ──────────────────────────────────────
// Notificación server-to-server de Wompi al confirmar un pago

ordersRouter.post('/wompi/webhook', async (req, res) => {
    try {
        res.sendStatus(200); // Responder rápido a Wompi

        const event = req.body;
        if (event?.event !== 'transaction.updated') return;

        const tx = event.data?.transaction;
        if (!tx) return;

        const { reference, status: txStatus, id: txId, payment_method_type } = tx;
        if (!reference) return;

        // Verificar firma de Wompi (checksum)
        const checksum = event?.signature?.checksum;
        const tsStr = event?.timestamp;
        if (WOMPI_INTEGRITY_SECRET && checksum && tsStr) {
            const expected = crypto
                .createHash('sha256')
                .update(`${tsStr}${WOMPI_INTEGRITY_SECRET}`, 'utf8')
                .digest('hex');
            if (expected !== checksum) {
                console.warn('[Wompi webhook] Firma inválida para ref:', reference);
                return;
            }
        }

        // Mapear estado de Wompi → estado interno
        const statusMap = { APPROVED: 'paid', DECLINED: 'cancelled', VOIDED: 'cancelled', ERROR: 'pending_payment' };
        const newStatus = statusMap[txStatus] || 'pending_payment';

        const orderResult = await query(
            `UPDATE customer_orders
       SET status = $1, payment_method = $2, payment_transaction_id = $3,
           payment_data = $4
       WHERE reference = $5
       RETURNING id, customer_name, customer_email, total_cop, subtotal_cop, shipping_cop,
                 shipping_address, shipping_city`,
            [newStatus, payment_method_type || 'wompi', txId, JSON.stringify(tx), reference]
        );

        if (!orderResult.rows.length) return;

        const order = orderResult.rows[0];

        // Enviar email de confirmación solo si el pago fue aprobado
        if (newStatus === 'paid') {
            const itemsResult = await query(
                `SELECT product_name, quantity, unit_price_cop
         FROM customer_order_items WHERE order_id = $1`,
                [order.id]
            );

            await sendOrderConfirmationEmail(
                order.customer_email,
                order.customer_name,
                {
                    orderId: reference,
                    date: new Date().toISOString(),
                    items: itemsResult.rows.map(r => ({
                        name: r.product_name,
                        quantity: r.quantity,
                        price: r.unit_price_cop
                    })),
                    subtotal: order.subtotal_cop,
                    shipping: order.shipping_cop,
                    total: order.total_cop,
                    shippingAddress: `${order.shipping_address}, ${order.shipping_city}`
                }
            );
        }
    } catch (err) {
        console.error('[Wompi webhook] Error procesando evento:', err);
    }
});
