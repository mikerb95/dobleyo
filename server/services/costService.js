/**
 * Trazabilidad de costos de la línea de producción.
 *
 * Cada paso del pipeline puede registrar su costo: cosecha (pago al caficultor),
 * ingreso a bodega (transporte), envío a tostión (transporte), retiro de tostión
 * (maquila), almacén tostado (transporte de retorno) y empaque (bolsa+etiqueta).
 *
 * Los costos son opcionales: un paso sin costo se guarda igual y el lote queda
 * marcado como 'costeo incompleto'. Contabilizar tampoco bloquea — si el asiento
 * falla, el costo queda registrado con `accounting_entry_id` en NULL y se puede
 * contabilizar después.
 *
 * Costo por kg: el total pagado en cosecha queda fijo y se divide entre los kg
 * que realmente ingresan a bodega, no entre los kg cosechados. Así la merma de
 * secado y selección la absorbe el café utilizable. La misma regla aplica a la
 * merma de tostión: después del retiro, el costo acumulado se divide entre los
 * kg salidos del tostador.
 */
import { query } from '../db.js';
import { logger } from '../logger.js';
import { postCostEntry, reverseCostEntry } from './accountingService.js';
import { resolveRecordedAt } from '../utils/recordDate.js';

// ── Catálogo ─────────────────────────────────────────────────────────────────

/** Etapa del pipeline a la que pertenece cada tipo de costo. */
export const COST_TYPE_STAGE = {
  farmer_payment:         'harvest',
  transport_to_storage:   'green_storage',
  transport_to_roaster:   'sent_to_roasting',
  roasting_service:       'roast_retrieval',
  transport_to_warehouse: 'roasted_storage',
  packaging_material:     'packaging',
  labeling_material:      'packaging',
};

export const STAGE_LABEL = {
  harvest:          'Cosecha',
  green_storage:    'Ingreso a bodega',
  sent_to_roasting: 'Envío a tostión',
  roast_retrieval:  'Retiro de tostión',
  roasted_storage:  'Almacén de tostado',
  packaging:        'Empaque',
};

export const COST_TYPE_LABEL = {
  farmer_payment:         'Pago al caficultor',
  transport_to_storage:   'Transporte a bodega',
  transport_to_roaster:   'Transporte a tostadora',
  roasting_service:       'Proceso de tostión',
  transport_to_warehouse: 'Transporte de retorno',
  packaging_material:     'Empaque',
  labeling_material:      'Etiqueta',
  other:                  'Otro',
};

const PAYMENT_METHODS = ['caja', 'banco', 'credito'];

function bizError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Redondeo a peso colombiano: no se manejan centavos. */
function roundCop(value) {
  return Math.round(parseFloat(value) || 0);
}

// ── Registro de un costo ─────────────────────────────────────────────────────

/**
 * Registra un costo del pipeline y su asiento en borrador.
 *
 * Idempotente por (source_table, source_id, cost_type): si el paso ya tenía ese
 * costo — reintento de la cola offline móvil — se actualiza en vez de duplicar.
 *
 * @param {object} input
 * @param {string} input.lotId
 * @param {string} input.costType     Clave de COST_TYPE_STAGE
 * @param {number} input.amount       Monto total en COP
 * @param {number} [input.qtyKg]      Kg a los que aplica el costo
 * @param {number} [input.qtyUnits]   Unidades cuando el costo es unitario
 * @param {string} [input.paymentMethod] 'caja' | 'banco' | 'credito'
 * @param {string} [input.sourceTable]
 * @param {number} [input.sourceId]
 * @param {number} [input.supplyId]   Insumo de empaque que originó el costo
 * @param {number} [input.partnerId]  Caficultor/proveedor para el crédito a CxP
 * @param {string} [input.recordedAt] Fecha real del costo
 * @param {object} [input.user]
 * @param {string} [input.notes]
 * @returns {Promise<{costId: number, accounted: boolean, entryId: number|null}>}
 */
export async function recordCost({
  lotId, costType, amount, qtyKg, qtyUnits, paymentMethod = 'caja',
  sourceTable, sourceId, supplyId, partnerId, recordedAt, user, notes,
}) {
  if (!lotId) throw bizError(400, 'Lote requerido para registrar el costo');

  const stage = COST_TYPE_STAGE[costType];
  if (!stage) throw bizError(400, `Tipo de costo no reconocido: ${costType}`);

  const amountCop = roundCop(amount);
  if (!isFinite(amountCop) || amountCop <= 0) throw bizError(400, 'El costo debe ser un monto positivo');

  const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'caja';
  const at = resolveRecordedAt(recordedAt) || new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Un costo por (paso, tipo): el reintento actualiza el monto en vez de sumar
  // uno nuevo. El asiento anterior se reversa dentro de updateCost.
  if (sourceTable && sourceId) {
    const { rows: existing } = await query(
      'SELECT id FROM lot_costs WHERE source_table = ? AND source_id = ? AND cost_type = ?',
      [sourceTable, sourceId, costType]
    );
    if (existing.length) {
      const updated = await updateCost(existing[0].id, { amount: amountCop, paymentMethod: method, notes }, user);
      return { costId: existing[0].id, accounted: updated.accounted, entryId: updated.entryId, updated: true };
    }
  }

  const { rows } = await query(
    `INSERT INTO lot_costs
       (lot_id, stage, cost_type, amount_cop, qty_kg, qty_units, payment_method,
        source_table, source_id, supply_id, partner_id, notes, created_by, recorded_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now')) RETURNING id`,
    [lotId, stage, costType, amountCop,
     qtyKg != null ? parseFloat(qtyKg) : null,
     qtyUnits != null ? parseInt(qtyUnits, 10) : null,
     method, sourceTable || null, sourceId || null, supplyId || null,
     partnerId || null, notes || null, user?.id || null, at]
  );
  const costId = rows[0].id;

  // La contabilización no bloquea la operación en campo.
  const { entryId } = await tryPostEntry({
    costId, lotId, costType, amount: amountCop, paymentMethod: method,
    entryDate: at.slice(0, 10), partnerId, fromSupply: Boolean(supplyId),
    userId: user?.id, notes,
  });

  return { costId, accounted: entryId != null, entryId };
}

/** Contabiliza un costo sin dejar que un fallo tumbe el paso de producción. */
async function tryPostEntry({ costId, lotId, costType, amount, paymentMethod, entryDate, partnerId, fromSupply, userId, notes }) {
  try {
    const { entryId, entryNumber } = await postCostEntry({
      lotId, costType, amount, paymentMethod, entryDate, partnerId,
      partnerKind: costType === 'farmer_payment' ? 'farmer' : 'supplier',
      fromSupply, userId, notes,
    });
    await query("UPDATE lot_costs SET accounting_entry_id = ?, updated_at = datetime('now') WHERE id = ?", [entryId, costId]);
    return { entryId, entryNumber };
  } catch (err) {
    logger.error({ err, costId, lotId, costType }, 'No se pudo contabilizar el costo; queda pendiente');
    return { entryId: null, entryNumber: null };
  }
}

// ── Corrección ───────────────────────────────────────────────────────────────

/**
 * Corrige un costo ya registrado. Reversa el asiento anterior y emite uno nuevo.
 * El historial queda en `audit_logs` (lo registra el router).
 */
export async function updateCost(costId, { amount, paymentMethod, notes, partnerId }, user) {
  const { rows } = await query('SELECT * FROM lot_costs WHERE id = ?', [costId]);
  if (!rows.length) throw bizError(404, 'Costo no encontrado');
  const cost = rows[0];

  const amountCop = amount != null ? roundCop(amount) : parseFloat(cost.amount_cop);
  if (!isFinite(amountCop) || amountCop <= 0) throw bizError(400, 'El costo debe ser un monto positivo');

  const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : cost.payment_method;
  const newPartnerId = partnerId !== undefined ? partnerId : cost.partner_id;

  if (cost.accounting_entry_id) {
    try {
      await reverseCostEntry(cost.accounting_entry_id, { userId: user?.id, reason: 'Corrección de costo de producción' });
    } catch (err) {
      logger.error({ err, costId }, 'No se pudo reversar el asiento del costo');
    }
  }

  await query(
    `UPDATE lot_costs
        SET amount_cop = ?, payment_method = ?, notes = ?, partner_id = ?,
            accounting_entry_id = NULL, updated_at = datetime('now')
      WHERE id = ?`,
    [amountCop, method, notes !== undefined ? notes : cost.notes, newPartnerId, costId]
  );

  const { entryId } = await tryPostEntry({
    costId, lotId: cost.lot_id, costType: cost.cost_type, amount: amountCop,
    paymentMethod: method, entryDate: String(cost.recorded_at).slice(0, 10),
    partnerId: newPartnerId, fromSupply: Boolean(cost.supply_id),
    userId: user?.id, notes: notes !== undefined ? notes : cost.notes,
  });

  return { costId, accounted: entryId != null, entryId, previous: cost };
}

/** Elimina un costo y reversa su asiento. */
export async function deleteCost(costId, user) {
  const { rows } = await query('SELECT * FROM lot_costs WHERE id = ?', [costId]);
  if (!rows.length) throw bizError(404, 'Costo no encontrado');
  const cost = rows[0];

  if (cost.accounting_entry_id) {
    try {
      await reverseCostEntry(cost.accounting_entry_id, { userId: user?.id, reason: 'Eliminación de costo de producción' });
    } catch (err) {
      logger.error({ err, costId }, 'No se pudo reversar el asiento al eliminar el costo');
    }
  }

  await query('DELETE FROM lot_costs WHERE id = ?', [costId]);
  return cost;
}

// ── Consulta ─────────────────────────────────────────────────────────────────

/** Costos de un lote, en orden cronológico. */
export async function getLotCosts(lotId) {
  const { rows } = await query(
    `SELECT lc.*, ps.name AS supply_name, ae.entry_number, ae.state AS entry_state,
            u.first_name || ' ' || COALESCE(u.last_name, '') AS created_by_name
       FROM lot_costs lc
       LEFT JOIN packaging_supplies ps ON ps.id = lc.supply_id
       LEFT JOIN accounting_entries ae ON ae.id = lc.accounting_entry_id
       LEFT JOIN users u ON u.id = lc.created_by
      WHERE lc.lot_id = ?
      ORDER BY lc.recorded_at ASC, lc.id ASC`,
    [lotId]
  );
  return rows.map(r => ({
    ...r,
    stage_label: STAGE_LABEL[r.stage] || r.stage,
    cost_type_label: COST_TYPE_LABEL[r.cost_type] || r.cost_type,
  }));
}

/**
 * Pesos del lote a lo largo del pipeline. Son los denominadores del costo/kg.
 *
 * - `harvested`: lo que se recogió en finca (puede no estar registrado).
 * - `green`: lo que realmente ingresó a bodega — divide el costo de origen.
 * - `roasted`: lo que salió del tostador — absorbe la merma de tostión.
 * - `packaged`: kg efectivamente empacados.
 */
async function getLotWeights(lotId) {
  const [harvest, green, sent, roasted, packaged] = await Promise.all([
    // El peso de origen es el de la compra al caficultor, el mismo dato que usa
    // el comparativo de precio FNC. No se duplica en otra columna.
    query('SELECT COALESCE(SUM(purchase_weight_kg), 0) AS kg FROM coffee_harvests WHERE lot_id = ?', [lotId]),
    query('SELECT COALESCE(SUM(weight_kg), 0) AS kg FROM green_coffee_inventory WHERE lot_id = ?', [lotId]),
    query('SELECT COALESCE(SUM(quantity_sent_kg), 0) AS kg FROM roasting_batches WHERE lot_id = ?', [lotId]),
    query(
      `SELECT COALESCE(SUM(rc.weight_kg), 0) AS kg
         FROM roasted_coffee rc JOIN roasting_batches rb ON rb.id = rc.roasting_id
        WHERE rb.lot_id = ?`, [lotId]
    ),
    query(
      `SELECT COALESCE(SUM(CASE WHEN pc.package_size = 'bulk' THEN pc.unit_count
                                WHEN pc.package_size = '100g' THEN pc.unit_count * 0.1
                                WHEN pc.package_size = '250g' THEN pc.unit_count * 0.25
                                WHEN pc.package_size = '500g' THEN pc.unit_count * 0.5
                                WHEN pc.package_size = '1kg'  THEN pc.unit_count * 1.0
                                ELSE 0 END), 0) AS kg,
              COALESCE(SUM(CASE WHEN pc.package_size = 'bulk' THEN 0 ELSE pc.unit_count END), 0) AS units
         FROM packaged_coffee pc
         JOIN roasted_coffee_inventory rci ON rci.id = pc.roasted_storage_id
         JOIN roasted_coffee rc ON rc.id = rci.roasted_id
         JOIN roasting_batches rb ON rb.id = rc.roasting_id
        WHERE rb.lot_id = ?`, [lotId]
    ),
  ]);

  return {
    harvested_kg: parseFloat(harvest.rows[0].kg) || 0,
    green_kg:     parseFloat(green.rows[0].kg) || 0,
    sent_kg:      parseFloat(sent.rows[0].kg) || 0,
    roasted_kg:   parseFloat(roasted.rows[0].kg) || 0,
    packaged_kg:  parseFloat(packaged.rows[0].kg) || 0,
    packaged_units: parseInt(packaged.rows[0].units, 10) || 0,
  };
}

/**
 * Resumen de costeo de un lote: total por etapa, costo por kg en cada punto del
 * proceso y costo unitario del producto empacado.
 *
 * El costo/kg se recalcula en cada transformación porque el denominador cambia:
 * lo que se paga por 100 kg de cereza no rinde 100 kg de café tostado.
 */
export async function getLotCostSummary(lotId) {
  const [costs, weights] = await Promise.all([getLotCosts(lotId), getLotWeights(lotId)]);

  const byStage = {};
  for (const stage of Object.keys(STAGE_LABEL)) {
    byStage[stage] = { stage, label: STAGE_LABEL[stage], amount_cop: 0, items: [] };
  }
  for (const c of costs) {
    const bucket = byStage[c.stage];
    if (!bucket) continue;
    bucket.amount_cop += parseFloat(c.amount_cop) || 0;
    bucket.items.push({
      id: c.id, cost_type: c.cost_type, label: c.cost_type_label,
      amount_cop: parseFloat(c.amount_cop) || 0, qty_kg: c.qty_kg, qty_units: c.qty_units,
      payment_method: c.payment_method, recorded_at: c.recorded_at,
      entry_number: c.entry_number, entry_state: c.entry_state, supply_name: c.supply_name,
    });
  }

  const stageTotal = (s) => byStage[s].amount_cop;

  // Costo acumulado en cada punto del proceso.
  const greenCost    = stageTotal('harvest') + stageTotal('green_storage');
  const processCost  = greenCost + stageTotal('sent_to_roasting') + stageTotal('roast_retrieval');
  const roastedCost  = processCost + stageTotal('roasted_storage');
  const packagingCost = stageTotal('packaging');
  const totalCost    = roastedCost + packagingCost;

  // Denominadores. El café verde manda sobre los kg cosechados: la merma de
  // secado ya la absorbió el café que sí llegó a bodega.
  const greenKg   = weights.green_kg || weights.harvested_kg || 0;
  const roastedKg = weights.roasted_kg || 0;

  const perKg = (amount, kg) => (kg > 0 ? Math.round(amount / kg) : null);

  // Costo unitario del empacado: el café tostado que lleva el paquete más sus
  // insumos, prorrateados entre las unidades efectivamente empacadas.
  const coffeeCostPerRoastedKg = perKg(roastedCost, roastedKg);
  const unitCost = weights.packaged_units > 0
    ? Math.round(
        (coffeeCostPerRoastedKg != null
          ? coffeeCostPerRoastedKg * (weights.packaged_kg / weights.packaged_units)
          : 0) + packagingCost / weights.packaged_units
      )
    : null;

  // Etapas alcanzadas por el lote que no tienen costo digitado.
  const missing = [];
  if (weights.harvested_kg === 0) missing.push('harvest_weight');
  for (const [stage, reached] of [
    ['harvest', true],
    ['green_storage', weights.green_kg > 0],
    ['sent_to_roasting', weights.sent_kg > 0],
    ['roast_retrieval', weights.roasted_kg > 0],
    ['roasted_storage', weights.roasted_kg > 0],
    ['packaging', weights.packaged_kg > 0],
  ]) {
    if (reached && byStage[stage].amount_cop === 0) missing.push(stage);
  }

  return {
    lot_id: lotId,
    weights,
    // Merma acumulada, para leer el costo/kg en contexto.
    shrinkage: {
      drying_pct: weights.harvested_kg > 0
        ? parseFloat((((weights.harvested_kg - weights.green_kg) / weights.harvested_kg) * 100).toFixed(2))
        : null,
      roasting_pct: weights.sent_kg > 0
        ? parseFloat((((weights.sent_kg - weights.roasted_kg) / weights.sent_kg) * 100).toFixed(2))
        : null,
    },
    by_stage: Object.values(byStage),
    totals: {
      green_cop: Math.round(greenCost),
      process_cop: Math.round(processCost),
      roasted_cop: Math.round(roastedCost),
      packaging_cop: Math.round(packagingCost),
      total_cop: Math.round(totalCost),
    },
    cost_per_kg: {
      green: perKg(greenCost, greenKg),
      roasted: coffeeCostPerRoastedKg,
    },
    unit_cost_cop: unitCost,
    pending_accounting: costs.filter(c => !c.accounting_entry_id).length,
    missing_stages: missing,
    complete: missing.length === 0,
  };
}

/**
 * Listado de lotes con su costeo, para la vista /admin/costos.
 * Trae el precio de venta del producto asociado para calcular el margen.
 */
export async function getCostOverview({ limit = 100, offset = 0 } = {}) {
  const { rows: lots } = await query(
    `SELECT ch.lot_id, ch.farm, ch.variety, ch.process, ch.harvest_weight_kg, ch.created_at
       FROM coffee_harvests ch
      ORDER BY ch.created_at DESC
      LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const summaries = await Promise.all(lots.map(async (lot) => {
    const summary = await getLotCostSummary(lot.lot_id);

    // Precio de venta de referencia: el producto generado en el empaque de este lote.
    const { rows: priced } = await query(
      `SELECT p.price, p.weight, p.weight_unit
         FROM products p
        WHERE p.id LIKE ? AND p.is_active = 1
        ORDER BY p.created_at DESC LIMIT 1`,
      [`%${lot.lot_id}%`]
    );
    const price = priced.length ? parseInt(priced[0].price, 10) : null;

    const margin = (price != null && summary.unit_cost_cop != null && price > 0)
      ? parseFloat((((price - summary.unit_cost_cop) / price) * 100).toFixed(1))
      : null;

    return {
      lot_id: lot.lot_id, farm: lot.farm, variety: lot.variety, process: lot.process,
      created_at: lot.created_at,
      ...summary,
      sale_price_cop: price,
      margin_pct: margin,
    };
  }));

  const { rows: countRows } = await query('SELECT COUNT(*) AS cnt FROM coffee_harvests');
  return { lots: summaries, total: parseInt(countRows[0].cnt, 10) };
}

// ── Insumos de empaque ───────────────────────────────────────────────────────

export async function getSupplies({ activeOnly = true } = {}) {
  const { rows } = await query(
    `SELECT * FROM packaging_supplies ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY type, size_label, name`
  );
  return rows;
}

/**
 * Consume insumos de empaque: descuenta stock, deja el movimiento y devuelve el
 * costo total. El stock puede quedar en negativo — el empaque físico ya ocurrió
 * y bloquearlo por un maestro desactualizado frenaría la operación; el faltante
 * queda visible en el listado de insumos.
 */
export async function consumeSupply({ supplyId, units, lotId, sourceTable, sourceId, user }, tx) {
  const q = tx ? tx.query : query;

  const { rows } = await q('SELECT id, name, unit_cost_cop, stock_units FROM packaging_supplies WHERE id = ? AND is_active = 1', [supplyId]);
  if (!rows.length) throw bizError(404, 'Insumo de empaque no encontrado');
  const supply = rows[0];

  const unitsNum = parseInt(units, 10);
  if (!Number.isInteger(unitsNum) || unitsNum <= 0) throw bizError(400, 'Cantidad de insumo inválida');

  const before = parseInt(supply.stock_units, 10) || 0;
  const after = before - unitsNum;
  const unitCost = parseFloat(supply.unit_cost_cop) || 0;

  await q("UPDATE packaging_supplies SET stock_units = ?, updated_at = datetime('now') WHERE id = ?", [after, supplyId]);
  await q(
    `INSERT INTO packaging_supply_movements
       (supply_id, movement_type, quantity, quantity_before, quantity_after, unit_cost_cop,
        reason, lot_id, source_table, source_id, user_id, created_at)
     VALUES (?, 'salida', ?, ?, ?, ?, 'Consumo en empaque', ?, ?, ?, ?, datetime('now'))`,
    [supplyId, unitsNum, before, after, unitCost, lotId || null, sourceTable || null, sourceId || null, user?.id || null]
  );

  return {
    supplyId, name: supply.name, units: unitsNum,
    unitCost, totalCost: Math.round(unitCost * unitsNum),
    stockAfter: after, stockShort: after < 0,
  };
}

export const __testing = { roundCop, getLotWeights };
