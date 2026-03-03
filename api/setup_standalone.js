import pg from 'pg';
import bcrypt from 'bcryptjs';

/**
 * Standalone setup endpoint para Vercel (PostgreSQL)
 * Crea tablas esenciales y admin user sin depender de Express app
 *
 * Uso: GET /api/setup_standalone?key=SETUP_SECRET_KEY
 */
export default async function handler(req, res) {
    const logs = [];
    const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

    // Protección via variable de entorno
    const SETUP_KEY = process.env.SETUP_SECRET_KEY;
    if (!SETUP_KEY || req.query.key !== SETUP_KEY) {
        return res.status(403).json({ error: 'Unauthorized. Set SETUP_SECRET_KEY env var and pass ?key=<value>' });
    }

    let client;

    try {
        log('Starting Standalone Setup (PostgreSQL)...');

        // 1. Conectar
        client = new pg.Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        await client.connect();
        log('Connected to DB.');

        // 2. Schema — tablas esenciales
        const SCHEMA_STATEMENTS = [
            `CREATE TABLE IF NOT EXISTS users (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(80),
          last_name VARCHAR(80),
          mobile_phone VARCHAR(20),
          city VARCHAR(120),
          state_province VARCHAR(120),
          country VARCHAR(120) DEFAULT 'Colombia',
          address TEXT,
          role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client', 'provider', 'caficultor')),
          is_verified BOOLEAN NOT NULL DEFAULT FALSE,
          caficultor_status TEXT NOT NULL DEFAULT 'none' CHECK (caficultor_status IN ('none', 'pending', 'approved', 'rejected')),
          last_login_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
      )`,
            `CREATE TABLE IF NOT EXISTS providers (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          company_name VARCHAR(160) NOT NULL,
          tax_id VARCHAR(50),
          phone VARCHAR(40),
          address TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
            `CREATE TABLE IF NOT EXISTS refresh_tokens (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          replaced_by_token VARCHAR(255)
      )`,
            `CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(64) NOT NULL,
          entity_type VARCHAR(64),
          entity_id VARCHAR(64),
          details JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
            `CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          category TEXT NOT NULL DEFAULT 'cafe' CHECK (category IN ('cafe', 'accesorio', 'merchandising')),
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
          stock_quantity INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
      )`,
            `CREATE TABLE IF NOT EXISTS lots (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
          product_id VARCHAR(50) NULL REFERENCES products(id),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
      )`
        ];

        for (const sql of SCHEMA_STATEMENTS) {
            try {
                await client.query(sql);
            } catch (err) {
                if (err.code !== '42P07') { // table already exists
                    log(`Schema Warning: ${err.message}`);
                }
            }
        }
        log('Schema applied.');

        // 3. Seed Products
        const products = [
            { id: 'cf-sierra', name: 'Sierra Nevada', category: 'cafe', price: 42000, stock: 50 },
            { id: 'cf-huila', name: 'Huila', category: 'cafe', price: 45000, stock: 50 },
            { id: 'cf-nar', name: 'Nariño', category: 'cafe', price: 48000, stock: 50 },
            { id: 'acc-molinillo', name: 'Molinillo Manual', category: 'accesorio', price: 199900, stock: 20 },
            { id: 'acc-prensa', name: 'Prensa Francesa', category: 'accesorio', price: 89900, stock: 30 },
            { id: 'acc-chemex', name: 'Chemex 6 Tazas', category: 'accesorio', price: 245000, stock: 15 }
        ];

        for (const p of products) {
            const existing = await client.query('SELECT id FROM products WHERE id = $1', [p.id]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO products (id, name, category, price, stock_quantity) VALUES ($1, $2, $3, $4, $5)`,
                    [p.id, p.name, p.category, p.price, p.stock]
                );
            }
        }
        log('Products seeded.');

        // 4. Create Admin
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        const ADMIN_PASS = process.env.ADMIN_PASSWORD;

        if (!ADMIN_EMAIL || !ADMIN_PASS) {
            log('Skipping admin creation: ADMIN_EMAIL and ADMIN_PASSWORD env vars not set.');
        } else if (ADMIN_PASS.length < 8) {
            log('Skipping admin creation: Password must be at least 8 characters.');
        } else {
            const users = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
            if (users.rows.length === 0) {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(ADMIN_PASS, salt);
                await client.query(
                    'INSERT INTO users (email, password_hash, first_name, role, is_verified) VALUES ($1, $2, $3, $4, TRUE)',
                    [ADMIN_EMAIL, hash, 'Admin DobleYo', 'admin']
                );
                log('Admin user created.');
            } else {
                log('Admin user already exists.');
            }
        }

        await client.end();
        res.status(200).json({ status: 'Success', logs });

    } catch (error) {
        log(`ERROR: ${error.message}`);
        if (client) try { await client.end(); } catch (_) { }
        res.status(500).json({ status: 'Failed', error: error.message, logs });
    }
}
