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
import { usersRouter } from './routes/users.js';
import { labelsRouter } from './routes/labels.js';
import { devtoolsRouter } from './routes/devtools.js';
import { productionRouter } from './routes/production/index.js';
import { query } from './db.js';

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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));

app.use('/api/auth', authRouter);
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

// Endpoint de auditoría - Obtener logs
app.get('/api/audit/logs', async (req, res) => {
  try {
    const { action, entity_type, user_id, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT 
        al.id,
        al.user_id,
        u.email as user_email,
        u.first_name,
        u.last_name,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];

    if (action) {
      sql += ` AND al.action = ?`;
      params.push(action);
    }
    if (entity_type) {
      sql += ` AND al.entity_type = ?`;
      params.push(entity_type);
    }
    if (user_id) {
      sql += ` AND al.user_id = ?`;
      params.push(user_id);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit) || 100, parseInt(offset) || 0);

    const result = await query(sql, params);

    // Contar total
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (action) {
      countSql += ` AND action = ?`;
      countParams.push(action);
    }
    if (entity_type) {
      countSql += ` AND entity_type = ?`;
      countParams.push(entity_type);
    }
    if (user_id) {
      countSql += ` AND user_id = ?`;
      countParams.push(user_id);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult.rows[0].total;

    res.json({
      logs: result.rows,
      total,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    });
  } catch (err) {
    console.error('[GET /api/audit/logs] Error:', err);
    res.status(500).json({ error: 'Error al obtener logs de auditoría' });
  }
});

// Endpoint de auditoría - Estadísticas
app.get('/api/audit/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        action,
        entity_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY action, entity_type
      ORDER BY count DESC
    `);

    res.json({ stats: result.rows });
  } catch (err) {
    console.error('[GET /api/audit/stats] Error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Endpoint de auditoría - Lista de acciones
app.get('/api/audit/actions', async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT action FROM audit_logs ORDER BY action`
    );

    const actions = result.rows.map(r => r.action);
    res.json({ actions });
  } catch (err) {
    console.error('[GET /api/audit/actions] Error:', err);
    res.status(500).json({ error: 'Error al obtener acciones' });
  }
});

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
