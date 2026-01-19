-- DobleYo relational schema (MySQL Compatible)

-- Users
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(80),
    last_name VARCHAR(80),
    name VARCHAR(120),
    mobile_phone VARCHAR(20),
    landline_phone VARCHAR(20),
    tax_id VARCHAR(50), -- Cédula o NIT
    city VARCHAR(120),
    state_province VARCHAR(120), -- Departamento
    country VARCHAR(120) DEFAULT 'Colombia',
    address TEXT,
    role ENUM('admin', 'client', 'provider', 'caficultor') NOT NULL DEFAULT 'client',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    caficultor_status ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_caficultor_status ON users(caficultor_status);

-- Caficultor Applications
CREATE TABLE IF NOT EXISTS caficultor_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    farm_name VARCHAR(160) NOT NULL,
    region VARCHAR(80) NOT NULL,
    altitude INT,
    hectares DECIMAL(10,2),
    varieties_cultivated TEXT,
    certifications TEXT,
    description TEXT,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_caficultor_apps_user ON caficultor_applications(user_id);
CREATE INDEX idx_caficultor_apps_status ON caficultor_applications(status);

-- Providers Profile
CREATE TABLE IF NOT EXISTS providers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    company_name VARCHAR(160) NOT NULL,
    tax_id VARCHAR(50),
    phone VARCHAR(40),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    replaced_by_token VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    sku VARCHAR(100) UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    category ENUM('cafe', 'accesorio', 'merchandising') NOT NULL DEFAULT 'cafe',
    subcategory VARCHAR(80), -- Para cafés: origen. Para accesorios: tipo (prensa, chemex, filtros, etc)
    origin VARCHAR(120), -- Para cafés
    process VARCHAR(80), -- Para cafés: lavado, honey, natural
    roast VARCHAR(80), -- Para cafés: claro, medio, oscuro
    price INTEGER NOT NULL,
    cost INTEGER, -- Costo de adquisición/producción
    rating DECIMAL(3,1) DEFAULT 0,
    is_deal BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    is_fast BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE, -- Producto visible en tienda
    image_url TEXT,
    images JSON, -- Array de URLs de imágenes adicionales
    stock_quantity INTEGER NOT NULL DEFAULT 0, -- Stock actual disponible
    stock_reserved INTEGER NOT NULL DEFAULT 0, -- Stock reservado en pedidos
    stock_min INTEGER DEFAULT 0, -- Stock mínimo antes de alertar
    weight DECIMAL(10,2), -- Peso del producto
    weight_unit ENUM('g', 'kg', 'ml', 'l', 'unidad') DEFAULT 'g',
    dimensions VARCHAR(100), -- Dimensiones para accesorios
    meta_keywords TEXT, -- SEO
    meta_description TEXT, -- SEO
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_sku ON products(sku);

-- Inventory Movements (Trazabilidad de movimientos de stock)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(50) NOT NULL,
    movement_type ENUM('entrada', 'salida', 'ajuste', 'merma', 'devolucion') NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason VARCHAR(255),
    reference VARCHAR(100), -- Número de orden, lote, factura, etc
    notes TEXT,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_inv_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inv_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inv_movements_date ON inventory_movements(created_at);

-- Product Suppliers (Proveedores de productos)
CREATE TABLE IF NOT EXISTS product_suppliers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    contact_name VARCHAR(120),
    email VARCHAR(255),
    phone VARCHAR(40),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms VARCHAR(255), -- Términos de pago
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);

-- Product-Supplier relationship
CREATE TABLE IF NOT EXISTS product_supplier_prices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(50) NOT NULL,
    supplier_id BIGINT NOT NULL,
    cost_price INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'COP',
    minimum_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER, -- Días de entrega
    last_order_date DATE,
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE CASCADE
);
CREATE INDEX idx_prod_supplier_product ON product_supplier_prices(product_id);
CREATE INDEX idx_prod_supplier_supplier ON product_supplier_prices(supplier_id);

-- Lots
CREATE TABLE IF NOT EXISTS lots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(160),
    origin VARCHAR(160),
    farm VARCHAR(160),
    producer VARCHAR(160),
    altitude VARCHAR(60),
    variety VARCHAR(120),
    shade_system VARCHAR(120),
    climate VARCHAR(120),
    process VARCHAR(80),
    roast VARCHAR(80),
    harvest_date DATE,
    roast_date DATE,
    moisture VARCHAR(20),
    score DECIMAL(4,1),
    notes TEXT,
    product_id VARCHAR(50) NULL,
    estado ENUM('verde', 'tostado') NOT NULL DEFAULT 'verde',
    fecha_tostado DATE NULL,
    parent_lot_id BIGINT NULL,
    weight DECIMAL(10,2),
    weight_unit ENUM('g', 'kg') NOT NULL DEFAULT 'kg',
    aroma VARCHAR(255),
    flavor_notes VARCHAR(255),
    acidity VARCHAR(80),
    body VARCHAR(80),
    balance VARCHAR(80),
    presentation VARCHAR(120),
    grind VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (parent_lot_id) REFERENCES lots(id) ON DELETE SET NULL
);
CREATE INDEX idx_lots_code ON lots(code);
CREATE INDEX idx_lots_product ON lots(product_id);
CREATE INDEX idx_lots_estado ON lots(estado);
CREATE INDEX idx_lots_parent ON lots(parent_lot_id);

-- Sales Tracking (MercadoLibre)
CREATE TABLE IF NOT EXISTS sales_tracking (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ml_order_id BIGINT NOT NULL UNIQUE,
    purchase_date DATETIME NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    order_status VARCHAR(80),
    shipping_method VARCHAR(120),
    recipient_city VARCHAR(160),
    recipient_state VARCHAR(160),
    recipient_country VARCHAR(120),
    recipient_zip_code VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(10,8),
    products JSON NOT NULL,
    sync_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sales_ml_order_id ON sales_tracking(ml_order_id);
CREATE INDEX idx_sales_purchase_date ON sales_tracking(purchase_date);
CREATE INDEX idx_sales_city ON sales_tracking(recipient_city);
CREATE INDEX idx_sales_state ON sales_tracking(recipient_state);
-- Product Labels (Etiquetas para productos)
CREATE TABLE IF NOT EXISTS product_labels (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    lot_id BIGINT,
    label_code VARCHAR(100) NOT NULL UNIQUE,
    sequence INT,
    qr_data JSON,
    printed BOOLEAN DEFAULT FALSE,
    printed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
);
CREATE INDEX idx_product_labels_lot ON product_labels(lot_id);
CREATE INDEX idx_product_labels_code ON product_labels(label_code);
CREATE INDEX idx_product_labels_printed ON product_labels(printed);

-- Generated Labels (Etiquetas generadas - desde lotes o de cero)
CREATE TABLE IF NOT EXISTS generated_labels (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    label_code VARCHAR(100) NOT NULL UNIQUE,
    lot_code VARCHAR(100),
    origin VARCHAR(160),
    variety VARCHAR(120),
    roast VARCHAR(80),
    process VARCHAR(80),
    altitude VARCHAR(60),
    farm VARCHAR(160),
    acidity INT,
    body INT,
    balance INT,
    score DECIMAL(4,1),
    flavor_notes TEXT,
    qr_data JSON,
    user_id BIGINT,
    printed BOOLEAN DEFAULT FALSE,
    printed_at TIMESTAMP NULL,
    sequence INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_generated_labels_code ON generated_labels(label_code);
CREATE INDEX idx_generated_labels_lot_code ON generated_labels(lot_code);
CREATE INDEX idx_generated_labels_user ON generated_labels(user_id);
CREATE INDEX idx_generated_labels_printed ON generated_labels(printed);
CREATE INDEX idx_generated_labels_created ON generated_labels(created_at);

-- ==========================================
-- MÓDULO FINANCIERO / ACCOUNTING
-- ==========================================

-- Plan de Cuentas Contables (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounting_accounts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    account_type ENUM('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo') NOT NULL,
    account_subtype ENUM(
        'efectivo', 'banco', 'cuentas_por_cobrar', 'inventario', 'activo_fijo',
        'cuentas_por_pagar', 'prestamo', 'capital', 
        'venta_producto', 'venta_servicio', 'otro_ingreso',
        'gasto_operativo', 'gasto_administrativo', 'gasto_venta', 'costo_venta'
    ),
    parent_account_id BIGINT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    allow_reconciliation BOOLEAN DEFAULT FALSE, -- Para conciliación bancaria
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_acc_accounts_code ON accounting_accounts(code);
CREATE INDEX idx_acc_accounts_type ON accounting_accounts(account_type);
CREATE INDEX idx_acc_accounts_parent ON accounting_accounts(parent_account_id);

-- Diarios Contables (Journals)
CREATE TABLE IF NOT EXISTS accounting_journals (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    journal_type ENUM('venta', 'compra', 'banco', 'caja', 'general', 'nomina') NOT NULL,
    default_account_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (default_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_acc_journals_type ON accounting_journals(journal_type);

-- Asientos Contables (Journal Entries)
CREATE TABLE IF NOT EXISTS accounting_entries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    journal_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    reference VARCHAR(100), -- Número de factura, orden, etc.
    description TEXT,
    total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    state ENUM('borrador', 'publicado', 'cancelado') NOT NULL DEFAULT 'borrador',
    user_id BIGINT,
    posted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES accounting_journals(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_acc_entries_journal ON accounting_entries(journal_id);
CREATE INDEX idx_acc_entries_date ON accounting_entries(entry_date);
CREATE INDEX idx_acc_entries_state ON accounting_entries(state);
CREATE INDEX idx_acc_entries_reference ON accounting_entries(reference);

-- Líneas de Asientos Contables (Journal Entry Lines - Partida Doble)
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entry_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    description VARCHAR(255),
    debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    partner_id BIGINT NULL, -- Usuario relacionado (cliente/proveedor/caficultor)
    reconciled BOOLEAN DEFAULT FALSE, -- Para conciliación
    reconcile_ref VARCHAR(50), -- Referencia de conciliación
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES accounting_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_acc_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX idx_acc_entry_lines_account ON accounting_entry_lines(account_id);
CREATE INDEX idx_acc_entry_lines_partner ON accounting_entry_lines(partner_id);
CREATE INDEX idx_acc_entry_lines_reconciled ON accounting_entry_lines(reconciled);

-- Cuentas Bancarias
CREATE TABLE IF NOT EXISTS bank_accounts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bank_name VARCHAR(160) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_type ENUM('ahorros', 'corriente', 'empresarial') NOT NULL,
    currency VARCHAR(3) DEFAULT 'COP',
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    accounting_account_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);

-- Movimientos Bancarios
CREATE TABLE IF NOT EXISTS bank_movements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bank_account_id BIGINT NOT NULL,
    movement_date DATE NOT NULL,
    movement_type ENUM('deposito', 'retiro', 'transferencia_entrada', 'transferencia_salida', 'comision', 'interes') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    reference VARCHAR(100),
    description TEXT,
    reconciled BOOLEAN DEFAULT FALSE,
    accounting_entry_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL
);
CREATE INDEX idx_bank_movements_account ON bank_movements(bank_account_id);
CREATE INDEX idx_bank_movements_date ON bank_movements(movement_date);
CREATE INDEX idx_bank_movements_reconciled ON bank_movements(reconciled);

-- Métodos de Pago
CREATE TABLE IF NOT EXISTS payment_methods (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    method_type ENUM('efectivo', 'transferencia', 'cheque', 'tarjeta_credito', 'tarjeta_debito', 'pse', 'otro') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    requires_reference BOOLEAN DEFAULT FALSE,
    accounting_account_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);

-- Órdenes de Compra (Purchase Orders)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id BIGINT NULL, -- Puede ser product_supplier o caficultor (user)
    caficultor_id BIGINT NULL, -- Si es compra a caficultor
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    state ENUM('borrador', 'confirmada', 'recibida', 'facturada', 'cancelada') NOT NULL DEFAULT 'borrador',
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    user_id BIGINT, -- Quien creó la orden
    confirmed_at TIMESTAMP NULL,
    received_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (caficultor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_caficultor ON purchase_orders(caficultor_id);
CREATE INDEX idx_purchase_orders_state ON purchase_orders(state);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);

-- Líneas de Órdenes de Compra
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    purchase_order_id BIGINT NOT NULL,
    product_id VARCHAR(50) NULL, -- Si es producto existente
    description VARCHAR(255) NOT NULL, -- Descripción del ítem
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0, -- Porcentaje de IVA
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    quantity_received DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
CREATE INDEX idx_purchase_order_lines_order ON purchase_order_lines(purchase_order_id);

-- Facturas de Compra (Vendor Bills)
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_invoice_number VARCHAR(100), -- Número de factura del proveedor
    purchase_order_id BIGINT NULL, -- Relacionada con orden de compra
    supplier_id BIGINT NULL,
    caficultor_id BIGINT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    state ENUM('borrador', 'confirmada', 'pagada_parcial', 'pagada', 'cancelada') NOT NULL DEFAULT 'borrador',
    payment_term_days INT DEFAULT 0, -- Días de crédito
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    accounting_entry_id BIGINT NULL,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (caficultor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX idx_purchase_invoices_caficultor ON purchase_invoices(caficultor_id);
CREATE INDEX idx_purchase_invoices_state ON purchase_invoices(state);
CREATE INDEX idx_purchase_invoices_date ON purchase_invoices(invoice_date);
CREATE INDEX idx_purchase_invoices_due_date ON purchase_invoices(due_date);

-- Líneas de Facturas de Compra
CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    purchase_invoice_id BIGINT NOT NULL,
    product_id VARCHAR(50) NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    accounting_account_id BIGINT NULL, -- Cuenta contable del gasto/costo
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_purchase_invoice_lines_invoice ON purchase_invoice_lines(purchase_invoice_id);

-- Facturas de Venta (Customer Invoices)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    state ENUM('borrador', 'confirmada', 'pagada_parcial', 'pagada', 'cancelada') NOT NULL DEFAULT 'borrador',
    payment_term_days INT DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
    ml_order_id BIGINT NULL, -- Relacionada con venta de MercadoLibre
    notes TEXT,
    accounting_entry_id BIGINT NULL,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (ml_order_id) REFERENCES sales_tracking(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_state ON sales_invoices(state);
CREATE INDEX idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX idx_sales_invoices_due_date ON sales_invoices(due_date);
CREATE INDEX idx_sales_invoices_ml_order ON sales_invoices(ml_order_id);

-- Líneas de Facturas de Venta
CREATE TABLE IF NOT EXISTS sales_invoice_lines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sales_invoice_id BIGINT NOT NULL,
    product_id VARCHAR(50) NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    accounting_account_id BIGINT NULL, -- Cuenta de ingreso
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_sales_invoice_lines_invoice ON sales_invoice_lines(sales_invoice_id);

-- Pagos (Payments - tanto recibidos como realizados)
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    payment_type ENUM('recibido', 'realizado') NOT NULL, -- Recibido = cobro, Realizado = pago
    payment_date DATE NOT NULL,
    partner_id BIGINT NOT NULL, -- Cliente o Proveedor/Caficultor
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'COP',
    payment_method_id BIGINT NOT NULL,
    bank_account_id BIGINT NULL, -- Si aplica
    reference VARCHAR(100), -- Número de cheque, referencia de transferencia, etc.
    notes TEXT,
    state ENUM('borrador', 'confirmado', 'conciliado', 'cancelado') NOT NULL DEFAULT 'borrador',
    accounting_entry_id BIGINT NULL,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_partner ON payments(partner_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_state ON payments(state);

-- Asignación de Pagos a Facturas (Payment Allocations)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    payment_id BIGINT NOT NULL,
    invoice_id BIGINT NOT NULL, -- Puede ser sales_invoice o purchase_invoice
    invoice_type ENUM('venta', 'compra') NOT NULL,
    amount_allocated DECIMAL(15,2) NOT NULL,
    allocation_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);
CREATE INDEX idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_invoice ON payment_allocations(invoice_id, invoice_type);

-- Centro de Costos
CREATE TABLE IF NOT EXISTS cost_centers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    parent_cost_center_id BIGINT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
);
CREATE INDEX idx_cost_centers_parent ON cost_centers(parent_cost_center_id);

-- Presupuestos
CREATE TABLE IF NOT EXISTS budgets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    budget_year INT NOT NULL,
    budget_period ENUM('anual', 'semestral', 'trimestral', 'mensual') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    state ENUM('borrador', 'aprobado', 'cerrado') NOT NULL DEFAULT 'borrador',
    total_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_budgets_year ON budgets(budget_year);
CREATE INDEX idx_budgets_state ON budgets(state);

-- Líneas de Presupuesto
CREATE TABLE IF NOT EXISTS budget_lines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    budget_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    cost_center_id BIGINT NULL,
    budgeted_amount DECIMAL(15,2) NOT NULL,
    actual_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    variance DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
);
CREATE INDEX idx_budget_lines_budget ON budget_lines(budget_id);
CREATE INDEX idx_budget_lines_account ON budget_lines(account_id);
CREATE INDEX idx_budget_lines_cost_center ON budget_lines(cost_center_id);

-- Notas Crédito/Débito
CREATE TABLE IF NOT EXISTS credit_debit_notes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    note_number VARCHAR(50) NOT NULL UNIQUE,
    note_type ENUM('credito', 'debito') NOT NULL,
    document_type ENUM('venta', 'compra') NOT NULL, -- A qué tipo de documento afecta
    invoice_id BIGINT NOT NULL, -- Factura relacionada
    partner_id BIGINT NOT NULL,
    note_date DATE NOT NULL,
    reason ENUM('devolucion', 'descuento', 'error_facturacion', 'ajuste', 'otro') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    state ENUM('borrador', 'confirmada', 'aplicada', 'cancelada') NOT NULL DEFAULT 'borrador',
    description TEXT,
    accounting_entry_id BIGINT NULL,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_credit_debit_notes_type ON credit_debit_notes(note_type);
CREATE INDEX idx_credit_debit_notes_document_type ON credit_debit_notes(document_type);
CREATE INDEX idx_credit_debit_notes_invoice ON credit_debit_notes(invoice_id);
CREATE INDEX idx_credit_debit_notes_partner ON credit_debit_notes(partner_id);
CREATE INDEX idx_credit_debit_notes_state ON credit_debit_notes(state);

-- Gastos / Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    expense_number VARCHAR(50) NOT NULL UNIQUE,
    expense_date DATE NOT NULL,
    category ENUM('operativo', 'administrativo', 'venta', 'financiero', 'otro') NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'COP',
    supplier_id BIGINT NULL,
    payment_method_id BIGINT NULL,
    cost_center_id BIGINT NULL,
    accounting_account_id BIGINT NULL,
    receipt_number VARCHAR(100), -- Número de recibo o factura
    is_reimbursable BOOLEAN DEFAULT FALSE, -- Si es reembolsable a empleado
    employee_id BIGINT NULL, -- Si aplica
    state ENUM('borrador', 'aprobado', 'pagado', 'rechazado') NOT NULL DEFAULT 'borrador',
    approved_by BIGINT NULL,
    approved_at TIMESTAMP NULL,
    notes TEXT,
    accounting_entry_id BIGINT NULL,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES product_suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
    FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (accounting_entry_id) REFERENCES accounting_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_supplier ON expenses(supplier_id);
CREATE INDEX idx_expenses_state ON expenses(state);
CREATE INDEX idx_expenses_cost_center ON expenses(cost_center_id);

-- Configuración de Impuestos
CREATE TABLE IF NOT EXISTS tax_rates (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    rate_percent DECIMAL(5,2) NOT NULL,
    tax_type ENUM('iva', 'retencion_iva', 'retencion_renta', 'ica', 'otro') NOT NULL,
    accounting_account_id BIGINT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (accounting_account_id) REFERENCES accounting_accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_tax_rates_type ON tax_rates(tax_type);

-- ==========================================
-- MÓDULO DE MANUFACTURA/PRODUCCIÓN
-- ==========================================

-- Estaciones de Trabajo / Equipos (Work Centers)
CREATE TABLE IF NOT EXISTS work_centers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    work_center_type ENUM('tostado', 'molido', 'empaque', 'control_calidad', 'almacen', 'otro') NOT NULL,
    capacity_per_hour DECIMAL(10,2), -- Capacidad en kg/hora o unidades/hora
    capacity_unit ENUM('kg', 'unidades', 'lotes') DEFAULT 'kg',
    cost_per_hour DECIMAL(10,2), -- Costo operativo por hora
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_work_centers_type ON work_centers(work_center_type);
CREATE INDEX idx_work_centers_active ON work_centers(is_active);

-- Equipos de Tostado (Roasting Equipment)
CREATE TABLE IF NOT EXISTS roasting_equipment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    work_center_id BIGINT NOT NULL,
    equipment_code VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(160) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    batch_capacity_kg DECIMAL(10,2) NOT NULL, -- Capacidad por batch en kg
    min_batch_kg DECIMAL(10,2), -- Carga mínima
    max_batch_kg DECIMAL(10,2), -- Carga máxima
    fuel_type ENUM('gas', 'electrico', 'lena', 'hibrido') NOT NULL,
    roast_time_minutes INT, -- Tiempo promedio de tostado
    cooling_time_minutes INT, -- Tiempo de enfriamiento
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    is_operational BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_center_id) REFERENCES work_centers(id) ON DELETE RESTRICT
);
CREATE INDEX idx_roasting_equipment_work_center ON roasting_equipment(work_center_id);
CREATE INDEX idx_roasting_equipment_operational ON roasting_equipment(is_operational);

-- Lista de Materiales (Bill of Materials - BOM)
CREATE TABLE IF NOT EXISTS bill_of_materials (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bom_code VARCHAR(50) NOT NULL UNIQUE,
    product_id VARCHAR(50) NOT NULL, -- Producto final (café tostado)
    product_qty DECIMAL(10,2) NOT NULL DEFAULT 1, -- Cantidad producida
    product_unit ENUM('kg', 'g', 'unidad') NOT NULL DEFAULT 'kg',
    bom_type ENUM('tostado', 'molido', 'empaque', 'combinado') NOT NULL DEFAULT 'tostado',
    work_center_id BIGINT NULL, -- Estación donde se produce
    estimated_time_minutes INT, -- Tiempo estimado de producción
    loss_percentage DECIMAL(5,2) DEFAULT 15.00, -- % de merma esperado (15% típico en tostado)
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (work_center_id) REFERENCES work_centers(id) ON DELETE SET NULL
);
CREATE INDEX idx_bom_product ON bill_of_materials(product_id);
CREATE INDEX idx_bom_type ON bill_of_materials(bom_type);
CREATE INDEX idx_bom_active ON bill_of_materials(is_active);

-- Componentes de la Lista de Materiales (BOM Components)
CREATE TABLE IF NOT EXISTS bom_components (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bom_id BIGINT NOT NULL,
    component_product_id VARCHAR(50) NOT NULL, -- Producto componente (café verde, empaque, etc)
    quantity DECIMAL(10,2) NOT NULL, -- Cantidad requerida
    quantity_unit ENUM('kg', 'g', 'unidad', 'ml', 'l') NOT NULL DEFAULT 'kg',
    component_type ENUM('materia_prima', 'empaque', 'consumible', 'otro') NOT NULL DEFAULT 'materia_prima',
    scrap_percentage DECIMAL(5,2) DEFAULT 0, -- % adicional de merma para este componente
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bom_id) REFERENCES bill_of_materials(id) ON DELETE CASCADE,
    FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE RESTRICT
);
CREATE INDEX idx_bom_components_bom ON bom_components(bom_id);
CREATE INDEX idx_bom_components_product ON bom_components(component_product_id);

-- Órdenes de Producción (Manufacturing Orders)
CREATE TABLE IF NOT EXISTS production_orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    bom_id BIGINT NOT NULL,
    product_id VARCHAR(50) NOT NULL, -- Producto a producir
    lot_id BIGINT NULL, -- Lote asociado si aplica
    planned_quantity DECIMAL(10,2) NOT NULL, -- Cantidad planeada a producir
    produced_quantity DECIMAL(10,2) DEFAULT 0, -- Cantidad realmente producida
    quantity_unit ENUM('kg', 'g', 'unidad') NOT NULL DEFAULT 'kg',
    work_center_id BIGINT NULL,
    roasting_equipment_id BIGINT NULL,
    state ENUM('borrador', 'confirmada', 'en_progreso', 'pausada', 'completada', 'cancelada') NOT NULL DEFAULT 'borrador',
    priority ENUM('baja', 'normal', 'alta', 'urgente') NOT NULL DEFAULT 'normal',
    scheduled_date DATE NOT NULL,
    start_date DATETIME NULL,
    end_date DATETIME NULL,
    expected_loss_percentage DECIMAL(5,2) DEFAULT 15.00,
    actual_loss_percentage DECIMAL(5,2),
    production_cost DECIMAL(15,2) DEFAULT 0, -- Costo total de producción
    responsible_user_id BIGINT NULL, -- Operador responsable
    notes TEXT,
    user_id BIGINT, -- Quien creó la orden
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bom_id) REFERENCES bill_of_materials(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE SET NULL,
    FOREIGN KEY (work_center_id) REFERENCES work_centers(id) ON DELETE SET NULL,
    FOREIGN KEY (roasting_equipment_id) REFERENCES roasting_equipment(id) ON DELETE SET NULL,
    FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_production_orders_bom ON production_orders(bom_id);
CREATE INDEX idx_production_orders_product ON production_orders(product_id);
CREATE INDEX idx_production_orders_lot ON production_orders(lot_id);
CREATE INDEX idx_production_orders_state ON production_orders(state);
CREATE INDEX idx_production_orders_scheduled_date ON production_orders(scheduled_date);
CREATE INDEX idx_production_orders_work_center ON production_orders(work_center_id);

-- Consumos de Materiales en Producción (Material Consumption)
CREATE TABLE IF NOT EXISTS production_material_consumption (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    production_order_id BIGINT NOT NULL,
    product_id VARCHAR(50) NOT NULL, -- Material consumido
    lot_id BIGINT NULL, -- Lote del material si aplica
    planned_quantity DECIMAL(10,2) NOT NULL, -- Cantidad planeada
    consumed_quantity DECIMAL(10,2) NOT NULL, -- Cantidad realmente consumida
    quantity_unit ENUM('kg', 'g', 'unidad', 'ml', 'l') NOT NULL DEFAULT 'kg',
    consumption_date DATETIME NOT NULL,
    inventory_movement_id BIGINT NULL, -- Referencia al movimiento de inventario
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE SET NULL,
    FOREIGN KEY (inventory_movement_id) REFERENCES inventory_movements(id) ON DELETE SET NULL
);
CREATE INDEX idx_prod_material_consumption_order ON production_material_consumption(production_order_id);
CREATE INDEX idx_prod_material_consumption_product ON production_material_consumption(product_id);
CREATE INDEX idx_prod_material_consumption_date ON production_material_consumption(consumption_date);

-- Perfiles de Tostado (Roast Profiles)
CREATE TABLE IF NOT EXISTS roast_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    profile_code VARCHAR(50) NOT NULL UNIQUE,
    profile_name VARCHAR(160) NOT NULL,
    roast_level ENUM('ligero', 'medio_ligero', 'medio', 'medio_oscuro', 'oscuro', 'muy_oscuro') NOT NULL,
    target_temperature_celsius INT, -- Temperatura objetivo
    roast_duration_minutes INT, -- Duración total del tostado
    first_crack_time_minutes INT, -- Tiempo al primer crack
    second_crack_time_minutes INT, -- Tiempo al segundo crack si aplica
    development_time_ratio DECIMAL(5,2), -- DTR (Development Time Ratio)
    color_agtron INT, -- Medida de color Agtron
    suitable_for_varieties TEXT, -- Variedades recomendadas
    flavor_profile TEXT, -- Perfil de sabor esperado
    roasting_equipment_id BIGINT NULL, -- Equipo específico si aplica
    curve_data JSON, -- Datos de la curva de tostado (temperatura vs tiempo)
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (roasting_equipment_id) REFERENCES roasting_equipment(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_roast_profiles_level ON roast_profiles(roast_level);
CREATE INDEX idx_roast_profiles_active ON roast_profiles(is_active);

-- Registros de Tostado (Roast Batches / Roast Logs)
CREATE TABLE IF NOT EXISTS roast_batches (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_number VARCHAR(50) NOT NULL UNIQUE,
    production_order_id BIGINT NOT NULL,
    roast_profile_id BIGINT NULL,
    roasting_equipment_id BIGINT NOT NULL,
    green_coffee_lot_id BIGINT NOT NULL, -- Lote de café verde usado
    green_coffee_weight_kg DECIMAL(10,2) NOT NULL, -- Peso verde inicial
    roasted_coffee_weight_kg DECIMAL(10,2), -- Peso tostado final
    weight_loss_percentage DECIMAL(5,2), -- % de merma real
    roast_date DATETIME NOT NULL,
    roast_start_time DATETIME NOT NULL,
    roast_end_time DATETIME,
    actual_duration_minutes INT,
    inlet_temperature_celsius INT, -- Temperatura de entrada
    first_crack_time_minutes INT,
    first_crack_temperature_celsius INT,
    second_crack_time_minutes INT,
    drop_temperature_celsius INT, -- Temperatura de descarga
    development_time_ratio DECIMAL(5,2),
    color_agtron INT,
    roast_level_achieved ENUM('ligero', 'medio_ligero', 'medio', 'medio_oscuro', 'oscuro', 'muy_oscuro'),
    ambient_temperature_celsius INT,
    humidity_percentage INT,
    operator_id BIGINT NOT NULL, -- Operador que realizó el tostado
    quality_score DECIMAL(3,1), -- Puntuación de calidad (0-10)
    quality_notes TEXT,
    defects_found TEXT,
    curve_data JSON, -- Datos reales de la curva de tostado
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by BIGINT NULL,
    approved_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE RESTRICT,
    FOREIGN KEY (roast_profile_id) REFERENCES roast_profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (roasting_equipment_id) REFERENCES roasting_equipment(id) ON DELETE RESTRICT,
    FOREIGN KEY (green_coffee_lot_id) REFERENCES lots(id) ON DELETE RESTRICT,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_roast_batches_production_order ON roast_batches(production_order_id);
CREATE INDEX idx_roast_batches_profile ON roast_batches(roast_profile_id);
CREATE INDEX idx_roast_batches_equipment ON roast_batches(roasting_equipment_id);
CREATE INDEX idx_roast_batches_green_lot ON roast_batches(green_coffee_lot_id);
CREATE INDEX idx_roast_batches_date ON roast_batches(roast_date);
CREATE INDEX idx_roast_batches_operator ON roast_batches(operator_id);
CREATE INDEX idx_roast_batches_approved ON roast_batches(is_approved);

-- Control de Calidad en Producción
CREATE TABLE IF NOT EXISTS production_quality_checks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    check_number VARCHAR(50) NOT NULL UNIQUE,
    production_order_id BIGINT NULL,
    roast_batch_id BIGINT NULL,
    check_type ENUM('recepcion_verde', 'pre_tostado', 'post_tostado', 'catacion', 'empaque', 'final') NOT NULL,
    check_date DATETIME NOT NULL,
    inspector_id BIGINT NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    overall_score DECIMAL(4,1), -- Puntuación general (0-100)
    -- Atributos de catación
    aroma_score DECIMAL(3,1),
    flavor_score DECIMAL(3,1),
    acidity_score DECIMAL(3,1),
    body_score DECIMAL(3,1),
    balance_score DECIMAL(3,1),
    aftertaste_score DECIMAL(3,1),
    sweetness_score DECIMAL(3,1),
    uniformity_score DECIMAL(3,1),
    clean_cup_score DECIMAL(3,1),
    -- Defectos
    defects_found TEXT,
    defects_count INT DEFAULT 0,
    moisture_percentage DECIMAL(5,2),
    color_agtron INT,
    grind_test_result ENUM('aprobado', 'rechazado', 'no_aplica') DEFAULT 'no_aplica',
    packaging_test_result ENUM('aprobado', 'rechazado', 'no_aplica') DEFAULT 'no_aplica',
    observations TEXT,
    corrective_actions TEXT,
    images JSON, -- URLs de imágenes del control
    approved_by BIGINT NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (roast_batch_id) REFERENCES roast_batches(id) ON DELETE SET NULL,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_quality_checks_production_order ON production_quality_checks(production_order_id);
CREATE INDEX idx_quality_checks_roast_batch ON production_quality_checks(roast_batch_id);
CREATE INDEX idx_quality_checks_type ON production_quality_checks(check_type);
CREATE INDEX idx_quality_checks_date ON production_quality_checks(check_date);
CREATE INDEX idx_quality_checks_inspector ON production_quality_checks(inspector_id);
CREATE INDEX idx_quality_checks_passed ON production_quality_checks(passed);

-- Mermas y Subproductos
CREATE TABLE IF NOT EXISTS production_waste_byproducts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    production_order_id BIGINT NOT NULL,
    roast_batch_id BIGINT NULL,
    waste_type ENUM('merma_tostado', 'merma_molido', 'defectos', 'chaff', 'rechazo_calidad', 'otro') NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    quantity_unit ENUM('kg', 'g', 'unidad') NOT NULL DEFAULT 'kg',
    waste_date DATETIME NOT NULL,
    disposal_method ENUM('descartado', 'compost', 'reutilizado', 'vendido', 'donado') NOT NULL DEFAULT 'descartado',
    estimated_value_loss DECIMAL(10,2), -- Pérdida de valor estimada
    reason TEXT,
    notes TEXT,
    recorded_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (roast_batch_id) REFERENCES roast_batches(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_waste_byproducts_production_order ON production_waste_byproducts(production_order_id);
CREATE INDEX idx_waste_byproducts_roast_batch ON production_waste_byproducts(roast_batch_id);
CREATE INDEX idx_waste_byproducts_type ON production_waste_byproducts(waste_type);
CREATE INDEX idx_waste_byproducts_date ON production_waste_byproducts(waste_date);

-- Mantenimiento de Equipos
CREATE TABLE IF NOT EXISTS equipment_maintenance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    maintenance_number VARCHAR(50) NOT NULL UNIQUE,
    roasting_equipment_id BIGINT NOT NULL,
    maintenance_type ENUM('preventivo', 'correctivo', 'calibracion', 'limpieza', 'emergencia') NOT NULL,
    scheduled_date DATE NOT NULL,
    start_date DATETIME NULL,
    end_date DATETIME NULL,
    state ENUM('programado', 'en_progreso', 'completado', 'cancelado') NOT NULL DEFAULT 'programado',
    maintenance_description TEXT NOT NULL,
    parts_replaced TEXT,
    maintenance_cost DECIMAL(10,2),
    performed_by VARCHAR(255), -- Técnico o empresa
    technician_user_id BIGINT NULL, -- Si es interno
    next_maintenance_date DATE,
    downtime_hours DECIMAL(5,2), -- Horas de inactividad
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (roasting_equipment_id) REFERENCES roasting_equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_equipment_maintenance_equipment ON equipment_maintenance(roasting_equipment_id);
CREATE INDEX idx_equipment_maintenance_type ON equipment_maintenance(maintenance_type);
CREATE INDEX idx_equipment_maintenance_state ON equipment_maintenance(state);
CREATE INDEX idx_equipment_maintenance_scheduled_date ON equipment_maintenance(scheduled_date);