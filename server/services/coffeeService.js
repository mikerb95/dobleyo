/**
 * Servicio de pipeline de café: cosecha → verde → tostión → almacén → empaque → venta.
 * Todas las funciones son puras (sin req/res) — lanzan errores con { status, message } en fallas de negocio.
 */
import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import { assertCanAdvance, getCurrentStage, STAGE_LABELS } from './lotStateMachine.js';
import { postMovement, issueFromLotFIFO, resolveLocationForIntake } from './storageService.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function bizError(status, message, detail) {
  const err = new Error(message);
  err.status = status;
  if (detail) err.detail = detail;
  return err;
}

const FARM_MAP = {
  'finca-la-sierra': { region: 'HUI', altitude: 1800 },
  'finca-nariño':    { region: 'NAR', altitude: 1900 },
  'finca-cauca':     { region: 'CAU', altitude: 1750 },
};

const PACKAGE_KG = { '100g': 0.1, '250g': 0.25, '500g': 0.5, '1kg': 1.0 };

// ── 1. Cosecha ───────────────────────────────────────────────────────────────

export async function createHarvest({ farm, region, altitude, variety, climate, process, aroma, tasteNotes }) {
  if (!farm || !variety || !climate || !process || !aroma || !tasteNotes) {
    throw bizError(400, 'Faltan campos requeridos');
  }

  let farmRegion = region;
  let farmAltitude = altitude;

  if (!farmRegion || !farmAltitude) {
    const info = FARM_MAP[farm];
    if (info) { farmRegion = info.region; farmAltitude = info.altitude; }
  }

  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const lotId = `COL-${farmRegion}-${farmAltitude}-${variety}-${process}-${suffix}`;

  const result = await query(
    `INSERT INTO coffee_harvests (lot_id, farm, region, altitude, variety, climate, process, aroma, taste_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING id`,
    [lotId, farm, farmRegion, farmAltitude, variety, climate, process, aroma, tasteNotes]
  );

  return { lotId, harvestId: result.rows[0].id };
}

// ── 2. Almacenamiento verde ──────────────────────────────────────────────────

export async function storeGreenCoffee({ lotId, weight, weightUnit, location, storageDate, notes, user, movementUid }) {
  if (!lotId || !weight || !location || !storageDate) {
    throw bizError(400, 'Faltan campos requeridos');
  }

  await assertCanAdvance(query, lotId, 'in_storage_green');

  const harvest = await query('SELECT id FROM coffee_harvests WHERE lot_id = ?', [lotId]);
  if (!harvest.rows.length) throw bizError(404, 'Lote no encontrado');
  const harvestId = harvest.rows[0].id;

  const weightNum = parseFloat(weight);
  if (!isFinite(weightNum) || weightNum <= 0) throw bizError(400, 'Peso inválido');
  const weightKg = weightUnit === 'lb' ? parseFloat((weightNum * 0.453592).toFixed(3)) : weightNum;

  // La ubicación deja de ser texto libre: se valida contra el maestro (activa,
  // no bloqueada y apta para café verde) antes de escribir nada.
  const loc = await resolveLocationForIntake(location, 'green');

  // El registro de inventario y el asiento en el ledger son una sola operación:
  // no puede existir uno sin el otro.
  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, location_id, storage_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING id`,
      [harvestId, lotId, weightKg, loc.code, loc.id, storageDate, notes || null]
    );
    const storageId = result.rows[0].id;

    await postMovement({
      type: 'receipt', to: loc.id, lotId, stockState: 'green', qtyKg: weightKg,
      sourceTable: 'green_coffee_inventory', sourceId: storageId,
      reasonCode: 'harvest_intake', notes: notes || null,
      movementUid: movementUid || `green-in:${storageId}`, user,
    }, tx);

    return { storageId, location: loc.code };
  });
}

// ── 3. Enviar a tostión ──────────────────────────────────────────────────────

export async function sendToRoasting({ lotId, quantitySent, targetTemp, notes, user, movementUid }) {
  if (!lotId || !quantitySent) throw bizError(400, 'Faltan campos requeridos');

  await assertCanAdvance(query, lotId, 'sent_to_roasting');

  const quantitySentNum = parseFloat(quantitySent);
  if (!isFinite(quantitySentNum) || quantitySentNum <= 0) throw bizError(400, 'Cantidad inválida');

  // La disponibilidad ya no se estima restando tablas: sale de los quants, que
  // son la proyección del ledger. issueFromLotFIFO la valida y retira en la
  // misma transacción, así dos envíos simultáneos no pueden sobregirar el lote.
  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO roasting_batches (lot_id, quantity_sent_kg, target_temp, notes, status, created_at)
       VALUES (?, ?, ?, ?, 'in_roasting', datetime('now')) RETURNING id`,
      [lotId, quantitySentNum, targetTemp ? parseInt(targetTemp) : null, notes || null]
    );
    const roastingId = result.rows[0].id;

    const { issued } = await issueFromLotFIFO(tx, {
      lotId, stockState: 'green', qtyKg: quantitySentNum,
      sourceTable: 'roasting_batches', sourceId: roastingId,
      reasonCode: 'sent_to_roasting', notes: notes || null,
      uidPrefix: movementUid || `roast-out:${roastingId}`, user,
    });

    return { roastingId, issuedFrom: issued };
  });
}

// ── 4. Recoger del tueste ────────────────────────────────────────────────────

export async function receiveRoasted({ roastingId, roastLevel, roastedWeight, actualTemp, roastTime, observations }) {
  if (!roastingId || !roastLevel || !roastedWeight) throw bizError(400, 'Faltan campos requeridos');

  const roastingResult = await query(
    'SELECT quantity_sent_kg, lot_id FROM roasting_batches WHERE id = ?', [roastingId]
  );
  if (!roastingResult.rows.length) throw bizError(404, 'Lote en tostión no encontrado');

  const { quantity_sent_kg: quantitySent, lot_id: roastLotId } = roastingResult.rows[0];
  const roastedWeightNum = parseFloat(roastedWeight);
  const quantitySentNum  = parseFloat(quantitySent);

  if (!isFinite(roastedWeightNum) || roastedWeightNum <= 0) {
    throw bizError(400, 'Peso tostado inválido: debe ser mayor a 0');
  }
  if (roastedWeightNum >= quantitySentNum) {
    throw bizError(400, 'El peso tostado no puede ser igual o mayor al peso enviado (siempre hay pérdida por evaporación)', {
      sent_kg: quantitySentNum, received_kg: roastedWeightNum,
    });
  }
  const minReasonable = parseFloat((quantitySentNum * 0.60).toFixed(3));
  if (roastedWeightNum < minReasonable) {
    throw bizError(400,
      `Peso tostado inusualmente bajo (${roastedWeightNum} kg). Evaporación máxima esperada ~35%. Mínimo razonable: ${minReasonable} kg`,
      { sent_kg: quantitySentNum, received_kg: roastedWeightNum, min_reasonable_kg: minReasonable }
    );
  }

  if (roastLotId) await assertCanAdvance(query, roastLotId, 'roasted');

  const weightLossPercent = parseFloat(((quantitySentNum - roastedWeightNum) / quantitySentNum * 100).toFixed(2));

  const result = await query(
    `INSERT INTO roasted_coffee (roasting_id, roast_level, weight_kg, weight_loss_percent, actual_temp, roast_time_minutes, observations, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ready_for_storage', datetime('now')) RETURNING id`,
    [roastingId, roastLevel, roastedWeightNum, weightLossPercent,
     actualTemp ? parseInt(actualTemp) : null, roastTime ? parseInt(roastTime) : null, observations || null]
  );

  await query('UPDATE roasting_batches SET status = ? WHERE id = ?', ['completed', roastingId]);

  return { roastedId: result.rows[0].id, weightLossPercent };
}

// ── 5. Almacenar tostado ─────────────────────────────────────────────────────

export async function storeRoasted({ roastedId, location, container, containerCount, conditions, notes, user, movementUid }) {
  if (!roastedId || !location || !container || !containerCount) throw bizError(400, 'Faltan campos requeridos');

  const roastedResult = await query(
    `SELECT rc.weight_kg, rb.lot_id FROM roasted_coffee rc
     JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rc.id = ?`, [roastedId]
  );
  if (!roastedResult.rows.length) throw bizError(404, 'Café tostado no encontrado');

  const { lot_id: storageLotId, weight_kg: roastedWeightKg } = roastedResult.rows[0];
  if (storageLotId) await assertCanAdvance(query, storageLotId, 'in_storage_roasted');

  // Valida contra el maestro: activa, no bloqueada y apta para café tostado.
  const loc = await resolveLocationForIntake(location, 'roasted');

  const conditionsStr = (Array.isArray(conditions) && conditions.length) ? conditions.join(',') : null;
  const containers = parseInt(containerCount, 10) || 0;

  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO roasted_coffee_inventory (roasted_id, location, location_id, container_type, container_count, storage_conditions, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready_for_packaging', datetime('now')) RETURNING id`,
      [roastedId, loc.code, loc.id, container, containers, conditionsStr, notes || null]
    );
    const storageId = result.rows[0].id;

    await tx.query('UPDATE roasted_coffee SET status = ? WHERE id = ?', ['stored', roastedId]);

    // La validación de capacidad de la ubicación ocurre aquí dentro: si el
    // estante no da, el registro de almacenamiento tampoco se guarda.
    await postMovement({
      type: 'receipt', to: loc.id, lotId: storageLotId || 'SIN-LOTE', stockState: 'roasted',
      qtyKg: roastedWeightKg, containerType: container, containerCount: containers,
      sourceTable: 'roasted_coffee_inventory', sourceId: storageId,
      reasonCode: 'roast_intake', notes: notes || null,
      movementUid: movementUid || `roasted-in:${storageId}`, user,
    }, tx);

    return { storageId, location: loc.code };
  });
}

// ── 5.1 Detalle de almacenamiento tostado ────────────────────────────────────

export async function getRoastedStorageDetail(id) {
  const result = await query(
    `SELECT rci.id, rci.location, rci.container_type as container, rci.container_count,
            rci.storage_conditions as conditions, rci.notes, rci.created_at as storage_date,
            rc.weight_kg, rc.roast_level, rb.lot_id,
            ch.variety, ch.climate, ch.region, ch.altitude, ch.process, ch.aroma, ch.taste_notes
     FROM roasted_coffee_inventory rci
     LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
     LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
     WHERE rci.id = ?`, [id]
  );
  if (!result.rows.length) throw bizError(404, 'Almacenamiento no encontrado');

  const d = result.rows[0];
  return { ...d, conditions: d.conditions ? d.conditions.split(',') : [] };
}

// ── 6. Empaque ───────────────────────────────────────────────────────────────

export async function createPackaging({ roastedStorageId, acidity, body, balance, presentation, grindSize, packageSize, unitCount, notes, addToInventory, user, movementUid }) {
  if (!roastedStorageId || !acidity || !body || !balance || !presentation || !packageSize || !unitCount) {
    throw bizError(400, 'Faltan campos requeridos');
  }
  if (presentation === 'MOLIDO' && !grindSize) {
    throw bizError(400, 'Debe especificar tipo de molienda');
  }

  const [acidityInt, bodyInt, balanceInt] = [parseInt(acidity, 10), parseInt(body, 10), parseInt(balance, 10)];
  if ([acidityInt, bodyInt, balanceInt].some(v => !Number.isInteger(v) || v < 1 || v > 5)) {
    throw bizError(400, 'Los atributos sensoriales deben ser enteros entre 1 y 5');
  }
  const score = parseFloat(((acidityInt + bodyInt + balanceInt) / 3).toFixed(2));

  const roastedResult = await query(
    `SELECT rci.*, rc.roast_level, rc.weight_kg, rb.lot_id,
            ch.region, ch.farm, ch.variety, ch.process, ch.aroma, ch.taste_notes
     FROM roasted_coffee_inventory rci
     LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
     LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
     WHERE rci.id = ?`, [roastedStorageId]
  );
  if (!roastedResult.rows.length) throw bizError(404, 'Café tostado no encontrado en inventario');
  const roastedInfo = roastedResult.rows[0];

  const unitCountNum = parseInt(unitCount, 10);
  if (!Number.isInteger(unitCountNum) || unitCountNum <= 0) throw bizError(400, 'Cantidad de unidades inválida');

  const availableWeightKg = parseFloat(roastedInfo.weight_kg) || 0;
  if (availableWeightKg <= 0) throw bizError(400, 'No hay peso disponible en este lote tostado');

  // Peso que consume este empaque. A granel, unitCount se expresa en kilos.
  let consumedKg;
  if (packageSize !== 'bulk') {
    const packageKg = PACKAGE_KG[packageSize];
    if (!packageKg) throw bizError(400, `Tamaño de paquete no reconocido: ${packageSize}`);
    consumedKg = parseFloat((unitCountNum * packageKg).toFixed(3));
    if (consumedKg > availableWeightKg) {
      throw bizError(400, `Peso requerido (${consumedKg} kg) supera el disponible (${availableWeightKg} kg)`, {
        unit_count: unitCountNum, package_size: packageSize, required_kg: consumedKg,
        available_kg: availableWeightKg, max_units: Math.floor(availableWeightKg / packageKg),
      });
    }
  } else {
    consumedKg = unitCountNum;
    if (consumedKg > availableWeightKg) {
      throw bizError(400, `Peso a granel (${consumedKg} kg) supera el disponible (${availableWeightKg} kg)`, {
        unit_count: unitCountNum, package_size: packageSize, required_kg: consumedKg,
        available_kg: availableWeightKg, max_units: Math.floor(availableWeightKg),
      });
    }
  }

  // Peso que queda tras este empaque. Si no alcanza para el paquete más
  // pequeño, el lote se cierra; si no, sigue disponible para empaques parciales.
  const remainingKg = parseFloat((availableWeightKg - consumedKg).toFixed(3));
  const minPackageKg = Math.min(...Object.values(PACKAGE_KG));
  const lotExhausted = remainingKg < minPackageKg;

  if (roastedInfo.lot_id) await assertCanAdvance(query, roastedInfo.lot_id, 'packaged');

  return withTransaction(async ({ query: txq }) => {
    const result = await txq(
      `INSERT INTO packaged_coffee (roasted_storage_id, acidity, body, balance, score, presentation, grind_size, package_size, unit_count, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready_for_sale', datetime('now')) RETURNING id`,
      [roastedStorageId, acidityInt, bodyInt, balanceInt, score, presentation, grindSize || null, packageSize, unitCountNum, notes || null]
    );

    // Descuento del peso consumido: sin esto el remanente del lote se perdía.
    if (roastedInfo.roasted_id) {
      await txq('UPDATE roasted_coffee SET weight_kg = ? WHERE id = ?', [remainingKg, roastedInfo.roasted_id]);
    }
    if (lotExhausted) {
      await txq('UPDATE roasted_coffee_inventory SET status = ? WHERE id = ?', ['packaged', roastedStorageId]);
    }

    // Salida del estante por el peso realmente consumido. Un empaque parcial
    // descuenta solo lo empacado; el remanente sigue contabilizado en bodega.
    if (roastedInfo.location_id && consumedKg > 0) {
      await postMovement({
        type: 'issue', from: roastedInfo.location_id,
        lotId: roastedInfo.lot_id || 'SIN-LOTE', stockState: 'roasted', qtyKg: consumedKg,
        containerCount: lotExhausted ? (parseInt(roastedInfo.container_count, 10) || 0) : 0,
        sourceTable: 'packaged_coffee', sourceId: result.rows[0].id,
        reasonCode: 'packaging', notes: notes || null,
        movementUid: movementUid || `pack-out:${result.rows[0].id}`, user,
      }, { query: txq });
    }

    let productId = null;
    let inventoryMovementCreated = false;

    if (addToInventory === true) {
      const suffix = crypto.randomBytes(3).toString('hex');
      productId = `CAFE-${roastedInfo.lot_id || 'GEN'}-${packageSize.replace(/[^a-zA-Z0-9-]/g, '')}-${suffix}`.substring(0, 50);
      const presentationLabel = presentation === 'GRANO' ? 'Grano' : `Molido ${grindSize ?? ''}`.trim();
      const productName = `Café ${roastedInfo.lot_id || 'Premium'} - ${packageSize} (${presentationLabel})`;
      const roastLevel = roastedInfo.roast_level || 'medium';
      const origin = roastedInfo.region || 'Colombia';
      const harvestProcess = roastedInfo.process || null;
      // A granel la unidad de stock es 1 kg; en bolsa, el peso nominal en gramos.
      const weightUnit = packageSize === 'bulk' ? 'kg' : 'g';
      const weightValue = packageSize === 'bulk' ? 1 : packageSize === '1kg' ? 1000 : parseInt(packageSize, 10);

      await txq(
        `INSERT INTO products (id, name, category, origin, process, roast, price, cost, is_active, stock_quantity, stock_min, weight, weight_unit, created_at)
         VALUES (?, ?, 'cafe', ?, ?, ?, 0, 0, 0, ?, 0, ?, ?, datetime('now'))`,
        [productId, productName, origin, harvestProcess, roastLevel, unitCountNum, weightValue, weightUnit]
      );
      await txq(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, created_at)
         VALUES (?, 'entrada', ?, 0, ?, 'Café empacado para venta', ?, datetime('now'))`,
        [productId, unitCountNum, unitCountNum, roastedInfo.lot_id || 'packaging']
      );
      inventoryMovementCreated = true;
    }

    return {
      packagedId: result.rows[0].id,
      productId, score, inventoryMovementCreated,
      lotId: roastedInfo.lot_id || null,
      consumedKg, remainingKg, lotExhausted,
    };
  });
}

// ── Queries de lista ─────────────────────────────────────────────────────────

export async function getHarvests() {
  const { rows } = await query('SELECT * FROM coffee_harvests ORDER BY created_at DESC LIMIT 100');
  return rows;
}

export async function getGreenInventory() {
  const { rows } = await query('SELECT * FROM green_coffee_inventory ORDER BY created_at DESC LIMIT 100');
  return rows;
}

export async function getRoastingBatches() {
  const { rows } = await query(
    `SELECT * FROM roasting_batches WHERE status = ? ORDER BY created_at DESC LIMIT 100`, ['in_roasting']
  );
  return rows;
}

export async function getRoastedCoffee() {
  const { rows } = await query(
    `SELECT rci.id, rci.roasted_id, rci.location, rci.container_type, rci.container_count, rci.status,
            rc.roast_level, rc.weight_kg, rc.weight_loss_percent, rb.lot_id,
            COALESCE(ch.farm, '') as farm, COALESCE(ch.farm, '') as farm_name,
            COALESCE(ch.region, '') as region, COALESCE(ch.altitude, 0) as altitude,
            COALESCE(ch.variety, '') as variety, COALESCE(ch.climate, '') as climate,
            COALESCE(ch.process, '') as process, COALESCE(ch.aroma, '') as aroma,
            COALESCE(ch.taste_notes, '') as taste_notes, COALESCE(ch.taste_notes, '') as notes
     FROM roasted_coffee_inventory rci
     INNER JOIN roasted_coffee rc ON rci.roasted_id = rc.id
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
     LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
     WHERE rci.status = ? ORDER BY rci.created_at DESC LIMIT 100`, ['ready_for_packaging']
  );
  return rows;
}

export async function getRoastedForStorage() {
  const { rows } = await query(
    `SELECT rc.id, rc.roasting_id, rc.roast_level, rc.weight_kg, rc.weight_loss_percent,
            rc.actual_temp, rc.roast_time_minutes, rc.observations, rc.status, rb.lot_id,
            ch.farm, ch.farm as farm_name, ch.region, ch.altitude, ch.variety, ch.climate,
            ch.process, ch.aroma, ch.taste_notes, ch.taste_notes as notes
     FROM roasted_coffee rc
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
     LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
     WHERE rc.status = ? ORDER BY rc.created_at DESC LIMIT 100`, ['ready_for_storage']
  );
  return rows;
}

export async function getPackaged() {
  const { rows } = await query(
    `SELECT * FROM packaged_coffee WHERE status = ? ORDER BY created_at DESC LIMIT 100`, ['ready_for_sale']
  );
  return rows;
}

export async function getLotStage(lotId) {
  const stage = await getCurrentStage(query, lotId);
  return { lot_id: lotId, stage, label: STAGE_LABELS[stage] ?? stage };
}

export async function getAllLots() {
  const queries = [
    query(`SELECT ch.id, ch.lot_id, ch.farm as farm_name, ch.variety, ch.region, ch.altitude,
                  ch.climate, ch.process, ch.aroma, ch.taste_notes as notes, ch.created_at,
                  'verde' as status, COALESCE(ci.weight_kg, 0) as weight
           FROM coffee_harvests ch
           LEFT JOIN green_coffee_inventory ci ON ch.lot_id = ci.lot_id
           ORDER BY ch.created_at DESC`),
    query(`SELECT rci.id, rb.lot_id, ch.farm as farm_name, ch.variety, ch.region, ch.altitude,
                  ch.climate, ch.process, ch.aroma, ch.taste_notes as notes, rci.created_at,
                  'tostado' as status, rc.weight_kg as weight
           FROM roasted_coffee_inventory rci
           JOIN roasted_coffee rc ON rci.roasted_id = rc.id
           JOIN roasting_batches rb ON rc.roasting_id = rb.id
           LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
           ORDER BY rci.created_at DESC`),
    query(`SELECT rc.id, rb.lot_id, ch.farm as farm_name, ch.variety, ch.region, ch.altitude,
                  ch.climate, ch.process, ch.aroma, ch.taste_notes as notes, rc.created_at,
                  'pendiente' as status, rc.weight_kg as weight
           FROM roasted_coffee rc
           LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
           LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
           WHERE rc.status = 'ready_for_storage'
           ORDER BY rc.created_at DESC`),
    query(`SELECT rb.id, rb.lot_id, ch.farm as farm_name, ch.variety, ch.region, ch.altitude,
                  ch.climate, ch.process, ch.aroma, ch.taste_notes as notes, rb.created_at,
                  'en_tostado' as status, rb.quantity_sent_kg as weight
           FROM roasting_batches rb
           LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
           WHERE rb.status = 'in_roasting'
           ORDER BY rb.created_at DESC`),
  ];

  const results = await Promise.allSettled(queries);
  const allLots = results.flatMap(r => r.status === 'fulfilled' ? r.value.rows : []);
  allLots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    lots: allLots,
    total: allLots.length,
    breakdown: {
      verde:      allLots.filter(l => l.status === 'verde').length,
      en_tostado: allLots.filter(l => l.status === 'en_tostado').length,
      tostado:    allLots.filter(l => l.status === 'tostado').length,
      pendiente:  allLots.filter(l => l.status === 'pendiente').length,
    },
  };
}

// ── Deletes ──────────────────────────────────────────────────────────────────

export async function deleteHarvest(lotId) {
  const check = await query('SELECT id FROM coffee_harvests WHERE lot_id = ?', [lotId]);
  if (!check.rows.length) throw bizError(404, 'Lote no encontrado');

  await query('DELETE FROM green_coffee_inventory WHERE lot_id = ?', [lotId]);
  await query('DELETE FROM coffee_harvests WHERE lot_id = ?', [lotId]);
}

export async function deleteRoastedStorage(id) {
  const check = await query('SELECT id FROM roasted_coffee_inventory WHERE id = ?', [id]);
  if (!check.rows.length) throw bizError(404, 'Registro no encontrado');
  await query('DELETE FROM roasted_coffee_inventory WHERE id = ?', [id]);
}

export async function deleteRoastedCoffee(id) {
  const check = await query('SELECT id FROM roasted_coffee WHERE id = ?', [id]);
  if (!check.rows.length) throw bizError(404, 'Registro no encontrado');
  await query('DELETE FROM roasted_coffee WHERE id = ?', [id]);
}

export async function deleteRoastingBatch(id) {
  const check = await query('SELECT id FROM roasting_batches WHERE id = ?', [id]);
  if (!check.rows.length) throw bizError(404, 'Lote en tostado no encontrado');
  await query('DELETE FROM roasted_coffee WHERE roasting_id = ?', [id]);
  await query('DELETE FROM roasting_batches WHERE id = ?', [id]);
}

// ── Cupping SCA ──────────────────────────────────────────────────────────────

export async function getRoastedForCupping() {
  const { rows } = await query(
    `SELECT rc.id, rc.roast_level, rc.weight_kg, rb.lot_id,
            COALESCE(ch.variety, '') AS variety, COALESCE(ch.region,  '') AS region
     FROM roasted_coffee rc
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
     LEFT JOIN coffee_harvests  ch ON rb.lot_id = ch.lot_id
     WHERE rc.status IN ('ready_for_storage', 'stored')
     ORDER BY rc.created_at DESC LIMIT 100`
  );
  return rows;
}

export async function getCuppings() {
  const { rows } = await query(
    `SELECT id, check_number,
            CASE WHEN check_number LIKE 'CUP-%' THEN
              SUBSTRING(check_number FROM 5 FOR LENGTH(check_number) - 9)
            ELSE NULL END AS lot_id,
            check_type, check_date, passed, overall_score,
            aroma_score, flavor_score, aftertaste_score, acidity_score,
            body_score, balance_score, uniformity_score, clean_cup_score, sweetness_score,
            defects_count, defects_found, moisture_percentage, color_agtron,
            observations, corrective_actions
     FROM production_quality_checks
     WHERE check_type IN ('post_tostado', 'catacion', 'final')
     ORDER BY check_date DESC LIMIT 50`
  );
  return rows;
}

export async function createCupping({
  roastedId, checkType, checkDate, userId,
  aromaScore, flavorScore, aftertasteScore, acidityScore,
  bodyScore, balanceScore, uniformityScore, cleanCupScore, sweetnessScore,
  defectsCount, defectsFound, moisturePercent, colorAgtron,
  observations, correctiveActions, passed,
}) {
  if (!roastedId || !checkDate) throw bizError(400, 'Faltan campos requeridos (roastedId, checkDate)');

  const lotCheck = await query('SELECT id FROM roasted_coffee WHERE id = ?', [roastedId]);
  if (!lotCheck.rows.length) throw bizError(404, 'Lote tostado no encontrado');

  const attrs = [aromaScore, flavorScore, aftertasteScore, acidityScore,
                 bodyScore, balanceScore, uniformityScore, cleanCupScore, sweetnessScore];
  const attrSum = attrs.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const finalScore = Math.max(0, attrSum - (parseInt(defectsCount) || 0) * 4);

  const lotRow = await query(
    `SELECT rb.lot_id FROM roasted_coffee rc
     LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id WHERE rc.id = ?`, [roastedId]
  );
  const lotId = lotRow.rows[0]?.lot_id || 'GEN';
  const checkNumber = `CUP-${lotId}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const result = await query(
    `INSERT INTO production_quality_checks (
       check_number, roast_batch_id, check_type, check_date, inspector_id,
       passed, overall_score,
       aroma_score, flavor_score, aftertaste_score, acidity_score,
       body_score, balance_score, uniformity_score, clean_cup_score, sweetness_score,
       defects_count, defects_found, moisture_percentage, color_agtron,
       observations, corrective_actions, created_at
     ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING id`,
    [
      checkNumber, checkType || 'catacion', checkDate, userId,
      passed ? 1 : 0, finalScore.toFixed(2),
      aromaScore || null, flavorScore || null, aftertasteScore || null, acidityScore || null,
      bodyScore || null, balanceScore || null, uniformityScore || null, cleanCupScore || null, sweetnessScore || null,
      defectsCount || 0, defectsFound || null, moisturePercent || null, colorAgtron || null,
      observations || null, correctiveActions || null,
    ]
  );

  return { cuppingId: result.rows[0].id, checkNumber, overallScore: finalScore.toFixed(2), passed: !!passed };
}
