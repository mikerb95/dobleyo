import { Router } from 'express';
import { logger } from '../logger.js';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { query, withTransaction } from '../db.js';
import { authenticateToken, requireRole, optionalAuth } from '../auth.js';
import { checkoutLimiter } from '../middleware/rateLimit.js';
import { logAudit, logSystemAudit } from '../services/audit.js';
import { sendOrderStatusEmail } from '../services/email.js';
import { geocodeOrderAsync } from '../services/geocoding.js';
import { trackingUrlForGuide } from '../services/interrapidisimo.js';
import { resolveOrderShipping, packageWeightKg, signQuote } from '../services/checkoutShipping.js';
import { findMunicipality } from '../utils/coLocations.js';
import { verifyEventSignature } from '../services/wompi.js';
import {
    deductStockForOrder, replenishStockForOrder, notifyConfirmedSale,
    sendConfirmationEmailForOrder, applyWompiTransaction, reconcileOrderPayment,
} from '../services/orderPayments.js';
import { handleSubscriptionTransaction } from './subscriptions.js';
import { runInBackground } from '../utils/background.js';

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

// El descuento/reposición de inventario, los avisos y la aplicación de las
// transacciones de Wompi viven en server/services/orderPayments.js.

// La consulta de pago desde la página de confirmación llama a la API de Wompi:
// se limita por IP para que nadie la use de martillo.
const verifyPaymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: { success: false, error: 'Demasiadas consultas. Intente de nuevo en unos minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skip: () => process.env.NODE_ENV === 'test',
});

// Texto libre de ciudad/departamento (pedidos sin DANE): solo letras, números,
// espacios y puntuación de nombres. Nada de HTML.
const PLACE_NAME_RE = /^[\p{L}\p{M}\d .,'()\-]{2,80}$/u;

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
        // Documento del comprador: lo exige Interrapidísimo para la guía. Opcional
        // en el API para no romper clientes viejos. PA = pasaporte.
        body('customerDocumentType').optional({ values: 'falsy' }).isIn(['CC', 'CE', 'NI', 'TI', 'PA']).withMessage('Tipo de documento inválido'),
        body('customerDocumentNumber').optional({ values: 'falsy' }).trim().matches(/^[0-9A-Za-z-]{4,25}$/).withMessage('Número de documento inválido'),
        body('shippingAddress').trim().notEmpty().withMessage('Dirección requerida'),
        body('shippingCity').trim().notEmpty().withMessage('Ciudad requerida')
            .matches(PLACE_NAME_RE).withMessage('Ciudad inválida'),
        body('shippingDepartment').optional({ values: 'falsy' }).trim()
            .matches(PLACE_NAME_RE).withMessage('Departamento inválido'),
        // DANE de la ciudad elegida en el checkout (Envia.com cotiza con él).
        body('shippingDaneCode').optional({ values: 'falsy' }).matches(/^\d{5}$/).withMessage('Ciudad inválida'),
        body('shippingQuoteToken').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
        body('items').isArray({ min: 1, max: 50 }).withMessage('El carrito está vacío'),
        body('items.*.productId').notEmpty(),
        body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Cantidad inválida'),
        // Total que el cliente vio en pantalla. Si no coincide con el calculado
        // aquí, no se crea la orden: se le devuelve el valor real para que confirme.
        body('expectedTotal').optional({ values: 'null' }).isInt({ min: 0 }),
        body('currency').optional().isIn(['COP', 'USD']).withMessage('Moneda inválida'),
        body('paymentMethod').optional().isIn(['wompi', 'cod']).withMessage('Método de pago inválido'),
        body('lang').optional().isIn(['es', 'en']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ success: false, errors: errors.array() });
        }

        try {
            const {
                customerName, customerEmail, customerPhone,
                customerDocumentType, customerDocumentNumber,
                shippingAddress, shippingZip, shippingDaneCode, shippingQuoteToken,
                items, notes, couponCode, currency = 'COP', paymentMethod = 'wompi', lang, expectedTotal
            } = req.body;
            const isUSD = currency === 'USD';
            const isCod = paymentMethod === 'cod';

            // El sitio vende solo en COP (también en inglés). La ruta en USD queda
            // apagada salvo que se habilite a propósito: daba envío gratis.
            if (isUSD && process.env.ENABLE_USD_CHECKOUT !== 'true') {
                return res.status(422).json({ success: false, error: 'Moneda no disponible' });
            }

            // Con DANE, ciudad y departamento salen de la lista oficial (no del texto del navegador).
            let { shippingCity, shippingDepartment } = req.body;
            const municipality = shippingDaneCode ? findMunicipality(shippingDaneCode) : null;
            if (shippingDaneCode && !municipality) {
                return res.status(422).json({ success: false, error: 'Ciudad no reconocida. Selecciónela de nuevo.' });
            }
            if (municipality) {
                shippingCity = municipality.city;
                shippingDepartment = municipality.department;
            }

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
                `SELECT id, name, price, price_usd, image_url, stock_quantity, weight, weight_unit
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
            // Envío: USD gratis (MVP). En COP gratis desde $120.000; si no, lo cotizado
            // con Envia.com para el DANE del destino (tarifa fija si no hay cotización).
            const shipping = isUSD ? 0 : (await resolveOrderShipping({
                discountedSubtotal,
                daneCode: municipality?.code || null,
                items: normalizedItems,
                products: productsResult.rows,
                isCod,
                quoteToken: shippingQuoteToken,
            })).shipping;
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

            // El cliente debe pagar lo que vio. Si el total cambió (precio, cupón que
            // ya no aplica, envío recotizado), no se crea la orden: se responde el
            // desglose real y un token que fija ese envío para el siguiente intento.
            if (expectedTotal != null && Number(expectedTotal) !== total) {
                const lockedQuoteToken = (!isUSD && municipality && shipping > 0)
                    ? signQuote({
                        daneCode: municipality.code,
                        weightKg: packageWeightKg(normalizedItems, productsResult.rows),
                        isCod,
                        cost: shipping,
                    })
                    : null;
                return res.status(409).json({
                    success: false,
                    code: 'TOTAL_CHANGED',
                    error: 'El total del pedido cambió. Revise el resumen y confirme de nuevo.',
                    data: { subtotal, discountAmount, shipping, total, shippingQuoteToken: lockedQuoteToken },
                });
            }

            // Referencia única: DY-timestamp-10 hex aleatorios. La consulta pública
            // del pedido se hace por referencia, así que no debe poder adivinarse.
            const ref = `DY-${Date.now()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
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
                customer_document_type, customer_document_number,
                shipping_address, shipping_city, shipping_department, shipping_zip, shipping_dane_code,
                subtotal_cop, shipping_cop, discount_amount_cop, total_cop, currency,
                discount_code, notes, user_id, payment_method, expected_amount_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id, reference`,
                    [ref, initialStatus, customerName, customerEmail, customerPhone || null,
                        customerDocumentNumber ? (customerDocumentType || 'CC') : null,
                        customerDocumentNumber || null,
                        shippingAddress, shippingCity, shippingDepartment || null, shippingZip || null, municipality?.code || null,
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

            // Generar URL de checkout Wompi (redirección a confirmación según idioma)
            const redirectUrl = (lang === 'en' || isUSD)
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
            // órdenes Wompi lo hacen al aprobarse el pago (ver POST /wompi/webhook). Se
            // espera (no fire-and-forget) para que la respuesta refleje stock consistente.
            if (isCod) {
                const codDeducted = await deductStockForOrder(orderId, reference).catch((err) => { logger.error({ err, orderId }, '[POST /api/orders] Error descontando stock COD'); return false; });
                if (codDeducted) await notifyConfirmedSale(orderId);
            }

            // Geocodificación asíncrona — no bloquea la respuesta HTTP
            geocodeOrderAsync(orderId, shippingCity, shippingDepartment);

            // COD no tiene webhook de confirmación de pago: enviar el email de
            // confirmación de una vez (la orden ya nace 'processing'). Si falla, lo
            // reintenta el mantenimiento.
            if (isCod) {
                runInBackground(sendConfirmationEmailForOrder(orderId), 'el correo de confirmación COD');
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

        // Seguimiento del envío activo más reciente. Solo transportadora, guía,
        // estado y eventos: la guía ya le llega al cliente por correo.
        const shipmentResult = await query(
            `SELECT id, provider, status, guide_number, delivery_company_name, tracking_url, tracking_updated_at
             FROM shipments
             WHERE order_id = ? AND status NOT IN ('cancelled','error')
             ORDER BY created_at DESC LIMIT 1`,
            [order.id]
        );
        let shipment = null;
        if (shipmentResult.rows.length) {
            const s = shipmentResult.rows[0];
            const eventsResult = await query(
                `SELECT update_state, description, event_date
                 FROM shipment_events
                 WHERE shipment_id = ? AND update_state IS NOT NULL
                 ORDER BY COALESCE(event_date, created_at) DESC
                 LIMIT 20`,
                [s.id]
            );
            shipment = {
                status: s.status,
                carrier: s.delivery_company_name,
                guideNumber: s.guide_number,
                trackingUrl: s.tracking_url
                    || (s.provider === 'interrapidisimo' && s.guide_number ? trackingUrlForGuide(s.guide_number) : null),
                updatedAt: s.tracking_updated_at,
                events: eventsResult.rows,
            };
        }

        // Exponer solo datos no sensibles para el cliente
        return res.json({
            success: true,
            data: { ...order, items: itemsResult.rows, shipment }
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

            const before = await query(`SELECT id, status, customer_email, customer_name, total_cop FROM customer_orders WHERE reference = ?`, [ref]);
            if (!before.rows.length) {
                return res.status(404).json({ success: false, error: 'Orden no encontrada' });
            }
            const previousStatus = before.rows[0].status;

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

            // Inventario: cambios manuales de estado también mueven stock, igual que
            // el webhook Wompi y la creación COD (idempotente vía stock_deducted_at).
            if (['cancelled', 'refunded'].includes(status) && !['cancelled', 'refunded'].includes(previousStatus)) {
                await replenishStockForOrder(result.rows[0].id, ref, 'Cancelación manual (admin)').catch((err) => logger.error({ err }, '[PATCH /api/orders/:ref/status] Error reponiendo stock'));
            } else if (['paid', 'processing'].includes(status) && !['paid', 'processing', 'shipped', 'delivered'].includes(previousStatus)) {
                const statusDeducted = await deductStockForOrder(result.rows[0].id, ref).catch((err) => { logger.error({ err }, '[PATCH /api/orders/:ref/status] Error descontando stock'); return false; });
                if (statusDeducted) await notifyConfirmedSale(result.rows[0].id);
            }

            await logAudit(req.user.id, 'update', 'customer_orders', result.rows[0].id, { status, previousStatus });

            // Avisar al cliente de los cambios que le importan. 'shipped' tiene su propio
            // correo (con la guía) desde shipping.js; 'paid' lo cubre la confirmación.
            const { customer_email, customer_name, total_cop } = before.rows[0];
            if (status !== previousStatus && ['delivered', 'cancelled', 'refunded'].includes(status) && customer_email && req.body.notify !== false) {
                sendOrderStatusEmail(customer_email, customer_name, { reference: ref, status, total: total_cop })
                    .catch((err) => logger.error({ err, ref }, '[PATCH /api/orders/:ref/status] Error enviando correo de estado'));
            }

            return res.json({ success: true, data: result.rows[0] });
        } catch (err) {
            logger.error({ err }, '[PATCH /api/orders/:ref/status] Error:');
            return res.status(500).json({ success: false, error: 'Error actualizando estado' });
        }
    }
);

// ─── POST /api/orders/:ref/verify-payment ────────────────────────────────
// Público. La página de confirmación lo llama mientras el pedido siga pendiente:
// le pregunta a Wompi por la referencia y, si hay un pago aprobado, lo aplica.
// Cubre el caso en que el webhook no llega. No confía en nada del navegador:
// `transactionId` solo sirve para ubicar la transacción en Wompi, y el monto y la
// referencia se validan igual que en el webhook.

ordersRouter.post('/:ref/verify-payment',
    verifyPaymentLimiter,
    [body('transactionId').optional({ values: 'falsy' }).isString().isLength({ max: 80 })],
    async (req, res) => {
        try {
            const { ref } = req.params;
            const readStatus = () => query(`SELECT status FROM customer_orders WHERE reference = ?`, [ref]);

            const before = await readStatus();
            if (!before.rows.length) {
                return res.status(404).json({ success: false, error: 'Orden no encontrada' });
            }
            let status = before.rows[0].status;

            if (validationResult(req).isEmpty() && ['pending_payment', 'cancelled'].includes(status)) {
                try {
                    const r = await reconcileOrderPayment(ref, {
                        transactionId: req.body?.transactionId || undefined,
                        source: 'wompi-reconcile-page',
                    });
                    if (r.recovered) status = (await readStatus()).rows[0]?.status ?? status;
                } catch (err) {
                    logger.error({ err, ref }, '[POST /api/orders/:ref/verify-payment] Error conciliando con Wompi');
                }
            }

            return res.json({ success: true, data: { reference: ref, status } });
        } catch (err) {
            logger.error({ err }, '[POST /api/orders/:ref/verify-payment] Error:');
            return res.status(500).json({ success: false, error: 'Error al consultar el pago' });
        }
    }
);

// ─── POST /api/orders/wompi/webhook ──────────────────────────────────────
// Notificación server-to-server de Wompi. Wompi admite UNA sola URL de eventos
// por ambiente, así que este endpoint atiende pedidos y cobros de suscripción:
// si la referencia no es de un pedido, se le pasa a subscriptions.js.
// Cualquier error responde 500 para que Wompi reintente; applyWompiTransaction
// es idempotente y completa lo que haya quedado a medias.

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
        if (WOMPI_EVENTS_SECRET && !verifyEventSignature(event)) {
            logger.warn('[Wompi webhook] Firma inválida');
            return res.sendStatus(401);
        }

        if (event?.event !== 'transaction.updated') return res.sendStatus(200);

        const tx = event.data?.transaction;
        if (!tx || !tx.reference || !tx.id) return res.sendStatus(400);

        const result = await applyWompiTransaction(tx, 'wompi-webhook');
        if (result.outcome === 'not_found' || result.outcome === 'ignored') {
            await handleSubscriptionTransaction(tx);
        }

        return res.sendStatus(200);
    } catch (err) {
        logger.error({ err }, '[Wompi webhook] Error procesando evento:');
        return res.sendStatus(500);
    }
});
