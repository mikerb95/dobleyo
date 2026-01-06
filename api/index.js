import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { stockRouter } from '../server/routes/stock.js';
import { authRouter } from '../server/routes/auth.js';
import { setupRouter } from '../server/routes/setup.js';
import { lotsRouter } from '../server/routes/lots.js';
import { mercadolibreRouter } from '../server/routes/mercadolibre.js';

const app = express();

// Basic Middleware
app.use(cookieParser());
app.use(express.json());

// CORS
app.use(cors({
  origin: process.env.SITE_BASE_URL || 'https://dobleyo.cafe',
  credentials: true
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/stock', stockRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/setup', setupRouter);
app.use('/api/mercadolibre', mercadolibreRouter);

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Export for Vercel serverless
export default app;
