import { sendNtfyAsync } from './ntfy.js';

// Catálogo central de alertas operativas que se publican en ntfy.
//
// Todas son fire-and-forget: nunca bloquean ni rompen la operación de negocio
// que las dispara (ver server/services/ntfy.js). Mantener aquí los textos y las
// prioridades evita que el copy quede regado por las rutas.
//
// Prioridades ntfy: 1 min · 2 baja · 3 normal · 4 alta · 5 urgente.

const SITE_URL = process.env.SITE_BASE_URL || 'https://dobleyo.cafe';

const cop = (v) => `$${Number(v ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const money = (v, currency) => (currency === 'USD' ? `US$${Number(v ?? 0).toLocaleString('en-US')}` : cop(v));

// ── Ventas ──────────────────────────────────────────────────────────────────

/**
 * Venta confirmada: pago aprobado en Wompi, orden contraentrega creada o pago
 * marcado a mano por un admin. Se dispara una sola vez por orden, atada al
 * descuento de inventario (idempotente vía stock_deducted_at).
 */
export function notifySaleConfirmed({ reference, customerName, city, total, currency, paymentMethod, items = [] }) {
  const detalle = items.length
    ? `\n${items.map((i) => `• ${i.quantity} × ${i.name}`).join('\n')}`
    : '';
  const medio = paymentMethod === 'cod' ? 'contraentrega' : paymentMethod === 'wompi_subscription' ? 'suscripción' : 'Wompi';

  sendNtfyAsync({
    title:    `Venta confirmada · ${money(total, currency)}`,
    message:  `${customerName || 'Cliente'}${city ? ` · ${city}` : ''} — pedido ${reference} (${medio}).${detalle}`,
    priority: 4,
    tags:     ['moneybag'],
    click:    `${SITE_URL}/admin/pedidos`,
  });
}

// ── Inventario ──────────────────────────────────────────────────────────────

/** El producto quedó en cero unidades tras una venta. */
export function notifyStockDepleted({ productName, reference }) {
  sendNtfyAsync({
    title:    `Agotado: ${productName}`,
    message:  `El pedido ${reference} dejó "${productName}" en 0 unidades. Ya no se puede vender hasta reponer.`,
    priority: 5,
    tags:     ['rotating_light', 'package'],
    click:    `${SITE_URL}/admin/inventario`,
  });
}

/** El producto quedó en o por debajo de su mínimo, pero aún hay unidades. */
export function notifyStockBelowMinimum({ productName, remaining, minimum }) {
  sendNtfyAsync({
    title:    `Stock bajo: ${productName}`,
    message:  `Quedan ${remaining} unidades de "${productName}" (mínimo: ${minimum}). Conviene programar reposición.`,
    priority: 3,
    tags:     ['warning'],
    click:    `${SITE_URL}/admin/inventario`,
  });
}

/**
 * Se pagó una orden sin stock suficiente para descontarla. La venta ya está
 * hecha: toca reponer o gestionar backorder con el cliente.
 */
export function notifyOversold({ productName, quantity, reference }) {
  sendNtfyAsync({
    title:    `Sobreventa: ${productName}`,
    message:  `El pedido ${reference} pagó ${quantity} unidad(es) de "${productName}" y no había stock para descontar. Gestione reposición o contacte al cliente.`,
    priority: 5,
    tags:     ['rotating_light', 'bangbang'],
    click:    `${SITE_URL}/admin/inventario`,
  });
}

/** Entrada de mercancía registrada en inventario. */
export function notifyInventoryEntry({ productName, quantity, newStock, reason }) {
  sendNtfyAsync({
    title:    `Entrada de inventario: ${productName}`,
    message:  `+${quantity} unidad(es) de "${productName}". Stock actual: ${newStock}.${reason ? ` Motivo: ${reason}.` : ''}`,
    priority: 2,
    tags:     ['package'],
    click:    `${SITE_URL}/admin/inventario`,
  });
}

// ── Envíos ──────────────────────────────────────────────────────────────────

/**
 * Novedad en la entrega reportada por la transportadora (entrega fallida,
 * devolución, cancelación). Es lo que se convierte en reclamo si nadie actúa.
 */
export function notifyShippingIssue({ reference, customerName, guideNumber, state, description }) {
  const detalle = [state, description].filter(Boolean).join(' — ');
  sendNtfyAsync({
    title:    `Novedad en envío · pedido ${reference}`,
    message:  `${customerName || 'Cliente'}${guideNumber ? ` · guía ${guideNumber}` : ''}\n${detalle || 'La transportadora reportó una novedad en la entrega.'}`,
    priority: 4,
    tags:     ['truck', 'warning'],
    click:    `${SITE_URL}/admin/envios`,
  });
}

// ── Suscripciones ───────────────────────────────────────────────────────────

/**
 * Falló el cobro recurrente. Si ya agotó los intentos, la suscripción queda en
 * 'payment_failed' y deja de generar ingreso hasta que se actúe.
 */
export function notifySubscriptionChargeFailed({ subscriptionRef, customerEmail, amount, status, failedAttempts, suspended }) {
  sendNtfyAsync({
    title:    suspended ? `Suscripción suspendida · ${subscriptionRef}` : `Cobro fallido · ${subscriptionRef}`,
    message:  `${customerEmail} — ${cop(amount)} (${status}). Intento ${failedAttempts}.${suspended ? ' La suscripción quedó en payment_failed y no se volverá a cobrar automáticamente.' : ''}`,
    priority: suspended ? 5 : 4,
    tags:     suspended ? ['rotating_light', 'credit_card'] : ['credit_card', 'warning'],
    click:    `${SITE_URL}/admin/pedidos`,
  });
}

// ── Entradas de personas ────────────────────────────────────────────────────

/** Un usuario solicitó ser caficultor y espera revisión. */
export function notifyCaficultorApplication({ farmName, region, userName }) {
  sendNtfyAsync({
    title:    'Nueva solicitud de caficultor',
    message:  `${userName || 'Un usuario'} postuló la finca "${farmName}"${region ? ` (${region})` : ''}. Queda pendiente de aprobación.`,
    priority: 3,
    tags:     ['seedling'],
    click:    `${SITE_URL}/admin/usuarios`,
  });
}

/** Mensaje nuevo del formulario de contacto. */
export function notifyContactMessage({ name, email, subject, message }) {
  const preview = String(message || '').slice(0, 180);
  sendNtfyAsync({
    title:    `Contacto: ${subject}`,
    message:  `${name} <${email}>\n${preview}${String(message || '').length > 180 ? '…' : ''}`,
    priority: 2,
    tags:     ['envelope'],
    click:    `${SITE_URL}/admin/crm`,
  });
}
