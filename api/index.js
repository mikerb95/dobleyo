import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { stockRouter } from '../server/routes/stock.js';
import { authRouter } from '../server/routes/auth.js';
import { setupRouter } from '../server/routes/setup.js';
import { lotsRouter } from '../server/routes/lots.js';
import { mercadolibreRouter } from '../server/routes/mercadolibre.js';
import { coffeeRouter } from '../server/routes/coffee.js';
import { inventoryRouter } from '../server/routes/inventory.js';

const app = express();

// Basic Middleware
app.use(cookieParser());
app.use(express.json());

// CORS - permitir múltiples orígenes
const allowedOrigins = [
  'https://dobleyo.cafe',
  'https://www.dobleyo.cafe',
  'https://dobleyo.vercel.app',
  'http://localhost:4321',
  'http://localhost:3000'
];
if (process.env.SITE_BASE_URL && !allowedOrigins.includes(process.env.SITE_BASE_URL)) {
  allowedOrigins.push(process.env.SITE_BASE_URL);
}

app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Origen bloqueado:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/stock', stockRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/setup', setupRouter);
app.use('/api/mercadolibre', mercadolibreRouter);
app.use('/api/coffee', coffeeRouter);
app.use('/api/inventory', inventoryRouter);

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Debug endpoint - verificar configuración (solo en desarrollo o con clave)
app.get('/api/debug/config', (req, res) => {
  const debugKey = req.query.key;
  const expectedKey = process.env.SETUP_SECRET_KEY;
  
  // Permitir acceso solo con clave correcta o en desarrollo
  if (process.env.NODE_ENV !== 'development' && debugKey !== expectedKey) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'not-set',
    config: {
      JWT_SECRET: process.env.JWT_SECRET ? '✓ configurado' : '✗ FALTA',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? '✓ configurado' : '✗ FALTA',
      DATABASE_URL: process.env.DATABASE_URL ? '✓ configurado' : '✗ FALTA',
      SITE_BASE_URL: process.env.SITE_BASE_URL || 'no configurado (usando default)',
      SETUP_SECRET_KEY: process.env.SETUP_SECRET_KEY ? '✓ configurado' : '✗ FALTA',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ? '✓ configurado' : '✗ FALTA',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? '✓ configurado' : '✗ FALTA',
    },
    allowedOrigins: allowedOrigins
  });
});

// Export for Vercel serverless
export default app;
