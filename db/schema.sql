-- DobleYo relational schema (engine-agnostic SQL)
-- Entities: users (admin), lots, products, blog_posts

-- Users
CREATE TABLE users (
  id            BIGINT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120),
  role          VARCHAR(32) NOT NULL DEFAULT 'user', -- 'admin'|'editor'|'user'
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL
);
CREATE INDEX idx_users_role ON users(role);

-- Products (catalog)
CREATE TABLE products (
  id          BIGINT PRIMARY KEY,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  name        VARCHAR(160) NOT NULL,
  price_cop   INTEGER NOT NULL, -- price in COP cents (or unit)
  origin      VARCHAR(120),
  process     VARCHAR(80),
  roast       VARCHAR(80),
  image_url   TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL
);
CREATE INDEX idx_products_origin ON products(origin);
CREATE INDEX idx_products_roast ON products(roast);

-- Lots (traceability)
CREATE TABLE lots (
  id           BIGINT PRIMARY KEY,
  code         VARCHAR(40) NOT NULL UNIQUE, -- e.g., DBY-2025-09-HUI
  name         VARCHAR(160),
  origin       VARCHAR(160),
  farm         VARCHAR(160),
  producer     VARCHAR(160),
  altitude     VARCHAR(60),
  process      VARCHAR(80),
  variety      VARCHAR(120),
  harvest_date DATE,
  roast_date   DATE,
  moisture     VARCHAR(20),
  score        DECIMAL(4,1),
  notes        TEXT,
  product_id   BIGINT NULL REFERENCES products(id), -- optional relation to product
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL
);
CREATE INDEX idx_lots_code ON lots(code);
CREATE INDEX idx_lots_product ON lots(product_id);

-- Blog posts
CREATE TABLE blog_posts (
  id          BIGINT PRIMARY KEY,
  slug        VARCHAR(160) NOT NULL UNIQUE,
  title       VARCHAR(200) NOT NULL,
  author      VARCHAR(120),
  content_md  TEXT, -- markdown or HTML
  cover_url   TEXT,
  published   BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL
);
CREATE INDEX idx_blog_published ON blog_posts(published);

-- Simple sessions (optional if using JWT elsewhere)
CREATE TABLE sessions (
  id          BIGINT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
