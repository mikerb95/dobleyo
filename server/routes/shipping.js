import { Router } from 'express';
import crypto from 'crypto';
import { body, query as queryValidator, validationResult } from 'express-validator';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit, logSystemAudit } from '../services/audit.js';
import { sendShippingNotificationEmail } from '../services/email.js';
import {
    quoteShipping,
    createSending,
    getSendings,
    getTracking,
    cancelSending,
    getLocations,
    registerWebhook,
    healthCheck as mipaqueteHealthCheck,
    resolveDaneCode,
    computePackageFromOrder,
    findSendingByReference,
    MP_PAYMENT_TYPE_PREPAID,
    MP_PAYMENT_TYPE_COD,
    MipaqueteError,
    MipaqueteConfigError,
} from '../services/mipaquete.js';

export const shippingRouter = Router();

const SITE_URL = process.env.SITE_BASE_URL || 'https://dobleyo.cafe';
const ORIGIN_DANE = process.env.MIPAQUETE_ORIGIN_DANE;
const WEBHOOK_TOKEN = process.env.MIPAQUETE_WEBHOOK_TOKEN;

// Rate limit propio para el webhook público (evita abuso ya que no requiere JWT)
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
});

function handleMipaqueteError(res, err, fallbackMsg) {
    if (err instanceof MipaqueteConfigError) {
        logger.error({ err }, '[Shipping] Mipaquete no configurado');
        return res.status(503).json({ success: false, error: 'Servicio de envíos no configurado' });
    }
    if (err instanceof MipaqueteError) {
        logger.error({ status: err.status, body: err.body }, '[Shipping] Error Mipaquete');
        return res.status(err.retriable ? 502 : 422).json({ success: false, error: err.message });
    }
    logger.error({ err }, `[Shipping] ${fallbackMsg}`);
    return res.status(500).json({ success: false, error: fallbackMsg });
}

async function getOrderWithItems(orderId) {
    const orderResult = await query(
        `SELECT id, reference, status, currency, customer_name, customer_email, customer_phone,
                shipping_address, shipping_city, shipping_department, subtotal_cop, payment_method
         FROM customer_orders WHERE id = ?`,
        [orderId]
    );
    if (!orderResult.rows.length) return null;
    const order = orderResult.rows[0];

    const itemsResult = await query(
        `SELECT product_id, product_name, quantity, subtotal_cop FROM customer_order_items WHERE order_id = ?`,
        [orderId]
    );
    const items = itemsResult.rows;

    const productIds = [...new Set(items.map((i) => i.product_id))];
    let products = [];
    if (productIds.length) {
        const placeholders = productIds.map(() => '?').join(', ');
        const productsResult = await query(
            `SELECT id, name, weight, weight_unit FROM products WHERE id IN (${placeholders})`,
            productIds
        );
        products = productsResult.rows;
    }

    return { order, items, products };
}

// ─── GET /api/shipping/orders-pending (admin) ──────────────────────────────

shippingRouter.get('/orders-pending', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await query(`
            SELECT o.id, o.reference, o.status, o.customer_name, o.customer_email,
                   o.shipping_city, o.shipping_department, o.total_cop, o.currency,
                   o.payment_method, o.created_at
            FROM customer_orders o
            LEFT JOIN shipments s ON s.order_id = o.id AND s.status NOT IN ('cancelled','error')
            WHERE o.status IN ('paid','processing') AND o.currency = 'COP' AND s.id IS NULL
            ORDER BY o.created_at ASC
            LIMIT 100
        `);
        return res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error({ err }, '[GET /api/shipping/orders-pending] Error:');
        return res.status(500).json({ success: false, error: 'Error al listar pedidos pendientes' });
    }
});

// ─── GET /api/shipping/:orderId/suggest (admin) ────────────────────────────
// Prellena el formulario de cotización: peso calculado desde products.weight,
// valor declarado, y resolución de ciudad→DANE (o candidatos si es ambigua).

shippingRouter.get('/:orderId/suggest', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const data = await getOrderWithItems(req.params.orderId);
        if (!data) return res.status(404).json({ success: false, error: 'Orden no encontrada' });
        const { order, items, products } = data;

        const { weightKg, missingWeights, declaredValueCop } = computePackageFromOrder(items, products);
        const dane = await resolveDaneCode(order.shipping_city, order.shipping_department);

        return res.json({
            success: true,
            data: {
                order,
                weightKg: weightKg || 0.5,
                missingWeights,
                declaredValueCop,
                dane,
            },
        });
    } catch (err) {
        logger.error({ err }, '[GET /api/shipping/:orderId/suggest] Error:');
        return res.status(500).json({ success: false, error: 'Error al calcular sugerencia de envío' });
    }
});

// ─── GET /api/shipping/locations?q= (admin) ────────────────────────────────

shippingRouter.get('/locations',
    authenticateToken, requireRole('admin'),
    [queryValidator('q').trim().notEmpty().withMessage('Parámetro q requerido')],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
        try {
            const result = await query(
                `SELECT location_code, location_name, department_name FROM dane_locations WHERE normalized_key LIKE ? LIMIT 20`,
                [`%${req.query.q.toLowerCase()}%`]
            );
            if (result.rows.length) return res.json({ success: true, data: result.rows });

            // No hay cache: consultar directo a Mipaquete
            const remote = await getLocations(req.query.q);
            const list = Array.isArray(remote) ? remote : (remote?.data || []);
            return res.json({ success: true, data: list });
        } catch (err) {
            return handleMipaqueteError(res, err, 'Error al buscar ubicaciones');
        }
    }
);

// ─── POST /api/shipping/quote (admin) ──────────────────────────────────────

shippingRouter.post('/quote',
    authenticateToken, requireRole('admin'),
    [
        body('orderId').isInt(),
        body('weightKg').isFloat({ gt: 0 }).withMessage('Peso debe ser mayor a 0'),
        body('width').isInt({ min: 1 }),
        body('length').isInt({ min: 1 }),
        body('height').isInt({ min: 1 }),
        body('destinyDaneCode').matches(/^\d{5,8}$/).withMessage('Código DANE inválido'),
        body('declaredValueCop').isInt({ min: 1 }),
        body('paymentMode').isIn(['prepaid', 'cod']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

        try {
            const { orderId, weightKg, width, length, height, destinyDaneCode, declaredValueCop } = req.body;

            const orderResult = await query(`SELECT id, currency FROM customer_orders WHERE id = ?`, [orderId]);
            if (!orderResult.rows.length) return res.status(404).json({ success: false, error: 'Orden no encontrada' });
            if (orderResult.rows[0].currency !== 'COP') {
                return res.status(422).json({ success: false, error: 'Mipaquete solo cubre envíos en Colombia (COP)' });
            }

            if (!ORIGIN_DANE) {
                return res.status(503).json({ success: false, error: 'MIPAQUETE_ORIGIN_DANE no configurado' });
            }

            const quotes = await quoteShipping({
                originDaneCode: ORIGIN_DANE,
                destinyDaneCode,
                quantity: 1,
                width, length, height,
                weight: weightKg,
                declaredValue: declaredValueCop,
            });

            const list = (Array.isArray(quotes) ? quotes : []).sort((a, b) => a.shippingCost - b.shippingCost);
            return res.json({ success: true, data: list });
        } catch (err) {
            return handleMipaqueteError(res, err, 'Error al cotizar el envío');
        }
    }
);

// ─── POST /api/shipping/create (admin) ─────────────────────────────────────

shippingRouter.post('/create',
    authenticateToken, requireRole('admin'),
    [
        body('orderId').isInt(),
        body('weightKg').isFloat({ gt: 0 }),
        body('width').isInt({ min: 1 }),
        body('length').isInt({ min: 1 }),
        body('height').isInt({ min: 1 }),
        body('destinyDaneCode').matches(/^\d{5,8}$/),
        body('declaredValueCop').isInt({ min: 1 }),
        body('paymentMode').isIn(['prepaid', 'cod']),
        body('deliveryCompanyId').notEmpty(),
        body('requestPickup').optional().isBoolean(),
        body('comments').optional().trim(),
        body('quotedShippingCostCop').optional().isInt({ min: 0 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

        try {
            const {
                orderId, weightKg, width, length, height, destinyDaneCode,
                declaredValueCop, paymentMode, deliveryCompanyId, requestPickup = true, comments,
                quotedShippingCostCop = null,
            } = req.body;

            const data = await getOrderWithItems(orderId);
            if (!data) return res.status(404).json({ success: false, error: 'Orden no encontrada' });
            const { order } = data;

            if (order.currency !== 'COP') {
                return res.status(422).json({ success: false, error: 'Mipaquete solo cubre envíos en Colombia (COP)' });
            }
            // Solo se puede despachar una orden que ya está pagada/en proceso. Evita
            // generar guía (y cobrar flete real) para pedidos aún no pagados o cancelados.
            if (!['paid', 'processing'].includes(order.status)) {
                return res.status(422).json({ success: false, error: `La orden está en estado '${order.status}' y no se puede despachar` });
            }
            if (!ORIGIN_DANE) {
                return res.status(503).json({ success: false, error: 'MIPAQUETE_ORIGIN_DANE no configurado' });
            }

            // Valor a recaudar en destino (solo aplica a contraentrega; en prepago es 0).
            const collectionValueCop = paymentMode === 'cod' ? declaredValueCop : 0;

            // (1) INSERT antes de llamar a la API: el índice único parcial rechaza
            // el doble clic con un 409 amistoso, sin necesidad de locks manuales.
            let shipmentId;
            try {
                const insertResult = await query(
                    `INSERT INTO shipments
                        (order_id, payment_mode, declared_value_cop, collection_value_cop, quoted_shipping_cost_cop,
                         package_weight_kg, package_width_cm, package_length_cm, package_height_cm,
                         destiny_dane_code, delivery_company_id, requested_pickup, created_by, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
                     RETURNING id`,
                    [orderId, paymentMode, declaredValueCop, collectionValueCop, quotedShippingCostCop,
                        weightKg, width, length, height,
                        destinyDaneCode, deliveryCompanyId, requestPickup ? 1 : 0, req.user.id]
                );
                shipmentId = insertResult.rows[0].id;
            } catch (err) {
                if (String(err.message).includes('UNIQUE')) {
                    return res.status(409).json({ success: false, error: 'Ya existe un envío activo para esta orden' });
                }
                throw err;
            }

            // (2) Construir payload y llamar createSending
            const senderName = process.env.MIPAQUETE_SENDER_NAME || 'DobleYo';
            const senderSurname = process.env.MIPAQUETE_SENDER_SURNAME || 'Cafe';
            const [receiverName, ...receiverSurnameParts] = String(order.customer_name || '').trim().split(' ');
            const receiverSurname = receiverSurnameParts.join(' ') || receiverName;

            const payload = {
                adminTransactionData: { saleValue: paymentMode === 'cod' ? declaredValueCop : 0 },
                channel: 'DobleYo Café',
                comments: comments || '',
                description: comments || `Pedido ${order.reference}`,
                deliveryCompany: deliveryCompanyId,
                locate: {
                    originDaneCode: ORIGIN_DANE,
                    destinyDaneCode,
                    originCountryCode: '484',
                    destinyCountryCode: '484',
                },
                paymentType: paymentMode === 'cod' ? MP_PAYMENT_TYPE_COD : MP_PAYMENT_TYPE_PREPAID,
                productInformation: {
                    declaredValue: declaredValueCop,
                    forbiddenProduct: false,
                    height, large: length, width,
                    productReference: order.reference,
                    quantity: 1,
                    weight: weightKg,
                },
                receiver: {
                    name: receiverName || order.customer_name,
                    surname: receiverSurname,
                    cellPhone: (order.customer_phone || '').replace(/\D/g, '').slice(-10),
                    email: order.customer_email,
                    destinationAddress: order.shipping_address,
                    prefix: '+57',
                    nit: '-',
                    nitType: '-',
                },
                sender: {
                    name: senderName,
                    surname: senderSurname,
                    cellPhone: process.env.MIPAQUETE_SENDER_CELLPHONE || '',
                    email: process.env.MIPAQUETE_SENDER_EMAIL || '',
                    pickupAddress: process.env.MIPAQUETE_SENDER_PICKUP_ADDRESS || '',
                    prefix: '+57',
                    nit: process.env.MIPAQUETE_SENDER_NIT || '-',
                    nitType: process.env.MIPAQUETE_SENDER_NIT_TYPE || 'NIT',
                },
                requestPickup: requestPickup ? 'true' : 'false',
                user: process.env.MIPAQUETE_USER_ID,
            };

            let mpCode;
            try {
                const created = await createSending(payload);
                mpCode = created?.mpCode;
                if (!mpCode) throw new MipaqueteError('Mipaquete no devolvió mpCode', { retriable: false, body: created });
            } catch (err) {
                // (3) liberar el candado: status='error' permite reintentar
                await query(`UPDATE shipments SET status = 'error', error_detail = ? WHERE id = ?`,
                    [String(err.message).slice(0, 500), shipmentId]);
                return handleMipaqueteError(res, err, 'Error al crear el envío');
            }

            await query(`UPDATE shipments SET mp_code = ? WHERE id = ?`, [String(mpCode), shipmentId]);

            // (4) Intentar obtener guía/PDF de inmediato; puede no estar lista aún (tolerar)
            let guideNumber = null;
            let pdfUrls = null;
            try {
                const sendings = await getSendings({ mpCode });
                const match = matchSendingByMpCode(sendings?.sendings || [], mpCode);
                if (match) {
                    guideNumber = match['Número de Guía'] || null;
                    pdfUrls = match.pdfGuide || null;
                } else {
                    logger.warn({ mpCode, shipmentId }, '[Shipping] getSendings no devolvió un match para el mpCode recién creado');
                }
            } catch (err) {
                logger.warn({ err, mpCode }, '[Shipping] No se pudo obtener guía inmediata, se completará por refresh');
            }

            await query(
                `UPDATE shipments SET guide_number = ?, pdf_guide_urls = ?, tracking_updated_at = datetime('now') WHERE id = ?`,
                [guideNumber, pdfUrls ? JSON.stringify(pdfUrls) : null, shipmentId]
            );

            await logAudit(req.user.id, 'create', 'shipments', shipmentId, {
                orderId, mpCode, deliveryCompanyId, paymentMode,
                collectionValueCop, quotedShippingCostCop, weightKg, destinyDaneCode,
            });

            if (guideNumber) {
                await query(`UPDATE customer_orders SET status = 'shipped' WHERE id = ? AND status NOT IN ('delivered','cancelled','refunded')`, [orderId]);
                await query(`UPDATE shipments SET guide_notified_at = datetime('now') WHERE id = ?`, [shipmentId]);
                sendShippingNotificationEmail(order.customer_email, order.customer_name, {
                    reference: order.reference,
                    guideNumber,
                    deliveryCompanyName: req.body.deliveryCompanyName || '',
                    trackingUrl: `${SITE_URL}/confirmacion?ref=${order.reference}`,
                    isCod: paymentMode === 'cod',
                    collectionValue: paymentMode === 'cod' ? declaredValueCop : 0,
                }).catch((err) => logger.error({ err }, '[Shipping] Error enviando email de despacho'));
            }

            return res.status(201).json({ success: true, data: { shipmentId, mpCode, guideNumber, pdfUrls } });
        } catch (err) {
            logger.error({ err }, '[POST /api/shipping/create] Error:');
            return res.status(500).json({ success: false, error: 'Error al crear el envío' });
        }
    }
);

// ─── POST /api/shipping/:id/refresh (admin) ────────────────────────────────

shippingRouter.post('/:id/refresh', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await refreshShipment(Number(req.params.id), 'manual');
        if (!result) return res.status(404).json({ success: false, error: 'Envío no encontrado' });
        return res.json({ success: true, data: result });
    } catch (err) {
        return handleMipaqueteError(res, err, 'Error al refrescar el envío');
    }
});

// Toma el envío cuyo mpCode explícito coincida; si la respuesta no trae el campo
// (algunas variantes de la API lo omiten) pero solo hay un resultado, se acepta
// -- pero nunca se toma a ciegas el primero de una lista con varios resultados.
function matchSendingByMpCode(sendings, mpCode) {
    if (!Array.isArray(sendings) || !sendings.length) return null;
    const target = String(mpCode);
    const explicit = sendings.find((s) => {
        const val = s.mpCode ?? s.mp_code ?? s.MpCode;
        return val != null && String(val) === target;
    });
    if (explicit) return explicit;
    return sendings.length === 1 ? sendings[0] : null;
}

// Mapea el estado crudo de Mipaquete a nuestro enum interno usando SOLO el
// evento más reciente (no todo el historial: un "entregado" viejo no debe
// contaminar un estado posterior). Las negaciones/fallos de entrega se evalúan
// ANTES que "entregado" con límites de palabra, para no confundir "No entregado"
// o "Entrega fallida" con una entrega exitosa.
function mapTrackingStateToStatus(events) {
    if (!Array.isArray(events) || !events.length) return null;

    const sorted = [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const latest = sorted[sorted.length - 1];
    const text = `${latest.updateState || ''} ${latest.description || ''}`.toLowerCase();

    if (/\bno\s+entregado\b|entrega\s+fallida|intento\s+de\s+entrega|novedad/.test(text)) return 'in_transit';
    if (/devuel|retorno/.test(text)) return 'returned';
    if (/cancelado/.test(text)) return 'cancelled';
    if (/\bentregado\b/.test(text)) return 'delivered';
    if (/recolec|transito|tránsito|camino/.test(text)) return 'in_transit';
    if (/recogida|pendiente por recog/.test(text)) return 'pickup_requested';
    return null; // sin cambio de estado reconocible
}

async function refreshShipment(shipmentId, source) {
    const shipmentResult = await query(
        `SELECT s.*, o.reference, o.customer_name, o.customer_email
         FROM shipments s JOIN customer_orders o ON o.id = s.order_id
         WHERE s.id = ?`,
        [shipmentId]
    );
    if (!shipmentResult.rows.length) return null;
    const shipment = shipmentResult.rows[0];
    if (!shipment.mp_code) return { shipment, updated: false };

    const [sendings, tracking] = await Promise.all([
        getSendings({ mpCode: shipment.mp_code }).catch(() => null),
        getTracking(shipment.mp_code).catch(() => null),
    ]);

    const match = matchSendingByMpCode(sendings?.sendings || [], shipment.mp_code);
    if (sendings?.sendings?.length && !match) {
        logger.warn({ mpCode: shipment.mp_code, shipmentId }, '[Shipping] getSendings devolvió resultados pero ninguno coincide con el mpCode');
    }
    const guideNumber = match?.['Número de Guía'] || shipment.guide_number;
    const pickupCode = match?.['Número de Recolección'] || shipment.pickup_code;
    const pdfUrls = match?.pdfGuide || (shipment.pdf_guide_urls ? JSON.parse(shipment.pdf_guide_urls) : null);
    const deliveryCompanyName = tracking?.deliveryCompanyName || shipment.delivery_company_name;
    const trackingEvents = tracking?.tracking || [];

    const mappedStatus = mapTrackingStateToStatus(trackingEvents);
    const newStatus = mappedStatus || shipment.status;

    await query(
        `UPDATE shipments SET
            guide_number = ?, pickup_code = ?, pdf_guide_urls = ?, delivery_company_name = ?,
            tracking_snapshot = ?, tracking_updated_at = datetime('now'),
            status = CASE WHEN status IN ('cancelled') THEN status ELSE ? END
         WHERE id = ?`,
        [guideNumber, pickupCode, pdfUrls ? JSON.stringify(pdfUrls) : null, deliveryCompanyName,
            JSON.stringify(trackingEvents), newStatus, shipmentId]
    );

    for (const ev of trackingEvents) {
        // Evitar duplicar eventos ya guardados (comparación simple por estado+fecha)
        const exists = await query(
            `SELECT 1 FROM shipment_events WHERE shipment_id = ? AND update_state = ? AND event_date = ? LIMIT 1`,
            [shipmentId, ev.updateState || null, ev.date || null]
        );
        if (!exists.rows.length) {
            await query(
                `INSERT INTO shipment_events (shipment_id, source, update_state, description, event_date)
                 VALUES (?, ?, ?, ?, ?)`,
                [shipmentId, source, ev.updateState || null, ev.description || null, ev.date || null]
            );
        }
    }

    // Primera vez que aparece la guía → notificar y marcar orden 'shipped'
    if (guideNumber && !shipment.guide_notified_at) {
        await query(`UPDATE shipments SET guide_notified_at = datetime('now') WHERE id = ?`, [shipmentId]);
        await query(`UPDATE customer_orders SET status = 'shipped' WHERE id = ? AND status NOT IN ('delivered','cancelled','refunded')`, [shipment.order_id]);
        sendShippingNotificationEmail(shipment.customer_email, shipment.customer_name, {
            reference: shipment.reference,
            guideNumber,
            deliveryCompanyName: deliveryCompanyName || '',
            trackingUrl: `${SITE_URL}/confirmacion?ref=${shipment.reference}`,
            isCod: shipment.payment_mode === 'cod',
            collectionValue: shipment.collection_value_cop,
        }).catch((err) => logger.error({ err }, '[Shipping] Error enviando email de despacho'));
    }

    if (newStatus === 'delivered' && shipment.status !== 'delivered') {
        await query(`UPDATE customer_orders SET status = 'delivered' WHERE id = ?`, [shipment.order_id]);
    }

    return { shipmentId, guideNumber, pickupCode, status: newStatus, pdfUrls };
}

// ─── POST /api/shipping/refresh-all (admin) ────────────────────────────────
// Fallback de polling sin cron: se dispara al abrir el panel. Presupuesto de
// tiempo acotado para respetar límites de funciones serverless.

shippingRouter.post('/refresh-all', authenticateToken, requireRole('admin'), async (req, res) => {
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 8000;
    const MAX_ITEMS = 20;

    try {
        const pending = await query(
            `SELECT id FROM shipments
             WHERE status IN ('created','pickup_requested','in_transit') AND mp_code IS NOT NULL
             ORDER BY COALESCE(tracking_updated_at, created_at) ASC
             LIMIT ?`,
            [MAX_ITEMS]
        );

        const results = [];
        for (const row of pending.rows) {
            if (Date.now() - startedAt > TIME_BUDGET_MS) break;
            try {
                const r = await refreshShipment(row.id, 'poll');
                results.push({ shipmentId: row.id, ok: true, status: r?.status });
            } catch (err) {
                results.push({ shipmentId: row.id, ok: false, error: err.message });
            }
        }

        return res.json({ success: true, data: { processed: results.length, results } });
    } catch (err) {
        logger.error({ err }, '[POST /api/shipping/refresh-all] Error:');
        return res.status(500).json({ success: false, error: 'Error al refrescar envíos' });
    }
});

// ─── PUT /api/shipping/:id/cancel (admin) ──────────────────────────────────

shippingRouter.put('/:id/cancel', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const shipmentResult = await query(`SELECT * FROM shipments WHERE id = ?`, [req.params.id]);
        if (!shipmentResult.rows.length) return res.status(404).json({ success: false, error: 'Envío no encontrado' });
        const shipment = shipmentResult.rows[0];

        if (shipment.mp_code) {
            await cancelSending(shipment.mp_code);
        }

        await query(`UPDATE shipments SET status = 'cancelled' WHERE id = ?`, [shipment.id]);
        await query(`UPDATE customer_orders SET status = 'processing' WHERE id = ? AND status = 'shipped'`, [shipment.order_id]);
        await logAudit(req.user.id, 'cancel', 'shipments', shipment.id, { mpCode: shipment.mp_code });

        return res.json({ success: true, data: { id: shipment.id, status: 'cancelled' } });
    } catch (err) {
        return handleMipaqueteError(res, err, 'Error al cancelar el envío');
    }
});

// ─── PATCH /api/shipping/:id/reconcile (admin) ─────────────────────────────

shippingRouter.patch('/:id/reconcile', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await query(
            `UPDATE shipments SET cod_reconciled = 1, cod_reconciled_at = datetime('now')
             WHERE id = ? AND payment_mode = 'cod' RETURNING id`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'Envío COD no encontrado' });
        await logAudit(req.user.id, 'reconcile', 'shipments', req.params.id, {});
        return res.json({ success: true, data: { id: Number(req.params.id), cod_reconciled: true } });
    } catch (err) {
        logger.error({ err }, '[PATCH /api/shipping/:id/reconcile] Error:');
        return res.status(500).json({ success: false, error: 'Error al conciliar el recaudo' });
    }
});

// ─── GET /api/shipping (admin) ─────────────────────────────────────────────

shippingRouter.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { status, paymentMode, codPending, limit = 50, offset = 0 } = req.query;
        let sql = `
            SELECT s.*, o.reference, o.customer_name, o.customer_email, o.shipping_city
            FROM shipments s JOIN customer_orders o ON o.id = s.order_id
            WHERE 1=1
        `;
        const params = [];
        if (status) { sql += ' AND s.status = ?'; params.push(status); }
        if (paymentMode) { sql += ' AND s.payment_mode = ?'; params.push(paymentMode); }
        if (codPending === '1') { sql += ` AND s.payment_mode = 'cod' AND s.status = 'delivered' AND s.cod_reconciled = 0`; }
        sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const result = await query(sql, params);
        return res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error({ err }, '[GET /api/shipping] Error:');
        return res.status(500).json({ success: false, error: 'Error al listar envíos' });
    }
});

// ─── GET /api/shipping/health (admin) ──────────────────────────────────────

shippingRouter.get('/health', authenticateToken, requireRole('admin'), async (req, res) => {
    const result = await mipaqueteHealthCheck();
    return res.status(result.ok ? 200 : 503).json({ success: result.ok, data: result });
});

// ─── POST /api/shipping/setup-webhook (admin, one-shot) ────────────────────

shippingRouter.post('/setup-webhook', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        if (!WEBHOOK_TOKEN) {
            return res.status(503).json({ success: false, error: 'MIPAQUETE_WEBHOOK_TOKEN no configurado' });
        }
        const webhookUrl = `${SITE_URL}/api/shipping/webhook?token=${WEBHOOK_TOKEN}`;
        const result = await registerWebhook({ guidesUrl: webhookUrl, statesUrl: webhookUrl });
        return res.json({ success: true, data: result });
    } catch (err) {
        return handleMipaqueteError(res, err, 'Error al registrar el webhook');
    }
});

// ─── POST /api/shipping/webhook (público, protegido por token) ────────────
// Trigger-don't-trust: el payload nunca se usa para escribir estado; solo
// dispara una re-consulta autenticada contra la API de Mipaquete.

shippingRouter.post('/webhook', webhookLimiter, async (req, res) => {
    try {
        if (!WEBHOOK_TOKEN) {
            logger.error('[Shipping webhook] MIPAQUETE_WEBHOOK_TOKEN no configurado');
            return res.sendStatus(500);
        }
        const provided = String(req.query.token || '');
        const expected = Buffer.from(WEBHOOK_TOKEN);
        const given = Buffer.from(provided);
        if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
            return res.sendStatus(401);
        }

        const payload = req.body || {};
        // Buscar mpCode en cualquier nivel razonable del payload (no documentado oficialmente)
        const mpCode = payload.mpCode || payload.mp_code || payload.data?.mpCode || payload.data?.mp_code;

        if (mpCode) {
            const shipmentResult = await query(`SELECT id FROM shipments WHERE mp_code = ?`, [String(mpCode)]);
            if (shipmentResult.rows.length) {
                const shipmentId = shipmentResult.rows[0].id;
                await query(
                    `INSERT INTO shipment_events (shipment_id, source, raw_payload) VALUES (?, 'webhook', ?)`,
                    [shipmentId, JSON.stringify(payload).slice(0, 8000)]
                );
                // Re-consultar con nuestro apikey; nunca confiar en el contenido del webhook.
                refreshShipment(shipmentId, 'webhook').catch((err) =>
                    logger.error({ err, shipmentId }, '[Shipping webhook] Error al re-consultar tracking'));
            }
        }

        return res.sendStatus(200);
    } catch (err) {
        logger.error({ err }, '[Shipping webhook] Error:');
        return res.sendStatus(200); // acusar recibo siempre; no bloquear reintentos de Mipaquete
    }
});
