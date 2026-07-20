import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from '../server/logger.js';
import { stockRouter } from '../server/routes/stock.js';
import { authRouter } from '../server/routes/auth.js';
import { setupRouter } from '../server/routes/setup.js';
import { lotsRouter } from '../server/routes/lots.js';
import { mercadolibreRouter } from '../server/routes/mercadolibre.js';
import { coffeeRouter } from '../server/routes/coffee.js';
import { inventoryRouter } from '../server/routes/inventory.js';
import { storageRouter } from '../server/routes/storage.js';
import { usersRouter } from '../server/routes/users.js';
import { labelsRouter } from '../server/routes/labels.js';
import { devtoolsRouter } from '../server/routes/devtools.js';
import { caficultorRouter } from '../server/routes/caficultor.js';
import { emailRouter } from '../server/routes/emails.js';
import { contactRouter } from '../server/routes/contact.js';
import { productionRouter } from '../server/routes/production.js';
import { ordersRouter } from '../server/routes/orders.js';
import { shippingRouter } from '../server/routes/shipping.js';
import { subscriptionsRouter } from '../server/routes/subscriptions.js';
import { traceabilityRouter } from '../server/routes/traceability.js';
import { financeRouter } from '../server/routes/finance.js';
import { farmsRouter } from '../server/routes/farms.js';
import { heatmapRouter } from '../server/routes/heatmap.js';
import { productsRouter } from '../server/routes/products.js';
import { blogRouter } from '../server/routes/blog.js';
import auditRouter from '../server/routes/audit.js';
import { systemRouter } from '../server/routes/system.js';
import { couponsRouter } from '../server/routes/coupons.js';
import { externalSalesRouter } from '../server/routes/external-sales.js';
import { crmRouter } from '../server/routes/crm.js';
import { dashboardRouter } from '../server/routes/dashboard.js';
import { forecastRouter } from '../server/routes/forecast.js';
import { accountRouter } from '../server/routes/account.js';
import { globalLimiter } from '../server/middleware/rateLimit.js';
import { healthCheck } from '../server/db.js';

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

// Routes
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/stock', stockRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/setup', setupRouter);
app.use('/api/labels', labelsRouter);
app.use('/api/mercadolibre', mercadolibreRouter);
app.use('/api/coffee', coffeeRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/users', usersRouter);
app.use('/api/devtools', devtoolsRouter);
app.use('/api/caficultor', caficultorRouter);
app.use('/api/emails', emailRouter);
app.use('/api/contact', contactRouter);
app.use('/api/production', productionRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/traceability', traceabilityRouter);
app.use('/api/finance', financeRouter);
app.use('/api/farms', farmsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/blog', blogRouter);
app.use('/api/products', productsRouter);
// Webhook Wompi delegado al router de órdenes
app.post('/api/wompi/webhook', (req, res, next) => { req.url = '/wompi/webhook'; ordersRouter(req, res, next); });
app.use('/api/audit', auditRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/external-sales', externalSalesRouter);
app.use('/api/system', systemRouter);
app.use('/api/crm', crmRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ml', forecastRouter);

// Health Check — ping real a Turso/libSQL
app.get('/api/health', async (req, res) => {
  const db = await healthCheck();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ok' : 'degraded',
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

// Export for Vercel serverless
export default app;
