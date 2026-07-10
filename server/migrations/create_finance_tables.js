// Migración: Tablas del módulo de finanzas (SQLite/libSQL)
// Fase 6: Módulo de finanzas de producción
// DDL alineado con db/schema.sql (fuente de verdad del modelo de datos).
import { query } from '../db.js';

export async function createFinanceTables() {
    // 1. Plan de cuentas
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      account_type TEXT NOT NULL CHECK (account_type IN ('activo','pasivo','patrimonio','ingreso','gasto','costo')),
      account_subtype TEXT CHECK (account_subtype IN (
        'efectivo','banco','cuentas_por_cobrar','inventario','activo_fijo',
        'cuentas_por_pagar','prestamo','capital',
        'venta_producto','venta_servicio','otro_ingreso',
        'gasto_operativo','gasto_administrativo','gasto_venta','costo_venta'
      )),
      parent_account_id BIGINT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      allow_reconciliation BOOLEAN DEFAULT FALSE,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (parent_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_accounts_code ON accounting_accounts(code)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_accounts_type ON accounting_accounts(account_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_accounts_parent ON accounting_accounts(parent_account_id)`);

    // 2. Diarios contables
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      journal_type TEXT NOT NULL CHECK (journal_type IN ('venta','compra','banco','caja','general','nomina')),
      default_account_id BIGINT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (default_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_journals_type ON accounting_journals(journal_type)`);

    // 3. Asientos contables
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_number VARCHAR(50) NOT NULL UNIQUE,
      journal_id BIGINT NOT NULL,
      entry_date DATE NOT NULL,
      reference VARCHAR(100),
      description TEXT,
      total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','publicado','cancelado')),
      user_id BIGINT,
      posted_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (journal_id) REFERENCES accounting_journals(id) ON DELETE RESTRICT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_journal ON accounting_entries(journal_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_date ON accounting_entries(entry_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_state ON accounting_entries(state)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entries_reference ON accounting_entries(reference)`);

    // 4. Líneas de asientos (partida doble)
    await query(`
    CREATE TABLE IF NOT EXISTS accounting_entry_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id BIGINT NOT NULL,
      account_id BIGINT NOT NULL,
      description VARCHAR(255),
      debit DECIMAL(15,2) NOT NULL DEFAULT 0,
      credit DECIMAL(15,2) NOT NULL DEFAULT 0,
      partner_id BIGINT NULL,
      reconciled BOOLEAN DEFAULT FALSE,
      reconcile_ref VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES accounting_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entry_lines_entry ON accounting_entry_lines(entry_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entry_lines_account ON accounting_entry_lines(account_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entry_lines_partner ON accounting_entry_lines(partner_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acc_entry_lines_reconciled ON accounting_entry_lines(reconciled)`);

    // 5. Métodos de pago
    await query(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      method_type TEXT NOT NULL CHECK (method_type IN ('efectivo','transferencia','cheque','tarjeta_credito','tarjeta_debito','pse','otro')),
      is_active BOOLEAN DEFAULT TRUE,
      requires_reference BOOLEAN DEFAULT FALSE,
      accounting_account_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
    )
  `);

    // 6. Centros de costo
    await query(`
    CREATE TABLE IF NOT EXISTS cost_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      description TEXT,
      parent_cost_center_id BIGINT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_cost_centers_parent ON cost_centers(parent_cost_center_id)`);

    // 7. Facturas de compra (pagos a caficultores y proveedores)
    await query(`
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      supplier_invoice_number VARCHAR(100),
      purchase_order_id BIGINT NULL,
      supplier_id BIGINT NULL,
      caficultor_id BIGINT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      state TEXT NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','confirmada','pagada_parcial','pagada','cancelada')),
      payment_term_days INT DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      accounting_entry_id BIGINT NULL,
      user_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
      FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (caficultor_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_caficultor ON purchase_invoices(caficultor_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_state ON purchase_invoices(state)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(invoice_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_due_date ON purchase_invoices(due_date)`);

    // 8. Líneas de facturas de compra
    await query(`
    CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_invoice_id BIGINT NOT NULL,
      product_id VARCHAR(50) NULL,
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      tax_rate DECIMAL(5,2) DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL,
      total DECIMAL(15,2) NOT NULL,
      accounting_account_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_invoice ON purchase_invoice_lines(purchase_invoice_id)`);

    // 9. Facturas de venta
    await query(`
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      customer_id BIGINT NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      state TEXT NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','confirmada','pagada_parcial','pagada','cancelada')),
      payment_term_days INT DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(15,2) DEFAULT 0,
      tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      shipping_cost DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
      ml_order_id BIGINT NULL,
      notes TEXT,
      accounting_entry_id BIGINT NULL,
      user_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (ml_order_id) REFERENCES sales_tracking(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_state ON sales_invoices(state)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_due_date ON sales_invoices(due_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_ml_order ON sales_invoices(ml_order_id)`);

    // 10. Líneas de facturas de venta
    await query(`
    CREATE TABLE IF NOT EXISTS sales_invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_invoice_id BIGINT NOT NULL,
      product_id VARCHAR(50) NULL,
      description VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit_price DECIMAL(15,2) NOT NULL,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      tax_rate DECIMAL(5,2) DEFAULT 0,
      subtotal DECIMAL(15,2) NOT NULL,
      total DECIMAL(15,2) NOT NULL,
      accounting_account_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_invoice ON sales_invoice_lines(sales_invoice_id)`);

    // 11. Pagos (recibidos y realizados)
    await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number VARCHAR(50) NOT NULL UNIQUE,
      payment_type TEXT NOT NULL CHECK (payment_type IN ('recibido','realizado')),
      payment_date DATE NOT NULL,
      partner_id BIGINT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'COP',
      payment_method_id BIGINT NOT NULL,
      bank_account_id BIGINT NULL,
      reference VARCHAR(100),
      notes TEXT,
      state TEXT NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','confirmado','conciliado','cancelado')),
      accounting_entry_id BIGINT NULL,
      user_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payments_partner ON payments(partner_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payments_state ON payments(state)`);

    // 12. Asignación de pagos a facturas
    await query(`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id BIGINT NOT NULL,
      invoice_id BIGINT NOT NULL,
      invoice_type TEXT NOT NULL CHECK (invoice_type IN ('venta','compra')),
      amount_allocated DECIMAL(15,2) NOT NULL,
      allocation_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id, invoice_type)`);

    // 13. Gastos
    await query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_number VARCHAR(50) NOT NULL UNIQUE,
      expense_date DATE NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('operativo','administrativo','venta','financiero','otro')),
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'COP',
      supplier_id BIGINT NULL,
      payment_method_id BIGINT NULL,
      cost_center_id BIGINT NULL,
      accounting_account_id BIGINT NULL,
      receipt_number VARCHAR(100),
      is_reimbursable BOOLEAN DEFAULT FALSE,
      employee_id BIGINT NULL,
      state TEXT NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','aprobado','pagado','rechazado')),
      approved_by BIGINT NULL,
      approved_at TIMESTAMP NULL,
      notes TEXT,
      accounting_entry_id BIGINT NULL,
      user_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_supplier ON expenses(supplier_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_state ON expenses(state)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_cost_center ON expenses(cost_center_id)`);

    // 14. Presupuestos
    await query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(160) NOT NULL,
      budget_year INT NOT NULL,
      budget_period TEXT NOT NULL CHECK (budget_period IN ('anual','semestral','trimestral','mensual')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      state TEXT NOT NULL DEFAULT 'borrador' CHECK (state IN ('borrador','aprobado','cerrado')),
      total_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      user_id BIGINT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_budgets_year ON budgets(budget_year)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_budgets_state ON budgets(state)`);

    // 15. Líneas de presupuesto
    await query(`
    CREATE TABLE IF NOT EXISTS budget_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id BIGINT NOT NULL,
      account_id BIGINT NOT NULL,
      cost_center_id BIGINT NULL,
      budgeted_amount DECIMAL(15,2) NOT NULL,
      actual_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      variance DECIMAL(15,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
    )
  `);
    await query(`CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_budget_lines_account ON budget_lines(account_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_budget_lines_cost_center ON budget_lines(cost_center_id)`);

    console.log('[Finance Migration] Todas las tablas financieras creadas correctamente.');
}

// Ejecutar directamente si se invoca como script
if (process.argv[1] === new URL(import.meta.url).pathname) {
    createFinanceTables()
        .then(() => { console.log('Migración financiera completada.'); process.exit(0); })
        .catch(err => { console.error('Error en migración:', err); process.exit(1); });
}
