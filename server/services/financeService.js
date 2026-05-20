/**
 * Servicio de finanzas: lógica de negocio para dashboard, transacciones y facturas.
 * Todas las funciones son puras (sin req/res) — lanzan errores en fallas de negocio.
 */
import { query, getClient } from '../db.js';

// ── Utilidades ───────────────────────────────────────────────────────────────

export async function nextNumber(prefix, table) {
  const { rows } = await query(`SELECT COUNT(*) AS cnt FROM ${table}`, []);
  const n = parseInt(rows[0].cnt, 10) + 1;
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [revenue, costs, pending, expenses, recentInvoices, recentExpenses] = await Promise.all([
    query(`SELECT COALESCE(SUM(total_amount), 0) AS total
           FROM sales_invoices
           WHERE state IN ('confirmada','pagada_parcial','pagada')
             AND strftime('%Y-%m', invoice_date) = ?`, [currentMonth]),
    query(`SELECT COALESCE(SUM(total_amount), 0) AS total
           FROM purchase_invoices
           WHERE state IN ('confirmada','pagada_parcial','pagada')
             AND strftime('%Y-%m', invoice_date) = ?`, [currentMonth]),
    query(`SELECT COALESCE(SUM(amount_due), 0) AS total, COUNT(*) AS count
           FROM purchase_invoices
           WHERE state IN ('confirmada','pagada_parcial')`, []),
    query(`SELECT COALESCE(SUM(amount), 0) AS total
           FROM expenses
           WHERE state IN ('aprobado','pagado')
             AND strftime('%Y-%m', expense_date) = ?`, [currentMonth]),
    query(`SELECT si.id, si.invoice_number, si.invoice_date, si.total_amount, si.state,
                  u.name AS customer_name
           FROM sales_invoices si
           JOIN users u ON u.id = si.customer_id
           ORDER BY si.created_at DESC LIMIT 5`, []),
    query(`SELECT id, expense_number, expense_date, description, amount, category, state
           FROM expenses ORDER BY created_at DESC LIMIT 5`, []),
  ]);

  const monthRevenue  = parseFloat(revenue.rows[0].total);
  const monthCosts    = parseFloat(costs.rows[0].total);
  const monthExpenses = parseFloat(expenses.rows[0].total);

  return {
    month_revenue: monthRevenue,
    month_costs: monthCosts,
    month_expenses: monthExpenses,
    month_balance: monthRevenue - monthCosts - monthExpenses,
    pending_payables: parseFloat(pending.rows[0].total),
    pending_invoices_count: parseInt(pending.rows[0].count, 10),
    recent_invoices: recentInvoices.rows,
    recent_expenses: recentExpenses.rows,
  };
}

// ── Libro de transacciones (UNION de todas las fuentes) ──────────────────────

const TRANSACTIONS_UNION = `
  SELECT 'factura_venta' AS tipo, si.id, si.invoice_number AS numero, si.invoice_date AS fecha,
         si.total_amount AS monto, 'ingreso' AS direccion, si.state AS estado,
         u.name AS contraparte, si.notes AS descripcion, si.created_at
  FROM sales_invoices si JOIN users u ON u.id = si.customer_id

  UNION ALL

  SELECT 'factura_compra', pi.id, pi.invoice_number, pi.invoice_date,
         pi.total_amount, 'egreso', pi.state,
         COALESCE(u.name, 'Proveedor externo'), pi.notes, pi.created_at
  FROM purchase_invoices pi LEFT JOIN users u ON u.id = pi.caficultor_id

  UNION ALL

  SELECT 'gasto', e.id, e.expense_number, e.expense_date,
         e.amount, 'egreso', e.state,
         e.category, e.description, e.created_at
  FROM expenses e

  UNION ALL

  SELECT 'pago', p.id, p.payment_number, p.payment_date,
         p.amount,
         CASE p.payment_type WHEN 'recibido' THEN 'ingreso' ELSE 'egreso' END,
         p.state, COALESCE(u.name, ''), COALESCE(p.notes, p.reference, ''), p.created_at
  FROM payments p LEFT JOIN users u ON u.id = p.partner_id
`;

export async function getTransactionBook({ date_from, date_to, tipo, estado, direccion, search, limit = 50, offset = 0 }) {
  const lim = Math.min(parseInt(limit, 10) || 50, 200);
  const off = parseInt(offset, 10) || 0;

  const conditions = [];
  const params = [];

  if (date_from) { conditions.push(`fecha >= ?`);   params.push(date_from); }
  if (date_to)   { conditions.push(`fecha <= ?`);   params.push(date_to); }
  if (tipo)      { conditions.push(`tipo = ?`);     params.push(tipo); }
  if (estado)    { conditions.push(`estado = ?`);   params.push(estado); }
  if (direccion) { conditions.push(`direccion = ?`); params.push(direccion); }
  if (search) {
    conditions.push(`(numero LIKE ? OR contraparte LIKE ? OR descripcion LIKE ?)`);
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ rows }, { rows: countRows }] = await Promise.all([
    query(`SELECT * FROM (${TRANSACTIONS_UNION}) ${where} ORDER BY fecha DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, lim, off]),
    query(`SELECT COUNT(*) AS total,
                  COALESCE(SUM(CASE WHEN direccion='ingreso' THEN monto ELSE 0 END),0) AS total_ingresos,
                  COALESCE(SUM(CASE WHEN direccion='egreso'  THEN monto ELSE 0 END),0) AS total_egresos
           FROM (${TRANSACTIONS_UNION}) ${where}`, params),
  ]);

  const totals = countRows[0];
  return {
    data: rows,
    total: parseInt(totals.total, 10),
    total_ingresos: parseFloat(totals.total_ingresos),
    total_egresos: parseFloat(totals.total_egresos),
    balance: parseFloat(totals.total_ingresos) - parseFloat(totals.total_egresos),
    limit: lim,
    offset: off,
  };
}

// ── Factura de compra (con transacción) ──────────────────────────────────────

export async function createPurchaseInvoice({ invoice_date, due_date, caficultor_id, supplier_invoice_number, notes, lines, payment_term_days = 0 }, userId) {
  let subtotal = 0, tax_amount = 0;
  for (const line of lines) {
    const lineSub = parseFloat(line.quantity) * parseFloat(line.unit_price);
    subtotal   += lineSub;
    tax_amount += lineSub * (parseFloat(line.tax_rate || 0) / 100);
  }
  const total_amount   = subtotal + tax_amount;
  const invoice_number = await nextNumber('FC', 'purchase_invoices');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: [invoice] } = await client.query(
      `INSERT INTO purchase_invoices
         (invoice_number, supplier_invoice_number, caficultor_id, invoice_date, due_date,
          payment_term_days, subtotal, tax_amount, total_amount, amount_due, notes, user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      [invoice_number, supplier_invoice_number || null, caficultor_id || null, invoice_date, due_date,
       payment_term_days, subtotal, tax_amount, total_amount, total_amount, notes || null, userId]
    );

    for (const line of lines) {
      const lineSub   = parseFloat(line.quantity) * parseFloat(line.unit_price);
      const lineTotal = lineSub * (1 + parseFloat(line.tax_rate || 0) / 100);
      await client.query(
        `INSERT INTO purchase_invoice_lines
           (purchase_invoice_id, description, quantity, unit_price, tax_rate, subtotal, total, lot_reference)
         VALUES (?,?,?,?,?,?,?,?)`,
        [invoice.id, line.description, line.quantity, line.unit_price,
         line.tax_rate || 0, lineSub, lineTotal, line.lot_reference || null]
      );
    }

    await client.query('COMMIT');
    return { ...invoice, lines };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Factura de venta (con transacción) ───────────────────────────────────────

export async function createSalesInvoice({ customer_id, invoice_date, due_date, notes, lines, shipping_cost = 0 }, userId) {
  let subtotal = 0, tax_amount = 0, discount_amount = 0;
  for (const line of lines) {
    const lineSub      = parseFloat(line.quantity) * parseFloat(line.unit_price);
    const lineDiscount = lineSub * (parseFloat(line.discount_percent || 0) / 100);
    const afterDiscount = lineSub - lineDiscount;
    subtotal       += afterDiscount;
    discount_amount += lineDiscount;
    tax_amount     += afterDiscount * (parseFloat(line.tax_rate || 0) / 100);
  }
  const total_amount   = subtotal + tax_amount + parseFloat(shipping_cost);
  const invoice_number = await nextNumber('FV', 'sales_invoices');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: [invoice] } = await client.query(
      `INSERT INTO sales_invoices
         (invoice_number, customer_id, invoice_date, due_date, subtotal, discount_amount,
          tax_amount, shipping_cost, total_amount, amount_due, notes, user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      [invoice_number, customer_id, invoice_date, due_date, subtotal, discount_amount,
       tax_amount, shipping_cost, total_amount, total_amount, notes || null, userId]
    );

    for (const line of lines) {
      const lineSub      = parseFloat(line.quantity) * parseFloat(line.unit_price);
      const lineDiscount = lineSub * (parseFloat(line.discount_percent || 0) / 100);
      const afterDiscount = lineSub - lineDiscount;
      const lineTax = afterDiscount * (parseFloat(line.tax_rate || 0) / 100);
      await client.query(
        `INSERT INTO sales_invoice_lines
           (sales_invoice_id, product_id, description, quantity, unit_price, discount_percent, tax_rate, subtotal, total)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [invoice.id, line.product_id || null, line.description, line.quantity, line.unit_price,
         line.discount_percent || 0, line.tax_rate || 0, afterDiscount, afterDiscount + lineTax]
      );
    }

    await client.query('COMMIT');
    return { ...invoice, lines };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
