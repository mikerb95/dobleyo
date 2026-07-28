/**
 * Costeo de producción: consulta y corrección de los costos del pipeline, y
 * maestro de insumos de empaque.
 *
 * Los costos se registran desde los pasos del pipeline (router `coffee.js`).
 * Aquí se leen, se corrigen y se administran los insumos. Todo el router es
 * solo para admin: el caficultor no ve montos.
 */
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../services/audit.js';
import {
  getLotCosts, getLotCostSummary, getCostOverview,
  updateCost, deleteCost, getSupplies,
  COST_TYPE_LABEL, STAGE_LABEL,
} from '../services/costService.js';

export const costsRouter = Router();

costsRouter.use(apiLimiter);
costsRouter.use(authenticateToken);
costsRouter.use(requireRole('admin'));

function handleErr(res, err, context) {
  if (err.status) return res.status(err.status).json({ success: false, error: err.message });
  logger.error({ err }, context);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
}

function invalid(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(422).json({ success: false, errors: errors.array() });
  return true;
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

costsRouter.get('/meta', (_req, res) => {
  res.json({ success: true, data: { stages: STAGE_LABEL, costTypes: COST_TYPE_LABEL } });
});

// ── Resumen general ──────────────────────────────────────────────────────────

// GET /api/costs — listado de lotes con su costeo (vista /admin/costos)
costsRouter.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const data = await getCostOverview({ limit, offset });
    res.json({ success: true, data });
  } catch (err) {
    handleErr(res, err, '[GET /api/costs] Error');
  }
});

// GET /api/costs/lot/:lotId — desglose de un lote
costsRouter.get('/lot/:lotId', async (req, res) => {
  try {
    const [summary, costs] = await Promise.all([
      getLotCostSummary(req.params.lotId),
      getLotCosts(req.params.lotId),
    ]);
    res.json({ success: true, data: { ...summary, costs } });
  } catch (err) {
    handleErr(res, err, '[GET /api/costs/lot] Error');
  }
});

// ── Corrección ───────────────────────────────────────────────────────────────

// PATCH /api/costs/:id — corrige el monto; reversa el asiento anterior
costsRouter.patch('/:id',
  [
    param('id').isInt({ min: 1 }),
    body('amount').optional().isFloat({ gt: 0 }).withMessage('El monto debe ser positivo'),
    body('paymentMethod').optional().isIn(['caja', 'banco', 'credito']).withMessage('Forma de pago inválida'),
    body('notes').optional().isLength({ max: 500 }),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const { amount, paymentMethod, notes, partnerId } = req.body;
      const result = await updateCost(req.params.id, { amount, paymentMethod, notes, partnerId }, req.user);

      await logAudit(req.user.id, 'update', 'lot_cost', req.params.id, {
        lot_id: result.previous.lot_id, cost_type: result.previous.cost_type,
        amount_before: result.previous.amount_cop, amount_after: amount ?? result.previous.amount_cop,
        reversed_entry_id: result.previous.accounting_entry_id, new_entry_id: result.entryId,
      });

      res.json({
        success: true,
        message: result.accounted
          ? 'Costo corregido y reasiento contable generado en borrador'
          : 'Costo corregido. La contabilización quedó pendiente',
        data: { costId: result.costId, accounted: result.accounted, entryId: result.entryId },
      });
    } catch (err) {
      handleErr(res, err, '[PATCH /api/costs] Error');
    }
  }
);

// DELETE /api/costs/:id — elimina el costo y reversa su asiento
costsRouter.delete('/:id', [param('id').isInt({ min: 1 })], async (req, res) => {
  if (invalid(req, res)) return;
  try {
    const removed = await deleteCost(req.params.id, req.user);

    await logAudit(req.user.id, 'delete', 'lot_cost', req.params.id, {
      lot_id: removed.lot_id, cost_type: removed.cost_type, amount_cop: removed.amount_cop,
    });

    res.json({ success: true, message: 'Costo eliminado y asiento reversado' });
  } catch (err) {
    handleErr(res, err, '[DELETE /api/costs] Error');
  }
});

// ── Maestro de insumos de empaque ────────────────────────────────────────────

// GET /api/costs/supplies — bolsas, etiquetas y demás insumos
costsRouter.get('/supplies/list', async (req, res) => {
  try {
    const supplies = await getSupplies({ activeOnly: req.query.all !== '1' });
    res.json({ success: true, data: supplies });
  } catch (err) {
    handleErr(res, err, '[GET /api/costs/supplies] Error');
  }
});

// POST /api/costs/supplies — crea un insumo
costsRouter.post('/supplies',
  [
    body('name').trim().notEmpty().withMessage('Nombre requerido'),
    body('type').isIn(['bolsa', 'etiqueta', 'valvula', 'otro']).withMessage('Tipo inválido'),
    body('unitCost').isFloat({ min: 0 }).withMessage('Costo unitario inválido'),
    body('sizeLabel').optional({ nullable: true }).isLength({ max: 20 }),
    body('sku').optional({ nullable: true }).trim().isLength({ max: 40 }),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const { sku, name, type, sizeLabel, unitCost, stockUnits, stockMin, supplier } = req.body;
      const { rows } = await query(
        `INSERT INTO packaging_supplies (sku, name, type, size_label, unit_cost_cop, stock_units, stock_min, supplier, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now')) RETURNING id`,
        [sku || null, name, type, sizeLabel || null, Math.round(unitCost),
         parseInt(stockUnits, 10) || 0, parseInt(stockMin, 10) || 0, supplier || null]
      );

      await logAudit(req.user.id, 'create', 'packaging_supply', rows[0].id, { name, type, unit_cost: unitCost });
      res.status(201).json({ success: true, data: { id: rows[0].id }, message: 'Insumo creado correctamente' });
    } catch (err) {
      handleErr(res, err, '[POST /api/costs/supplies] Error');
    }
  }
);

// PATCH /api/costs/supplies/:id — actualiza costo, stock o estado
costsRouter.patch('/supplies/:id',
  [
    param('id').isInt({ min: 1 }),
    body('unitCost').optional().isFloat({ min: 0 }).withMessage('Costo unitario inválido'),
    body('stockUnits').optional().isInt().withMessage('Stock inválido'),
    body('stockMin').optional().isInt({ min: 0 }).withMessage('Mínimo inválido'),
    body('isActive').optional().isBoolean(),
  ],
  async (req, res) => {
    if (invalid(req, res)) return;
    try {
      const { rows: current } = await query('SELECT * FROM packaging_supplies WHERE id = ?', [req.params.id]);
      if (!current.length) return res.status(404).json({ success: false, error: 'Insumo no encontrado' });
      const supply = current[0];

      const { name, unitCost, stockUnits, stockMin, supplier, isActive } = req.body;
      const nextStock = stockUnits !== undefined ? parseInt(stockUnits, 10) : parseInt(supply.stock_units, 10);

      await query(
        `UPDATE packaging_supplies
            SET name = ?, unit_cost_cop = ?, stock_units = ?, stock_min = ?, supplier = ?, is_active = ?,
                updated_at = datetime('now')
          WHERE id = ?`,
        [name ?? supply.name,
         unitCost !== undefined ? Math.round(unitCost) : supply.unit_cost_cop,
         nextStock,
         stockMin !== undefined ? parseInt(stockMin, 10) : supply.stock_min,
         supplier !== undefined ? supplier : supply.supplier,
         isActive !== undefined ? (isActive ? 1 : 0) : supply.is_active,
         req.params.id]
      );

      // Un ajuste de stock deja rastro: el inventario de insumos también es trazable.
      const before = parseInt(supply.stock_units, 10);
      if (stockUnits !== undefined && nextStock !== before) {
        await query(
          `INSERT INTO packaging_supply_movements
             (supply_id, movement_type, quantity, quantity_before, quantity_after, unit_cost_cop, reason, user_id, created_at)
           VALUES (?, 'ajuste', ?, ?, ?, ?, 'Ajuste manual de stock', ?, datetime('now'))`,
          [req.params.id, Math.abs(nextStock - before), before, nextStock, supply.unit_cost_cop, req.user.id]
        );
      }

      await logAudit(req.user.id, 'update', 'packaging_supply', req.params.id, {
        unit_cost_before: supply.unit_cost_cop, unit_cost_after: unitCost ?? supply.unit_cost_cop,
        stock_before: before, stock_after: nextStock,
      });

      res.json({ success: true, message: 'Insumo actualizado correctamente' });
    } catch (err) {
      handleErr(res, err, '[PATCH /api/costs/supplies] Error');
    }
  }
);
