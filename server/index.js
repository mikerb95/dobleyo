import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';
import crypto from 'crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { stockRouter } from './routes/stock.js';
import { authRouter } from './routes/auth.js';
import { setupRouter } from './routes/setup.js';
import { coffeeRouter } from './routes/coffee.js';
import { mercadolibreRouter } from './routes/mercadolibre.js';
import { inventoryRouter } from './routes/inventory.js';

const app = express();

// Seguridad: Headers HTTP seguros (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar CSP estricto por ahora si hay scripts inline o externos
}));

// Seguridad: Cookies y Body Parsing
app.use(cookieParser());
app.use(express.json());

// CORS: Configurar origenes permitidos (ajustar segun dominio real)
app.use(cors({
  origin: process.env.SITE_BASE_URL || 'https://dobleyo.cafe',
  credentials: true // Permitir cookies en CORS
}));

app.use('/api/auth', authRouter);
app.use('/api/stock', stockRouter);
app.use('/api/setup', setupRouter);
app.use('/api/coffee', coffeeRouter);
app.use('/api/mercadolibre', mercadolibreRouter);
app.use('/api/inventory', inventoryRouter);

// Debug endpoint to check environment variables (safe version)
app.get('/api/debug-env', (req, res) => {
  res.json({
    status: 'ok',
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      hasJwtSecret: !!process.env.JWT_SECRET
    }
  });
});

// Directorio de estaticos: carpeta dist (generada por astro build)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, '../dist');
app.use(express.static(staticDir));

// Salud
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.post('/api/mp/create_preference', async (req, res) => {
  try {
    return res.status(501).json({ error: 'Método de pago aún no disponible' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/wompi/checkout', async (req, res) => {
  try {
    return res.status(501).json({ error: 'Método de pago aún no disponible' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/mp/webhook', express.json(), async (req, res) => {
  try{
    res.sendStatus(200);
  }catch(e){ res.status(200).end(); }
});

app.post('/api/wompi/webhook', express.json(), (req, res) => {
  try{
    res.sendStatus(200);
  }catch(e){ res.status(200).end(); }
});

app.get('/api/order/:ref', (req, res) => {
  const ref = req.params.ref;
  const ord = store.get(ref);
  if (!ord) return res.status(404).json({ error: 'No existe la orden' });
  res.json(ord);
});

const PORT = process.env.PORT || 4000;

// Only start server if explicitly requested via START_SERVER env var
// This prevents Vercel from trying to bind ports during module loading
if (process.env.START_SERVER === 'true') {
  app.listen(PORT, ()=>{
    console.log('Server listening on https://dobleyo.cafe');
  });
}

export default app;
