// Módulo de precio de referencia FNC
// Compara lo que DobleYo le paga al caficultor contra el precio interno de
// referencia de la Federación Nacional de Cafeteros, y lo cruza con el costo
// acumulado de producción del lote.
//
// Lo pagado sale de `lot_costs` (cost_type = 'farmer_payment'), que ya alimenta
// el flujo de cosecha. Este módulo no captura costos: solo lee y compara.
//
// DobleYo recibe el café ya trillado (verde), mientras que la FNC cotiza
// pergamino seco por carga de 125 kg. La conversión usa la columna "Valor
// Excelso $/Carga" del boletín dividida por "Kg Excelso en Carga", así que el
// factor de conversión lo publica la propia FNC y no es una constante inventada.
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
const num = (v) => (v === null || v === undefined ? 0 : parseFloat(v) || 0);

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

// GET /api/fnc/history?days=90 — histórico ya guardado (no toca la red).
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
// FACTOR DE RENDIMIENTO DEL LOTE
// ===================================================

// PUT /api/fnc/lot/:lotId/yield-factor — dato opcional del análisis de trilla.
fncRouter.put('/lot/:lotId/yield-factor',
  authenticateToken,
  requireRole('admin'),
  [
    param('lotId').trim().notEmpty().withMessage('Lote requerido'),
    body('yieldFactor').optional({ nullable: true }).isInt({ min: 60, max: 140 })
      .withMessage('El factor de rendimiento debe estar entre 60 y 140'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const { lotId } = req.params;
      const yieldFactor = req.body.yieldFactor ?? null;

      const { rowCount } = await query(
        'UPDATE coffee_harvests SET yield_factor = ? WHERE lot_id = ?',
        [yieldFactor, lotId]
      );

      if (!rowCount) {
        return res.status(404).json({ success: false, error: 'Lote no encontrado' });
      }

      await logAudit(req.user.id, 'update', 'coffee_harvest', lotId, { yieldFactor });
      res.json({ success: true, data: { lotId, yieldFactor } });
    } catch (err) {
      logger.error({ err }, '[PUT /api/fnc/lot/:lotId/yield-factor] Error');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// ===================================================
// COMPARATIVO
// ===================================================

// GET /api/fnc/comparison — pagado al caficultor vs. referencia FNC, por lote.
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
      const conditions = ['farmer_payment_cop > 0'];
      const params = [];

      if (req.query.from) {
        params.push(String(req.query.from).slice(0, 10));
        conditions.push('purchase_date >= ?');
      }
      if (req.query.to) {
        params.push(String(req.query.to).slice(0, 10));
        conditions.push('purchase_date <= ?');
      }

      // Los kilos de café verde mandan sobre los cosechados: la merma de secado
      // y selección ya la absorbió el café que efectivamente llegó a bodega, y
      // es ese el que se compara contra el excelso que cotiza la FNC.
      const { rows: lots } = await query(
        `SELECT * FROM (
           SELECT h.lot_id, h.farm, h.variety, h.region, h.yield_factor,
                  h.harvest_weight_kg,
                  (SELECT COALESCE(SUM(g.weight_kg), 0) FROM green_coffee_inventory g
                    WHERE g.lot_id = h.lot_id) AS green_kg,
                  (SELECT COALESCE(SUM(c.amount_cop), 0) FROM lot_costs c
                    WHERE c.lot_id = h.lot_id AND c.cost_type = 'farmer_payment') AS farmer_payment_cop,
                  (SELECT COALESCE(SUM(c.amount_cop), 0) FROM lot_costs c
                    WHERE c.lot_id = h.lot_id) AS total_cost_cop,
                  (SELECT MIN(date(c.recorded_at)) FROM lot_costs c
                    WHERE c.lot_id = h.lot_id AND c.cost_type = 'farmer_payment') AS purchase_date
             FROM coffee_harvests h
         )
         WHERE ${conditions.join(' AND ')}
         ORDER BY purchase_date DESC, lot_id DESC`,
        params
      );

      // Cada lote se compara contra el boletín vigente el día de su compra.
      const dates = [...new Set(lots.map((l) => l.purchase_date).filter(Boolean))];
      const priceByDate = new Map();

      for (const date of dates) {
        const { rows } = await query(
          'SELECT * FROM fnc_price_history WHERE price_date <= ? ORDER BY price_date DESC LIMIT 1',
          [date]
        );
        if (rows[0]) priceByDate.set(date, mapPriceRow(rows[0]));
      }

      // El boletín más antiguo sirve de referencia aproximada para las compras
      // anteriores al inicio del histórico.
      const { rows: oldestRows } = await query(
        'SELECT * FROM fnc_price_history ORDER BY price_date ASC LIMIT 1'
      );
      const oldest = mapPriceRow(oldestRows[0]);

      let totalPaid = 0;
      let totalReference = 0;
      let comparableKg = 0;

      const items = lots.map((lot) => {
        // Sin kilos no hay costo por kg y el lote no es comparable.
        const weight = num(lot.green_kg) || num(lot.harvest_weight_kg);
        const paid = num(lot.farmer_payment_cop);

        const exact = lot.purchase_date ? priceByDate.get(lot.purchase_date) : null;
        const price = exact ?? oldest;
        const factor = lot.yield_factor ?? price?.baseYieldFactor ?? null;
        const referencePerKg = excelsoRefForFactor(price, factor);

        const paidPerKg = weight > 0 ? paid / weight : null;
        const referenceTotal = referencePerKg !== null && weight > 0 ? referencePerKg * weight : null;
        const differenceTotal = referenceTotal === null ? null : paid - referenceTotal;

        if (referenceTotal !== null) {
          totalPaid += paid;
          totalReference += referenceTotal;
          comparableKg += weight;
        }

        const totalCost = num(lot.total_cost_cop);

        return {
          lotId: lot.lot_id,
          farm: lot.farm,
          variety: lot.variety,
          region: lot.region,
          purchaseDate: lot.purchase_date,
          weightKg: round2(weight),
          // De dónde salieron los kilos, para que el número sea auditable.
          weightSource: num(lot.green_kg) > 0 ? 'green_inventory' : 'harvest',
          paidTotalCop: round2(paid),
          paidCopKg: round2(paidPerKg),
          yieldFactor: factor,
          yieldFactorIsAssumed: lot.yield_factor === null || lot.yield_factor === undefined,
          referenceDate: price?.priceDate ?? null,
          referenceCopKg: round2(referencePerKg),
          referenceTotalCop: round2(referenceTotal),
          differenceCop: round2(differenceTotal),
          differencePct: referenceTotal ? round2((differenceTotal / referenceTotal) * 100) : null,
          // Costo acumulado del lote en todo el pipeline, no solo la compra.
          totalCostCop: round2(totalCost),
          totalCostCopKg: weight > 0 ? round2(totalCost / weight) : null,
          // El histórico no cubre esta fecha: se usó el boletín más antiguo.
          referenceIsApproximate: !exact && Boolean(oldest),
        };
      });

      res.json({
        success: true,
        data: {
          items,
          summary: {
            lots: items.length,
            comparableLots: items.filter((i) => i.referenceCopKg !== null).length,
            totalWeightKg: round2(comparableKg),
            totalPaidCop: round2(totalPaid),
            totalReferenceCop: round2(totalReference),
            differenceCop: round2(totalPaid - totalReference),
            differencePct: totalReference
              ? round2(((totalPaid - totalReference) / totalReference) * 100)
              : null,
            avgPaidCopKg: comparableKg ? round2(totalPaid / comparableKg) : null,
            avgReferenceCopKg: comparableKg ? round2(totalReference / comparableKg) : null,
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
