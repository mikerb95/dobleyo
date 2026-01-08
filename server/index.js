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
import { caficultorRouter } from './routes/caficultor.js';
import { setupRouter } from './routes/setup.js';
import { coffeeRouter } from './routes/coffee.js';
import { mercadolibreRouter } from './routes/mercadolibre.js';
import { inventoryRouter } from './routes/inventory.js';
import { emailRouter } from './routes/emails.js';
import { contactRouter } from './routes/contact.js';

const app = express();

// Seguridad: Headers HTTP seguros (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar CSP estricto por ahora si hay scripts inline o externos
}));

// Seguridad: Cookies y Body Parsing
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

app.use('/api/auth', authRouter);
app.use('/api/stock', stockRouter);
app.use('/api/caficultor', caficultorRouter);
app.use('/api/setup', setupRouter);
app.use('/api/coffee', coffeeRouter);
app.use('/api/mercadolibre', mercadolibreRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/emails', emailRouter);
app.use('/api/contact', contactRouter);

// Debug endpoint to check environment variables (safe version)
app.get('/api/debug-env', (req, res) => {
  // Proteger en producción
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Endpoint no disponible en producción' });
  }

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

// Directorio de estaticos: carpeta dist (generada por astro build)
// DESPUÉS de todas las rutas API
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, '../dist');
app.use(express.static(staticDir));

// Fallback: servir index.html para SPA
app.get('*', (req, res) => {
  res.sendFile(path.resolve(staticDir, 'index.html'));
});

// Only start server if explicitly requested via START_SERVER env var
// This prevents Vercel from trying to bind ports during module loading
if (process.env.START_SERVER === 'true') {
  app.listen(PORT, ()=>{
    console.log('Server listening on https://dobleyo.cafe');
  });
}

export default app;
