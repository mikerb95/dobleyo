-- DobleYo relational schema (MySQL Compatible)

-- Users
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120),
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
