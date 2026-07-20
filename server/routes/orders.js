import { Router } from 'express';
import { logger } from '../logger.js';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { query, withTransaction } from '../db.js';
import { authenticateToken, requireRole, optionalAuth } from '../auth.js';
import { checkoutLimiter } from '../middleware/rateLimit.js';
import { logAudit, logSystemAudit } from '../services/audit.js';
import { sendOrderConfirmationEmail } from '../services/email.js';
import { geocodeOrderAsync } from '../services/geocoding.js';

export const ordersRouter = Router();

const SITE_URL = process.env.SITE_BASE_URL || 'https://dobleyo.cafe';
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';

// ─── Contraentrega (COD) — límites antifraude ──────────────────────────────
const COD_MAX_TOTAL_COP = Number(process.env.COD_MAX_TOTAL_COP) || 300000;

// Rate limit específico para órdenes COD por IP, además del checkoutLimiter general.
const codOrderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,
    message: { error: 'Demasiados pedidos contraentrega desde esta IP. Intente más tarde.', retryAfter: 3600 },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skip: (req) => process.env.NODE_ENV === 'test' || req.body?.paymentMethod !== 'cod',
});

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
function buildWompiCheckoutUrl(reference, amountPesos, customerEmail, redirectUrl, currency = 'COP') {
    const amountCents = amountPesos * 100;
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

/**
 * Parámetros firmados para el Widget Checkout embebido de Wompi (modal in-page).
 * Mismos datos que la URL hosted, pero estructurados para `new WidgetCheckout(...)`.
 * Solo expone la firma de integridad (hash), nunca el secreto.
 */
function buildWompiWidgetData(reference, amountPesos, customerEmail, redirectUrl, currency = 'COP') {
    const amountInCents = amountPesos * 100;
    return {
        publicKey: WOMPI_PUBLIC_KEY,
        currency,
        amountInCents,
        reference,
        signature: wompiIntegrityHash(reference, amountInCents, currency),
        redirectUrl,
        customerEmail,
    };
}

/**
 * Verifica la firma de un evento (webhook) de Wompi.
 * checksum = SHA256( valores_de_properties (en orden) + timestamp + eventsSecret ).
 * `properties` son rutas relativas a `data`, p.ej. "transaction.id".
 * Ata la firma al contenido del evento, no solo al timestamp.
 * https://docs.wompi.co/docs/colombia/eventos/
 */
function verifyWompiEventSignature(event) {
    const checksum = event?.signature?.checksum;
    const properties = event?.signature?.properties;
    const tsStr = event?.timestamp;
    if (!checksum || !tsStr || !Array.isArray(properties)) return false;

    const concatenated = properties
        .map((path) => path.split('.').reduce((obj, key) => obj?.[key], event.data))
        .map((v) => (v == null ? '' : String(v)))
        .join('');

    const expected = crypto
        .createHash('sha256')
        .update(`${concatenated}${tsStr}${WOMPI_EVENTS_SECRET}`, 'utf8')
        .digest('hex');

    // Comparación en tiempo constante para evitar timing attacks.
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(checksum), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Inventario: descuento directo al confirmarse el pago ─────────────────
// Se descuenta SOLO cuando la orden queda 'paid' (webhook Wompi) o nace COD
// ('processing' de inmediato) — nunca en 'pending_payment'. No hay reserva de
// stock: el riesgo de sobreventa entre creación y pago se acepta para este
// catálogo de bajo volumen. Idempotente vía `stock_deducted_at`.
async function deductStockForOrder(orderId, reference) {
    const order = await query(`SELECT stock_deducted_at FROM customer_orders WHERE id = ?`, [orderId]);
    if (!order.rows.length || order.rows[0].stock_deducted_at) return;

    const items = await query(`SELECT product_id, quantity FROM customer_order_items WHERE order_id = ?`, [orderId]);

    for (const item of items.rows) {
        const result = await query(
            `UPDATE products SET stock_quantity = stock_quantity - ?
             WHERE id = ? AND stock_quantity >= ?
             RETURNING stock_quantity`,
            [item.quantity, item.product_id, item.quantity]
        );
        if (result.rows.length) {
            const after = result.rows[0].stock_quantity;
            await query(
                `INSERT INTO inventory_movements
                    (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference)
                 VALUES (?, 'salida', ?, ?, ?, 'Venta e-commerce', ?)`,
                [item.product_id, item.quantity, after + item.quantity, after, reference]
            );
        } else {
            // Sobreventa: no se pudo descontar (stock insuficiente en el momento del
            // pago). La orden ya está pagada/confirmada, así que se deja seguir — se
            // registra para que el admin gestione backorder/reposición.
            logger.warn({ orderId, productId: item.product_id, quantity: item.quantity }, '[Inventory] Sobreventa detectada al descontar stock');
            logSystemAudit('oversold', 'products', item.product_id, { orderId, reference, quantity: item.quantity }).catch(() => {});
        }
    }

    await query(`UPDATE customer_orders SET stock_deducted_at = datetime('now') WHERE id = ?`, [orderId]);
}

// Repone stock cuando una orden que YA había descontado inventario se cancela
// o reembolsa. Si nunca se descontó (p. ej. seguía en pending_payment), no hay
// nada que reponer.
async function replenishStockForOrder(orderId, reference, reasonLabel) {
    const order = await query(`SELECT stock_deducted_at FROM customer_orders WHERE id = ?`, [orderId]);
    if (!order.rows.length || !order.rows[0].stock_deducted_at) return;

    const items = await query(`SELECT product_id, quantity FROM customer_order_items WHERE order_id = ?`, [orderId]);
    for (const item of items.rows) {
        const result = await query(
            `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? RETURNING stock_quantity`,
            [item.quantity, item.product_id]
        );
        if (result.rows.length) {
            const after = result.rows[0].stock_quantity;
            await query(
                `INSERT INTO inventory_movements
                    (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference)
                 VALUES (?, 'devolucion', ?, ?, ?, ?, ?)`,
                [item.product_id, item.quantity, after - item.quantity, after, reasonLabel, reference]
            );
        }
    }
    await query(`UPDATE customer_orders SET stock_deducted_at = NULL WHERE id = ?`, [orderId]);
}

// ─── POST /api/orders ─────────────────────────────────────────────────────
// Crea una orden en estado pending_payment y devuelve la URL de pago Wompi

ordersRouter.post('/',
    checkoutLimiter,
    codOrderLimiter,
    optionalAuth,
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
        body('currency').optional().isIn(['COP', 'USD']).withMessage('Moneda inválida'),
        body('paymentMethod').optional().isIn(['wompi', 'cod']).withMessage('Método de pago inválido'),
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
                items, notes, couponCode, currency = 'COP', paymentMethod = 'wompi'
            } = req.body;
            const isUSD = currency === 'USD';
            const isCod = paymentMethod === 'cod';

            // Contraentrega solo aplica a Colombia/COP (Mipaquete no cubre envíos internacionales).
            if (isCod && isUSD) {
                return res.status(422).json({ success: false, error: 'El pago contraentrega solo está disponible en Colombia' });
            }

            // No crear una orden que después no se pueda pagar: si el checkout es por
            // Wompi y faltan las llaves, se rechaza antes de tocar la base de datos.
            if (!isCod && (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET)) {
                logger.error('[POST /api/orders] Wompi no configurado (faltan WOMPI_PUBLIC_KEY/WOMPI_INTEGRITY_SECRET)');
                return res.status(503).json({ success: false, error: 'Pagos en línea no disponibles en este momento. Intente de nuevo más tarde.' });
            }

            // Celular colombiano estricto: Mipaquete requiere un número válido para contactar
            // al destinatario, y esto también dificulta el fraude con datos inventados.
            if (isCod) {
                const digits = String(customerPhone || '').replace(/\D/g, '').slice(-10);
                if (!/^3\d{9}$/.test(digits)) {
                    return res.status(422).json({ success: false, error: 'Para contraentrega se requiere un celular colombiano válido' });
                }
            }

            const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
            if (!productIds.length) {
                return res.status(422).json({ success: false, error: 'El carrito está vacío' });
            }

            const placeholders = productIds.map(() => '?').join(', ');
            const productsResult = await query(
                `SELECT id, name, price, price_usd, image_url, stock_quantity
         FROM products
         WHERE id IN (${placeholders}) AND is_active = 1`,
                productIds
            );

            if (productsResult.rows.length !== productIds.length) {
                return res.status(422).json({ success: false, error: 'Uno o más productos no están disponibles' });
            }

            const productMap = new Map(productsResult.rows.map((p) => [p.id, p]));

            // Calcular totales en COP desde la BD (evita manipulación del cliente)
            // En USD la fuente de verdad es products.price_usd; si falta, no se puede vender en USD.
            if (isUSD) {
                const missing = productsResult.rows.find((p) => p.price_usd == null);
                if (missing) {
                    return res.status(422).json({ success: false, error: 'Algún producto no tiene precio en USD' });
                }
            }

            let subtotal = 0;
            const normalizedItems = items.map((item) => {
                const product = productMap.get(item.productId);
                const quantity = Number(item.quantity);
                const unitPrice = isUSD ? Number(product.price_usd) : Number(product.price);
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

            // Validar stock disponible (suma de líneas por producto, por si el carrito
            // trae el mismo producto en más de una línea). Solo informativo al crear la
            // orden — el descuento real ocurre al confirmarse el pago (ver deductStockForOrder);
            // entre estos dos momentos puede haber una venta concurrente que agote el
            // stock (riesgo aceptado para este catálogo de bajo volumen).
            const quantityByProduct = new Map();
            for (const item of normalizedItems) {
                quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity);
            }
            for (const [productId, qty] of quantityByProduct) {
                const product = productMap.get(productId);
                if (Number(product.stock_quantity) < qty) {
                    return res.status(422).json({ success: false, error: `"${product.name}" no tiene suficiente stock disponible` });
                }
            }

            // Aplicar cupón si viene en el request
            let discountAmount = 0;
            let appliedCode = null;
            if (couponCode && !isUSD) {
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
            // Envío: COP cobra $12.000 bajo $120.000; USD gratis a todo el mundo (MVP).
            const shipping = isUSD ? 0 : (discountedSubtotal >= 120000 ? 0 : 12000);
            const total = discountedSubtotal + shipping;

            // Mitigaciones antifraude para contraentrega: tope de monto, límite de
            // pedidos COD abiertos por email/teléfono, y bloqueo si hubo un envío
            // devuelto previamente (indicio de que el destinatario no recibe/rechaza).
            if (isCod) {
                if (total > COD_MAX_TOTAL_COP) {
                    logger.warn({ customerEmail, total, limit: COD_MAX_TOTAL_COP }, '[POST /api/orders] COD rechazado: excede tope antifraude');
                    logSystemAudit('cod_rejected', 'customer_orders', customerEmail.toLowerCase(), { reason: 'max_total_exceeded', total, limit: COD_MAX_TOTAL_COP }).catch(() => {});
                    return res.status(422).json({
                        success: false,
                        error: `El pago contraentrega solo aplica para pedidos hasta $${COD_MAX_TOTAL_COP.toLocaleString('es-CO')}`
                    });
                }

                const digits = String(customerPhone || '').replace(/\D/g, '').slice(-10);
                const openCod = await query(
                    `SELECT COUNT(*) as cnt FROM customer_orders
                     WHERE payment_method = 'cod' AND status IN ('processing','shipped')
                       AND (customer_email = ? OR customer_phone LIKE ?)`,
                    [customerEmail.toLowerCase(), `%${digits}`]
                );
                if (Number(openCod.rows[0].cnt) >= 2) {
                    logger.warn({ customerEmail, digits }, '[POST /api/orders] COD rechazado: pedidos abiertos en curso');
                    logSystemAudit('cod_rejected', 'customer_orders', customerEmail.toLowerCase(), { reason: 'open_orders_limit' }).catch(() => {});
                    return res.status(422).json({
                        success: false,
                        error: 'Ya tiene pedidos contraentrega en curso. Complete la entrega antes de generar uno nuevo.'
                    });
                }

                const returnedBefore = await query(
                    `SELECT COUNT(*) as cnt FROM customer_orders o
                     JOIN shipments s ON s.order_id = o.id
                     WHERE s.status = 'returned' AND (o.customer_email = ? OR o.customer_phone LIKE ?)`,
                    [customerEmail.toLowerCase(), `%${digits}`]
                );
                if (Number(returnedBefore.rows[0].cnt) > 0) {
                    logger.warn({ customerEmail, digits }, '[POST /api/orders] COD rechazado: devolución previa registrada');
                    logSystemAudit('cod_rejected', 'customer_orders', customerEmail.toLowerCase(), { reason: 'previous_return' }).catch(() => {});
                    return res.status(422).json({
                        success: false,
                        error: 'No es posible generar un pedido contraentrega para estos datos de contacto'
                    });
                }
            }

            // Referencia única: DY-timestamp-random4chars
            const ref = `DY-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            const initialStatus = isCod ? 'processing' : 'pending_payment';
            // Monto exacto que se firmará hacia Wompi (en centavos, en la moneda real
            // de la orden). El webhook valida contra este campo en vez de asumir COP,
            // lo que permite confirmar pagos en USD correctamente.
            const expectedAmountCents = isCod ? null : total * 100;

            // Insertar orden + ítems en una sola transacción: evita órdenes "huérfanas"
            // sin ítems si el proceso falla a mitad de camino (rompería el cálculo de
            // peso/valor declarado del envío más adelante).
            const { orderId, reference } = await withTransaction(async ({ query: txq }) => {
                const orderResult = await txq(
                    `INSERT INTO customer_orders
               (reference, status, customer_name, customer_email, customer_phone,
                shipping_address, shipping_city, shipping_department, shipping_zip,
                subtotal_cop, shipping_cop, discount_amount_cop, total_cop, currency,
                discount_code, notes, user_id, payment_method, expected_amount_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id, reference`,
                    [ref, initialStatus, customerName, customerEmail, customerPhone || null,
                        shippingAddress, shippingCity, shippingDepartment || null, shippingZip || null,
                        subtotal, shipping, discountAmount, total, currency,
                        appliedCode, notes || null,
                        req.user?.id || null, isCod ? 'cod' : null, expectedAmountCents]
                );

                const { id, reference: createdRef } = orderResult.rows[0];

                for (const item of normalizedItems) {
                    await txq(
                        `INSERT INTO customer_order_items
                 (order_id, product_id, product_name, product_image, unit_price_cop, quantity, subtotal_cop)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [id, item.productId, item.productName, item.productImage || null,
                            item.unitPrice, item.quantity, item.subtotal]
                    );
                }

                return { orderId: id, reference: createdRef };
            });

            // Generar URL de checkout Wompi (redirección a confirmación según idioma/moneda)
            const redirectUrl = isUSD
                ? `https://en.dobleyo.cafe/confirmation?ref=${reference}`
                : `${SITE_URL}/confirmacion?ref=${reference}`;
            let checkoutUrl = null;
            let wompi = null;

            if (!isCod && WOMPI_PUBLIC_KEY && WOMPI_INTEGRITY_SECRET) {
                checkoutUrl = buildWompiCheckoutUrl(reference, total, customerEmail, redirectUrl, currency);
                wompi = buildWompiWidgetData(reference, total, customerEmail, redirectUrl, currency);
            }

            // El uso del cupón se contabiliza al CONFIRMAR el pago (webhook Wompi), no aquí:
            // incrementar en la creación permitía agotar promociones con órdenes que nunca
            // se pagan. En COD no hay webhook de pago, así que el cupón se cuenta de una vez
            // (la orden ya nace confirmada, sin intento de pago que pueda fallar).
            if (isCod && appliedCode) {
                await query(
                    `UPDATE discount_codes SET uses_count = uses_count + 1
                     WHERE code = ? AND (max_uses IS NULL OR uses_count < max_uses)`,
                    [appliedCode]
                );
            }

            await logAudit(req.user?.id || null, 'create', 'customer_orders', orderId, { reference, total, discount: discountAmount, paymentMethod });

            // COD nace confirmada ('processing'): el descuento de stock ocurre aquí. Las
            // órdenes Wompi lo hacen al aprobarse el pago (ver POST /wompi/webhook).
            if (isCod) {
                deductStockForOrder(orderId, reference).catch((err) => logger.error({ err, orderId }, '[POST /api/orders] Error descontando stock COD'));
            }

            // Geocodificación asíncrona — no bloquea la respuesta HTTP
            geocodeOrderAsync(orderId, shippingCity, shippingDepartment);

            // COD no tiene webhook de confirmación de pago: enviar el email de
            // confirmación de una vez (la orden ya nace 'processing').
            if (isCod) {
                sendOrderConfirmationEmail(customerEmail, customerName, {
                    orderId: reference,
                    date: new Date().toISOString(),
                    items: normalizedItems.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice })),
                    subtotal,
                    shipping,
                    total,
                    shippingAddress: `${shippingAddress}, ${shippingCity}`,
                }).then(() => query(`UPDATE customer_orders SET confirmation_email_sent_at = datetime('now') WHERE id = ?`, [orderId]))
                    .catch((err) => logger.error({ err }, '[POST /api/orders] Error enviando confirmación COD'));
            }

            return res.status(201).json({
                success: true,
                data: { orderId, reference, subtotal, discountAmount, shipping, total, currency, paymentMethod, checkoutUrl, wompi }
            });
        } catch (err) {
            logger.error({ err }, '[POST /api/orders] Error:');
            return res.status(500).json({ success: false, error: 'Error al crear la orden' });
        }
    }
);

// ─── GET /api/orders/mine ────────────────────────────────────────────────
// Historial de pedidos del usuario autenticado. Debe declararse ANTES de
// '/:ref' para que Express no interprete 'mine' como una referencia.

ordersRouter.get('/mine', authenticateToken, async (req, res) => {
    try {
        const ordersResult = await query(
            `SELECT id, reference, status, shipping_city, shipping_department,
                    subtotal_cop, shipping_cop, total_cop, currency,
                    payment_method, created_at
             FROM customer_orders
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 100`,
            [req.user.id]
        );

        const orders = ordersResult.rows;
        if (!orders.length) return res.json({ success: true, data: [] });

        // Traer todos los ítems en una sola consulta y agruparlos por orden.
        const ids = orders.map((o) => o.id);
        const placeholders = ids.map(() => '?').join(', ');
        const itemsResult = await query(
            `SELECT order_id, product_id, product_name, product_image, unit_price_cop, quantity, subtotal_cop
             FROM customer_order_items
             WHERE order_id IN (${placeholders})
             ORDER BY id`,
            ids
        );

        const itemsByOrder = new Map();
        for (const item of itemsResult.rows) {
            if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
            itemsByOrder.get(item.order_id).push(item);
        }

        const data = orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] }));
        return res.json({ success: true, data });
    } catch (err) {
        logger.error({ err }, '[GET /api/orders/mine] Error:');
        return res.status(500).json({ success: false, error: 'Error al consultar tus pedidos' });
    }
});

// ─── GET /api/orders/:ref ────────────────────────────────────────────────
// Consulta pública de estado de orden (para página de confirmación)

ordersRouter.get('/:ref', async (req, res) => {
    try {
        const { ref } = req.params;

        const orderResult = await query(
            `SELECT o.id, o.reference, o.status,
                            o.shipping_city, o.subtotal_cop, o.shipping_cop, o.total_cop, o.currency,
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
        if (WOMPI_EVENTS_SECRET && !verifyWompiEventSignature(event)) {
            logger.warn('[Wompi webhook] Firma inválida');
            return res.sendStatus(401);
        }

        if (event?.event !== 'transaction.updated') return res.sendStatus(200);

        const tx = event.data?.transaction;
        if (!tx) return res.sendStatus(400);

        const { reference, status: txStatus, id: txId, payment_method_type, amount_in_cents, currency } = tx;
        if (!reference) return res.sendStatus(400);

        const orderLookup = await query(
            `SELECT id, status, total_cop, currency, expected_amount_cents, payment_transaction_id, discount_code
       FROM customer_orders
       WHERE reference = ?`,
            [reference]
        );

        if (!orderLookup.rows.length) return res.sendStatus(200);

        const order = orderLookup.rows[0];

        // Mapear estado de Wompi → estado interno.
        const statusMap = { APPROVED: 'paid', DECLINED: 'cancelled', VOIDED: 'cancelled', ERROR: 'pending_payment' };
        const newStatus = statusMap[txStatus] || 'pending_payment';

        // Idempotencia: el mismo evento (misma transacción y mismo estado resultante)
        // ya fue aplicado → acusamos recibo sin reprocesar (evita reenviar el correo).
        if (order.payment_transaction_id === txId && order.status === newStatus) {
            return res.sendStatus(200);
        }

        // El monto y la moneda deben coincidir con la orden, en la moneda REAL de la
        // orden (COP o USD) — expected_amount_cents se fija al crear la orden con el
        // mismo monto firmado hacia Wompi, así que sirve tanto para COP como para USD.
        // Órdenes creadas antes de esta columna (expected_amount_cents NULL) caen al
        // cálculo legado en COP para no romper transacciones en vuelo.
        const expectedAmount = order.expected_amount_cents != null
            ? Number(order.expected_amount_cents)
            : Number(order.total_cop) * 100;
        const expectedCurrency = order.currency || 'COP';
        if (Number(amount_in_cents) !== expectedAmount || (currency && currency !== expectedCurrency)) {
            logger.warn({ reference, txId, expectedAmount, expectedCurrency, amount_in_cents, currency }, '[Wompi webhook] Monto/moneda inválidos; se ignora');
            return res.sendStatus(200);
        }

        // Una orden ya pagada no se degrada por una transacción DISTINTA (p. ej. un
        // segundo intento con otra tarjeta que llega tarde). Solo un evento de la MISMA
        // transacción (un VOID/contracargo) puede cambiarla.
        if (order.status === 'paid' && order.payment_transaction_id && order.payment_transaction_id !== txId) {
            logger.warn({ reference, txId }, '[Wompi webhook] Orden ya pagada por otra transacción; se ignora');
            return res.sendStatus(200);
        }

        // Un pago APROBADO gana sobre intentos previos fallidos: aunque un DECLINED
        // anterior haya dejado la orden en 'cancelled', un APPROVED posterior (nueva
        // transacción, misma referencia) la marca como pagada. Para estados que NO son
        // 'paid', no pisamos una orden que ya avanzó en el fulfillment, salvo que el
        // evento venga de la misma transacción registrada (p. ej. un VOID posterior).
        if (newStatus !== 'paid'
            && order.status !== 'pending_payment'
            && order.status !== 'cancelled'
            && order.payment_transaction_id !== txId) {
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

        if (!orderResult.rows.length) return res.sendStatus(200);

        const updatedOrder = orderResult.rows[0];

        // El pago aprobado es el evento de negocio más importante del flujo: queda
        // en audit_logs aunque no haya un usuario autenticado detrás (lo dispara Wompi).
        logSystemAudit('update', 'customer_orders', updatedOrder.id, {
            reference, from: order.status, to: newStatus, txId, source: 'wompi-webhook',
        }).catch(() => {});

        // Contabilizar el uso del cupón SOLO al aprobarse el pago. El UPDATE es atómico
        // y tope-seguro: la condición evita superar max_uses ante webhooks concurrentes.
        if (newStatus === 'paid' && order.discount_code) {
            await query(
                `UPDATE discount_codes
           SET uses_count = uses_count + 1
         WHERE code = ? AND (max_uses IS NULL OR uses_count < max_uses)`,
                [order.discount_code]
            );
        }

        // Enviar email de confirmación solo si el pago fue aprobado. Se desacopla de la
        // respuesta HTTP del webhook: si Resend falla aquí, NO se debe devolver 500 (eso
        // dispararía un reintento de Wompi que la idempotencia de arriba ignoraría sin
        // reenviar el correo). El envío queda pendiente vía confirmation_email_sent_at
        // y refresh-all lo reintenta (ver server/routes/shipping.js).
        if (newStatus === 'paid') {
            const itemsResult = await query(
                `SELECT product_name, quantity, unit_price_cop
         FROM customer_order_items WHERE order_id = ?`,
                [updatedOrder.id]
            );

            sendOrderConfirmationEmail(
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
            ).then(() => query(`UPDATE customer_orders SET confirmation_email_sent_at = datetime('now') WHERE id = ?`, [updatedOrder.id]))
                .catch((err) => logger.error({ err, reference }, '[Wompi webhook] Error enviando confirmación de pago; se reintentará por refresh-all'));
        }

        return res.sendStatus(200);
    } catch (err) {
        logger.error({ err }, '[Wompi webhook] Error procesando evento:');
        return res.sendStatus(500);
    }
});
