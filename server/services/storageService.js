/**
 * Servicio de almacenamiento: maestro de ubicaciones + libro de movimientos.
 *
 * Invariante del módulo: `storage_quants` NUNCA se escribe fuera de aquí.
 * Toda mutación de stock pasa por postMovement(), que registra el movimiento en
 * el ledger append-only y actualiza la proyección dentro de la MISMA transacción.
 * Así el stock no puede desincronizarse del historial.
 *
 * Funciones puras (sin req/res): lanzan Error con { status, message, detail }.
 */
import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import { logAudit } from './audit.js';

const EPS = 0.0001;
const round3 = (n) => Math.round((parseFloat(n) || 0) * 1000) / 1000;

export const STOCK_STATES = ['green', 'roasted', 'packaged'];
export const MOVEMENT_TYPES = ['receipt', 'transfer', 'issue', 'adjustment', 'count_correction'];

function bizError(status, message, detail) {
  const err = new Error(message);
  err.status = status;
  if (detail) err.detail = detail;
  return err;
}

// ── Lectura de maestros ──────────────────────────────────────────────────────

/**
 * Lista ubicaciones con su ocupación actual, calculada en el servidor.
 * El cliente nunca vuelve a sumar filas para saber cuánto hay en un estante.
 */
export async function listLocations({ stockState, zoneType, includeInactive = false, includeBlocked = true } = {}) {
  const where = [];
  const args = [];

  if (!includeInactive) where.push('l.is_active = 1');
  if (!includeBlocked) where.push('l.is_blocked = 0');
  if (zoneType) { where.push('z.zone_type = ?'); args.push(zoneType); }
  if (stockState) {
    if (!STOCK_STATES.includes(stockState)) throw bizError(400, `Estado de stock inválido: ${stockState}`);
    // allowed_states es un CSV; se compara con separadores para evitar
    // que 'green' haga match parcial dentro de otro valor.
    where.push(`(',' || l.allowed_states || ',') LIKE ?`);
    args.push(`%,${stockState},%`);
  }

  const { rows } = await query(
    `SELECT l.id, l.code, l.name, l.capacity_kg, l.max_containers, l.allowed_states,
            l.is_active, l.is_blocked, l.block_reason, l.sort_order, l.qr_payload, l.version,
            z.id AS zone_id, z.code AS zone_code, z.name AS zone_name, z.zone_type,
            z.temp_controlled, w.code AS warehouse_code, w.name AS warehouse_name,
            COALESCE(q.qty_kg, 0)      AS occupied_kg,
            COALESCE(q.lots, 0)        AS lot_count,
            COALESCE(q.containers, 0)  AS container_count
     FROM storage_locations l
     JOIN storage_zones z ON z.id = l.zone_id
     JOIN warehouses    w ON w.id = z.warehouse_id
     LEFT JOIN (
       SELECT location_id,
              SUM(qty_kg) AS qty_kg,
              SUM(container_count) AS containers,
              COUNT(DISTINCT lot_id) AS lots
       FROM storage_quants WHERE qty_kg > 0 GROUP BY location_id
     ) q ON q.location_id = l.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY z.zone_type, l.sort_order, l.code`,
    args
  );

  return rows.map((r) => ({
    ...r,
    occupied_kg: round3(r.occupied_kg),
    allowed_states: String(r.allowed_states).split(','),
    fill_pct: r.capacity_kg > 0
      ? Math.min(100, Math.round((r.occupied_kg / r.capacity_kg) * 100))
      : null,
  }));
}

export async function getLocationByCode(code) {
  const rows = await listLocations({ includeInactive: true });
  const found = rows.find((r) => r.code === code);
  if (!found) throw bizError(404, `Ubicación no encontrada: ${code}`);
  return found;
}

/** Detalle de una ubicación: quants vigentes + últimos movimientos. */
export async function getLocationDetail(id) {
  const loc = await query(
    `SELECT l.*, z.code AS zone_code, z.name AS zone_name, z.zone_type
     FROM storage_locations l JOIN storage_zones z ON z.id = l.zone_id WHERE l.id = ?`, [id]
  );
  if (!loc.rows.length) throw bizError(404, 'Ubicación no encontrada');

  const [quants, movements] = await Promise.all([
    query(
      `SELECT lot_id, stock_state, qty_kg, container_count, updated_at
       FROM storage_quants WHERE location_id = ? AND qty_kg > 0
       ORDER BY lot_id`, [id]
    ),
    query(
      `SELECT m.id, m.movement_uid, m.movement_type, m.lot_id, m.stock_state, m.qty_kg,
              m.reason_code, m.notes, m.performed_at,
              fl.code AS from_code, tl.code AS to_code,
              u.email AS performed_by_email
       FROM storage_movements m
       LEFT JOIN storage_locations fl ON fl.id = m.from_location_id
       LEFT JOIN storage_locations tl ON tl.id = m.to_location_id
       LEFT JOIN users u ON u.id = m.performed_by
       WHERE m.from_location_id = ? OR m.to_location_id = ?
       ORDER BY m.id DESC LIMIT 50`, [id, id]
    ),
  ]);

  return { ...loc.rows[0], quants: quants.rows, movements: movements.rows };
}

export async function listZones() {
  const { rows } = await query(
    `SELECT z.*, w.code AS warehouse_code, w.name AS warehouse_name,
            (SELECT COUNT(*) FROM storage_locations l WHERE l.zone_id = z.id AND l.is_active = 1) AS location_count
     FROM storage_zones z JOIN warehouses w ON w.id = z.warehouse_id
     WHERE z.is_active = 1 ORDER BY z.zone_type, z.code`
  );
  return rows;
}

export async function listWarehouses() {
  const { rows } = await query('SELECT * FROM warehouses WHERE is_active = 1 ORDER BY code');
  return rows;
}

export async function listMovements({ locationCode, lotId, from, to, limit = 200 } = {}) {
  const where = [];
  const args = [];
  if (locationCode) {
    where.push('(fl.code = ? OR tl.code = ?)');
    args.push(locationCode, locationCode);
  }
  if (lotId) { where.push('m.lot_id = ?'); args.push(lotId); }
  if (from)   { where.push('m.performed_at >= ?'); args.push(from); }
  if (to)     { where.push('m.performed_at <= ?'); args.push(to); }

  const { rows } = await query(
    `SELECT m.id, m.movement_uid, m.movement_type, m.lot_id, m.stock_state, m.qty_kg,
            m.container_type, m.container_count, m.source_table, m.source_id,
            m.reason_code, m.notes, m.performed_at,
            fl.code AS from_code, tl.code AS to_code, u.email AS performed_by_email
     FROM storage_movements m
     LEFT JOIN storage_locations fl ON fl.id = m.from_location_id
     LEFT JOIN storage_locations tl ON tl.id = m.to_location_id
     LEFT JOIN users u ON u.id = m.performed_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY m.id DESC LIMIT ?`,
    [...args, Math.min(parseInt(limit, 10) || 200, 1000)]
  );
  return rows;
}

// ── Núcleo: registrar un movimiento ──────────────────────────────────────────

/**
 * Resuelve un código o id de ubicación a su fila, DENTRO de la transacción.
 * Leer el maestro fuera de la tx permitiría que se bloquee la ubicación entre
 * la validación y la escritura.
 */
async function loadLocation(client, ref, label) {
  if (ref == null || ref === '') return null;
  const byId = Number.isInteger(ref) || /^\d+$/.test(String(ref));
  const { rows } = await client.query(
    `SELECT l.*, z.zone_type FROM storage_locations l
     JOIN storage_zones z ON z.id = l.zone_id
     WHERE ${byId ? 'l.id = ?' : 'l.code = ?'}`,
    [byId ? parseInt(ref, 10) : String(ref)]
  );
  if (!rows.length) throw bizError(404, `Ubicación ${label} no encontrada: ${ref}`);
  return rows[0];
}

function assertUsable(loc, stockState, label, { forOutbound = false } = {}) {
  if (!loc.is_active) {
    throw bizError(409, `La ubicación ${loc.code} está inactiva y no admite movimientos.`);
  }
  // El bloqueo congela la ubicación en ambos sentidos, a propósito: es lo que
  // hace confiable un conteo físico. Para corregir un bloqueo se desbloquea
  // primero (ruta de admin), como hace postInventoryCount().
  if (loc.is_blocked) {
    throw bizError(409,
      `La ubicación ${loc.code} está bloqueada${loc.block_reason ? `: ${loc.block_reason}` : '.'}`);
  }
  // El tipo de mercancía, en cambio, solo se restringe al ingresar: sacar un
  // lote mal ubicado debe ser posible, o el stock quedaría atrapado.
  if (!forOutbound) {
    const allowed = String(loc.allowed_states).split(',');
    if (!allowed.includes(stockState)) {
      throw bizError(422,
        `La ubicación ${loc.code} no admite café en estado "${stockState}". Admite: ${allowed.join(', ')}.`,
        { location: loc.code, allowed_states: allowed, requested_state: stockState });
    }
  }
}

async function readQuant(client, locationId, lotId, stockState) {
  const { rows } = await client.query(
    'SELECT qty_kg, container_count FROM storage_quants WHERE location_id = ? AND lot_id = ? AND stock_state = ?',
    [locationId, lotId, stockState]
  );
  return rows.length
    ? { qty: parseFloat(rows[0].qty_kg) || 0, containers: parseInt(rows[0].container_count, 10) || 0 }
    : { qty: 0, containers: 0 };
}

/**
 * Aplica un delta al quant leyendo y escribiendo el valor absoluto.
 *
 * No se usa UPSERT con el delta: SQLite evalúa el CHECK (qty_kg >= 0) sobre la
 * fila candidata del INSERT antes de resolver el conflicto, así que un
 * decremento haría fallar la restricción aunque el resultado final fuera
 * positivo. Leer-calcular-escribir mantiene el CHECK como red de seguridad real
 * sobre el valor final, y la transacción de escritura de libSQL serializa el
 * acceso, así que no hay ventana de carrera entre la lectura y la escritura.
 */
async function applyQuantDelta(client, locationId, lotId, stockState, deltaKg, deltaContainers, movementId) {
  const current = await readQuant(client, locationId, lotId, stockState);
  const nextQty = round3(current.qty + deltaKg);
  const nextContainers = Math.max(0, current.containers + (deltaContainers || 0));

  if (nextQty < -EPS) {
    // Defensa en profundidad: las validaciones previas ya lo impiden.
    throw bizError(409, `Movimiento rechazado: dejaría la ubicación en ${nextQty} kg (negativo).`);
  }
  const safeQty = nextQty < 0 ? 0 : nextQty;

  const updated = await client.query(
    `UPDATE storage_quants SET qty_kg = ?, container_count = ?, last_movement_id = ?, updated_at = datetime('now')
     WHERE location_id = ? AND lot_id = ? AND stock_state = ?`,
    [safeQty, nextContainers, movementId, locationId, lotId, stockState]
  );
  if (!updated.rowCount) {
    await client.query(
      `INSERT INTO storage_quants (location_id, lot_id, stock_state, qty_kg, container_count, last_movement_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [locationId, lotId, stockState, safeQty, nextContainers, movementId]
    );
  }
}

/**
 * Registra un movimiento y actualiza los quants atómicamente.
 *
 * @param {object} p
 * @param {'receipt'|'transfer'|'issue'|'adjustment'|'count_correction'} p.type
 * @param {string|number|null} p.from  código o id de la ubicación origen (null = entrada externa)
 * @param {string|number|null} p.to    código o id de la ubicación destino (null = salida a consumo/venta)
 * @param {string} p.lotId
 * @param {'green'|'roasted'|'packaged'} p.stockState
 * @param {number} p.qtyKg  siempre positivo
 * @param {string} [p.movementUid]  clave de idempotencia (p. ej. client_op_id de la app móvil)
 * @param {object} [client]  cliente de transacción existente, para componer con otras escrituras
 */
export async function postMovement(p, client = null) {
  const run = async (tx) => postMovementTx(tx, p);
  return client ? run(client) : withTransaction(run);
}

async function postMovementTx(tx, p) {
  const {
    type, from = null, to = null, lotId, stockState, qtyKg,
    containerType = null, containerCount = 0,
    sourceTable = null, sourceId = null, reasonCode = null, notes = null,
    movementUid, user = null,
  } = p;

  if (!MOVEMENT_TYPES.includes(type)) throw bizError(400, `Tipo de movimiento inválido: ${type}`);
  if (!STOCK_STATES.includes(stockState)) throw bizError(400, `Estado de stock inválido: ${stockState}`);
  if (!lotId) throw bizError(400, 'El lote es requerido');
  if (from == null && to == null) throw bizError(400, 'Un movimiento requiere origen, destino o ambos');

  const qty = round3(qtyKg);
  if (!isFinite(qty) || qty <= 0) throw bizError(400, 'La cantidad debe ser mayor a cero');

  const uid = movementUid || `mv:${crypto.randomUUID()}`;

  // 1. Idempotencia: un reintento (red caída, cola offline del móvil) devuelve
  //    el movimiento original en lugar de duplicar stock.
  const existing = await tx.query(
    'SELECT id, movement_type, lot_id, qty_kg, performed_at FROM storage_movements WHERE movement_uid = ?',
    [uid]
  );
  if (existing.rows.length) {
    return { movementId: existing.rows[0].id, movementUid: uid, idempotent: true };
  }

  // 2. Validar maestros dentro de la transacción
  const fromLoc = await loadLocation(tx, from, 'origen');
  const toLoc   = await loadLocation(tx, to, 'destino');
  if (fromLoc && toLoc && fromLoc.id === toLoc.id) {
    throw bizError(422, 'El origen y el destino no pueden ser la misma ubicación');
  }
  if (fromLoc) assertUsable(fromLoc, stockState, 'origen', { forOutbound: true });
  if (toLoc)   assertUsable(toLoc, stockState, 'destino');

  // 3. Disponibilidad en origen
  if (fromLoc) {
    const current = await readQuant(tx, fromLoc.id, lotId, stockState);
    if (qty > current.qty + EPS) {
      throw bizError(409,
        `Existencia insuficiente en ${fromLoc.code}: disponible ${round3(current.qty)} kg, solicitado ${qty} kg.`,
        { location: fromLoc.code, lot_id: lotId, available_kg: round3(current.qty), requested_kg: qty });
    }
  }

  // 4. Capacidad en destino
  if (toLoc && toLoc.capacity_kg != null) {
    const { rows } = await tx.query(
      'SELECT COALESCE(SUM(qty_kg), 0) AS total FROM storage_quants WHERE location_id = ?', [toLoc.id]
    );
    const occupied = parseFloat(rows[0].total) || 0;
    const capacity = parseFloat(toLoc.capacity_kg);
    if (occupied + qty > capacity + EPS) {
      throw bizError(409,
        `Capacidad excedida en ${toLoc.code}: ocupado ${round3(occupied)} kg de ${capacity} kg, se intentan ingresar ${qty} kg.`,
        { location: toLoc.code, capacity_kg: capacity, occupied_kg: round3(occupied),
          requested_kg: qty, free_kg: round3(capacity - occupied) });
    }
  }
  if (toLoc && toLoc.max_containers != null && containerCount > 0) {
    const { rows } = await tx.query(
      'SELECT COALESCE(SUM(container_count), 0) AS total FROM storage_quants WHERE location_id = ?', [toLoc.id]
    );
    const used = parseInt(rows[0].total, 10) || 0;
    if (used + containerCount > toLoc.max_containers) {
      throw bizError(409,
        `Límite de contenedores excedido en ${toLoc.code}: ${used} de ${toLoc.max_containers} ocupados.`);
    }
  }

  // 5. Asentar en el ledger
  const inserted = await tx.query(
    `INSERT INTO storage_movements
       (movement_uid, movement_type, from_location_id, to_location_id, lot_id, stock_state,
        qty_kg, container_type, container_count, source_table, source_id, reason_code, notes,
        performed_by, performed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING id`,
    [uid, type, fromLoc?.id ?? null, toLoc?.id ?? null, lotId, stockState, qty,
     containerType, containerCount || null, sourceTable,
     sourceId != null ? String(sourceId) : null, reasonCode, notes, user?.id ?? null]
  );
  const movementId = inserted.rows[0].id;

  // 6. Proyectar sobre los quants
  if (fromLoc) await applyQuantDelta(tx, fromLoc.id, lotId, stockState, -qty, -(containerCount || 0), movementId);
  if (toLoc)   await applyQuantDelta(tx, toLoc.id,   lotId, stockState,  qty,  (containerCount || 0), movementId);

  return {
    movementId, movementUid: uid, idempotent: false,
    from: fromLoc?.code ?? null, to: toLoc?.code ?? null, qtyKg: qty,
  };
}

/**
 * Retira `qtyKg` de un lote repartido en varias ubicaciones, consumiendo FIFO
 * (la ubicación con el quant más antiguo primero). Genera un movimiento de
 * salida por cada ubicación tocada, de modo que el historial refleje de qué
 * estante salió cada kilo.
 *
 * Se ejecuta dentro de la transacción del llamador para que la validación de
 * disponibilidad y las salidas sean atómicas entre sí.
 */
export async function issueFromLotFIFO(tx, { lotId, stockState, qtyKg, sourceTable, sourceId, reasonCode, notes, uidPrefix, user }) {
  const needed = round3(qtyKg);
  if (!isFinite(needed) || needed <= 0) throw bizError(400, 'La cantidad debe ser mayor a cero');

  const { rows } = await tx.query(
    `SELECT q.id, q.location_id, q.qty_kg, l.code
     FROM storage_quants q JOIN storage_locations l ON l.id = q.location_id
     WHERE q.lot_id = ? AND q.stock_state = ? AND q.qty_kg > 0
     ORDER BY q.id ASC`,
    [lotId, stockState]
  );

  const available = round3(rows.reduce((s, r) => s + (parseFloat(r.qty_kg) || 0), 0));
  if (needed > available + EPS) {
    throw bizError(409,
      `Existencia insuficiente del lote ${lotId}: disponible ${available} kg en bodega, solicitado ${needed} kg.`,
      { lot_id: lotId, available_kg: available, requested_kg: needed,
        locations: rows.map((r) => ({ code: r.code, qty_kg: round3(r.qty_kg) })) });
  }

  let remaining = needed;
  const issued = [];
  let seq = 0;
  for (const r of rows) {
    if (remaining <= EPS) break;
    const take = round3(Math.min(parseFloat(r.qty_kg), remaining));
    if (take <= EPS) continue;
    seq += 1;

    const result = await postMovementTx(tx, {
      type: 'issue', from: r.location_id, lotId, stockState, qtyKg: take,
      sourceTable, sourceId, reasonCode, notes,
      movementUid: `${uidPrefix}:${seq}`, user,
    });
    issued.push({ location: r.code, qty_kg: take, movement_id: result.movementId });
    remaining = round3(remaining - take);
  }

  return { issued, totalKg: needed };
}

/** Traslado entre ubicaciones. Es un postMovement con validación de ambos extremos. */
export async function transferStock({ fromCode, toCode, lotId, stockState, qtyKg, containerCount, notes, movementUid, user }) {
  if (!fromCode || !toCode) throw bizError(400, 'Origen y destino son requeridos');
  const result = await postMovement({
    type: 'transfer', from: fromCode, to: toCode, lotId, stockState,
    qtyKg, containerCount, notes, movementUid, reasonCode: 'transfer_manual', user,
  });
  if (!result.idempotent) {
    await logAudit(user?.id, 'transfer', 'storage_movement', result.movementId,
      { from: fromCode, to: toCode, lot_id: lotId, qty_kg: result.qtyKg, stock_state: stockState });
  }
  return result;
}

/** Ajuste manual con motivo obligatorio. Nunca edita un quant: asienta la diferencia. */
export async function adjustStock({ locationCode, lotId, stockState, targetQtyKg, reason, movementUid, user }) {
  if (!locationCode || !lotId || !reason) {
    throw bizError(400, 'Ubicación, lote y motivo del ajuste son requeridos');
  }
  const target = round3(targetQtyKg);
  if (!isFinite(target) || target < 0) throw bizError(400, 'La cantidad objetivo no puede ser negativa');

  const outcome = await withTransaction(async (tx) => {
    const loc = await loadLocation(tx, locationCode, 'ajuste');
    const current = await readQuant(tx, loc.id, lotId, stockState);
    const delta = round3(target - current.qty);
    if (Math.abs(delta) < EPS) {
      return { movementId: null, delta: 0, message: 'Sin diferencia: no se generó movimiento.' };
    }

    const result = await postMovementTx(tx, {
      type: 'adjustment',
      from: delta < 0 ? loc.id : null,
      to:   delta > 0 ? loc.id : null,
      lotId, stockState, qtyKg: Math.abs(delta),
      reasonCode: 'adjustment_manual', notes: reason, movementUid, user,
    });
    return { ...result, delta, locationCode: loc.code, fromKg: current.qty };
  });

  // La auditoría va FUERA de la transacción: logAudit usa el cliente no
  // transaccional y llamarlo adentro bloquea la propia escritura (SQLITE_BUSY),
  // perdiendo el registro en silencio.
  if (outcome.movementId) {
    await logAudit(user?.id, 'adjust', 'storage_movement', outcome.movementId, {
      location: outcome.locationCode, lot_id: lotId,
      from_kg: outcome.fromKg, to_kg: target, reason,
    });
  }
  return outcome;
}

// ── CRUD del maestro ─────────────────────────────────────────────────────────

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,58}[A-Z0-9]$/;

export async function createLocation({ zoneId, code, name, capacityKg, maxContainers, allowedStates, sortOrder, user }) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(normalizedCode)) {
    throw bizError(422, 'El código debe tener entre 3 y 60 caracteres: mayúsculas, números y guiones.');
  }
  if (!name || !String(name).trim()) throw bizError(422, 'El nombre es requerido');
  if (!zoneId) throw bizError(422, 'La zona es requerida');

  const states = Array.isArray(allowedStates) ? allowedStates : String(allowedStates || '').split(',');
  const clean = states.map((s) => s.trim()).filter(Boolean);
  if (!clean.length || clean.some((s) => !STOCK_STATES.includes(s))) {
    throw bizError(422, `Estados permitidos inválidos. Valores admitidos: ${STOCK_STATES.join(', ')}.`);
  }

  const zone = await query('SELECT id FROM storage_zones WHERE id = ? AND is_active = 1', [zoneId]);
  if (!zone.rows.length) throw bizError(404, 'Zona no encontrada o inactiva');

  const dup = await query('SELECT id FROM storage_locations WHERE code = ?', [normalizedCode]);
  if (dup.rows.length) throw bizError(409, `Ya existe una ubicación con el código ${normalizedCode}.`);

  const capacity = capacityKg === '' || capacityKg == null ? null : parseFloat(capacityKg);
  if (capacity != null && (!isFinite(capacity) || capacity <= 0)) {
    throw bizError(422, 'La capacidad debe ser un número mayor a cero, o quedar vacía para ilimitada.');
  }

  const result = await query(
    `INSERT INTO storage_locations (zone_id, code, name, capacity_kg, max_containers, allowed_states, sort_order, qr_payload, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [zoneId, normalizedCode, String(name).trim(), capacity,
     maxContainers ? parseInt(maxContainers, 10) : null, clean.join(','),
     parseInt(sortOrder, 10) || 0, `LOC:${normalizedCode}`, user?.id ?? null]
  );

  await logAudit(user?.id, 'create', 'storage_location', result.rows[0].id,
    { code: normalizedCode, zone_id: zoneId, capacity_kg: capacity });
  return { id: result.rows[0].id, code: normalizedCode };
}

/**
 * Actualiza atributos no identificantes. El `code` es inmutable a propósito:
 * cambiarlo reescribiría el significado del historial ya asentado.
 * Requiere `version` (bloqueo optimista) para no pisar cambios concurrentes.
 */
export async function updateLocation(id, { name, capacityKg, maxContainers, allowedStates, sortOrder, version, user }) {
  const current = await query('SELECT * FROM storage_locations WHERE id = ?', [id]);
  if (!current.rows.length) throw bizError(404, 'Ubicación no encontrada');
  const loc = current.rows[0];

  if (version != null && parseInt(version, 10) !== loc.version) {
    throw bizError(409, 'La ubicación fue modificada por otro usuario. Recargue la página e intente de nuevo.',
      { expected_version: loc.version, received_version: parseInt(version, 10) });
  }

  const fields = [];
  const args = [];

  if (name != null) {
    if (!String(name).trim()) throw bizError(422, 'El nombre no puede quedar vacío');
    fields.push('name = ?'); args.push(String(name).trim());
  }
  if (capacityKg !== undefined) {
    const capacity = capacityKg === '' || capacityKg === null ? null : parseFloat(capacityKg);
    if (capacity != null && (!isFinite(capacity) || capacity <= 0)) {
      throw bizError(422, 'La capacidad debe ser mayor a cero, o vacía para ilimitada.');
    }
    // Reducir la capacidad por debajo de lo ya almacenado dejaría la ubicación
    // en un estado inconsistente que ningún movimiento podría corregir.
    if (capacity != null) {
      const occ = await query('SELECT COALESCE(SUM(qty_kg), 0) AS total FROM storage_quants WHERE location_id = ?', [id]);
      const occupied = round3(occ.rows[0].total);
      if (occupied > capacity) {
        throw bizError(422,
          `No se puede fijar la capacidad en ${capacity} kg: la ubicación tiene ${occupied} kg almacenados. Retire mercancía primero.`);
      }
    }
    fields.push('capacity_kg = ?'); args.push(capacity);
  }
  if (maxContainers !== undefined) {
    fields.push('max_containers = ?');
    args.push(maxContainers === '' || maxContainers === null ? null : parseInt(maxContainers, 10));
  }
  if (allowedStates !== undefined) {
    const states = (Array.isArray(allowedStates) ? allowedStates : String(allowedStates).split(','))
      .map((s) => s.trim()).filter(Boolean);
    if (!states.length || states.some((s) => !STOCK_STATES.includes(s))) {
      throw bizError(422, `Estados permitidos inválidos. Valores admitidos: ${STOCK_STATES.join(', ')}.`);
    }
    // No se puede retirar un estado del que todavía hay existencias.
    const held = await query(
      'SELECT DISTINCT stock_state FROM storage_quants WHERE location_id = ? AND qty_kg > 0', [id]
    );
    const conflict = held.rows.map((r) => r.stock_state).filter((s) => !states.includes(s));
    if (conflict.length) {
      throw bizError(422,
        `La ubicación aún almacena café en estado: ${conflict.join(', ')}. Retire esa mercancía antes de cambiar los estados permitidos.`);
    }
    fields.push('allowed_states = ?'); args.push(states.join(','));
  }
  if (sortOrder !== undefined) { fields.push('sort_order = ?'); args.push(parseInt(sortOrder, 10) || 0); }

  if (!fields.length) throw bizError(400, 'No se recibió ningún campo para actualizar');

  fields.push('version = version + 1', `updated_at = datetime('now')`);
  const result = await query(
    `UPDATE storage_locations SET ${fields.join(', ')} WHERE id = ? AND version = ?`,
    [...args, id, loc.version]
  );
  if (!result.rowCount) {
    throw bizError(409, 'La ubicación cambió durante la actualización. Recargue e intente de nuevo.');
  }

  await logAudit(user?.id, 'update', 'storage_location', id, { code: loc.code, changes: fields });
  return { id, version: loc.version + 1 };
}

export async function setLocationBlocked(id, { blocked, reason, user }) {
  const current = await query('SELECT code, is_blocked FROM storage_locations WHERE id = ?', [id]);
  if (!current.rows.length) throw bizError(404, 'Ubicación no encontrada');
  if (blocked && !String(reason || '').trim()) {
    throw bizError(422, 'Debe indicar el motivo del bloqueo');
  }

  await query(
    `UPDATE storage_locations SET is_blocked = ?, block_reason = ?, version = version + 1, updated_at = datetime('now')
     WHERE id = ?`,
    [blocked ? 1 : 0, blocked ? String(reason).trim() : null, id]
  );
  await logAudit(user?.id, blocked ? 'block' : 'unblock', 'storage_location', id,
    { code: current.rows[0].code, reason: reason || null });
  return { id, is_blocked: blocked ? 1 : 0 };
}

/**
 * Desactivación lógica. Los maestros nunca se borran: el historial los
 * referencia y borrarlos dejaría movimientos huérfanos.
 */
export async function deactivateLocation(id, user) {
  const current = await query('SELECT code FROM storage_locations WHERE id = ?', [id]);
  if (!current.rows.length) throw bizError(404, 'Ubicación no encontrada');

  const stock = await query(
    'SELECT COALESCE(SUM(qty_kg), 0) AS total FROM storage_quants WHERE location_id = ?', [id]
  );
  const total = round3(stock.rows[0].total);
  if (total > EPS) {
    throw bizError(409,
      `No se puede desactivar ${current.rows[0].code}: aún tiene ${total} kg almacenados. Traslade la mercancía primero.`,
      { occupied_kg: total });
  }

  await query(
    `UPDATE storage_locations SET is_active = 0, version = version + 1, updated_at = datetime('now') WHERE id = ?`, [id]
  );
  await logAudit(user?.id, 'deactivate', 'storage_location', id, { code: current.rows[0].code });
  return { id, is_active: 0 };
}

export async function reactivateLocation(id, user) {
  const current = await query('SELECT code FROM storage_locations WHERE id = ?', [id]);
  if (!current.rows.length) throw bizError(404, 'Ubicación no encontrada');
  await query(
    `UPDATE storage_locations SET is_active = 1, version = version + 1, updated_at = datetime('now') WHERE id = ?`, [id]
  );
  await logAudit(user?.id, 'reactivate', 'storage_location', id, { code: current.rows[0].code });
  return { id, is_active: 1 };
}

export async function createZone({ warehouseId, code, name, zoneType, tempControlled, tempMinC, tempMaxC, humidityMaxPct, user }) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(normalizedCode)) throw bizError(422, 'Código de zona inválido');
  if (!name || !String(name).trim()) throw bizError(422, 'El nombre de la zona es requerido');
  if (!['green', 'roasted', 'packaged', 'quarantine', 'transit', 'scrap'].includes(zoneType)) {
    throw bizError(422, 'Tipo de zona inválido');
  }

  const wh = warehouseId
    ? await query('SELECT id FROM warehouses WHERE id = ? AND is_active = 1', [warehouseId])
    : await query('SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1');
  if (!wh.rows.length) throw bizError(404, 'Bodega no encontrada');

  const result = await query(
    `INSERT INTO storage_zones (warehouse_id, code, name, zone_type, temp_controlled, temp_min_c, temp_max_c, humidity_max_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [wh.rows[0].id, normalizedCode, String(name).trim(), zoneType, tempControlled ? 1 : 0,
     tempMinC ?? null, tempMaxC ?? null, humidityMaxPct ?? null]
  );
  await logAudit(user?.id, 'create', 'storage_zone', result.rows[0].id, { code: normalizedCode, zone_type: zoneType });
  return { id: result.rows[0].id, code: normalizedCode };
}

// ── Conteo cíclico (inventario físico) ───────────────────────────────────────

/** Abre un conteo: congela el stock del sistema y bloquea las ubicaciones. */
export async function openInventoryCount({ locationCodes, scopeNote, user }) {
  const countNumber = `CNT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  return withTransaction(async (tx) => {
    const created = await tx.query(
      `INSERT INTO inventory_counts (count_number, status, scope_note, created_by)
       VALUES (?, 'counting', ?, ?) RETURNING id`,
      [countNumber, scopeNote || null, user?.id ?? null]
    );
    const countId = created.rows[0].id;

    const codes = Array.isArray(locationCodes) && locationCodes.length ? locationCodes : null;
    const placeholders = codes ? codes.map(() => '?').join(',') : null;
    const { rows } = await tx.query(
      `SELECT q.location_id, q.lot_id, q.stock_state, q.qty_kg, l.id AS lid
       FROM storage_quants q JOIN storage_locations l ON l.id = q.location_id
       ${codes ? `WHERE l.code IN (${placeholders})` : ''}`,
      codes || []
    );

    for (const r of rows) {
      await tx.query(
        `INSERT OR IGNORE INTO inventory_count_lines (count_id, location_id, lot_id, stock_state, system_qty_kg)
         VALUES (?, ?, ?, ?, ?)`,
        [countId, r.location_id, r.lot_id, r.stock_state, r.qty_kg]
      );
    }

    // Bloquear las ubicaciones evita que entren o salgan kilos mientras se
    // cuenta: sin esto la diferencia medida sería ruido, no un hallazgo.
    await tx.query(
      `UPDATE storage_locations SET is_blocked = 1, block_reason = ?, version = version + 1
       ${codes ? `WHERE code IN (${placeholders})` : 'WHERE is_active = 1'}`,
      [`Conteo físico ${countNumber} en curso`, ...(codes || [])]
    );

    return { countId, countNumber, lines: rows.length };
  });
}

/** Cierra el conteo: genera un movimiento por cada diferencia y desbloquea. */
export async function postInventoryCount(countId, user) {
  const count = await query('SELECT * FROM inventory_counts WHERE id = ?', [countId]);
  if (!count.rows.length) throw bizError(404, 'Conteo no encontrado');
  if (count.rows[0].status === 'posted') throw bizError(409, 'Este conteo ya fue contabilizado');

  const lines = await query(
    `SELECT cl.*, l.code AS location_code FROM inventory_count_lines cl
     JOIN storage_locations l ON l.id = cl.location_id
     WHERE cl.count_id = ? AND cl.counted_qty_kg IS NOT NULL`, [countId]
  );

  const corrections = [];
  for (const line of lines.rows) {
    const delta = round3(parseFloat(line.counted_qty_kg) - parseFloat(line.system_qty_kg));
    if (Math.abs(delta) < EPS) continue;

    // El bloqueo del conteo no debe impedir su propia corrección.
    await query('UPDATE storage_locations SET is_blocked = 0 WHERE id = ?', [line.location_id]);
    const result = await postMovement({
      type: 'count_correction',
      from: delta < 0 ? line.location_id : null,
      to:   delta > 0 ? line.location_id : null,
      lotId: line.lot_id, stockState: line.stock_state, qtyKg: Math.abs(delta),
      reasonCode: `count:${count.rows[0].count_number}`,
      notes: `Corrección por conteo físico ${count.rows[0].count_number}`,
      movementUid: `count:${countId}:${line.id}`, user,
    });
    corrections.push({ location: line.location_code, lot_id: line.lot_id, delta_kg: delta, movement_id: result.movementId });
  }

  await query(
    `UPDATE inventory_counts SET status = 'posted', posted_by = ?, posted_at = datetime('now') WHERE id = ?`,
    [user?.id ?? null, countId]
  );
  await query(
    `UPDATE storage_locations SET is_blocked = 0, block_reason = NULL
     WHERE block_reason = ?`, [`Conteo físico ${count.rows[0].count_number} en curso`]
  );

  await logAudit(user?.id, 'post', 'inventory_count', countId,
    { count_number: count.rows[0].count_number, corrections: corrections.length });
  return { countId, countNumber: count.rows[0].count_number, corrections };
}

// ── Reconstrucción y reconciliación ──────────────────────────────────────────

/**
 * Reconstruye `storage_quants` desde cero a partir del ledger.
 * Es la garantía de recuperación: mientras el ledger esté intacto, el stock
 * siempre puede regenerarse. Lo usan la migración y el job de reconciliación.
 */
export async function rebuildQuants() {
  return withTransaction(async (tx) => {
    const { rows: movements } = await tx.query(
      `SELECT id, from_location_id, to_location_id, lot_id, stock_state, qty_kg, container_count
       FROM storage_movements ORDER BY id ASC`
    );

    const acc = new Map(); // "locId|lot|state" → { qty, containers, lastId }
    const bump = (locId, lotId, state, deltaKg, deltaCont, movId) => {
      const key = `${locId}|${lotId}|${state}`;
      const prev = acc.get(key) || { locId, lotId, state, qty: 0, containers: 0, lastId: null };
      prev.qty = round3(prev.qty + deltaKg);
      prev.containers = Math.max(0, prev.containers + deltaCont);
      prev.lastId = movId;
      acc.set(key, prev);
    };

    for (const m of movements) {
      const qty = parseFloat(m.qty_kg) || 0;
      const cont = parseInt(m.container_count, 10) || 0;
      if (m.from_location_id) bump(m.from_location_id, m.lot_id, m.stock_state, -qty, -cont, m.id);
      if (m.to_location_id)   bump(m.to_location_id,   m.lot_id, m.stock_state,  qty,  cont, m.id);
    }

    await tx.query('DELETE FROM storage_quants');
    let written = 0;
    for (const q of acc.values()) {
      // Un neto negativo solo puede venir de datos históricos incompletos; se
      // normaliza a 0 y se reporta, en vez de romper el CHECK de la tabla.
      const qty = q.qty < 0 ? 0 : q.qty;
      if (qty <= EPS && q.containers <= 0) continue;
      await tx.query(
        `INSERT INTO storage_quants (location_id, lot_id, stock_state, qty_kg, container_count, last_movement_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [q.locId, q.lotId, q.state, qty, q.containers, q.lastId]
      );
      written += 1;
    }

    return { movements: movements.length, quants: written };
  });
}

/**
 * Compara la proyección contra el ledger sin escribir nada. Es el chequeo de
 * salud que se corre antes de decidir si hace falta reconstruir.
 */
export async function reconcileReport() {
  const { rows } = await query(
    `WITH ledger AS (
       SELECT to_location_id AS location_id, lot_id, stock_state, qty_kg AS delta
       FROM storage_movements WHERE to_location_id IS NOT NULL
       UNION ALL
       SELECT from_location_id AS location_id, lot_id, stock_state, -qty_kg AS delta
       FROM storage_movements WHERE from_location_id IS NOT NULL
     ), expected AS (
       SELECT location_id, lot_id, stock_state, ROUND(SUM(delta), 3) AS qty_kg
       FROM ledger GROUP BY location_id, lot_id, stock_state
     )
     SELECT l.code AS location_code, e.lot_id, e.stock_state,
            COALESCE(e.qty_kg, 0) AS ledger_kg,
            COALESCE(q.qty_kg, 0) AS quant_kg,
            ROUND(COALESCE(e.qty_kg, 0) - COALESCE(q.qty_kg, 0), 3) AS diff_kg
     FROM expected e
     LEFT JOIN storage_quants q
       ON q.location_id = e.location_id AND q.lot_id = e.lot_id AND q.stock_state = e.stock_state
     JOIN storage_locations l ON l.id = e.location_id
     WHERE ABS(COALESCE(e.qty_kg, 0) - COALESCE(q.qty_kg, 0)) > 0.001
     ORDER BY ABS(COALESCE(e.qty_kg, 0) - COALESCE(q.qty_kg, 0)) DESC`
  );
  return { inSync: rows.length === 0, discrepancies: rows };
}

// ── Helper para el pipeline de café ──────────────────────────────────────────

/**
 * Valida un código de ubicación recibido de un formulario y devuelve su id.
 * Usarlo antes de escribir en green_coffee_inventory / roasted_coffee_inventory
 * garantiza que `location` deje de ser texto libre sin respaldo en el maestro.
 */
export async function resolveLocationForIntake(code, stockState) {
  if (!code) throw bizError(400, 'La ubicación es requerida');
  const { rows } = await query(
    `SELECT l.*, z.zone_type FROM storage_locations l
     JOIN storage_zones z ON z.id = l.zone_id WHERE l.code = ?`, [String(code).trim()]
  );
  if (!rows.length) {
    throw bizError(404, `Ubicación no encontrada: ${code}. Verifique el maestro en Configuración → Ubicaciones.`);
  }
  assertUsable(rows[0], stockState, 'destino');
  return rows[0];
}
