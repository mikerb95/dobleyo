// ==========================================
// ARCHIVO: server/routes/production.js
// Router principal que integra subrutas
// ==========================================

import express from 'express';
import { ordersRouter } from './production/orders.js';
import { batchesRouter } from './production/batches.js';
import { qualityRouter } from './production/quality.js';
import { dashboardRouter } from './production/dashboard.js';

export const productionRouter = express.Router();

// Middleware para logging (opcional)
productionRouter.use((req, res, next) => {
  console.log(`[PRODUCTION API] ${req.method} ${req.path}`);
  next();
});

// Montar subrutas
productionRouter.use('/orders', ordersRouter);
productionRouter.use('/batches', batchesRouter);
productionRouter.use('/quality', qualityRouter);
productionRouter.use('/dashboard', dashboardRouter);

// ==========================================
// ENDPOINTS ADICIONALES
// ==========================================

/**
 * GET /api/production
 * Información general del módulo
 */
productionRouter.get('/', (req, res) => {
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
