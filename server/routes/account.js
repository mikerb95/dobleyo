import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import { query } from '../db.js';
import { authenticateToken } from '../auth.js';
import { comparePassword } from '../auth.js';
import { logAudit } from '../services/audit.js';

export const accountRouter = Router();

// El usuario dev sintético (id 0) no existe en BD: bloqueamos escrituras.
function blockDevUser(req, res) {
  if (req.user.id === 0) {
    res.status(403).json({ success: false, error: 'Usuario de desarrollo no editable' });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECCIONES — libreta de direcciones de envío
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/account/addresses
accountRouter.get('/addresses', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, label, recipient_name, phone, address, city, state_province, country, zip, is_default, created_at
       FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/account/addresses] Error:');
    res.status(500).json({ success: false, error: 'Error al cargar direcciones' });
  }
});

const addressValidators = [
  body('recipient_name').trim().notEmpty().withMessage('Nombre del destinatario requerido'),
  body('address').trim().notEmpty().withMessage('Dirección requerida'),
  body('city').trim().notEmpty().withMessage('Ciudad requerida'),
  body('label').optional({ checkFalsy: true }).trim(),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('state_province').optional({ checkFalsy: true }).trim(),
  body('country').optional({ checkFalsy: true }).trim(),
  body('zip').optional({ checkFalsy: true }).trim(),
  body('is_default').optional().isBoolean().withMessage('Valor inválido'),
];

// POST /api/account/addresses
accountRouter.post('/addresses', authenticateToken, addressValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  if (blockDevUser(req, res)) return;

  const { label, recipient_name, phone, address, city, state_province, country, zip } = req.body;

  try {
    // Primera dirección o is_default solicitado → marcar como predeterminada.
    const countRes = await query('SELECT COUNT(*) AS c FROM user_addresses WHERE user_id = ?', [req.user.id]);
    const isFirst = Number(countRes.rows[0].c) === 0;
    const makeDefault = isFirst || req.body.is_default === true || req.body.is_default === 'true';

    if (makeDefault) {
      await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    const result = await query(
      `INSERT INTO user_addresses (user_id, label, recipient_name, phone, address, city, state_province, country, zip, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, label || null, recipient_name, phone || null, address, city,
        state_province || null, country || 'Colombia', zip || null, makeDefault ? 1 : 0,
      ]
    );

    await logAudit(req.user.id, 'create', 'user_address', String(result.lastInsertRowid), { city });
    res.status(201).json({ success: true, data: { id: Number(result.lastInsertRowid) } });
  } catch (err) {
    logger.error({ err }, '[POST /api/account/addresses] Error:');
    res.status(500).json({ success: false, error: 'Error al guardar la dirección' });
  }
});

// PUT /api/account/addresses/:id
accountRouter.put('/addresses/:id', authenticateToken, addressValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  if (blockDevUser(req, res)) return;

  const { label, recipient_name, phone, address, city, state_province, country, zip } = req.body;

  try {
    const owned = await query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ success: false, error: 'Dirección no encontrada' });

    const makeDefault = req.body.is_default === true || req.body.is_default === 'true';
    if (makeDefault) {
      await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    await query(
      `UPDATE user_addresses
       SET label=?, recipient_name=?, phone=?, address=?, city=?, state_province=?, country=?, zip=?${makeDefault ? ', is_default=1' : ''}
       WHERE id=? AND user_id=?`,
      [
        label || null, recipient_name, phone || null, address, city,
        state_province || null, country || 'Colombia', zip || null,
        req.params.id, req.user.id,
      ]
    );

    res.json({ success: true, message: 'Dirección actualizada' });
  } catch (err) {
    logger.error({ err }, '[PUT /api/account/addresses/:id] Error:');
    res.status(500).json({ success: false, error: 'Error al actualizar la dirección' });
  }
});

// PUT /api/account/addresses/:id/default
accountRouter.put('/addresses/:id/default', authenticateToken, async (req, res) => {
  if (blockDevUser(req, res)) return;
  try {
    const owned = await query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ success: false, error: 'Dirección no encontrada' });

    await query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    await query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Dirección predeterminada actualizada' });
  } catch (err) {
    logger.error({ err }, '[PUT /api/account/addresses/:id/default] Error:');
    res.status(500).json({ success: false, error: 'Error al actualizar la dirección' });
  }
});

// DELETE /api/account/addresses/:id
accountRouter.delete('/addresses/:id', authenticateToken, async (req, res) => {
  if (blockDevUser(req, res)) return;
  try {
    const owned = await query('SELECT is_default FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ success: false, error: 'Dirección no encontrada' });

    await query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    // Si se eliminó la predeterminada, promover la más reciente que quede.
    if (owned.rows[0].is_default) {
      const next = await query(
        'SELECT id FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (next.rows.length) {
        await query('UPDATE user_addresses SET is_default = 1 WHERE id = ?', [next.rows[0].id]);
      }
    }

    res.json({ success: true, message: 'Dirección eliminada' });
  } catch (err) {
    logger.error({ err }, '[DELETE /api/account/addresses/:id] Error:');
    res.status(500).json({ success: false, error: 'Error al eliminar la dirección' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FAVORITOS — lista de deseos
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/account/favorites
accountRouter.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT f.product_id, f.created_at,
              p.name, p.slug, p.category, p.price, p.price_usd, p.image_url, p.is_active, p.stock_quantity
       FROM user_favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/account/favorites] Error:');
    res.status(500).json({ success: false, error: 'Error al cargar favoritos' });
  }
});

// POST /api/account/favorites  { productId }
accountRouter.post('/favorites',
  authenticateToken,
  body('productId').trim().notEmpty().withMessage('Producto requerido'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
    if (blockDevUser(req, res)) return;

    try {
      const exists = await query('SELECT id FROM products WHERE id = ? AND is_active = 1', [req.body.productId]);
      if (!exists.rows.length) return res.status(404).json({ success: false, error: 'Producto no disponible' });

      await query(
        'INSERT OR IGNORE INTO user_favorites (user_id, product_id) VALUES (?, ?)',
        [req.user.id, req.body.productId]
      );
      res.status(201).json({ success: true, message: 'Agregado a favoritos' });
    } catch (err) {
      logger.error({ err }, '[POST /api/account/favorites] Error:');
      res.status(500).json({ success: false, error: 'Error al agregar a favoritos' });
    }
  }
);

// DELETE /api/account/favorites/:productId
accountRouter.delete('/favorites/:productId', authenticateToken, async (req, res) => {
  if (blockDevUser(req, res)) return;
  try {
    await query('DELETE FROM user_favorites WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId]);
    res.json({ success: true, message: 'Eliminado de favoritos' });
  } catch (err) {
    logger.error({ err }, '[DELETE /api/account/favorites/:productId] Error:');
    res.status(500).json({ success: false, error: 'Error al eliminar de favoritos' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PREFERENCIAS — comunicación, idioma y moneda
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PREFS = { newsletter: 1, order_updates: 1, promotions: 1, language: 'es', currency: 'COP' };

// GET /api/account/preferences
accountRouter.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT newsletter, order_updates, promotions, language, currency FROM user_preferences WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows[0] || DEFAULT_PREFS });
  } catch (err) {
    logger.error({ err }, '[GET /api/account/preferences] Error:');
    res.status(500).json({ success: false, error: 'Error al cargar preferencias' });
  }
});

// PUT /api/account/preferences
accountRouter.put('/preferences',
  authenticateToken,
  [
    body('newsletter').optional().isBoolean(),
    body('order_updates').optional().isBoolean(),
    body('promotions').optional().isBoolean(),
    body('language').optional().isIn(['es', 'en']).withMessage('Idioma inválido'),
    body('currency').optional().isIn(['COP', 'USD']).withMessage('Moneda inválida'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
    if (blockDevUser(req, res)) return;

    const toInt = (v, def) => (v === undefined ? def : (v === true || v === 'true' || v === 1 || v === '1') ? 1 : 0);

    try {
      const current = await query('SELECT * FROM user_preferences WHERE user_id = ?', [req.user.id]);
      const base = current.rows[0] || DEFAULT_PREFS;

      const newsletter = toInt(req.body.newsletter, base.newsletter);
      const orderUpdates = toInt(req.body.order_updates, base.order_updates);
      const promotions = toInt(req.body.promotions, base.promotions);
      const language = req.body.language || base.language;
      const currency = req.body.currency || base.currency;

      await query(
        `INSERT INTO user_preferences (user_id, newsletter, order_updates, promotions, language, currency, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           newsletter=excluded.newsletter, order_updates=excluded.order_updates,
           promotions=excluded.promotions, language=excluded.language,
           currency=excluded.currency, updated_at=datetime('now')`,
        [req.user.id, newsletter, orderUpdates, promotions, language, currency]
      );

      res.json({ success: true, message: 'Preferencias actualizadas' });
    } catch (err) {
      logger.error({ err }, '[PUT /api/account/preferences] Error:');
      res.status(500).json({ success: false, error: 'Error al actualizar preferencias' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR CUENTA
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/account  { current_password? }
// Las cuentas con contraseña deben confirmarla; las sociales (Google/Apple) no.
accountRouter.delete('/', authenticateToken, async (req, res) => {
  if (blockDevUser(req, res)) return;

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    const { password_hash } = result.rows[0];
    if (password_hash) {
      const provided = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
      if (!provided) return res.status(422).json({ success: false, error: 'Debe confirmar su contraseña' });
      const valid = await comparePassword(provided, password_hash);
      if (!valid) return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
    }

    await logAudit(req.user.id, 'delete', 'user', String(req.user.id), { self: true });

    // Limpieza explícita de datos vinculados. Las órdenes conservan historial
    // contable con user_id → NULL (ON DELETE SET NULL definido en la tabla).
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    await query('DELETE FROM user_addresses WHERE user_id = ?', [req.user.id]);
    await query('DELETE FROM user_favorites WHERE user_id = ?', [req.user.id]);
    await query('DELETE FROM user_preferences WHERE user_id = ?', [req.user.id]);
    await query('DELETE FROM users WHERE id = ?', [req.user.id]);

    res.clearCookie('auth_token');
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.json({ success: true, message: 'Cuenta eliminada' });
  } catch (err) {
    logger.error({ err }, '[DELETE /api/account] Error:');
    res.status(500).json({ success: false, error: 'Error al eliminar la cuenta' });
  }
});
