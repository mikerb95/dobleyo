/**
 * Flujo guiado de la línea de producción: "qué sigue" y la historia de cada lote.
 *
 * Solo lectura. Reconstruye el estado real de cada lote a partir de las tablas
 * operativas (las mismas que escriben los pasos de coffeeService) y deduce qué
 * trabajo queda pendiente. No escribe nada ni cambia la máquina de estados:
 * las tareas apuntan a los endpoints existentes de /api/coffee/*.
 *
 * La parte de cálculo (`buildLots`, `tasksForLot`) es pura y se prueba sin BD;
 * `loadSnapshot` es la única función que consulta.
 */
import { query } from '../db.js';

// ── Parámetros del negocio ──────────────────────────────────────────────────

/** Días que suele tardar la maquila en devolver el café tostado. */
export const MAQUILA_EXPECTED_DAYS = 5;
/** A partir de aquí el lote en maquila se considera atrasado. */
export const MAQUILA_LATE_DAYS = 10;
/** Días que el café recién recibido en finca puede esperar para entrar a bodega. */
export const GREEN_INTAKE_LATE_DAYS = 5;
/** Reposo mínimo del tostado antes de empacar (desgasificación). */
export const ROAST_REST_DAYS = 2;
/** Desde aquí conviene empacar pronto para no perder frescura. */
export const ROAST_FRESH_DAYS = 14;
/** Desde aquí el tostado ya está perdiendo frescura. */
export const ROAST_STALE_DAYS = 28;
/** Tostado recibido que lleva más de esto sin ubicación en bodega. */
export const ROASTED_UNPLACED_LATE_DAYS = 2;

/** Kg por paquete. Espejo de PACKAGE_KG en coffeeService. */
export const PACKAGE_KG = { '100g': 0.1, '250g': 0.25, '500g': 0.5, '1kg': 1.0 };
const MIN_PACKAGE_KG = Math.min(...Object.values(PACKAGE_KG));

/** Orden de las estaciones del recorrido del grano. */
export const STATIONS = ['harvest', 'green', 'roast', 'roasted', 'pack', 'label'];

/** Prioridad de cada nivel de urgencia (menor = más arriba en la bandeja). */
const URGENCY_RANK = { late: 0, now: 1, waiting: 2, anytime: 3 };

/** Tipos de tarea que puede ejecutar cada rol. */
const ROLE_TASKS = {
  admin: null, // todas
  caficultor: new Set(['store_green', 'send_roasting']),
};

// ── Utilidades ──────────────────────────────────────────────────────────────

const round = (n, d = 3) => {
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
};

/** Convierte las fechas de SQLite ('YYYY-MM-DD HH:MM:SS', UTC) a ms. */
export function toMs(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const s = String(value);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(fromMs, nowMs) {
  if (fromMs == null) return null;
  return Math.max(0, Math.floor((nowMs - fromMs) / 86400000));
}

function toIso(value) {
  const ms = toMs(value);
  return ms == null ? null : new Date(ms).toISOString();
}

/** Kg que consumió un empaque. A granel, unit_count ya viene en kg. */
export function packagedKg(pack) {
  const units = Number(pack.unit_count) || 0;
  if (pack.package_size === 'bulk') return units;
  return round(units * (PACKAGE_KG[pack.package_size] ?? 0));
}

/**
 * El lote de un cupping se guarda dentro de check_number: `CUP-<lote>-<4 hex>`.
 * Se extrae aquí en JS porque la consulta original usaba sintaxis de Postgres.
 */
export function lotFromCheckNumber(checkNumber) {
  const m = /^CUP-(.+)-[0-9A-F]{4}$/i.exec(String(checkNumber || ''));
  return m ? m[1] : null;
}

/**
 * Pasa un puntaje SCA (6 a 10) a la escala 1 a 5 de la etiqueta.
 * 6 → 1, 7 → 2, 8 → 3, 9 → 4, 10 → 5.
 */
export function scaToFive(score) {
  const n = parseFloat(score);
  if (!isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n - 5)));
}

// Nombres de las fincas históricas que no están en el maestro `farms`
// (las mismas de FARM_MAP en coffeeService).
const LEGACY_FARM_NAMES = {
  'finca-la-sierra': 'La Sierra',
  'finca-nariño': 'Nariño Premium',
  'finca-cauca': 'Cauca Estate',
};

/** Nombre legible de una finca cuando no está en el maestro. */
export function humanizeFarm(slug) {
  if (!slug) return 'Finca sin nombre';
  if (LEGACY_FARM_NAMES[slug]) return LEGACY_FARM_NAMES[slug];
  // Se capitaliza por palabras separadas por espacio: `\b` de JS no reconoce
  // la ñ ni las tildes como letras y partía "nariño" en "NariÑO".
  return String(slug)
    .replace(/^finca-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Construcción del estado por lote (puro) ─────────────────────────────────

/**
 * Agrupa las filas crudas de cada tabla en un objeto por lote.
 *
 * @param {object} snap  filas de loadSnapshot()
 * @returns {Map<string, object>}
 */
export function buildLots(snap) {
  const farms = new Map((snap.farms || []).map((f) => [f.slug, f]));
  const lots = new Map();

  for (const h of snap.harvests || []) {
    const farm = farms.get(h.farm);
    lots.set(h.lot_id, {
      lotId: h.lot_id,
      farm: {
        slug: h.farm,
        name: farm?.name || humanizeFarm(h.farm),
        ownerId: farm?.caficultor_id ?? null,
      },
      variety: h.variety || null,
      process: h.process || null,
      climate: h.climate || null,
      region: h.region || null,
      altitude: h.altitude != null ? Number(h.altitude) : null,
      aroma: h.aroma || null,
      tasteNotes: h.taste_notes || null,
      harvestedAt: toIso(h.created_at),
      harvestKg: h.harvest_weight_kg != null ? Number(h.harvest_weight_kg) : null,
      green: [],
      greenAvailableKg: null,
      roasts: [],
      packs: [],
      labels: { total: 0, printed: 0, lastAt: null },
      cuppings: [],
    });
  }

  for (const g of snap.green || []) {
    const lot = lots.get(g.lot_id);
    if (!lot) continue;
    lot.green.push({
      id: g.id,
      kg: Number(g.weight_kg) || 0,
      location: g.location || null,
      at: toIso(g.storage_date || g.created_at),
      recordedAt: toIso(g.created_at),
    });
  }

  const quants = new Map((snap.greenQuants || []).map((q) => [q.lot_id, Number(q.kg) || 0]));

  const roastsById = new Map();
  for (const r of snap.roasting || []) {
    const lot = lots.get(r.lot_id);
    if (!lot) continue;
    const roast = {
      id: r.id,
      sentKg: Number(r.quantity_sent_kg) || 0,
      sentAt: toIso(r.created_at),
      status: r.status,
      targetTemp: r.target_temp != null ? Number(r.target_temp) : null,
      received: null,
    };
    lot.roasts.push(roast);
    roastsById.set(r.id, roast);
  }

  const receivedById = new Map();
  for (const rc of snap.roasted || []) {
    const roast = roastsById.get(rc.roasting_id);
    if (!roast) continue;
    const lossPct = rc.weight_loss_percent != null ? Number(rc.weight_loss_percent) : null;
    // weight_kg se descuenta con cada empaque: el peso que salió del tostador
    // se reconstruye con lo enviado y la merma registrada.
    const outKg = lossPct != null ? round(roast.sentKg * (1 - lossPct / 100)) : Number(rc.weight_kg) || 0;
    const received = {
      id: rc.id,
      level: rc.roast_level || null,
      outKg,
      remainingKg: round(rc.weight_kg),
      lossPct,
      actualTemp: rc.actual_temp != null ? Number(rc.actual_temp) : null,
      roastMinutes: rc.roast_time_minutes != null ? Number(rc.roast_time_minutes) : null,
      at: toIso(rc.created_at),
      status: rc.status,
      storage: null,
    };
    roast.received = received;
    receivedById.set(rc.id, received);
  }

  const storageById = new Map();
  for (const s of snap.roastedStorage || []) {
    const received = receivedById.get(s.roasted_id);
    if (!received) continue;
    const storage = {
      id: s.id,
      location: s.location || null,
      containerType: s.container_type || null,
      containerCount: s.container_count != null ? Number(s.container_count) : null,
      at: toIso(s.created_at),
      status: s.status,
    };
    received.storage = storage;
    storageById.set(s.id, storage);
  }

  for (const p of snap.packaged || []) {
    const lot = lots.get(p.lot_id);
    if (!lot) continue;
    lot.packs.push({
      id: p.id,
      storageId: p.roasted_storage_id,
      presentation: p.presentation,
      grindSize: p.grind_size || null,
      packageSize: p.package_size,
      units: Number(p.unit_count) || 0,
      kg: packagedKg(p),
      at: toIso(p.created_at),
    });
  }

  for (const l of snap.labels || []) {
    const lot = lots.get(l.lot_id);
    if (!lot) continue;
    lot.labels = { total: Number(l.total) || 0, printed: Number(l.printed) || 0, lastAt: toIso(l.last_at) };
  }

  for (const c of snap.cuppings || []) {
    const lot = lots.get(lotFromCheckNumber(c.check_number));
    if (!lot) continue;
    lot.cuppings.push({
      id: c.id,
      score: c.overall_score != null ? Number(c.overall_score) : null,
      acidity: c.acidity_score != null ? Number(c.acidity_score) : null,
      body: c.body_score != null ? Number(c.body_score) : null,
      balance: c.balance_score != null ? Number(c.balance_score) : null,
      passed: c.passed === 1 || c.passed === true,
      at: toIso(c.check_date || c.created_at),
    });
  }

  for (const lot of lots.values()) {
    lot.roasts.sort((a, b) => toMs(a.sentAt) - toMs(b.sentAt));
    lot.packs.sort((a, b) => toMs(a.at) - toMs(b.at));
    lot.cuppings.sort((a, b) => toMs(b.at) - toMs(a.at));

    const storedKg = round(lot.green.reduce((s, g) => s + g.kg, 0));
    const sentKg = round(lot.roasts.reduce((s, r) => s + r.sentKg, 0));
    // Existencia real en bodega verde: sale de los quants (ledger). Sin
    // quants para el lote (datos previos al ledger), se estima restando.
    lot.greenAvailableKg = quants.has(lot.lotId)
      ? round(quants.get(lot.lotId))
      : round(Math.max(0, storedKg - sentKg));

    lot.balance = computeBalance(lot, storedKg);
    lot.stations = computeStations(lot);
  }

  return lots;
}

/** Dónde está hoy cada kilo del lote. */
function computeBalance(lot, storedKg) {
  const inMaquila = lot.roasts.filter((r) => !r.received).reduce((s, r) => s + r.sentKg, 0);
  const received = lot.roasts.map((r) => r.received).filter(Boolean);
  const roasted = received
    .filter((r) => r.status === 'ready_for_storage' || r.status === 'stored')
    .reduce((s, r) => s + r.remainingKg, 0);
  const packed = lot.packs.reduce((s, p) => s + p.kg, 0);
  const roastLoss = lot.roasts
    .filter((r) => r.received)
    .reduce((s, r) => s + Math.max(0, r.sentKg - r.received.outKg), 0);
  // Merma de secado y selección: lo comprado al caficultor que no llegó a bodega.
  const dryingLoss = lot.harvestKg != null && storedKg > 0 ? Math.max(0, lot.harvestKg - storedKg) : 0;

  return {
    greenKg: round(lot.greenAvailableKg, 2),
    maquilaKg: round(inMaquila, 2),
    roastedKg: round(roasted, 2),
    packedKg: round(packed, 2),
    roastLossKg: round(roastLoss, 2),
    dryingLossKg: round(dryingLoss, 2),
  };
}

/** Estado de cada estación del recorrido: done, active o pending. */
function computeStations(lot) {
  const unitsToLabel = lot.packs.filter((p) => p.packageSize !== 'bulk').reduce((s, p) => s + p.units, 0);
  const reached = {
    harvest: true,
    green: lot.green.length > 0,
    roast: lot.roasts.length > 0,
    roasted: lot.roasts.some((r) => r.received?.storage),
    pack: lot.packs.length > 0,
    label: lot.labels.total > 0,
  };
  // Cuánto trabajo sigue abierto en cada estación.
  const open = {
    harvest: false,
    green: !reached.green || lot.balance.greenKg > 0,
    roast: lot.balance.maquilaKg > 0 || lot.roasts.some((r) => r.received && !r.received.storage),
    roasted: lot.balance.roastedKg >= MIN_PACKAGE_KG,
    pack: lot.balance.roastedKg >= MIN_PACKAGE_KG && reached.pack,
    label: unitsToLabel > lot.labels.total,
  };

  const out = {};
  let firstPendingSeen = false;
  for (const st of STATIONS) {
    if (!reached[st]) {
      out[st] = firstPendingSeen ? 'pending' : 'next';
      firstPendingSeen = true;
    } else {
      out[st] = open[st] ? 'active' : 'done';
    }
  }
  return out;
}

// ── Tareas (puro) ───────────────────────────────────────────────────────────

/**
 * Trabajo pendiente de un lote. Cada tarea apunta a un paso existente y trae
 * la referencia que ese paso necesita (lotId, roastingId, roastedId...).
 *
 * @param {object} lot   lote de buildLots()
 * @param {number} nowMs
 * @returns {Array<object>}
 */
export function tasksForLot(lot, nowMs = Date.now()) {
  const tasks = [];
  const base = { lotId: lot.lotId };

  // 1. Café recibido en finca que aún no entra a bodega.
  if (lot.green.length === 0) {
    const age = daysBetween(toMs(lot.harvestedAt), nowMs);
    tasks.push({
      ...base,
      id: `store_green:${lot.lotId}`,
      kind: 'store_green',
      urgency: age >= GREEN_INTAKE_LATE_DAYS ? 'late' : 'now',
      since: lot.harvestedAt,
      ageDays: age,
      facts: { harvestKg: lot.harvestKg },
      ref: { lotId: lot.lotId },
    });
  }

  // 2. Café verde en bodega que puede salir a la maquila.
  // La máquina de estados permite un solo envío por lote: con un envío previo
  // el remanente no se ofrece como tarea (la ficha lo muestra como nota).
  if (lot.green.length > 0 && lot.roasts.length === 0 && lot.balance.greenKg > 0) {
    const firstIn = lot.green.map((g) => toMs(g.at)).filter(Boolean).sort((a, b) => a - b)[0] ?? null;
    tasks.push({
      ...base,
      id: `send_roasting:${lot.lotId}`,
      kind: 'send_roasting',
      urgency: 'anytime',
      since: firstIn ? new Date(firstIn).toISOString() : null,
      ageDays: daysBetween(firstIn, nowMs),
      facts: { availableKg: lot.balance.greenKg },
      ref: { lotId: lot.lotId },
    });
  }

  for (const roast of lot.roasts) {
    // 3. Café que está en la maquila.
    if (!roast.received && roast.status === 'in_roasting') {
      const age = daysBetween(toMs(roast.sentAt), nowMs);
      tasks.push({
        ...base,
        id: `receive_roast:${roast.id}`,
        kind: 'receive_roast',
        urgency: age >= MAQUILA_LATE_DAYS ? 'late' : age >= MAQUILA_EXPECTED_DAYS ? 'now' : 'waiting',
        since: roast.sentAt,
        ageDays: age,
        facts: { sentKg: roast.sentKg, expectedDays: MAQUILA_EXPECTED_DAYS },
        ref: { roastingId: roast.id },
      });
      continue;
    }

    const rec = roast.received;
    if (!rec) continue;

    // 4. Tostado recibido que no tiene ubicación en bodega.
    if (!rec.storage && rec.status === 'ready_for_storage') {
      const age = daysBetween(toMs(rec.at), nowMs);
      tasks.push({
        ...base,
        id: `store_roasted:${rec.id}`,
        kind: 'store_roasted',
        urgency: age >= ROASTED_UNPLACED_LATE_DAYS ? 'late' : 'now',
        since: rec.at,
        ageDays: age,
        facts: { kg: rec.remainingKg, level: rec.level },
        ref: { roastedId: rec.id },
      });
      continue;
    }

    // 5. Tostado en bodega con peso suficiente para al menos un paquete.
    if (rec.storage && rec.storage.status === 'ready_for_packaging' && rec.remainingKg >= MIN_PACKAGE_KG) {
      const age = daysBetween(toMs(rec.at), nowMs);
      const urgency = age < ROAST_REST_DAYS ? 'waiting'
        : age >= ROAST_STALE_DAYS ? 'late'
        : age >= ROAST_FRESH_DAYS ? 'now'
        : 'anytime';
      const restMs = toMs(rec.at) + ROAST_REST_DAYS * 86400000;
      tasks.push({
        ...base,
        id: `pack:${rec.storage.id}`,
        kind: 'pack',
        urgency,
        since: rec.at,
        ageDays: age,
        facts: {
          kg: rec.remainingKg,
          level: rec.level,
          location: rec.storage.location,
          readyAt: new Date(restMs).toISOString(),
        },
        ref: { roastedStorageId: rec.storage.id },
      });
    }
  }

  // 6. Unidades empacadas sin etiqueta.
  const unitsToLabel = lot.packs.filter((p) => p.packageSize !== 'bulk').reduce((s, p) => s + p.units, 0);
  const missingLabels = unitsToLabel - lot.labels.total;
  if (missingLabels > 0) {
    const lastPack = lot.packs[lot.packs.length - 1];
    // Solo el último empaque sin etiquetar puede generarse desde el lote:
    // /api/labels/generate-from-lot trabaja por registro de empaque.
    tasks.push({
      ...base,
      id: `label:${lot.lotId}`,
      kind: 'label',
      urgency: 'now',
      since: lastPack?.at ?? null,
      ageDays: daysBetween(toMs(lastPack?.at), nowMs),
      facts: { missing: missingLabels },
      ref: { packagedId: lastPack?.id ?? null, quantity: Math.min(missingLabels, lastPack?.units ?? missingLabels) },
    });
  }

  // 7. Tostado sin catación: alimenta el perfil de la etiqueta.
  const firstRoasted = lot.roasts.map((r) => r.received).find(Boolean);
  if (firstRoasted && lot.cuppings.length === 0 && lot.balance.roastedKg > 0) {
    tasks.push({
      ...base,
      id: `cupping:${lot.lotId}`,
      kind: 'cupping',
      urgency: 'anytime',
      since: firstRoasted.at,
      ageDays: daysBetween(toMs(firstRoasted.at), nowMs),
      facts: {},
      ref: { roastedId: firstRoasted.id },
    });
  }

  return tasks;
}

/** Datos de encabezado de un lote para acompañar sus tareas. */
function lotHeader(lot) {
  return {
    lotId: lot.lotId,
    farmName: lot.farm.name,
    variety: lot.variety,
    process: lot.process,
    region: lot.region,
    altitude: lot.altitude,
    stations: lot.stations,
    balance: lot.balance,
  };
}

function canSeeLot(lot, user) {
  if (user?.role !== 'caficultor') return true;
  // Finca sin dueño registrado: mismo criterio permisivo de assertFarmOwnership.
  return lot.farm.ownerId == null || Number(lot.farm.ownerId) === Number(user.id);
}

function roleAllows(kind, user) {
  const allowed = ROLE_TASKS[user?.role];
  return allowed == null ? user?.role === 'admin' : allowed.has(kind);
}

function sortTasks(a, b) {
  const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (byUrgency) return byUrgency;
  return (b.ageDays ?? 0) - (a.ageDays ?? 0);
}

/** Un lote sigue "en curso" mientras tenga kilos o etiquetas por mover. */
function isInFlight(lot, tasks) {
  const b = lot.balance;
  return tasks.some((t) => t.kind !== 'cupping')
    || b.greenKg > 0 || b.maquilaKg > 0 || b.roastedKg >= MIN_PACKAGE_KG;
}

function lastActivity(lot) {
  const dates = [
    lot.harvestedAt,
    ...lot.green.map((g) => g.recordedAt),
    ...lot.roasts.flatMap((r) => [r.sentAt, r.received?.at, r.received?.storage?.at]),
    ...lot.packs.map((p) => p.at),
    lot.labels.lastAt,
  ].map(toMs).filter(Boolean);
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

/**
 * Bandeja de trabajo: tareas ordenadas por urgencia + lotes en curso.
 *
 * @param {object} snap
 * @param {{ id: number, role: string }} user
 * @param {number} nowMs
 */
export function buildQueue(snap, user, nowMs = Date.now()) {
  const lots = buildLots(snap);
  const tasks = [];
  const inFlight = [];

  for (const lot of lots.values()) {
    if (!canSeeLot(lot, user)) continue;
    const lotTasks = tasksForLot(lot, nowMs);
    const visible = lotTasks.filter((t) => roleAllows(t.kind, user));
    for (const t of visible) tasks.push({ ...t, lot: lotHeader(lot) });
    if (isInFlight(lot, lotTasks)) {
      inFlight.push({ ...lotHeader(lot), lastActivityAt: lastActivity(lot), openTasks: visible.length });
    }
  }

  tasks.sort(sortTasks);
  inFlight.sort((a, b) => (toMs(b.lastActivityAt) ?? 0) - (toMs(a.lastActivityAt) ?? 0));

  const counts = { late: 0, now: 0, waiting: 0, anytime: 0 };
  for (const t of tasks) counts[t.urgency] += 1;

  return { tasks, lots: inFlight, counts, generatedAt: new Date(nowMs).toISOString() };
}

/**
 * Historia de un lote en eventos fechados, del más antiguo al más reciente.
 * Cada evento trae datos, no frases: el texto lo arma cada cliente.
 */
export function buildEvents(lot) {
  const events = [{ kind: 'harvest', at: lot.harvestedAt, data: { kg: lot.harvestKg, farm: lot.farm.name } }];
  for (const g of lot.green) events.push({ kind: 'green_in', at: g.at, data: { kg: g.kg, location: g.location } });
  for (const r of lot.roasts) {
    events.push({ kind: 'sent_roasting', at: r.sentAt, data: { kg: r.sentKg } });
    const rec = r.received;
    if (rec) {
      events.push({
        kind: 'roast_received', at: rec.at,
        data: { kg: rec.outKg, level: rec.level, lossPct: rec.lossPct, days: daysBetween(toMs(r.sentAt), toMs(rec.at)) },
      });
      if (rec.storage) {
        events.push({
          kind: 'roasted_in', at: rec.storage.at,
          data: { location: rec.storage.location, containers: rec.storage.containerCount, containerType: rec.storage.containerType },
        });
      }
    }
  }
  for (const c of lot.cuppings) events.push({ kind: 'cupping', at: c.at, data: { score: c.score, passed: c.passed } });
  for (const p of lot.packs) {
    events.push({
      kind: 'packed', at: p.at,
      data: { units: p.units, packageSize: p.packageSize, presentation: p.presentation, grindSize: p.grindSize, kg: p.kg },
    });
  }
  if (lot.labels.total > 0) {
    events.push({ kind: 'labeled', at: lot.labels.lastAt, data: { total: lot.labels.total, printed: lot.labels.printed } });
  }
  return events.filter((e) => e.at).sort((a, b) => toMs(a.at) - toMs(b.at));
}

/**
 * Ficha completa de un lote: encabezado, balance, historia y lo que sigue.
 * Devuelve null si el lote no existe o el usuario no puede verlo.
 */
export function buildJourney(snap, lotId, user, nowMs = Date.now()) {
  const lot = buildLots(snap).get(lotId);
  if (!lot || !canSeeLot(lot, user)) return null;

  const tasks = tasksForLot(lot, nowMs).filter((t) => roleAllows(t.kind, user)).sort(sortTasks);
  const latestCupping = lot.cuppings[0] ?? null;

  // Remanente verde que la máquina de estados ya no deja enviar.
  const strandedGreenKg = lot.roasts.length > 0 && lot.balance.greenKg > 0 ? lot.balance.greenKg : 0;

  return {
    ...lotHeader(lot),
    climate: lot.climate,
    aroma: lot.aroma,
    tasteNotes: lot.tasteNotes,
    harvestedAt: lot.harvestedAt,
    harvestKg: lot.harvestKg,
    events: buildEvents(lot),
    tasks,
    strandedGreenKg,
    // Perfil sugerido para el empaque a partir de la última catación.
    suggestedProfile: latestCupping
      ? {
          acidity: scaToFive(latestCupping.acidity),
          body: scaToFive(latestCupping.body),
          balance: scaToFive(latestCupping.balance),
          score: latestCupping.score,
          cuppedAt: latestCupping.at,
        }
      : null,
    labels: lot.labels,
    traceUrl: `/trazabilidad?lote=${encodeURIComponent(lot.lotId)}`,
  };
}

// ── Acceso a datos ──────────────────────────────────────────────────────────

/** Consulta tolerante: una tabla que aún no existe no tumba la bandeja. */
async function safeRows(sql, args) {
  try {
    const { rows } = await query(sql, args);
    return rows;
  } catch (err) {
    if (/no such table|no such column/i.test(err.message)) return [];
    throw err;
  }
}

/**
 * Lee las filas de todas las etapas, opcionalmente de un solo lote.
 * Pocas consultas amplias en lugar de una por lote: el volumen es bajo y así
 * la bandeja completa sale en ~10 viajes a la BD.
 */
export async function loadSnapshot({ lotId } = {}) {
  const one = lotId != null;
  const where = (col) => (one ? `WHERE ${col} = ?` : '');
  const args = one ? [lotId] : [];

  const [
    harvests, green, greenQuants, roasting, roasted, roastedStorage, packaged, labels, cuppings, farms,
  ] = await Promise.all([
    safeRows(
      `SELECT id, lot_id, farm, region, altitude, variety, climate, process, aroma, taste_notes,
              harvest_weight_kg, created_at
       FROM coffee_harvests ${where('lot_id')}
       ORDER BY created_at DESC LIMIT 500`, args),
    safeRows(
      `SELECT id, lot_id, weight_kg, location, storage_date, created_at
       FROM green_coffee_inventory ${where('lot_id')}`, args),
    safeRows(
      `SELECT lot_id, SUM(qty_kg) AS kg FROM storage_quants
       WHERE stock_state = 'green' ${one ? 'AND lot_id = ?' : ''}
       GROUP BY lot_id`, args),
    safeRows(
      `SELECT id, lot_id, quantity_sent_kg, target_temp, status, created_at
       FROM roasting_batches ${where('lot_id')}`, args),
    safeRows(
      `SELECT rc.id, rc.roasting_id, rc.roast_level, rc.weight_kg, rc.weight_loss_percent,
              rc.actual_temp, rc.roast_time_minutes, rc.status, rc.created_at
       FROM roasted_coffee rc
       JOIN roasting_batches rb ON rb.id = rc.roasting_id ${where('rb.lot_id')}`, args),
    safeRows(
      `SELECT rci.id, rci.roasted_id, rci.location, rci.container_type, rci.container_count,
              rci.status, rci.created_at
       FROM roasted_coffee_inventory rci
       JOIN roasted_coffee rc   ON rc.id = rci.roasted_id
       JOIN roasting_batches rb ON rb.id = rc.roasting_id ${where('rb.lot_id')}`, args),
    safeRows(
      `SELECT pc.id, pc.roasted_storage_id, rb.lot_id, pc.presentation, pc.grind_size,
              pc.package_size, pc.unit_count, pc.created_at
       FROM packaged_coffee pc
       JOIN roasted_coffee_inventory rci ON rci.id = pc.roasted_storage_id
       JOIN roasted_coffee rc   ON rc.id = rci.roasted_id
       JOIN roasting_batches rb ON rb.id = rc.roasting_id ${where('rb.lot_id')}`, args),
    safeRows(
      `SELECT lot_code AS lot_id, COUNT(*) AS total,
              SUM(CASE WHEN printed = 1 THEN 1 ELSE 0 END) AS printed,
              MAX(created_at) AS last_at
       FROM generated_labels ${where('lot_code')}
       GROUP BY lot_code`, args),
    safeRows(
      `SELECT id, check_number, check_date, overall_score, acidity_score, body_score,
              balance_score, passed, created_at
       FROM production_quality_checks
       WHERE check_number LIKE ? ORDER BY check_date DESC LIMIT 500`,
      [one ? `CUP-${lotId}-%` : 'CUP-%']),
    safeRows('SELECT slug, name, caficultor_id FROM farms'),
  ]);

  return { harvests, green, greenQuants, roasting, roasted, roastedStorage, packaged, labels, cuppings, farms };
}

export async function getWorkQueue(user) {
  return buildQueue(await loadSnapshot(), user);
}

export async function getLotJourney(lotId, user) {
  return buildJourney(await loadSnapshot({ lotId }), lotId, user);
}
