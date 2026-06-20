import { Router } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken, optionalAuth } from '../auth.js';
import { logAudit } from '../services/audit.js';
import {
  getAcceptanceTokens,
  createCardPaymentSource,
  chargePaymentSource,
  getTransaction,
  wompiConfig,
} from '../services/wompi.js';

export const subscriptionsRouter = Router();

const DEFAULT_DISCOUNT = parseInt(process.env.SUBSCRIPTION_DISCOUNT_PERCENT || '10', 10);
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || '';
const CRON_SECRET = process.env.SUBSCRIPTIONS_CRON_SECRET || '';
const MAX_FAILED_ATTEMPTS = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

const genRef = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Verifica la firma de un evento (webhook) de Wompi (igual que en orders.js).
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
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(checksum), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Crea el pedido (customer_orders) cuando un cobro queda APROBADO. Idempotente.
async function finalizeApprovedCharge(sub, charge, tx) {
  // Idempotencia: si el cobro ya tiene pedido, no duplicar.
  if (charge.order_id) return charge.order_id;

  const prodImg = await query('SELECT image_url FROM products WHERE id = ?', [sub.product_id]);
  const image = prodImg.rows[0]?.image_url ?? null;
  const variantLabel = [sub.variant_size, sub.variant_grind].filter(Boolean).join(' · ');
  const productName = variantLabel ? `${sub.product_name} (${variantLabel})` : sub.product_name;

  const orderRes = await query(
    `INSERT INTO customer_orders
       (reference, status, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_department, shipping_zip,
        subtotal_cop, shipping_cop, total_cop, payment_method, payment_transaction_id,
        notes, user_id, created_at, updated_at)
     VALUES (?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'wompi_subscription', ?, ?, ?, datetime('now'), datetime('now'))`,
    [charge.reference, sub.customer_name, sub.customer_email, sub.customer_phone ?? null,
     sub.shipping_address, sub.shipping_city, sub.shipping_department ?? null, sub.shipping_zip ?? null,
     sub.amount_cop, sub.amount_cop, tx?.id ?? null,
     `Suscripción ${sub.reference} · cada ${sub.frequency_days} días`, sub.user_id ?? null]
  );
  const orderId = Number(orderRes.lastInsertRowid);

  await query(
    `INSERT INTO customer_order_items
       (order_id, product_id, product_name, product_image, unit_price_cop, quantity, subtotal_cop)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [orderId, sub.product_id, productName, image, sub.unit_price_cop, sub.quantity, sub.amount_cop]
  );

  await query(
    `UPDATE subscription_charges
       SET status='APPROVED', order_id=?, wompi_transaction_id=?, updated_at=datetime('now')
     WHERE id=?`,
    [orderId, tx?.id ?? charge.wompi_transaction_id ?? null, charge.id]
  );

  await query(
    `UPDATE subscriptions
       SET status='active', last_charged_at=datetime('now'),
           charge_count = charge_count + 1, failed_attempts = 0,
           next_billing_date = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [addDaysISO(sub.frequency_days), sub.id]
  );

  return orderId;
}

async function markChargeFailed(sub, charge, status) {
  await query(
    `UPDATE subscription_charges SET status=?, updated_at=datetime('now') WHERE id=?`,
    [status, charge.id]
  );
  const failed = (sub.failed_attempts ?? 0) + 1;
  const newStatus = failed >= MAX_FAILED_ATTEMPTS ? 'payment_failed' : sub.status;
  await query(
    `UPDATE subscriptions SET failed_attempts=?, status=?, updated_at=datetime('now') WHERE id=?`,
    [failed, newStatus, sub.id]
  );
}

// Ejecuta un cobro contra la fuente de pago y procesa el resultado.
async function runCharge(sub) {
  const reference = genRef('SUBC');
  const chargeRes = await query(
    `INSERT INTO subscription_charges (subscription_id, reference, amount_cop, status, created_at)
     VALUES (?, ?, ?, 'PENDING', datetime('now'))`,
    [sub.id, reference, sub.amount_cop]
  );
  const charge = { id: Number(chargeRes.lastInsertRowid), reference, order_id: null, wompi_transaction_id: null };

  try {
    const tx = await chargePaymentSource({
      amountCents: sub.amount_cop * 100,
      customerEmail: sub.customer_email,
      reference,
      paymentSourceId: sub.wompi_payment_source_id,
    });
    await query(`UPDATE subscription_charges SET wompi_transaction_id=?, status=?, updated_at=datetime('now') WHERE id=?`,
      [tx.id, tx.status || 'PENDING', charge.id]);
    charge.wompi_transaction_id = tx.id;

    if (tx.status === 'APPROVED') {
      await finalizeApprovedCharge(sub, charge, tx);
      return { status: 'APPROVED', reference, transactionId: tx.id };
    }
    if (['DECLINED', 'ERROR', 'VOIDED'].includes(tx.status)) {
      await markChargeFailed(sub, charge, tx.status);
      return { status: tx.status, reference, transactionId: tx.id };
    }
    // PENDING → el webhook lo finaliza.
    return { status: 'PENDING', reference, transactionId: tx.id };
  } catch (err) {
    logger.error({ err, sub: sub.id }, '[subscriptions] Error al cobrar');
    await markChargeFailed(sub, charge, 'ERROR');
    return { status: 'ERROR', reference, error: err.message };
  }
}

// ─── GET /api/subscriptions/acceptance ──────────────────────────────────────
// Público: tokens de aceptación + datos para el widget de tarjeta (front).
subscriptionsRouter.get('/acceptance', async (_req, res) => {
  if (!wompiConfig.configured) {
    return res.status(503).json({ success: false, error: 'Pagos no configurados' });
  }
  try {
    const tokens = await getAcceptanceTokens();
    res.json({
      success: true,
      data: {
        ...tokens,
        public_key: wompiConfig.publicKey,
        api_base: wompiConfig.apiBase,
        discount_percent: DEFAULT_DISCOUNT,
      },
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/subscriptions/acceptance]');
    res.status(502).json({ success: false, error: 'No se pudieron obtener los tokens de aceptación' });
  }
});

// ─── POST /api/subscriptions ────────────────────────────────────────────────
// Crea la suscripción: fuente de pago + primer cobro.
subscriptionsRouter.post('/',
  optionalAuth,
  [
    body('productId').trim().notEmpty().withMessage('Producto requerido'),
    body('quantity').isInt({ min: 1, max: 20 }).withMessage('Cantidad inválida'),
    body('frequencyDays').isIn([15, 30, '15', '30']).withMessage('Frecuencia inválida (15 o 30)'),
    body('customerName').trim().notEmpty().withMessage('Nombre requerido'),
    body('customerEmail').isEmail().withMessage('Correo inválido'),
    body('shippingAddress').trim().notEmpty().withMessage('Dirección requerida'),
    body('shippingCity').trim().notEmpty().withMessage('Ciudad requerida'),
    body('cardToken').trim().notEmpty().withMessage('Token de tarjeta requerido'),
    body('acceptanceToken').trim().notEmpty().withMessage('Token de aceptación requerido'),
    body('acceptPersonalAuth').trim().notEmpty().withMessage('Autorización de datos requerida'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    if (!wompiConfig.configured) {
      return res.status(503).json({ success: false, error: 'Pagos no configurados' });
    }

    try {
      const {
        productId, variantId, quantity, frequencyDays,
        customerName, customerEmail, customerPhone,
        shippingAddress, shippingCity, shippingDepartment, shippingZip,
        cardToken, acceptanceToken, acceptPersonalAuth,
      } = req.body;

      const freq = parseInt(frequencyDays, 10);
      const qty = parseInt(quantity, 10);

      // Precio base (producto o variante) — la fuente de verdad es la BD.
      const prod = await query(
        'SELECT id, name, price FROM products WHERE id = ? AND is_active = 1 AND category = ?',
        [productId, 'cafe']
      );
      if (!prod.rows.length) {
        return res.status(404).json({ success: false, error: 'Café no disponible para suscripción' });
      }
      let unitPrice = Number(prod.rows[0].price);
      let variantSize = null;
      let variantGrind = null;
      if (variantId) {
        const v = await query(
          'SELECT price_cop, size_label, grind_label FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1',
          [variantId, productId]
        );
        if (v.rows.length) {
          unitPrice = Number(v.rows[0].price_cop);
          variantSize = v.rows[0].size_label;
          variantGrind = v.rows[0].grind_label;
        }
      }

      const subtotal = unitPrice * qty;
      const amount = Math.round((subtotal * (100 - DEFAULT_DISCOUNT)) / 100);

      // 1) Fuente de pago
      const paymentSource = await createCardPaymentSource({
        cardToken, customerEmail, acceptanceToken, acceptPersonalAuth,
      });
      if (!paymentSource?.id) {
        return res.status(502).json({ success: false, error: 'No se pudo registrar la tarjeta' });
      }

      // 2) Guardar suscripción
      const reference = genRef('SUB');
      const subRes = await query(
        `INSERT INTO subscriptions
          (reference, user_id, product_id, product_name, variant_size, variant_grind, quantity,
           frequency_days, unit_price_cop, discount_percent, amount_cop,
           customer_name, customer_email, customer_phone,
           shipping_address, shipping_city, shipping_department, shipping_zip,
           wompi_payment_source_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_auth', datetime('now'))`,
        [reference, req.user?.id ?? null, productId, prod.rows[0].name, variantSize, variantGrind, qty,
         freq, unitPrice, DEFAULT_DISCOUNT, amount,
         customerName, customerEmail, customerPhone ?? null,
         shippingAddress, shippingCity, shippingDepartment ?? null, shippingZip ?? null,
         paymentSource.id]
      );
      const subId = Number(subRes.lastInsertRowid);
      const sub = {
        id: subId, reference, user_id: req.user?.id ?? null,
        product_id: productId, product_name: prod.rows[0].name,
        variant_size: variantSize, variant_grind: variantGrind, quantity: qty,
        frequency_days: freq, unit_price_cop: unitPrice, amount_cop: amount,
        customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone ?? null,
        shipping_address: shippingAddress, shipping_city: shippingCity,
        shipping_department: shippingDepartment ?? null, shipping_zip: shippingZip ?? null,
        wompi_payment_source_id: paymentSource.id, status: 'pending_auth', failed_attempts: 0,
      };

      // 3) Primer cobro
      const result = await runCharge(sub);

      await logAudit(req.user?.id ?? null, 'create', 'subscription', subId, { reference, amount, freq });

      res.status(201).json({
        success: true,
        data: { reference, amount_cop: amount, frequency_days: freq, charge: result },
      });
    } catch (err) {
      logger.error({ err }, '[POST /api/subscriptions]');
      res.status(500).json({ success: false, error: 'Error al crear la suscripción' });
    }
  }
);

// ─── POST /api/subscriptions/run-billing ────────────────────────────────────
// Disparado por un scheduler externo. Protegido por secreto. Cobra las vencidas.
subscriptionsRouter.post('/run-billing', async (req, res) => {
  if (!CRON_SECRET) {
    return res.status(503).json({ success: false, error: 'Billing no configurado (falta SUBSCRIPTIONS_CRON_SECRET)' });
  }
  const provided = req.get('x-cron-secret') || req.query.secret;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(CRON_SECRET);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  try {
    const { rows } = await query(
      `SELECT * FROM subscriptions
       WHERE status = 'active' AND wompi_payment_source_id IS NOT NULL
         AND next_billing_date IS NOT NULL AND next_billing_date <= date('now')
       ORDER BY next_billing_date ASC
       LIMIT 100`
    );

    const summary = { processed: 0, approved: 0, pending: 0, failed: 0 };
    for (const sub of rows) {
      const r = await runCharge(sub);
      summary.processed++;
      if (r.status === 'APPROVED') summary.approved++;
      else if (r.status === 'PENDING') summary.pending++;
      else summary.failed++;
    }
    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error({ err }, '[POST /api/subscriptions/run-billing]');
    res.status(500).json({ success: false, error: 'Error al procesar cobros' });
  }
});

// ─── POST /api/subscriptions/wompi/webhook ──────────────────────────────────
// Reconcilia transacciones asíncronas (PENDING → APPROVED/DECLINED).
subscriptionsRouter.post('/wompi/webhook', async (req, res) => {
  try {
    const event = req.body;
    if (process.env.NODE_ENV === 'production' && !verifyWompiEventSignature(event)) {
      return res.status(401).json({ success: false, error: 'Firma inválida' });
    }
    const tx = event?.data?.transaction;
    if (!tx?.id) return res.json({ success: true });

    const { rows } = await query(
      `SELECT c.*, s.frequency_days, s.amount_cop AS sub_amount, s.id AS sub_id
       FROM subscription_charges c JOIN subscriptions s ON s.id = c.subscription_id
       WHERE c.wompi_transaction_id = ? OR c.reference = ?`,
      [tx.id, tx.reference]
    );
    if (!rows.length) return res.json({ success: true });
    const charge = rows[0];
    if (charge.status === 'APPROVED') return res.json({ success: true }); // idempotente

    const subRows = await query('SELECT * FROM subscriptions WHERE id = ?', [charge.subscription_id]);
    const sub = subRows.rows[0];
    if (!sub) return res.json({ success: true });

    if (tx.status === 'APPROVED') {
      await finalizeApprovedCharge(sub, charge, tx);
    } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(tx.status)) {
      await markChargeFailed(sub, charge, tx.status);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, '[subscriptions webhook]');
    res.status(500).json({ success: false, error: 'Error procesando evento' });
  }
});

// ─── GET /api/subscriptions/me ──────────────────────────────────────────────
subscriptionsRouter.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT reference, product_name, variant_size, variant_grind, quantity, frequency_days,
              amount_cop, status, next_billing_date, charge_count, created_at
       FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/subscriptions/me]');
    res.status(500).json({ success: false, error: 'Error al cargar suscripciones' });
  }
});

// ─── POST /api/subscriptions/:reference/cancel ──────────────────────────────
subscriptionsRouter.post('/:reference/cancel', optionalAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    const { email } = req.body;
    const { rows } = await query('SELECT * FROM subscriptions WHERE reference = ?', [reference]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Suscripción no encontrada' });
    const sub = rows[0];

    // Autorización: dueño autenticado o coincidencia de email.
    const isOwner = req.user && sub.user_id === req.user.id;
    const emailMatches = email && email.toLowerCase() === sub.customer_email.toLowerCase();
    if (!isOwner && !emailMatches) {
      return res.status(403).json({ success: false, error: 'No autorizado para cancelar esta suscripción' });
    }
    if (sub.status === 'cancelled') {
      return res.json({ success: true, data: { reference, status: 'cancelled' } });
    }

    await query(
      `UPDATE subscriptions SET status='cancelled', cancelled_at=datetime('now'), updated_at=datetime('now') WHERE id=?`,
      [sub.id]
    );
    await logAudit(req.user?.id ?? null, 'cancel', 'subscription', sub.id, { reference });
    res.json({ success: true, data: { reference, status: 'cancelled' } });
  } catch (err) {
    logger.error({ err }, '[POST /api/subscriptions/:reference/cancel]');
    res.status(500).json({ success: false, error: 'Error al cancelar la suscripción' });
  }
});
