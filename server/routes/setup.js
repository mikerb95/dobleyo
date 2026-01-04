import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from '../db.js';
import * as auth from '../auth.js';

export const setupRouter = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../db/schema.sql');

const ADMIN_EMAIL = 'admin@dobleyo.com';
const ADMIN_PASS = 'admin123';

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
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
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

    // 2. Seed Products
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

    // 3. Create Admin
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
