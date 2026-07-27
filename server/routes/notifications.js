import { Router } from 'express';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { sendNtfy, isNtfyEnabled } from '../services/ntfy.js';

export const notificationsRouter = Router();

const SITE_URL = process.env.SITE_BASE_URL || 'https://dobleyo.cafe';
const CRON_SECRET = process.env.NTFY_CRON_SECRET || '';

// Una cosecha queda "pendiente de ingreso" mientras su lot_id no tenga fila en
// green_coffee_inventory (mismo criterio que /admin/inventory-storage).
const PENDING_GREEN_INTAKE_SQL = `
  SELECT h.lot_id, h.farm, h.variety, h.created_at,
         CAST(julianday('now') - julianday(h.created_at) AS INTEGER) AS days_pending
    FROM coffee_harvests h
    LEFT JOIN green_coffee_inventory g ON g.lot_id = h.lot_id
   WHERE g.id IS NULL
     AND julianday('now') - julianday(h.created_at) >= ?
   ORDER BY h.created_at ASC`;

/**
 * Permite dos formas de autenticación:
 *  - Header `x-cron-secret` con NTFY_CRON_SECRET (para un cron externo).
 *  - JWT de admin (para dispararlo a mano desde el panel).
 */
function authenticateCronOrAdmin(req, res, next) {
  const provided = req.get('x-cron-secret');
  if (CRON_SECRET && provided && timingSafeEqual(provided, CRON_SECRET)) return next();
  return authenticateToken(req, res, (err) => (err ? next(err) : requireRole('admin')(req, res, next)));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function getPendingIntake(minDays) {
  const { rows } = await query(PENDING_GREEN_INTAKE_SQL, [minDays]);
  return rows.map((r) => ({
    lotId:       r.lot_id,
    farm:        r.farm,
    variety:     r.variety,
    harvestedAt: r.created_at,
    daysPending: Number(r.days_pending ?? 0),
  }));
}

// Días mínimos de espera antes de recordar un lote. Por defecto 1, para no
// repetir el aviso inmediato que ya se envió al registrar la cosecha.
const parseMinDays = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 1;
};

// ──────────────────────────────────────────────────────────────────────────
// GET /api/notifications/pending-intake — Consulta sin enviar notificación.
// ──────────────────────────────────────────────────────────────────────────
notificationsRouter.get('/pending-intake', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const lots = await getPendingIntake(parseMinDays(req.query.minDays));
    res.json({ success: true, data: { count: lots.length, lots } });
  } catch (err) {
    logger.error({ err }, '[GET /api/notifications/pending-intake]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/notifications/pending-intake — Barrido: publica en ntfy un resumen
// de los lotes cosechados que siguen sin ingresar al inventario de café verde.
// Pensado para un cron externo con el header `x-cron-secret`.
// ──────────────────────────────────────────────────────────────────────────
notificationsRouter.post('/pending-intake', authenticateCronOrAdmin, async (req, res) => {
  try {
    const minDays = parseMinDays(req.query.minDays);
    const lots = await getPendingIntake(minDays);

    if (lots.length === 0) {
      return res.json({ success: true, data: { count: 0, notified: false, reason: 'sin_pendientes' } });
    }
    if (!isNtfyEnabled()) {
      return res.json({ success: true, data: { count: lots.length, notified: false, reason: 'ntfy_no_configurado', lots } });
    }

    const maxDays = Math.max(...lots.map((l) => l.daysPending));
    const detalle = lots
      .slice(0, 10)
      .map((l) => `• ${l.lotId} — ${l.farm} (${l.variety}), ${l.daysPending} día${l.daysPending === 1 ? '' : 's'}`)
      .join('\n');
    const resto = lots.length > 10 ? `\n…y ${lots.length - 10} lote(s) más.` : '';

    const result = await sendNtfy({
      title:    `${lots.length} lote${lots.length === 1 ? '' : 's'} pendiente${lots.length === 1 ? '' : 's'} de ingreso a inventario`,
      message:  `Cosechas recogidas y aún sin registrar en el inventario de café verde:\n${detalle}${resto}`,
      priority: maxDays >= 7 ? 4 : 3,
      tags:     maxDays >= 7 ? ['warning', 'seedling'] : ['seedling'],
      click:    `${SITE_URL}/admin/inventory-storage`,
    });

    res.json({ success: true, data: { count: lots.length, notified: result.success, maxDaysPending: maxDays, lots } });
  } catch (err) {
    logger.error({ err }, '[POST /api/notifications/pending-intake]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});
