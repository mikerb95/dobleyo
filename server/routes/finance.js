// Módulo de Finanzas — Fase 6
import { Router } from 'express';
import { logger } from '../logger.js';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';
import {
  getDashboard, getTransactionBook,
  createPurchaseInvoice, createSalesInvoice, nextNumber,
} from '../services/financeService.js';

export const financeRouter = Router();

financeRouter.use(authenticateToken);

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return true; }
  return false;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

financeRouter.get('/dashboard', requireRole('admin'), async (_req, res) => {
  try {
    res.json({ success: true, data: await getDashboard() });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/dashboard]');
    res.status(500).json({ success: false, error: 'Error al obtener el dashboard financiero' });
  }
});

// ── Libro de transacciones ───────────────────────────────────────────────────

financeRouter.get('/transactions', requireRole('admin'), async (req, res) => {
  try {
    const result = await getTransactionBook(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/transactions]');
    res.status(500).json({ success: false, error: 'Error al obtener el libro de transacciones' });
  }
});

// ── Plan de cuentas ──────────────────────────────────────────────────────────

financeRouter.get('/accounts', requireRole('admin'), async (req, res) => {
  try {
    const { type, active = 'true' } = req.query;
    const conditions = [];
    const params = [];
    if (active === 'true') conditions.push('a.is_active = 1');
    if (type) { params.push(type); conditions.push(`a.account_type = ?`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(`
      SELECT a.id, a.code, a.name, a.account_type, a.account_subtype,
             a.parent_account_id, p.name AS parent_name, a.is_active, a.description
      FROM accounting_accounts a
      LEFT JOIN accounting_accounts p ON p.id = a.parent_account_id
      ${where} ORDER BY a.code
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/accounts]');
    res.status(500).json({ success: false, error: 'Error al obtener el plan de cuentas' });
  }
});

financeRouter.post('/accounts', requireRole('admin'), [
  body('code').trim().notEmpty().withMessage('Código requerido'),
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('account_type').isIn(['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo']).withMessage('Tipo inválido'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { code, name, account_type, account_subtype, parent_account_id, description } = req.body;
    const { rows } = await query(
      `INSERT INTO accounting_accounts (code, name, account_type, account_subtype, parent_account_id, description)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [code, name, account_type, account_subtype || null, parent_account_id || null, description || null]
    );
    await logAudit(req.user.id, 'create', 'accounting_account', rows[0].id, { code, name, account_type });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, '[POST /api/finance/accounts]');
    res.status(500).json({ success: false, error: 'Error al crear la cuenta contable' });
  }
});

// ── Gastos ───────────────────────────────────────────────────────────────────

financeRouter.get('/expenses', requireRole('admin'), async (req, res) => {
  try {
    const { state, category, limit = 20, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    if (state)    { params.push(state);    conditions.push(`e.state = ?`); }
    if (category) { params.push(category); conditions.push(`e.category = ?`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await query(`
      SELECT e.id, e.expense_number, e.expense_date, e.category, e.description,
             e.amount, e.currency, e.state, e.receipt_number, e.notes,
             u.name AS created_by, ab.name AS approved_by_name
      FROM expenses e
      LEFT JOIN users u  ON u.id  = e.user_id
      LEFT JOIN users ab ON ab.id = e.approved_by
      ${where} ORDER BY e.expense_date DESC LIMIT ? OFFSET ?
    `, params);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM expenses e ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/expenses]');
    res.status(500).json({ success: false, error: 'Error al obtener los gastos' });
  }
});

financeRouter.post('/expenses', requireRole('admin'), [
  body('expense_date').isDate().withMessage('Fecha inválida'),
  body('category').isIn(['operativo', 'administrativo', 'venta', 'financiero', 'otro']).withMessage('Categoría inválida'),
  body('description').trim().notEmpty().withMessage('Descripción requerida'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Monto debe ser positivo'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { expense_date, category, description, amount, currency = 'COP', receipt_number, notes, payment_method_id, cost_center_id } = req.body;
    const expense_number = await nextNumber('EXP', 'expenses');
    const { rows } = await query(
      `INSERT INTO expenses (expense_number, expense_date, category, description, amount, currency,
         receipt_number, notes, payment_method_id, cost_center_id, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      [expense_number, expense_date, category, description, amount, currency,
       receipt_number || null, notes || null, payment_method_id || null, cost_center_id || null, req.user.id]
    );
    await logAudit(req.user.id, 'create', 'expense', rows[0].id, { expense_number, amount, category });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, '[POST /api/finance/expenses]');
    res.status(500).json({ success: false, error: 'Error al registrar el gasto' });
  }
});

financeRouter.patch('/expenses/:id/state', requireRole('admin'), [
  param('id').isInt().withMessage('ID inválido'),
  body('state').isIn(['borrador', 'aprobado', 'pagado', 'rechazado']).withMessage('Estado inválido'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { id } = req.params;
    const { state } = req.body;
    const extra = state === 'aprobado' ? `, approved_by = ${req.user.id}, approved_at = datetime('now')` : '';
    const { rows } = await query(
      `UPDATE expenses SET state = ?, updated_at = datetime('now') ${extra} WHERE id = ? RETURNING *`,
      [state, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Gasto no encontrado' });
    await logAudit(req.user.id, 'update', 'expense', id, { state });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, '[PATCH /api/finance/expenses/:id/state]');
    res.status(500).json({ success: false, error: 'Error al actualizar el gasto' });
  }
});

// ── Facturas de compra ───────────────────────────────────────────────────────

financeRouter.get('/purchase-invoices', requireRole('admin'), async (req, res) => {
  try {
    const { state, caficultor_id, limit = 20, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    if (state)         { params.push(state);         conditions.push(`pi.state = ?`); }
    if (caficultor_id) { params.push(caficultor_id); conditions.push(`pi.caficultor_id = ?`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await query(`
      SELECT pi.id, pi.invoice_number, pi.supplier_invoice_number, pi.invoice_date, pi.due_date,
             pi.state, pi.total_amount, pi.amount_paid, pi.amount_due, pi.notes,
             u.name AS caficultor_name, u.email AS caficultor_email
      FROM purchase_invoices pi
      LEFT JOIN users u ON u.id = pi.caficultor_id
      ${where} ORDER BY pi.invoice_date DESC LIMIT ? OFFSET ?
    `, params);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM purchase_invoices pi ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/purchase-invoices]');
    res.status(500).json({ success: false, error: 'Error al obtener las facturas de compra' });
  }
});

financeRouter.post('/purchase-invoices', requireRole('admin'), [
  body('invoice_date').isDate().withMessage('Fecha de factura inválida'),
  body('due_date').isDate().withMessage('Fecha de vencimiento inválida'),
  body('lines').isArray({ min: 1 }).withMessage('Debe tener al menos una línea'),
  body('lines.*.description').trim().notEmpty().withMessage('Descripción de línea requerida'),
  body('lines.*.quantity').isFloat({ min: 0.01 }).withMessage('Cantidad inválida'),
  body('lines.*.unit_price').isFloat({ min: 0 }).withMessage('Precio unitario inválido'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const invoice = await createPurchaseInvoice(req.body, req.user.id);
    await logAudit(req.user.id, 'create', 'purchase_invoice', invoice.id, { invoice_number: invoice.invoice_number, total_amount: invoice.total_amount });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    logger.error({ err }, '[POST /api/finance/purchase-invoices]');
    res.status(500).json({ success: false, error: 'Error al crear la factura de compra' });
  }
});

financeRouter.patch('/purchase-invoices/:id/state', requireRole('admin'), [
  param('id').isInt().withMessage('ID inválido'),
  body('state').isIn(['borrador', 'confirmada', 'pagada_parcial', 'pagada', 'cancelada']).withMessage('Estado inválido'),
  body('amount_paid').optional().isFloat({ min: 0 }).withMessage('Monto pagado inválido'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { id } = req.params;
    const { state, amount_paid } = req.body;
    const setAmountPaid = amount_paid !== undefined ? `, amount_paid = ?, amount_due = total_amount - ?` : '';
    const params = amount_paid !== undefined ? [state, amount_paid, amount_paid, id] : [state, id];
    const { rows } = await query(
      `UPDATE purchase_invoices SET state = ?, updated_at = datetime('now') ${setAmountPaid} WHERE id = ? RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Factura no encontrada' });
    await logAudit(req.user.id, 'update', 'purchase_invoice', id, { state, amount_paid });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, '[PATCH /api/finance/purchase-invoices/:id/state]');
    res.status(500).json({ success: false, error: 'Error al actualizar la factura' });
  }
});

// ── Facturas de venta ────────────────────────────────────────────────────────

financeRouter.get('/sales-invoices', requireRole('admin'), async (req, res) => {
  try {
    const { state, limit = 20, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    if (state) { params.push(state); conditions.push(`si.state = ?`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await query(`
      SELECT si.id, si.invoice_number, si.invoice_date, si.due_date,
             si.state, si.total_amount, si.amount_paid, si.amount_due,
             u.name AS customer_name, u.email AS customer_email
      FROM sales_invoices si JOIN users u ON u.id = si.customer_id
      ${where} ORDER BY si.invoice_date DESC LIMIT ? OFFSET ?
    `, params);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM sales_invoices si ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/sales-invoices]');
    res.status(500).json({ success: false, error: 'Error al obtener las facturas de venta' });
  }
});

financeRouter.post('/sales-invoices', requireRole('admin'), [
  body('customer_id').isInt().withMessage('Cliente inválido'),
  body('invoice_date').isDate().withMessage('Fecha inválida'),
  body('due_date').isDate().withMessage('Fecha de vencimiento inválida'),
  body('lines').isArray({ min: 1 }).withMessage('Debe tener al menos una línea'),
  body('lines.*.description').trim().notEmpty().withMessage('Descripción requerida'),
  body('lines.*.quantity').isFloat({ min: 0.01 }).withMessage('Cantidad inválida'),
  body('lines.*.unit_price').isFloat({ min: 0 }).withMessage('Precio inválido'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const invoice = await createSalesInvoice(req.body, req.user.id);
    await logAudit(req.user.id, 'create', 'sales_invoice', invoice.id, { invoice_number: invoice.invoice_number, total_amount: invoice.total_amount });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    logger.error({ err }, '[POST /api/finance/sales-invoices]');
    res.status(500).json({ success: false, error: 'Error al crear la factura de venta' });
  }
});

// ── Pagos ────────────────────────────────────────────────────────────────────

financeRouter.get('/payments', requireRole('admin'), async (req, res) => {
  try {
    const { type, state, limit = 20, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    if (type)  { params.push(type);  conditions.push(`p.payment_type = ?`); }
    if (state) { params.push(state); conditions.push(`p.state = ?`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await query(`
      SELECT p.id, p.payment_number, p.payment_type, p.payment_date,
             p.amount, p.currency, p.reference, p.state, p.notes, u.name AS partner_name
      FROM payments p LEFT JOIN users u ON u.id = p.partner_id
      ${where} ORDER BY p.payment_date DESC LIMIT ? OFFSET ?
    `, params);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS total FROM payments p ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/payments]');
    res.status(500).json({ success: false, error: 'Error al obtener los pagos' });
  }
});

financeRouter.post('/payments', requireRole('admin'), [
  body('payment_type').isIn(['recibido', 'realizado']).withMessage('Tipo de pago inválido'),
  body('payment_date').isDate().withMessage('Fecha inválida'),
  body('partner_id').isInt().withMessage('Socio inválido'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Monto debe ser positivo'),
  body('payment_method_id').isInt().withMessage('Método de pago requerido'),
], async (req, res) => {
  if (handleValidation(req, res)) return;
  try {
    const { payment_type, payment_date, partner_id, amount, currency = 'COP', payment_method_id, reference, notes } = req.body;
    const payment_number = await nextNumber('PAG', 'payments');
    const { rows } = await query(
      `INSERT INTO payments (payment_number, payment_type, payment_date, partner_id, amount, currency,
         payment_method_id, reference, notes, state, user_id) VALUES (?,?,?,?,?,?,?,?,?,'confirmado',?) RETURNING *`,
      [payment_number, payment_type, payment_date, partner_id, amount, currency,
       payment_method_id, reference || null, notes || null, req.user.id]
    );
    await logAudit(req.user.id, 'create', 'payment', rows[0].id, { payment_number, amount, payment_type });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error({ err }, '[POST /api/finance/payments]');
    res.status(500).json({ success: false, error: 'Error al registrar el pago' });
  }
});

// ── Listas de soporte ────────────────────────────────────────────────────────

financeRouter.get('/users-list', requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    const conditions = [];
    const params = [];
    if (role) { conditions.push('role = ?'); params.push(role); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(`SELECT id, name, email, role FROM users ${where} ORDER BY name`, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/users-list]');
    res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
  }
});

financeRouter.get('/payment-methods', requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, code, name, method_type, requires_reference FROM payment_methods WHERE is_active = 1 ORDER BY name`, []
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/payment-methods]');
    res.status(500).json({ success: false, error: 'Error al obtener métodos de pago' });
  }
});

// ── Mis facturas (caficultor) ────────────────────────────────────────────────

financeRouter.get('/my-invoices', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const lim = parseInt(limit, 10);
    const off = parseInt(offset, 10);

    const { rows: invoices } = await query(`
      SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.due_date,
             pi.state, pi.total_amount, pi.amount_paid, pi.amount_due, pi.notes
      FROM purchase_invoices pi
      WHERE pi.caficultor_id = ?
      ORDER BY pi.invoice_date DESC LIMIT ? OFFSET ?
    `, [req.user.id, lim, off]);

    if (invoices.length > 0) {
      const ids = invoices.map(i => i.id);
      const placeholders = ids.map(() => '?').join(',');
      const { rows: lines } = await query(
        `SELECT purchase_invoice_id, description, quantity, unit_price, subtotal, total, lot_reference
         FROM purchase_invoice_lines WHERE purchase_invoice_id IN (${placeholders}) ORDER BY id`, ids
      );
      const byInvoice = {};
      for (const l of lines) {
        if (!byInvoice[l.purchase_invoice_id]) byInvoice[l.purchase_invoice_id] = [];
        byInvoice[l.purchase_invoice_id].push(l);
      }
      for (const inv of invoices) inv.lines = byInvoice[inv.id] || [];
    }

    const [{ rows: countRows }, { rows: summaryRows }] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM purchase_invoices WHERE caficultor_id = ?`, [req.user.id]),
      query(`SELECT COALESCE(SUM(total_amount), 0) AS total_facturado,
                    COALESCE(SUM(amount_paid), 0)  AS total_pagado,
                    COALESCE(SUM(amount_due), 0)   AS total_pendiente,
                    SUM(CASE WHEN state IN ('confirmada','pagada_parcial') THEN 1 ELSE 0 END) AS facturas_pendientes
             FROM purchase_invoices WHERE caficultor_id = ?`, [req.user.id]),
    ]);

    res.json({ success: true, data: invoices, total: parseInt(countRows[0].total, 10), limit: lim, offset: off, summary: summaryRows[0] });
  } catch (err) {
    logger.error({ err }, '[GET /api/finance/my-invoices]');
    res.status(500).json({ success: false, error: 'Error al obtener tus facturas' });
  }
});
