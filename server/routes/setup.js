import express from 'express';
import * as db from '../db.js';
import * as auth from '../auth.js';
import { createCoffeeTables } from '../migrations/create_coffee_tables.js';

export const setupRouter = express.Router();

const ADMIN_EMAIL = 'admin@dobleyo.com';
const ADMIN_PASS = 'admin123';

// Embed schema directly to avoid file reading issues in Vercel
const SCHEMA_SQL = `
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
    process VARCHAR(80),
    variety VARCHAR(120),
    harvest_date DATE,
    roast_date DATE,
    moisture VARCHAR(20),
    score DECIMAL(4,1),
    notes TEXT,
    product_id VARCHAR(50) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX idx_lots_code ON lots(code);
CREATE INDEX idx_lots_product ON lots(product_id);
`;

const products = [
  {
    id: "cf-sierra",
    name: "Sierra Nevada",
    category: "Cafés",
    origin: "Sierra Nevada",
    process: "Lavado",
    roast: "Medio",
    price: 42000,
    rating: 4.6,
    deal: true,
    bestseller: true,
    fast: true,
    image: "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "cf-huila",
    name: "Huila",
    category: "Cafés",
    origin: "Huila",
    process: "Honey",
    roast: "Claro",
    price: 45000,
    rating: 4.7,
    new: true,
    fast: true,
    image: "https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "cf-nar",
    name: "Nariño",
    category: "Cafés",
    origin: "Nariño",
    process: "Natural",
    roast: "Oscuro",
    price: 48000,
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "acc-molinillo",
    name: "Molinillo Manual",
    category: "Accesorios",
    price: 199900,
    rating: 4.3,
    image: "https://images.unsplash.com/photo-1517080319694-66f5353725c8?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "acc-prensa",
    name: "Prensa Francesa",
    category: "Accesorios",
    price: 89900,
    rating: 4.8,
    bestseller: true,
    image: "https://images.unsplash.com/photo-1544098485-2a2a4c9b5316?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "acc-chemex",
    name: "Chemex 6 Tazas",
    category: "Accesorios",
    price: 245000,
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1565452344054-01369143d9d5?q=80&w=800&auto=format&fit=crop",
  }
];

setupRouter.get('/', async (req, res) => {
  // Simple protection
  if (req.query.key !== 'dobleyo_setup_2026') {
    return res.status(403).json({ error: 'Unauthorized. Provide correct key.' });
  }

  const logs = [];
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log('Starting remote setup...');

    // 1. Run Schema
    const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      if (statement.startsWith('--')) continue;
      try {
        await db.query(statement);
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          // ignore
        } else {
          log(`Schema Error (non-fatal): ${err.message}`);
        }
      }
    }
    log('Schema applied.');

    // 2. Create Coffee Tables
    try {
      await createCoffeeTables();
      log('Coffee tables created.');
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        log('Coffee tables already exist.');
      } else {
        throw err;
      }
    }

    // 3. Seed Products
    for (const p of products) {
      const existing = await db.query('SELECT id FROM products WHERE id = ?', [p.id]);
      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO products (id, name, category, origin, process, roast, price, rating, is_deal, is_bestseller, is_new, is_fast, image_url, stock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id, p.name, p.category, p.origin || null, p.process || null, p.roast || null,
            p.price, p.rating || 0, p.deal || false, p.bestseller || false, p.new || false,
            p.fast || false, p.image, 50
          ]
        );
      }
    }
    log('Products seeded.');

    // 4. Create Admin
    const existingAdmin = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
    if (existingAdmin.rows.length === 0) {
      const hash = await auth.hashPassword(ADMIN_PASS);
      await db.query(
        'INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [ADMIN_EMAIL, hash, 'Admin DobleYo', 'admin']
      );
      log('Admin user created.');
    } else {
      log('Admin user already exists.');
    }

    res.json({ success: true, logs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message, logs });
  }
});
