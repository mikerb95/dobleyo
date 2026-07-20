// Módulo de Almacenamiento — maestro de ubicaciones + libro de movimientos
// La lógica vive en services/storageService.js; aquí solo hay HTTP y permisos.
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { idempotency } from '../middleware/idempotency.js';
import {
  listLocations, getLocationDetail, listZones, listWarehouses, listMovements,
  createLocation, updateLocation, setLocationBlocked, deactivateLocation, reactivateLocation,
  createZone, transferStock, adjustStock,
  listInventoryCounts, getInventoryCountDetail, recordCountLine, cancelInventoryCount,
  openInventoryCount, postInventoryCount, rebuildQuants, reconcileReport,
  STOCK_STATES,
} from '../services/storageService.js';

export const storageRouter = Router();

storageRouter.use(apiLimiter);
storageRouter.use(authenticateToken);
storageRouter.use(idempotency);

const onlyAdmin = requireRole(['admin']);
const operators = requireRole(['admin', 'caficultor']);

function handleErr(res, err, context) {
  if (err.status) {
    return res.status(err.status).json({
      success: false, error: err.message, ...(err.detail && { detail: err.detail }),
    });
  }
  logger.error({ err }, context);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
}

function invalid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

// ── Consulta ─────────────────────────────────────────────────────────────────

storageRouter.get('/locations', operators, async (req, res) => {
  try {
    const data = await listLocations({
      stockState: req.query.state || undefined,
      zoneType: req.query.zone_type || undefined,
      includeInactive: req.query.include_inactive === '1',
      includeBlocked: req.query.include_blocked !== '0',
    });
    res.json({ success: true, data });
  } catch (err) { handleErr(res, err, 'Error en GET /storage/locations'); }
});

storageRouter.get('/locations/:id', operators,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      res.json({ success: true, data: await getLocationDetail(parseInt(req.params.id, 10)) });
    } catch (err) { handleErr(res, err, 'Error en GET /storage/locations/:id'); }
  }
);

storageRouter.get('/zones', operators, async (_req, res) => {
  try { res.json({ success: true, data: await listZones() }); }
  catch (err) { handleErr(res, err, 'Error en GET /storage/zones'); }
});

storageRouter.get('/warehouses', operators, async (_req, res) => {
  try { res.json({ success: true, data: await listWarehouses() }); }
  catch (err) { handleErr(res, err, 'Error en GET /storage/warehouses'); }
});

storageRouter.get('/movements', operators, async (req, res) => {
  try {
    const data = await listMovements({
      locationCode: req.query.location || undefined,
      lotId: req.query.lot || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (err) { handleErr(res, err, 'Error en GET /storage/movements'); }
});

// ── Maestro (solo admin) ─────────────────────────────────────────────────────

storageRouter.post('/locations', onlyAdmin,
  [
    body('code').trim().notEmpty().withMessage('El código es requerido'),
    body('name').trim().notEmpty().withMessage('El nombre es requerido'),
    body('zoneId').isInt({ min: 1 }).withMessage('La zona es requerida'),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await createLocation({ ...req.body, user: req.user });
      res.status(201).json({ success: true, message: 'Ubicación creada correctamente', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/locations'); }
  }
);

storageRouter.patch('/locations/:id', onlyAdmin,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await updateLocation(parseInt(req.params.id, 10), { ...req.body, user: req.user });
      res.json({ success: true, message: 'Ubicación actualizada correctamente', data });
    } catch (err) { handleErr(res, err, 'Error en PATCH /storage/locations/:id'); }
  }
);

storageRouter.post('/locations/:id/block', onlyAdmin,
  [param('id').isInt({ min: 1 }), body('reason').trim().notEmpty().withMessage('El motivo del bloqueo es requerido')],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await setLocationBlocked(parseInt(req.params.id, 10),
        { blocked: true, reason: req.body.reason, user: req.user });
      res.json({ success: true, message: 'Ubicación bloqueada', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/locations/:id/block'); }
  }
);

storageRouter.post('/locations/:id/unblock', onlyAdmin,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await setLocationBlocked(parseInt(req.params.id, 10), { blocked: false, user: req.user });
      res.json({ success: true, message: 'Ubicación desbloqueada', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/locations/:id/unblock'); }
  }
);

// DELETE desactiva; nunca borra. El historial referencia estos maestros.
storageRouter.delete('/locations/:id', onlyAdmin,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await deactivateLocation(parseInt(req.params.id, 10), req.user);
      res.json({ success: true, message: 'Ubicación desactivada', data });
    } catch (err) { handleErr(res, err, 'Error en DELETE /storage/locations/:id'); }
  }
);

storageRouter.post('/locations/:id/reactivate', onlyAdmin,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await reactivateLocation(parseInt(req.params.id, 10), req.user);
      res.json({ success: true, message: 'Ubicación reactivada', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/locations/:id/reactivate'); }
  }
);

storageRouter.post('/zones', onlyAdmin,
  [
    body('code').trim().notEmpty().withMessage('El código es requerido'),
    body('name').trim().notEmpty().withMessage('El nombre es requerido'),
    body('zoneType').trim().notEmpty().withMessage('El tipo de zona es requerido'),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await createZone({ ...req.body, user: req.user });
      res.status(201).json({ success: true, message: 'Zona creada correctamente', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/zones'); }
  }
);

// ── Movimientos ──────────────────────────────────────────────────────────────

storageRouter.post('/transfers', operators,
  [
    body('fromCode').trim().notEmpty().withMessage('La ubicación de origen es requerida'),
    body('toCode').trim().notEmpty().withMessage('La ubicación de destino es requerida'),
    body('lotId').trim().notEmpty().withMessage('El lote es requerido'),
    body('stockState').isIn(STOCK_STATES).withMessage('Estado de stock inválido'),
    body('qtyKg').isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a cero'),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await transferStock({
        ...req.body,
        movementUid: req.body.movementUid || req.body.client_op_id,
        user: req.user,
      });
      res.status(201).json({ success: true, message: 'Traslado registrado correctamente', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/transfers'); }
  }
);

// Los ajustes cambian el inventario sin respaldo documental: solo admin.
storageRouter.post('/adjustments', onlyAdmin,
  [
    body('locationCode').trim().notEmpty().withMessage('La ubicación es requerida'),
    body('lotId').trim().notEmpty().withMessage('El lote es requerido'),
    body('stockState').isIn(STOCK_STATES).withMessage('Estado de stock inválido'),
    body('targetQtyKg').isFloat({ min: 0 }).withMessage('La cantidad objetivo no puede ser negativa'),
    body('reason').trim().isLength({ min: 5 }).withMessage('Indique el motivo del ajuste (mínimo 5 caracteres)'),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await adjustStock({
        ...req.body,
        movementUid: req.body.movementUid || req.body.client_op_id,
        user: req.user,
      });
      res.status(201).json({ success: true, message: 'Ajuste registrado correctamente', data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/adjustments'); }
  }
);

// ── Conteo cíclico ───────────────────────────────────────────────────────────

storageRouter.post('/counts', onlyAdmin, async (req, res) => {
  try {
    const data = await openInventoryCount({
      locationCodes: req.body.locationCodes, scopeNote: req.body.scopeNote, user: req.user,
    });
    res.status(201).json({ success: true, message: 'Conteo abierto. Las ubicaciones quedaron bloqueadas.', data });
  } catch (err) { handleErr(res, err, 'Error en POST /storage/counts'); }
});

storageRouter.post('/counts/:id/post', onlyAdmin,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const data = await postInventoryCount(parseInt(req.params.id, 10), req.user);
      res.json({ success: true, message: `Conteo contabilizado con ${data.corrections.length} corrección(es).`, data });
    } catch (err) { handleErr(res, err, 'Error en POST /storage/counts/:id/post'); }
  }
);

// ── Salud del inventario ─────────────────────────────────────────────────────

storageRouter.get('/reconcile', onlyAdmin, async (_req, res) => {
  try { res.json({ success: true, data: await reconcileReport() }); }
  catch (err) { handleErr(res, err, 'Error en GET /storage/reconcile'); }
});

storageRouter.post('/reconcile', onlyAdmin, async (_req, res) => {
  try {
    const data = await rebuildQuants();
    res.json({ success: true, message: 'Existencias reconstruidas desde el libro de movimientos.', data });
  } catch (err) { handleErr(res, err, 'Error en POST /storage/reconcile'); }
});
