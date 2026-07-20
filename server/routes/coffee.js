import express from 'express';
import { logger } from '../logger.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { idempotency } from '../middleware/idempotency.js';
import { assertFarmOwnership } from '../middleware/farmAuth.js';
import { logAudit } from '../services/audit.js';
import {
  createHarvest, storeGreenCoffee, sendToRoasting, receiveRoasted,
  storeRoasted, getRoastedStorageDetail, createPackaging,
  getHarvests, getGreenInventory, getRoastingBatches, getRoastedCoffee,
  getRoastedForStorage, getPackaged, getLotStage, getAllLots,
  deleteHarvest, deleteRoastedStorage, deleteRoastedCoffee, deleteRoastingBatch,
  getRoastedForCupping, getCuppings, createCupping,
} from '../services/coffeeService.js';

export const coffeeRouter = express.Router();

coffeeRouter.use(apiLimiter);
coffeeRouter.use(authenticateToken);
coffeeRouter.use(requireRole(['admin', 'caficultor']));
// Idempotencia de la cola offline móvil: los POST con client_op_id
// no se re-ejecutan al reintentarse (devuelven la respuesta guardada).
coffeeRouter.use(idempotency);

// Helper: envía la respuesta de error de negocio o 500
function handleErr(res, err, context) {
  if (err.status) return res.status(err.status).json({ success: false, error: err.message, ...(err.detail && { detail: err.detail }) });
  logger.error({ err }, context);
  res.status(500).json({ success: false, error: err.message });
}

// 1. Cosecha
coffeeRouter.post('/harvest', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { farm, region, altitude, variety, climate, process, aroma, tasteNotes } = req.body;
    try {
      await assertFarmOwnership(farm, req.user);
    } catch (authErr) {
      return res.status(authErr.status ?? 403).json({ success: false, error: authErr.message });
    }
    const data = await createHarvest({ farm, region, altitude, variety, climate, process, aroma, tasteNotes });
    res.status(201).json({ success: true, message: 'Lote registrado correctamente', ...data });
  } catch (err) {
    handleErr(res, err, 'Error en harvest');
  }
});

// 2. Almacenamiento verde
coffeeRouter.post('/inventory-storage', async (req, res) => {
  try {
    const { lotId, weight, weightUnit, location, storageDate, notes } = req.body;
    const data = await storeGreenCoffee({ lotId, weight, weightUnit, location, storageDate, notes });
    res.status(201).json({ success: true, message: 'Café verde almacenado correctamente', ...data });
  } catch (err) {
    handleErr(res, err, 'Error en inventory-storage');
  }
});

// 3. Enviar a tostión
coffeeRouter.post('/send-roasting', async (req, res) => {
  try {
    const { lotId, quantitySent, targetTemp, notes } = req.body;
    const data = await sendToRoasting({ lotId, quantitySent, targetTemp, notes });
    res.status(201).json({ success: true, message: 'Lote enviado a tostión correctamente', ...data });
  } catch (err) {
    handleErr(res, err, 'Error en send-roasting');
  }
});

// 4. Recoger del tueste
coffeeRouter.post('/roast-retrieval', async (req, res) => {
  try {
    const { roastingId, roastLevel, roastedWeight, actualTemp, roastTime, observations } = req.body;
    const data = await receiveRoasted({ roastingId, roastLevel, roastedWeight, actualTemp, roastTime, observations });
    res.status(201).json({ success: true, message: 'Café tostado registrado correctamente', ...data });
  } catch (err) {
    handleErr(res, err, 'Error en roast-retrieval');
  }
});

// 5. Almacenar tostado
coffeeRouter.post('/roasted-storage', async (req, res) => {
  try {
    const { roastedId, location, container, containerCount, conditions, notes } = req.body;
    const data = await storeRoasted({ roastedId, location, container, containerCount, conditions, notes });
    res.status(201).json({ success: true, message: 'Café tostado almacenado correctamente', ...data });
  } catch (err) {
    handleErr(res, err, 'Error en roasted-storage');
  }
});

// 5.1 Detalle de almacenamiento
coffeeRouter.get('/roasted-storage/:id', async (req, res) => {
  try {
    const data = await getRoastedStorageDetail(req.params.id);
    res.json(data);
  } catch (err) {
    handleErr(res, err, 'Error obteniendo detalle de almacenamiento');
  }
});

// 6. Empaque
coffeeRouter.post('/packaging', async (req, res) => {
  try {
    const { roastedStorageId, acidity, body, balance, presentation, grindSize, packageSize, unitCount, notes, addToInventory } = req.body;
    const data = await createPackaging({ roastedStorageId, acidity, body, balance, presentation, grindSize, packageSize, unitCount, notes, addToInventory });

    await logAudit(req.user.id, 'create', 'packaged_coffee', data.packagedId, {
      roasted_storage_id: roastedStorageId, lot_id: data.lotId,
      presentation, grind_size: grindSize || null, package_size: packageSize,
      unit_count: unitCount, consumed_kg: data.consumedKg, remaining_kg: data.remainingKg,
      lot_exhausted: data.lotExhausted, product_id: data.productId,
    });

    res.status(201).json({
      success: true,
      ...data,
      message: data.inventoryMovementCreated
        ? `Café preparado para venta y ${unitCount} unidades agregadas al inventario`
        : 'Café preparado para venta correctamente',
    });
  } catch (err) {
    handleErr(res, err, 'Error en packaging');
  }
});

// GETs de lista
coffeeRouter.get('/harvests',          async (_req, res) => { try { res.json(await getHarvests()); }          catch (err) { handleErr(res, err, 'Error en GET harvests'); } });
coffeeRouter.get('/green-inventory',   async (_req, res) => { try { res.json(await getGreenInventory()); }    catch (err) { handleErr(res, err, 'Error en GET green-inventory'); } });
coffeeRouter.get('/roasting-batches',  async (_req, res) => { try { res.json(await getRoastingBatches()); }   catch (err) { handleErr(res, err, 'Error en GET roasting-batches'); } });
coffeeRouter.get('/roasted-coffee',    async (_req, res) => { try { res.json(await getRoastedCoffee()); }     catch (err) { handleErr(res, err, 'Error en GET roasted-coffee'); } });
coffeeRouter.get('/roasted-for-storage', async (_req, res) => { try { res.json(await getRoastedForStorage()); } catch (err) { handleErr(res, err, 'Error en GET roasted-for-storage'); } });
coffeeRouter.get('/packaged',          async (_req, res) => { try { res.json(await getPackaged()); }          catch (err) { handleErr(res, err, 'Error en GET packaged'); } });
coffeeRouter.get('/roasted-for-cupping', async (_req, res) => { try { res.json(await getRoastedForCupping()); } catch (err) { handleErr(res, err, 'Error en GET roasted-for-cupping'); } });
coffeeRouter.get('/cupping',           async (_req, res) => { try { res.json(await getCuppings()); }          catch (err) { handleErr(res, err, 'Error en GET cupping'); } });

// Stage del lote
coffeeRouter.get('/lots/:lotId/stage', async (req, res) => {
  try {
    const { lotId } = req.params;
    if (!lotId) return res.status(400).json({ success: false, error: 'lotId requerido' });
    res.json({ success: true, ...(await getLotStage(lotId)) });
  } catch (err) {
    handleErr(res, err, '[GET /lots/:lotId/stage] Error');
  }
});

// Todos los lotes
coffeeRouter.get('/lots', async (_req, res) => {
  try {
    res.json(await getAllLots());
  } catch (err) {
    handleErr(res, err, '[GET /lots] Error general');
  }
});

// DELETEs
coffeeRouter.delete('/harvest/:lotId', async (req, res) => {
  try {
    await deleteHarvest(req.params.lotId);
    res.json({ success: true, message: 'Lote eliminado correctamente' });
  } catch (err) {
    handleErr(res, err, '[DELETE /harvest] Error');
  }
});

coffeeRouter.delete('/roasted-storage/:id', async (req, res) => {
  try {
    await deleteRoastedStorage(req.params.id);
    res.json({ success: true, message: 'Café tostado almacenado eliminado correctamente' });
  } catch (err) {
    handleErr(res, err, '[DELETE /roasted-storage] Error');
  }
});

coffeeRouter.delete('/roasted-coffee/:id', async (req, res) => {
  try {
    await deleteRoastedCoffee(req.params.id);
    res.json({ success: true, message: 'Café tostado pendiente eliminado correctamente' });
  } catch (err) {
    handleErr(res, err, '[DELETE /roasted-coffee] Error');
  }
});

coffeeRouter.delete('/roasting-batch/:id', async (req, res) => {
  try {
    await deleteRoastingBatch(req.params.id);
    res.json({ success: true, message: 'Lote en proceso de tostado eliminado correctamente' });
  } catch (err) {
    handleErr(res, err, '[DELETE /roasting-batch] Error');
  }
});

// Cupping SCA
coffeeRouter.post('/cupping', async (req, res) => {
  try {
    const data = await createCupping({ ...req.body, userId: req.user.id });
    res.status(201).json({ success: true, message: 'Cupping registrado correctamente', ...data });
  } catch (err) {
    handleErr(res, err, '[POST /cupping] Error');
  }
});
