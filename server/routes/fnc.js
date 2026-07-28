// Módulo de precio de referencia FNC
// Compara lo que DobleYo paga a los caficultores contra el precio interno de
// referencia de la Federación Nacional de Cafeteros.
//
// DobleYo recibe el café ya trillado (verde), mientras que la FNC cotiza
// pergamino seco por carga de 125 kg. La conversión usa la columna "Valor
// Excelso $/Carga" del propio boletín dividida por "Kg Excelso en Carga", así
// que el factor de conversión sale de la FNC y no de una constante inventada.
import { Router } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';
import {
  getFncPrice,
  getLatestStoredPrice,
  mapPriceRow,
  excelsoRefForFactor,
} from '../services/fncPrice.js';

export const fncRouter = Router();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

// ===================================================
// PRECIO VIGENTE E HISTÓRICO
// ===================================================

// GET /api/fnc/price — precio de referencia vigente.
// Descarga el boletín solo si el último guardado no es de hoy.
fncRouter.get('/price',
  authenticateToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const result = await getFncPrice({ forceRefresh });

      res.json({
        success: true,
        data: result.price,
        refreshed: result.refreshed,
        stale: result.stale,
        ...(result.error ? { warning: result.error } : {}),
      });
    } catch (err) {
      logger.error({ err }, '[GET /api/fnc/price] Error');
      res.status(502).json({
        success: false,
        error: 'No se pudo obtener el precio de la Federación Nacional de Cafeteros',
      });
    }
  }
);

// GET /api/fnc/history?days=90 — histórico de precios ya guardados (sin red).
fncRouter.get('/history',
  authenticateToken,
  requireRole('admin'),
  [queryValidator('days').optional().isInt({ min: 1, max: 3650 })],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const days = parseInt(req.query.days ?? '90', 10);
      const { rows } = await query(
        `SELECT price_date, carga_cop, excelso_cop_kg, ny_close_uscent_lb, base_yield_factor
           FROM fnc_price_history
          WHERE price_date >= date('now', ?)
          ORDER BY price_date ASC`,
        [`-${days} days`]
      );

      res.json({
        success: true,
        data: rows.map((r) => ({
          priceDate: r.price_date,
          cargaCop: r.carga_cop,
          excelsoCopKg: r.excelso_cop_kg,
          nyCloseUscentLb: r.ny_close_uscent_lb,
          baseYieldFactor: r.base_yield_factor,
        })),
      });
    } catch (err) {
      logger.error({ err }, '[GET /api/fnc/history] Error');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// ===================================================
// REGISTRO DE LA COMPRA AL CAFICULTOR
// ===================================================

// PUT /api/fnc/purchase/:lotId — datos de compra de un lote ya cosechado.
fncRouter.put('/purchase/:lotId',
  authenticateToken,
  requireRole('admin'),
  [
    param('lotId').trim().notEmpty().withMessage('Lote requerido'),
    body('purchaseWeightKg').isFloat({ gt: 0 }).withMessage('El peso debe ser mayor que cero'),
    body('purchaseTotalCop').isInt({ min: 1 }).withMessage('El valor pagado debe ser positivo'),
    body('purchaseDate').isISO8601().withMessage('Fecha de compra inválida'),
    body('yieldFactor').optional({ nullable: true }).isInt({ min: 60, max: 140 })
      .withMessage('El factor de rendimiento debe estar entre 60 y 140'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const { lotId } = req.params;
      const { purchaseWeightKg, purchaseTotalCop, purchaseDate, yieldFactor = null } = req.body;

      const { rowCount } = await query(
        `UPDATE coffee_harvests
            SET purchase_weight_kg = ?, purchase_total_cop = ?, purchase_date = ?, yield_factor = ?
          WHERE lot_id = ?`,
        [purchaseWeightKg, purchaseTotalCop, purchaseDate.slice(0, 10), yieldFactor, lotId]
      );

      if (!rowCount) {
        return res.status(404).json({ success: false, error: 'Lote no encontrado' });
      }

      await logAudit(req.user.id, 'update', 'coffee_harvest_purchase', lotId, {
        purchaseWeightKg, purchaseTotalCop, purchaseDate, yieldFactor,
      });

      res.json({ success: true, data: { lotId } });
    } catch (err) {
      logger.error({ err }, '[PUT /api/fnc/purchase] Error');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// ===================================================
// COMPARATIVO
// ===================================================

// GET /api/fnc/comparison — pagado vs. referencia FNC, por lote y consolidado.
fncRouter.get('/comparison',
  authenticateToken,
  requireRole('admin'),
  [
    queryValidator('from').optional().isISO8601(),
    queryValidator('to').optional().isISO8601(),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const conditions = ['h.purchase_total_cop IS NOT NULL', 'h.purchase_weight_kg > 0'];
      const params = [];

      if (req.query.from) {
        params.push(String(req.query.from).slice(0, 10));
        conditions.push('h.purchase_date >= ?');
      }
      if (req.query.to) {
        params.push(String(req.query.to).slice(0, 10));
        conditions.push('h.purchase_date <= ?');
      }

      // Cada lote se compara contra el boletín vigente el día de su compra.
      const { rows: lots } = await query(
        `SELECT h.lot_id, h.farm, h.variety, h.region,
                h.purchase_weight_kg, h.purchase_total_cop, h.purchase_date, h.yield_factor,
                (SELECT p.id FROM fnc_price_history p
                  WHERE p.price_date <= COALESCE(h.purchase_date, date('now'))
                  ORDER BY p.price_date DESC LIMIT 1) AS price_id
           FROM coffee_harvests h
          WHERE ${conditions.join(' AND ')}
          ORDER BY h.purchase_date DESC, h.lot_id DESC`,
        params
      );

      // El boletín más antiguo sirve de referencia aproximada para compras
      // anteriores al inicio del histórico.
      const { rows: oldestRows } = await query(
        'SELECT * FROM fnc_price_history ORDER BY price_date ASC LIMIT 1'
      );
      const oldest = mapPriceRow(oldestRows[0]);

      const neededIds = [...new Set(lots.map((l) => l.price_id).filter(Boolean))];
      const priceById = new Map();

      if (neededIds.length) {
        const placeholders = neededIds.map(() => '?').join(',');
        const { rows: priceRows } = await query(
          `SELECT * FROM fnc_price_history WHERE id IN (${placeholders})`,
          neededIds
        );
        for (const row of priceRows) priceById.set(Number(row.id), mapPriceRow(row));
      }

      let totalPaid = 0;
      let totalReference = 0;
      let comparableWeight = 0;

      const items = lots.map((lot) => {
        const weight = Number(lot.purchase_weight_kg);
        const paid = Number(lot.purchase_total_cop);
        const paidPerKg = paid / weight;

        const price = priceById.get(Number(lot.price_id)) ?? oldest;
        const approximate = !lot.price_id && Boolean(oldest);
        const factor = lot.yield_factor ?? price?.baseYieldFactor ?? null;
        const referencePerKg = excelsoRefForFactor(price, factor);

        const referenceTotal = referencePerKg === null ? null : referencePerKg * weight;
        const differenceTotal = referenceTotal === null ? null : paid - referenceTotal;

        if (referenceTotal !== null) {
          totalPaid += paid;
          totalReference += referenceTotal;
          comparableWeight += weight;
        }

        return {
          lotId: lot.lot_id,
          farm: lot.farm,
          variety: lot.variety,
          region: lot.region,
          purchaseDate: lot.purchase_date,
          weightKg: round2(weight),
          paidTotalCop: paid,
          paidCopKg: round2(paidPerKg),
          yieldFactor: factor,
          yieldFactorIsAssumed: lot.yield_factor === null || lot.yield_factor === undefined,
          referenceDate: price?.priceDate ?? null,
          referenceCopKg: round2(referencePerKg),
          referenceTotalCop: round2(referenceTotal),
          differenceCop: round2(differenceTotal),
          differencePct: referenceTotal ? round2((differenceTotal / referenceTotal) * 100) : null,
          // El histórico no cubre esta fecha: se usó el boletín más antiguo.
          referenceIsApproximate: approximate,
        };
      });

      res.json({
        success: true,
        data: {
          items,
          summary: {
            lots: items.length,
            comparableLots: items.filter((i) => i.referenceCopKg !== null).length,
            totalWeightKg: round2(comparableWeight),
            totalPaidCop: round2(totalPaid),
            totalReferenceCop: round2(totalReference),
            differenceCop: round2(totalPaid - totalReference),
            differencePct: totalReference
              ? round2(((totalPaid - totalReference) / totalReference) * 100)
              : null,
            avgPaidCopKg: comparableWeight ? round2(totalPaid / comparableWeight) : null,
            avgReferenceCopKg: comparableWeight ? round2(totalReference / comparableWeight) : null,
          },
          currentPrice: await getLatestStoredPrice(),
        },
      });
    } catch (err) {
      logger.error({ err }, '[GET /api/fnc/comparison] Error');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// GET /api/fnc/pending — lotes cosechados sin datos de compra registrados.
fncRouter.get('/pending',
  authenticateToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT lot_id, farm, variety, region, created_at
           FROM coffee_harvests
          WHERE purchase_total_cop IS NULL OR purchase_weight_kg IS NULL
          ORDER BY created_at DESC
          LIMIT 100`
      );

      res.json({
        success: true,
        data: rows.map((r) => ({
          lotId: r.lot_id,
          farm: r.farm,
          variety: r.variety,
          region: r.region,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      logger.error({ err }, '[GET /api/fnc/pending] Error');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);
