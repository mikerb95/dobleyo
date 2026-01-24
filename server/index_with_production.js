// server/index.js - Integración de APIs de Producción
// Este archivo muestra cómo integrar las nuevas APIs en el servidor principal

const express = require('express');
const cors = require('cors');
const db = require('./db');

// ============================================
// MIDDLEWARES
// ============================================
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// IMPORTAR ROUTERS
// ============================================

// Rutas existentes
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const productsRouter = require('./routes/stock');
const lotsRouter = require('./routes/lots');

// ⭐ NUEVAS RUTAS DE PRODUCCIÓN
const productionRouter = require('./routes/production');

// ============================================
// REGISTRAR RUTAS
// ============================================
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/lots', lotsRouter);

// ⭐ MONTAR ROUTER DE PRODUCCIÓN
app.use('/api/production', productionRouter);

// ============================================
// RUTAS DE DIAGNÓSTICO
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: 'DobleYo Coffee ERP API',
    version: '2.0',
    modules: [
      '/api/auth - Autenticación',
      '/api/users - Usuarios',
      '/api/products - Productos',
      '/api/lots - Lotes de café',
      '/api/production - ⭐ NUEVO: Módulo de Producción',
      '  /production/orders - Órdenes de producción',
      '  /production/batches - Batches de tostado',
      '  /production/quality - Control de calidad',
      '  /production/dashboard - Dashboard operativo'
    ]
  });
});

app.get('/api', (req, res) => {
  res.json({
    production: {
      orders: '/api/production/orders',
      batches: '/api/production/batches',
      quality: '/api/production/quality',
      dashboard: '/api/production/dashboard'
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         🏭 DobleYo Coffee ERP Server                  ║
║════════════════════════════════════════════════════════║
║  ✅ Servidor iniciado en puerto ${PORT}                   ║
║  📊 Dashboard: http://localhost:${PORT}/dashboard      ║
║  🔌 API: http://localhost:${PORT}/api                  ║
║  🏭 Producción: http://localhost:${PORT}/api/production ║
║════════════════════════════════════════════════════════║
║  Módulos disponibles:                                   ║
║  ✓ Autenticación                                        ║
║  ✓ Usuarios                                             ║
║  ✓ Productos                                            ║
║  ✓ Lotes de café                                        ║
║  ⭐ Producción (NUEVO)                                  ║
║    ├─ Órdenes                                           ║
║    ├─ Batches de tostado                                ║
║    ├─ Control de calidad                                ║
║    └─ Dashboard operativo                               ║
║════════════════════════════════════════════════════════║
  `);
});

module.exports = app;
