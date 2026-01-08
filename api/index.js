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
  credentials: true
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

// Export for Vercel serverless
export default app;
