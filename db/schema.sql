-- DobleYo relational schema (MySQL Compatible)

-- Users
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120),
    role ENUM('admin', 'client', 'provider') NOT NULL DEFAULT 'client',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_role ON users(role);

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
    name VARCHAR(160) NOT NULL,
    category VARCHAR(50),
    origin VARCHAR(120),
    process VARCHAR(80),
    roast VARCHAR(80),
    price INTEGER NOT NULL,
    rating DECIMAL(3,1) DEFAULT 0,
    is_deal BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    is_fast BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_category ON products(category);

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
