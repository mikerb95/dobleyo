// Módulo de Finanzas — Fase 6
// Cubre: plan de cuentas, gastos, facturas de compra/venta, pagos, dashboard financiero
import { Router } from 'express';
import { body, query as eqQuery, param, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';

export const financeRouter = Router();

financeRouter.use(authenticateToken);

async function nextNumber(prefix, table) {
    const { rows } = await query(`SELECT COUNT(*) AS cnt FROM ${table}`, []);
    const n = parseInt(rows[0].cnt, 10) + 1;
    return `${prefix}-${String(n).padStart(5, '0')}`;
}

function handleValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(422).json({ success: false, errors: errors.array() });
        return true;
    }
    return false;
}

// ==========================================================
// DASHBOARD — solo admin
// ==========================================================

financeRouter.get('/dashboard', requireRole('admin'), async (req, res) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7); // "2025-04"

        const [revenue, costs, pending, expenses, recentInvoices, recentExpenses] = await Promise.all([
            query(`
                SELECT COALESCE(SUM(total_amount), 0) AS total
                FROM sales_invoices
                WHERE state IN ('confirmada','pagada_parcial','pagada')
                  AND strftime('%Y-%m', invoice_date) = ?
            `, [currentMonth]),
            query(`
                SELECT COALESCE(SUM(total_amount), 0) AS total
                FROM purchase_invoices
                WHERE state IN ('confirmada','pagada_parcial','pagada')
                  AND strftime('%Y-%m', invoice_date) = ?
            `, [currentMonth]),
            query(`
                SELECT COALESCE(SUM(amount_due), 0) AS total, COUNT(*) AS count
                FROM purchase_invoices
                WHERE state IN ('confirmada','pagada_parcial')
            `, []),
            query(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM expenses
                WHERE state IN ('aprobado','pagado')
                  AND strftime('%Y-%m', expense_date) = ?
            `, [currentMonth]),
            query(`
                SELECT si.id, si.invoice_number, si.invoice_date, si.total_amount, si.state,
                       u.name AS customer_name
                FROM sales_invoices si
                JOIN users u ON u.id = si.customer_id
                ORDER BY si.created_at DESC LIMIT 5
            `, []),
            query(`
                SELECT id, expense_number, expense_date, description, amount, category, state
                FROM expenses
                ORDER BY created_at DESC LIMIT 5
            `, []),
        ]);

        const monthRevenue = parseFloat(revenue.rows[0].total);
        const monthCosts = parseFloat(costs.rows[0].total);
        const monthExpenses = parseFloat(expenses.rows[0].total);
        const balance = monthRevenue - monthCosts - monthExpenses;

        res.json({
            success: true,
            data: {
                month_revenue: monthRevenue,
                month_costs: monthCosts,
                month_expenses: monthExpenses,
                month_balance: balance,
                pending_payables: parseFloat(pending.rows[0].total),
                pending_invoices_count: parseInt(pending.rows[0].count, 10),
                recent_invoices: recentInvoices.rows,
                recent_expenses: recentExpenses.rows,
            },
        });
    } catch (err) {
        console.error('[GET /api/finance/dashboard]', err);
        res.status(500).json({ success: false, error: 'Error al obtener el dashboard financiero' });
    }
});

// ==========================================================
// LIBRO DE TRANSACCIONES — vista unificada admin
// ==========================================================

financeRouter.get('/transactions', requireRole('admin'), async (req, res) => {
    try {
        const {
            date_from, date_to,
            tipo,   // factura_venta | factura_compra | gasto | pago
            estado,
            direccion, // ingreso | egreso
            search,
            limit = 50,
            offset = 0,
        } = req.query;

        const lim = Math.min(parseInt(limit, 10) || 50, 200);
        const off = parseInt(offset, 10) || 0;

        // UNION de todas las fuentes financieras
        const unionSql = `
            SELECT
                'factura_venta'       AS tipo,
                si.id                 AS id,
                si.invoice_number     AS numero,
                si.invoice_date       AS fecha,
                si.total_amount       AS monto,
                'ingreso'             AS direccion,
                si.state              AS estado,
                u.name                AS contraparte,
                si.notes              AS descripcion,
                si.created_at         AS created_at
            FROM sales_invoices si
            JOIN users u ON u.id = si.customer_id

            UNION ALL

            SELECT
                'factura_compra'                              AS tipo,
                pi.id                                         AS id,
                pi.invoice_number                             AS numero,
                pi.invoice_date                               AS fecha,
                pi.total_amount                               AS monto,
                'egreso'                                      AS direccion,
                pi.state                                      AS estado,
                COALESCE(u.name, 'Proveedor externo')         AS contraparte,
                pi.notes                                      AS descripcion,
                pi.created_at                                 AS created_at
            FROM purchase_invoices pi
            LEFT JOIN users u ON u.id = pi.caficultor_id

            UNION ALL

            SELECT
                'gasto'          AS tipo,
                e.id             AS id,
                e.expense_number AS numero,
                e.expense_date   AS fecha,
                e.amount         AS monto,
                'egreso'         AS direccion,
                e.state          AS estado,
                e.category       AS contraparte,
                e.description    AS descripcion,
                e.created_at     AS created_at
            FROM expenses e

            UNION ALL

            SELECT
                'pago'                                                           AS tipo,
                p.id                                                             AS id,
                p.payment_number                                                 AS numero,
                p.payment_date                                                   AS fecha,
                p.amount                                                         AS monto,
                CASE p.payment_type WHEN 'recibido' THEN 'ingreso' ELSE 'egreso' END AS direccion,
                p.state                                                          AS estado,
                COALESCE(u.name, '')                                             AS contraparte,
                COALESCE(p.notes, p.reference, '')                               AS descripcion,
                p.created_at                                                     AS created_at
            FROM payments p
            LEFT JOIN users u ON u.id = p.partner_id
        `;

        // Filtros dinámicos
        const conditions = [];
        const params = [];

        if (date_from) { conditions.push(`fecha >= ?`); params.push(date_from); }
        if (date_to)   { conditions.push(`fecha <= ?`); params.push(date_to); }
        if (tipo)      { conditions.push(`tipo = ?`); params.push(tipo); }
        if (estado)    { conditions.push(`estado = ?`); params.push(estado); }
        if (direccion) { conditions.push(`direccion = ?`); params.push(direccion); }
        if (search)    {
            conditions.push(`(numero LIKE ? OR contraparte LIKE ? OR descripcion LIKE ?)`);
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const dataParams = [...params, lim, off];
        const { rows } = await query(
            `SELECT * FROM (${unionSql}) ${where} ORDER BY fecha DESC, created_at DESC LIMIT ? OFFSET ?`,
            dataParams
        );

        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN direccion='ingreso' THEN monto ELSE 0 END),0) AS total_ingresos, COALESCE(SUM(CASE WHEN direccion='egreso' THEN monto ELSE 0 END),0) AS total_egresos FROM (${unionSql}) ${where}`,
            params
        );

        const totals = countRows[0];

        res.json({
            success: true,
            data: rows,
            total: parseInt(totals.total, 10),
            total_ingresos: parseFloat(totals.total_ingresos),
            total_egresos: parseFloat(totals.total_egresos),
            balance: parseFloat(totals.total_ingresos) - parseFloat(totals.total_egresos),
            limit: lim,
            offset: off,
        });
    } catch (err) {
        console.error('[GET /api/finance/transactions]', err);
        res.status(500).json({ success: false, error: 'Error al obtener el libro de transacciones' });
    }
});

// ==========================================================
// PLAN DE CUENTAS (Accounting Accounts)
// ==========================================================

financeRouter.get('/accounts', requireRole('admin'), async (req, res) => {
    try {
        const { type, active = 'true' } = req.query;
        const conditions = [];
        const params = [];

        if (active === 'true') { conditions.push('a.is_active = 1'); }
        if (type) { params.push(type); conditions.push(`a.account_type = ?`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await query(`
            SELECT a.id, a.code, a.name, a.account_type, a.account_subtype,
                   a.parent_account_id, p.name AS parent_name, a.is_active, a.description
            FROM accounting_accounts a
            LEFT JOIN accounting_accounts p ON p.id = a.parent_account_id
            ${where}
            ORDER BY a.code
        `, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[GET /api/finance/accounts]', err);
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
        const { rows } = await query(`
            INSERT INTO accounting_accounts (code, name, account_type, account_subtype, parent_account_id, description)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *
        `, [code, name, account_type, account_subtype || null, parent_account_id || null, description || null]);
        await logAudit(req.user.id, 'create', 'accounting_account', rows[0].id, { code, name, account_type });
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[POST /api/finance/accounts]', err);
        res.status(500).json({ success: false, error: 'Error al crear la cuenta contable' });
    }
});

// ==========================================================
// GASTOS (Expenses)
// ==========================================================

financeRouter.get('/expenses', requireRole('admin'), async (req, res) => {
    try {
        const { state, category, limit = 20, offset = 0 } = req.query;
        const conditions = [];
        const params = [];

        if (state) { params.push(state); conditions.push(`e.state = ?`); }
        if (category) { params.push(category); conditions.push(`e.category = ?`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const { rows } = await query(`
            SELECT e.id, e.expense_number, e.expense_date, e.category, e.description,
                   e.amount, e.currency, e.state, e.receipt_number, e.notes,
                   u.name AS created_by,
                   ab.name AS approved_by_name
            FROM expenses e
            LEFT JOIN users u ON u.id = e.user_id
            LEFT JOIN users ab ON ab.id = e.approved_by
            ${where}
            ORDER BY e.expense_date DESC
            LIMIT ? OFFSET ?
        `, params);

        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total FROM expenses e ${where}`,
            params.slice(0, params.length - 2)
        );

        res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
    } catch (err) {
        console.error('[GET /api/finance/expenses]', err);
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
        const { expense_date, category, description, amount, currency = 'COP', receipt_number, notes,
            payment_method_id, cost_center_id } = req.body;
        const expense_number = await nextNumber('EXP', 'expenses');

        const { rows } = await query(`
            INSERT INTO expenses
              (expense_number, expense_date, category, description, amount, currency,
               receipt_number, notes, payment_method_id, cost_center_id, user_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *
        `, [expense_number, expense_date, category, description, amount, currency,
            receipt_number || null, notes || null,
            payment_method_id || null, cost_center_id || null, req.user.id]);

        await logAudit(req.user.id, 'create', 'expense', rows[0].id, { expense_number, amount, category });
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[POST /api/finance/expenses]', err);
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
        const extra = state === 'aprobado'
            ? `, approved_by = ${req.user.id}, approved_at = datetime('now')`
            : '';
        const { rows } = await query(
            `UPDATE expenses SET state = ?, updated_at = datetime('now') ${extra} WHERE id = ? RETURNING *`,
            [state, id]
        );
        if (!rows.length) return res.status(404).json({ success: false, error: 'Gasto no encontrado' });
        await logAudit(req.user.id, 'update', 'expense', id, { state });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[PATCH /api/finance/expenses/:id/state]', err);
        res.status(500).json({ success: false, error: 'Error al actualizar el gasto' });
    }
});

// ==========================================================
// FACTURAS DE COMPRA — pagos a caficultores / proveedores
// ==========================================================

financeRouter.get('/purchase-invoices', requireRole('admin'), async (req, res) => {
    try {
        const { state, caficultor_id, limit = 20, offset = 0 } = req.query;
        const conditions = [];
        const params = [];

        if (state) { params.push(state); conditions.push(`pi.state = ?`); }
        if (caficultor_id) { params.push(caficultor_id); conditions.push(`pi.caficultor_id = ?`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const { rows } = await query(`
            SELECT pi.id, pi.invoice_number, pi.supplier_invoice_number, pi.invoice_date, pi.due_date,
                   pi.state, pi.total_amount, pi.amount_paid, pi.amount_due, pi.notes,
                   u.name AS caficultor_name, u.email AS caficultor_email
            FROM purchase_invoices pi
            LEFT JOIN users u ON u.id = pi.caficultor_id
            ${where}
            ORDER BY pi.invoice_date DESC
            LIMIT ? OFFSET ?
        `, params);

        const countParams = params.slice(0, params.length - 2);
        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total FROM purchase_invoices pi ${where}`, countParams
        );

        res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
    } catch (err) {
        console.error('[GET /api/finance/purchase-invoices]', err);
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
    const { getClient } = await import('../db.js');
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const { invoice_date, due_date, caficultor_id, supplier_invoice_number, notes, lines, payment_term_days = 0 } = req.body;

        let subtotal = 0;
        let tax_amount = 0;
        for (const line of lines) {
            const lineSub = parseFloat(line.quantity) * parseFloat(line.unit_price);
            const lineTax = lineSub * (parseFloat(line.tax_rate || 0) / 100);
            subtotal += lineSub;
            tax_amount += lineTax;
        }
        const total_amount = subtotal + tax_amount;
        const invoice_number = await nextNumber('FC', 'purchase_invoices');

        const { rows: [invoice] } = await client.query(`
            INSERT INTO purchase_invoices
              (invoice_number, supplier_invoice_number, caficultor_id, invoice_date, due_date,
               payment_term_days, subtotal, tax_amount, total_amount, amount_due, notes, user_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
        `, [invoice_number, supplier_invoice_number || null, caficultor_id || null, invoice_date, due_date,
            payment_term_days, subtotal, tax_amount, total_amount, total_amount, notes || null, req.user.id]);

        for (const line of lines) {
            const lineSub = parseFloat(line.quantity) * parseFloat(line.unit_price);
            const lineTotal = lineSub * (1 + parseFloat(line.tax_rate || 0) / 100);
            await client.query(`
                INSERT INTO purchase_invoice_lines
                  (purchase_invoice_id, description, quantity, unit_price, tax_rate, subtotal, total, lot_reference)
                VALUES (?,?,?,?,?,?,?,?)
            `, [invoice.id, line.description, line.quantity, line.unit_price,
                line.tax_rate || 0, lineSub, lineTotal, line.lot_reference || null]);
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'create', 'purchase_invoice', invoice.id, { invoice_number, total_amount });
        res.status(201).json({ success: true, data: { ...invoice, lines } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/finance/purchase-invoices]', err);
        res.status(500).json({ success: false, error: 'Error al crear la factura de compra' });
    } finally {
        client.release();
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
        const setAmountPaid = amount_paid !== undefined
            ? `, amount_paid = ?, amount_due = total_amount - ?`
            : '';
        const params = amount_paid !== undefined ? [state, amount_paid, amount_paid, id] : [state, id];
        const { rows } = await query(
            `UPDATE purchase_invoices SET state = ?, updated_at = datetime('now') ${setAmountPaid} WHERE id = ? RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        await logAudit(req.user.id, 'update', 'purchase_invoice', id, { state, amount_paid });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[PATCH /api/finance/purchase-invoices/:id/state]', err);
        res.status(500).json({ success: false, error: 'Error al actualizar la factura' });
    }
});

// ==========================================================
// FACTURAS DE VENTA (Sales Invoices)
// ==========================================================

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
            FROM sales_invoices si
            JOIN users u ON u.id = si.customer_id
            ${where}
            ORDER BY si.invoice_date DESC
            LIMIT ? OFFSET ?
        `, params);

        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total FROM sales_invoices si ${where}`,
            params.slice(0, params.length - 2)
        );

        res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
    } catch (err) {
        console.error('[GET /api/finance/sales-invoices]', err);
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
    const { getClient } = await import('../db.js');
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const { customer_id, invoice_date, due_date, notes, lines, shipping_cost = 0 } = req.body;

        let subtotal = 0, tax_amount = 0, discount_amount = 0;
        for (const line of lines) {
            const lineSub = parseFloat(line.quantity) * parseFloat(line.unit_price);
            const lineDiscount = lineSub * (parseFloat(line.discount_percent || 0) / 100);
            const lineAfterDiscount = lineSub - lineDiscount;
            const lineTax = lineAfterDiscount * (parseFloat(line.tax_rate || 0) / 100);
            subtotal += lineAfterDiscount;
            discount_amount += lineDiscount;
            tax_amount += lineTax;
        }
        const total_amount = subtotal + tax_amount + parseFloat(shipping_cost);
        const invoice_number = await nextNumber('FV', 'sales_invoices');

        const { rows: [invoice] } = await client.query(`
            INSERT INTO sales_invoices
              (invoice_number, customer_id, invoice_date, due_date, subtotal, discount_amount,
               tax_amount, shipping_cost, total_amount, amount_due, notes, user_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
        `, [invoice_number, customer_id, invoice_date, due_date, subtotal, discount_amount,
            tax_amount, shipping_cost, total_amount, total_amount, notes || null, req.user.id]);

        for (const line of lines) {
            const lineSub = parseFloat(line.quantity) * parseFloat(line.unit_price);
            const lineDiscount = lineSub * (parseFloat(line.discount_percent || 0) / 100);
            const lineAfterDiscount = lineSub - lineDiscount;
            const lineTax = lineAfterDiscount * (parseFloat(line.tax_rate || 0) / 100);
            await client.query(`
                INSERT INTO sales_invoice_lines
                  (sales_invoice_id, product_id, description, quantity, unit_price, discount_percent, tax_rate, subtotal, total)
                VALUES (?,?,?,?,?,?,?,?,?)
            `, [invoice.id, line.product_id || null, line.description, line.quantity, line.unit_price,
                line.discount_percent || 0, line.tax_rate || 0, lineAfterDiscount, lineAfterDiscount + lineTax]);
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'create', 'sales_invoice', invoice.id, { invoice_number, total_amount });
        res.status(201).json({ success: true, data: { ...invoice, lines } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/finance/sales-invoices]', err);
        res.status(500).json({ success: false, error: 'Error al crear la factura de venta' });
    } finally {
        client.release();
    }
});

// ==========================================================
// PAGOS (Payments)
// ==========================================================

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
                   p.amount, p.currency, p.reference, p.state, p.notes,
                   u.name AS partner_name
            FROM payments p
            LEFT JOIN users u ON u.id = p.partner_id
            ${where}
            ORDER BY p.payment_date DESC
            LIMIT ? OFFSET ?
        `, params);

        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total FROM payments p ${where}`,
            params.slice(0, params.length - 2)
        );

        res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10), limit, offset });
    } catch (err) {
        console.error('[GET /api/finance/payments]', err);
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
        const { payment_type, payment_date, partner_id, amount, currency = 'COP',
            payment_method_id, reference, notes } = req.body;
        const payment_number = await nextNumber('PAG', 'payments');

        const { rows } = await query(`
            INSERT INTO payments
              (payment_number, payment_type, payment_date, partner_id, amount, currency,
               payment_method_id, reference, notes, state, user_id)
            VALUES (?,?,?,?,?,?,?,?,?,'confirmado',?) RETURNING *
        `, [payment_number, payment_type, payment_date, partner_id, amount, currency,
            payment_method_id, reference || null, notes || null, req.user.id]);

        await logAudit(req.user.id, 'create', 'payment', rows[0].id, { payment_number, amount, payment_type });
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[POST /api/finance/payments]', err);
        res.status(500).json({ success: false, error: 'Error al registrar el pago' });
    }
});

// ==========================================================
// RUTA CAFICULTOR — mis facturas de compra recibidas
// ==========================================================

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
            ORDER BY pi.invoice_date DESC
            LIMIT ? OFFSET ?
        `, [req.user.id, lim, off]);

        // Fetch lines separately (SQLite doesn't support json_agg)
        if (invoices.length > 0) {
            const ids = invoices.map(i => i.id);
            const placeholders = ids.map(() => '?').join(',');
            const { rows: lines } = await query(`
                SELECT purchase_invoice_id, description, quantity, unit_price, subtotal, total, lot_reference
                FROM purchase_invoice_lines
                WHERE purchase_invoice_id IN (${placeholders})
                ORDER BY id
            `, ids);
            const byInvoice = {};
            for (const l of lines) {
                if (!byInvoice[l.purchase_invoice_id]) byInvoice[l.purchase_invoice_id] = [];
                byInvoice[l.purchase_invoice_id].push(l);
            }
            for (const inv of invoices) {
                inv.lines = byInvoice[inv.id] || [];
            }
        }

        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total FROM purchase_invoices WHERE caficultor_id = ?`,
            [req.user.id]
        );

        const { rows: summaryRows } = await query(`
            SELECT
                COALESCE(SUM(total_amount), 0)  AS total_facturado,
                COALESCE(SUM(amount_paid), 0)   AS total_pagado,
                COALESCE(SUM(amount_due), 0)    AS total_pendiente,
                SUM(CASE WHEN state IN ('confirmada','pagada_parcial') THEN 1 ELSE 0 END) AS facturas_pendientes
            FROM purchase_invoices
            WHERE caficultor_id = ?
        `, [req.user.id]);

        res.json({
            success: true,
            data: invoices,
            total: parseInt(countRows[0].total, 10),
            limit: lim,
            offset: off,
            summary: summaryRows[0],
        });
    } catch (err) {
        console.error('[GET /api/finance/my-invoices]', err);
        res.status(500).json({ success: false, error: 'Error al obtener tus facturas' });
    }
});
