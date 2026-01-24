// ==========================================
// ARCHIVO: server/routes/production.js
// Router principal que integra subrutas
// ==========================================

const express = require('express');
const router = express.Router();

// Importar subrutas
const ordersRouter = require('./production/orders');
const batchesRouter = require('./production/batches');
const qualityRouter = require('./production/quality');
const dashboardRouter = require('./production/dashboard');

// Middleware para logging (opcional)
router.use((req, res, next) => {
  console.log(`[PRODUCTION API] ${req.method} ${req.path}`);
  next();
});

// Montar subrutas
router.use('/orders', ordersRouter);
router.use('/batches', batchesRouter);
router.use('/quality', qualityRouter);
router.use('/dashboard', dashboardRouter);

// ==========================================
// ENDPOINTS ADICIONALES
// ==========================================

/**
 * GET /api/production
 * Información general del módulo
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    module: 'Production',
    endpoints: {
      orders: '/api/production/orders',
      batches: '/api/production/batches',
      quality: '/api/production/quality',
      dashboard: '/api/production/dashboard'
    },
    version: '1.0.0'
  });
});

module.exports = router;
