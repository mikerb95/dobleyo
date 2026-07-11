import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';
import { stockRouter } from './routes/stock.js';
import { authRouter } from './routes/auth.js';
import { caficultorRouter } from './routes/caficultor.js';
import { setupRouter } from './routes/setup.js';
import { coffeeRouter } from './routes/coffee.js';
import { mercadolibreRouter } from './routes/mercadolibre.js';
import { inventoryRouter } from './routes/inventory.js';
import { emailRouter } from './routes/emails.js';
import { contactRouter } from './routes/contact.js';
import { usersRouter } from './routes/users.js';
import { labelsRouter } from './routes/labels.js';
import { devtoolsRouter } from './routes/devtools.js';
import { productionRouter } from './routes/production.js';
import { ordersRouter } from './routes/orders.js';
import { shippingRouter } from './routes/shipping.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { traceabilityRouter } from './routes/traceability.js';
import { financeRouter } from './routes/finance.js';
import { farmsRouter } from './routes/farms.js';
import { heatmapRouter } from './routes/heatmap.js';
import { productsRouter } from './routes/products.js';
import { blogRouter } from './routes/blog.js';
import { lotsRouter } from './routes/lots.js';
import { systemRouter } from './routes/system.js';
import { couponsRouter } from './routes/coupons.js';
import { externalSalesRouter } from './routes/external-sales.js';
import { crmRouter } from './routes/crm.js';
import { dashboardRouter } from './routes/dashboard.js';
import { forecastRouter } from './routes/forecast.js';
import { accountRouter } from './routes/account.js';
import auditRouter from './routes/audit.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { healthCheck } from './db.js';

const app = express();

// Detrás del proxy de Vercel: confiar en el primer hop para que req.ip refleje
// la IP real del cliente (X-Forwarded-For). Sin esto, el rate limiting agrupa a
// todos los usuarios bajo la IP del proxy y se vuelve inútil o bloquea a todos.
app.set('trust proxy', 1);

app.use(pinoHttp({ logger }));

// Seguridad: Headers HTTP seguros con CSP habilitado (BUG-011 resuelto Fase 11)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"], // anti-clickjacking
      formAction: ["'self'", "https://checkout.wompi.co", "https://www.mercadopago.com"],
      scriptSrc: ["'self'", "https://checkout.wompi.co", "https://www.mercadopago.com", "https://sdk.mercadopago.com", "https://cdn.jsdelivr.net", "https://accounts.google.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://checkout.wompi.co", "https://nominatim.openstreetmap.org", "https://api.mercadopago.com", "https://accounts.google.com", "https://www.gstatic.com"],
      frameSrc: ["'self'", "https://checkout.wompi.co", "https://www.mercadopago.com", "https://accounts.google.com"],
      mediaSrc: ["'self'", "https:", "blob:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Requerido para Leaflet y tiles de mapa externos
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
  origin: function (origin, callback) {
    // Sin 'origin' = petición no-navegador (SSR, webhooks Wompi/ML, health, curl).
    // CORS solo aplica al navegador; su control real aquí es el JWT / la firma del
    // webhook, no la cabecera Origin. Por eso se permiten.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Origen de navegador no permitido: respondemos SIN cabeceras CORS (el navegador
    // bloquea la lectura) en lugar de lanzar un Error, que produciría un 500 con traza.
    logger.warn({ origin }, '[CORS] Origen bloqueado');
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));

// Red de seguridad global contra abuso (excluye webhooks y health, ver rateLimit.js)
app.use('/api', globalLimiter);

app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/stock', stockRouter);
app.use('/api/caficultor', caficultorRouter);
app.use('/api/setup', setupRouter);
app.use('/api/coffee', coffeeRouter);
app.use('/api/labels', labelsRouter);
app.use('/api/mercadolibre', mercadolibreRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/emails', emailRouter);
app.use('/api/contact', contactRouter);
app.use('/api/users', usersRouter);
app.use('/api/devtools', devtoolsRouter);
app.use('/api/production', productionRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/traceability', traceabilityRouter);
app.use('/api/finance', financeRouter);
app.use('/api/farms', farmsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/blog', blogRouter);
app.use('/api/products', productsRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/external-sales', externalSalesRouter);
app.use('/api/system', systemRouter);
app.use('/api/crm', crmRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ml', forecastRouter);
app.use('/api/audit', auditRouter);
// Webhook Wompi delegado al router de órdenes
app.post('/api/wompi/webhook', (req, res, next) => { req.url = '/wompi/webhook'; ordersRouter(req, res, next); });

// Salud — ping real a Turso/libSQL
app.get('/api/health', async (req, res) => {
  const db = await healthCheck();
  const status = db.ok ? 'ok' : 'degraded';
  res.status(db.ok ? 200 : 503).json({
    status,
    time: new Date().toISOString(),
    db: db.ok ? 'connected' : `error: ${db.error}`,
  });
});

// MercadoPago — stub (Fase 4, pendiente)
app.post('/api/mp/create_preference', async (req, res) => {
  return res.status(501).json({ error: 'MercadoPago pendiente de configuración' });
});

app.post('/api/mp/webhook', express.json(), async (req, res) => {
  res.sendStatus(200);
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
  app.listen(PORT, () => {
    console.log('Server listening on https://dobleyo.cafe');
  });
}

export default app;
