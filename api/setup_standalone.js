import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const logs = [];
  const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

  // Protection via environment variable
  const SETUP_KEY = process.env.SETUP_SECRET_KEY;
  if (!SETUP_KEY || req.query.key !== SETUP_KEY) {
    return res.status(403).json({ error: 'Unauthorized. Set SETUP_SECRET_KEY env var and pass ?key=<value>' });
  }

  let connection;

  try {
    log("Starting Standalone Setup...");

    // 1. Connect
    const dbUrl = new URL(process.env.DATABASE_URL);
    connection = await mysql.createConnection({
      host: dbUrl.hostname,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1),
      port: Number(dbUrl.port),
      ssl: { rejectUnauthorized: false },
      multipleStatements: true // Allow running multiple SQL statements
    });
    log("Connected to DB.");

    // 2. Schema
    const SCHEMA_SQL = `
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
    `;

    // Split and execute schema
    const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const sql of statements) {
      try {
        await connection.query(sql);
      } catch (err) {
        // Ignore exists errors
        if (err.code !== 'ER_TABLE_EXISTS_ERROR' && err.code !== 'ER_DUP_KEYNAME') {
           log(`Schema Warning: ${err.message}`);
        }
      }
    }
    log("Schema applied.");

    // 3. Seed Products
    const products = [
      { id: "cf-sierra", name: "Sierra Nevada", category: "Cafés", price: 42000, stock: 50 },
      { id: "cf-huila", name: "Huila", category: "Cafés", price: 45000, stock: 50 },
      { id: "cf-nar", name: "Nariño", category: "Cafés", price: 48000, stock: 50 },
      { id: "acc-molinillo", name: "Molinillo Manual", category: "Accesorios", price: 199900, stock: 20 },
      { id: "acc-prensa", name: "Prensa Francesa", category: "Accesorios", price: 89900, stock: 30 },
      { id: "acc-chemex", name: "Chemex 6 Tazas", category: "Accesorios", price: 245000, stock: 15 }
    ];

    for (const p of products) {
      const [rows] = await connection.query('SELECT id FROM products WHERE id = ?', [p.id]);
      if (rows.length === 0) {
        await connection.query(
          `INSERT INTO products (id, name, category, price, stock) VALUES (?, ?, ?, ?, ?)`,
          [p.id, p.name, p.category, p.price, p.stock]
        );
      }
    }
    log("Products seeded.");

    // 4. Create Admin (only if credentials are provided via env vars)
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;
    
    if (!ADMIN_EMAIL || !ADMIN_PASS) {
      log("Skipping admin creation: ADMIN_EMAIL and ADMIN_PASSWORD env vars not set.");
    } else if (ADMIN_PASS.length < 8) {
      log("Skipping admin creation: Password must be at least 8 characters.");
    } else {
      const [users] = await connection.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
      if (users.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(ADMIN_PASS, salt);
        
        await connection.query(
          'INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
          [ADMIN_EMAIL, hash, 'Admin DobleYo', 'admin']
        );
        log("Admin user created.");
      } else {
        log("Admin user already exists.");
      }
    }

    res.status(200).json({ status: "Success", logs });

  } catch (error) {
    log(`ERROR: ${error.message}`);
    res.status(500).json({ status: "Failed", error: error.message, logs });
  } finally {
    if (connection) await connection.end();
  }
}
