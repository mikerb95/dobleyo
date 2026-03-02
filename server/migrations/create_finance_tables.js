// Migración: Tablas del módulo de finanzas (PostgreSQL)
// Fase 6: Módulo de finanzas de producción
import { query } from '../db.js';

export async function createFinanceTables() {
    // 1. Plan de cuentas
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_accounts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('activo','pasivo','patrimonio','ingreso','gasto','costo')),
      account_subtype VARCHAR(30) CHECK (account_subtype IN (
        'efectivo','banco','cuentas_por_cobrar','inventario','activo_fijo',
        'cuentas_por_pagar','prestamo','capital',
        'venta_producto','venta_servicio','otro_ingreso',
        'gasto_operativo','gasto_administrativo','gasto_venta','costo_venta'
      )),
      parent_account_id BIGINT REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT TRUE,
      allow_reconciliation BOOLEAN DEFAULT FALSE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_accounts_code ON accounting_accounts(code)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_accounts_type ON accounting_accounts(account_type)`, []);

    // 2. Diarios contables
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_journals (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      journal_type VARCHAR(10) NOT NULL CHECK (journal_type IN ('venta','compra','banco','caja','general','nomina')),
      default_account_id BIGINT REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);

    // 3. Asientos contables
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_entries (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      entry_number VARCHAR(50) NOT NULL UNIQUE,
      journal_id BIGINT NOT NULL REFERENCES accounting_journals(id) ON DELETE RESTRICT,
      entry_date DATE NOT NULL,
      reference VARCHAR(100),
      description TEXT,
      total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
      state VARCHAR(12) NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','publicado','cancelado')),
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      posted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_journal ON accounting_entries(journal_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_date ON accounting_entries(entry_date)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_state ON accounting_entries(state)`, []);

    // 4. Líneas de asientos (partida doble)
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_entry_lines (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      entry_id BIGINT NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
      account_id BIGINT NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
      description VARCHAR(255),
      debit DECIMAL(15,2) NOT NULL DEFAULT 0,
      credit DECIMAL(15,2) NOT NULL DEFAULT 0,
      partner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      reconciled BOOLEAN DEFAULT FALSE,
      reconcile_ref VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entry_lines_entry ON accounting_entry_lines(entry_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entry_lines_account ON accounting_entry_lines(account_id)`, []);

    // 5. Métodos de pago
    await query(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('efectivo','transferencia','cheque','tarjeta_credito','tarjeta_debito','pse','otro')),
      is_active BOOLEAN DEFAULT TRUE,
      requires_reference BOOLEAN DEFAULT FALSE,
      accounting_account_id BIGINT REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);

    // 6. Centros de costo
    await query(`
    CREATE TABLE IF NOT EXISTS cost_centers (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      description TEXT,
      parent_cost_center_id BIGINT REFERENCES cost_centers(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);

    // 7. Facturas de compra (pagos a caficultores y proveedores)
    await query(`
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      supplier_invoice_number VARCHAR(100),
      caficultor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      state VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','confirmada','pagada_parcial','pagada','cancelada')),
      payment_term_days INT DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      accounting_entry_id BIGINT REFERENCES accounting_entries(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pi_caficultor ON purchase_invoices(caficultor_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pi_state ON purchase_invoices(state)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pi_date ON purchase_invoices(invoice_date)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pi_due ON purchase_invoices(due_date)`, []);

    // 8. Líneas de facturas de compra
    await query(`
    CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      purchase_invoice_id BIGINT NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      tax_rate DECIMAL(5,2) DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL,
      total DECIMAL(15,2) NOT NULL,
      lot_reference VARCHAR(50),
      accounting_account_id BIGINT REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pil_invoice ON purchase_invoice_lines(purchase_invoice_id)`, []);

    // 9. Facturas de venta
    await query(`
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      state VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','confirmada','pagada_parcial','pagada','cancelada')),
      payment_term_days INT DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(15,2) DEFAULT 0,
      tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      shipping_cost DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      accounting_entry_id BIGINT REFERENCES accounting_entries(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_si_customer ON sales_invoices(customer_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_si_state ON sales_invoices(state)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_si_date ON sales_invoices(invoice_date)`, []);

    // 10. Líneas de facturas de venta
    await query(`
    CREATE TABLE IF NOT EXISTS sales_invoice_lines (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      sales_invoice_id BIGINT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
      product_id VARCHAR(50),
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      tax_rate DECIMAL(5,2) DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL,
      total DECIMAL(15,2) NOT NULL,
      accounting_account_id BIGINT REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_sil_invoice ON sales_invoice_lines(sales_invoice_id)`, []);

    // 11. Pagos (recibidos y realizados)
    await query(`
    CREATE TABLE IF NOT EXISTS fin_payments (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      payment_number VARCHAR(50) NOT NULL UNIQUE,
      payment_type VARCHAR(10) NOT NULL CHECK (payment_type IN ('recibido','realizado')),
      payment_date DATE NOT NULL,
      partner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'COP',
      payment_method_id BIGINT REFERENCES payment_methods(id) ON DELETE RESTRICT,
      reference VARCHAR(100),
      notes TEXT,
      state VARCHAR(15) NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','confirmado','conciliado','cancelado')),
      accounting_entry_id BIGINT REFERENCES accounting_entries(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_fp_type ON fin_payments(payment_type)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_fp_partner ON fin_payments(partner_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_fp_date ON fin_payments(payment_date)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_fp_state ON fin_payments(state)`, []);

    // 12. Asignación de pagos a facturas
    await query(`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      payment_id BIGINT NOT NULL REFERENCES fin_payments(id) ON DELETE CASCADE,
      invoice_id BIGINT NOT NULL,
      invoice_type VARCHAR(7) NOT NULL CHECK (invoice_type IN ('venta','compra')),
      amount_allocated DECIMAL(15,2) NOT NULL,
      allocation_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pa_payment ON payment_allocations(payment_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_pa_invoice ON payment_allocations(invoice_id, invoice_type)`, []);

    // 13. Gastos
    await query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      expense_number VARCHAR(50) NOT NULL UNIQUE,
      expense_date DATE NOT NULL,
      category VARCHAR(15) NOT NULL CHECK (category IN ('operativo','administrativo','venta','financiero','otro')),
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'COP',
      payment_method_id BIGINT REFERENCES payment_methods(id) ON DELETE SET NULL,
      cost_center_id BIGINT REFERENCES cost_centers(id) ON DELETE SET NULL,
      accounting_account_id BIGINT REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      receipt_number VARCHAR(100),
      is_reimbursable BOOLEAN DEFAULT FALSE,
      state VARCHAR(15) NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','aprobado','pagado','rechazado')),
      approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      notes TEXT,
      accounting_entry_id BIGINT REFERENCES accounting_entries(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_state ON expenses(state)`, []);

    // 14. Presupuestos
    await query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      budget_year INT NOT NULL,
      budget_period VARCHAR(15) NOT NULL CHECK (budget_period IN ('anual','semestral','trimestral','mensual')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      state VARCHAR(10) NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','aprobado','cerrado')),
      total_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);

    // 15. Líneas de presupuesto
    await query(`
    CREATE TABLE IF NOT EXISTS budget_lines (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      budget_id BIGINT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      account_id BIGINT NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
      cost_center_id BIGINT REFERENCES cost_centers(id) ON DELETE SET NULL,
      budgeted_amount DECIMAL(15,2) NOT NULL,
      actual_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      variance DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `, []);

    console.log('[Finance Migration] Todas las tablas financieras creadas correctamente.');
}

// Ejecutar directamente si se invoca como script
if (process.argv[1] === new URL(import.meta.url).pathname) {
    createFinanceTables()
        .then(() => { console.log('Migración financiera completada.'); process.exit(0); })
        .catch(err => { console.error('Error en migración:', err); process.exit(1); });
}
