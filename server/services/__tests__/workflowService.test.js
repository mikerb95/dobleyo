import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db.js', () => ({ query: vi.fn() }));

const {
  buildLots, buildQueue, humanizeFarm, buildJourney, tasksForLot, lotFromCheckNumber, scaToFive, packagedKg,
  MAQUILA_EXPECTED_DAYS, MAQUILA_LATE_DAYS,
} = await import('../workflowService.js');

const NOW = Date.parse('2026-09-24T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString().replace('T', ' ').slice(0, 19);

const LOT = 'COL-HUI-1800-CAT-HUM-A1F2';

function harvest(extra = {}) {
  return {
    id: 1, lot_id: LOT, farm: 'finca-la-sierra', region: 'HUI', altitude: 1800, variety: 'CAT',
    climate: 'SECO', process: 'HUM', aroma: '', taste_notes: '', harvest_weight_kg: 125,
    created_at: daysAgo(20), ...extra,
  };
}

function snap(parts = {}) {
  return {
    harvests: [harvest()], green: [], greenQuants: [], roasting: [], roasted: [],
    roastedStorage: [], packaged: [], labels: [], cuppings: [], farms: [], ...parts,
  };
}

const admin = { id: 1, role: 'admin' };
const kinds = (tasks) => tasks.map((t) => t.kind);

describe('helpers', () => {
  it('extrae el lote del número de catación', () => {
    expect(lotFromCheckNumber(`CUP-${LOT}-9F3A`)).toBe(LOT);
    expect(lotFromCheckNumber('QC-123')).toBeNull();
  });

  it('pasa puntajes SCA a escala 1-5', () => {
    expect(scaToFive(6)).toBe(1);
    expect(scaToFive(8.25)).toBe(3);
    expect(scaToFive(10)).toBe(5);
    expect(scaToFive(null)).toBeNull();
  });

  it('nombra fincas sin maestro sin romper la ñ', () => {
    expect(humanizeFarm('finca-nariño')).toBe('Nariño Premium');
    expect(humanizeFarm('finca-el-peñón')).toBe('El Peñón');
  });

  it('calcula los kg de un empaque, a granel incluido', () => {
    expect(packagedKg({ package_size: '250g', unit_count: 40 })).toBe(10);
    expect(packagedKg({ package_size: 'bulk', unit_count: 3 })).toBe(3);
  });
});

describe('tareas por etapa', () => {
  it('una cosecha sin bodega pide ingreso, atrasado a los 5 días', () => {
    const fresh = buildLots(snap({ harvests: [harvest({ created_at: daysAgo(1) })] })).get(LOT);
    expect(tasksForLot(fresh, NOW)[0]).toMatchObject({ kind: 'store_green', urgency: 'now' });

    const old = buildLots(snap()).get(LOT);
    expect(tasksForLot(old, NOW)[0]).toMatchObject({ kind: 'store_green', urgency: 'late', ageDays: 20 });
  });

  it('café verde en bodega se ofrece para la maquila con lo disponible del ledger', () => {
    const lot = buildLots(snap({
      green: [{ id: 1, lot_id: LOT, weight_kg: 110, location: 'V-01', storage_date: '2026-09-10', created_at: daysAgo(14) }],
      greenQuants: [{ lot_id: LOT, kg: 108.5 }],
    })).get(LOT);
    const [task] = tasksForLot(lot, NOW);
    expect(task).toMatchObject({ kind: 'send_roasting', urgency: 'anytime', facts: { availableKg: 108.5 } });
    expect(lot.balance.dryingLossKg).toBe(15);
  });

  it('la maquila pasa de espera a atrasada según los días fuera', () => {
    const at = (days) => buildLots(snap({
      green: [{ id: 1, lot_id: LOT, weight_kg: 100, location: 'V-01', storage_date: '2026-09-01', created_at: daysAgo(23) }],
      greenQuants: [{ lot_id: LOT, kg: 0 }],
      roasting: [{ id: 7, lot_id: LOT, quantity_sent_kg: 100, status: 'in_roasting', created_at: daysAgo(days) }],
    })).get(LOT);

    expect(tasksForLot(at(1), NOW)[0]).toMatchObject({ kind: 'receive_roast', urgency: 'waiting', ref: { roastingId: 7 } });
    expect(tasksForLot(at(MAQUILA_EXPECTED_DAYS), NOW)[0].urgency).toBe('now');
    expect(tasksForLot(at(MAQUILA_LATE_DAYS), NOW)[0].urgency).toBe('late');
    expect(at(1).balance.maquilaKg).toBe(100);
  });

  it('el tostado sin ubicación pide guardarse; ubicado y reposado pide empaque', () => {
    const base = {
      green: [{ id: 1, lot_id: LOT, weight_kg: 100, location: 'V-01', storage_date: '2026-09-01', created_at: daysAgo(23) }],
      greenQuants: [{ lot_id: LOT, kg: 0 }],
      roasting: [{ id: 7, lot_id: LOT, quantity_sent_kg: 100, status: 'completed', created_at: daysAgo(12) }],
    };
    const unplaced = buildLots(snap({
      ...base,
      roasted: [{ id: 3, roasting_id: 7, roast_level: 'MEDIUM', weight_kg: 84, weight_loss_percent: 16, status: 'ready_for_storage', created_at: daysAgo(0) }],
    })).get(LOT);
    expect(kinds(tasksForLot(unplaced, NOW))).toEqual(['store_roasted', 'cupping']);

    const placed = buildLots(snap({
      ...base,
      roasted: [{ id: 3, roasting_id: 7, roast_level: 'MEDIUM', weight_kg: 84, weight_loss_percent: 16, status: 'stored', created_at: daysAgo(5) }],
      roastedStorage: [{ id: 9, roasted_id: 3, location: 'T-02', container_type: 'bolsa', container_count: 4, status: 'ready_for_packaging', created_at: daysAgo(5) }],
    })).get(LOT);
    const pack = tasksForLot(placed, NOW).find((t) => t.kind === 'pack');
    expect(pack).toMatchObject({ urgency: 'anytime', ref: { roastedStorageId: 9 }, facts: { kg: 84 } });
    expect(placed.balance).toMatchObject({ roastedKg: 84, roastLossKg: 16 });
  });

  it('el tostado recién salido reposa antes de empacar', () => {
    const lot = buildLots(snap({
      roasting: [{ id: 7, lot_id: LOT, quantity_sent_kg: 10, status: 'completed', created_at: daysAgo(3) }],
      roasted: [{ id: 3, roasting_id: 7, weight_kg: 8.4, weight_loss_percent: 16, status: 'stored', created_at: daysAgo(1) }],
      roastedStorage: [{ id: 9, roasted_id: 3, status: 'ready_for_packaging', created_at: daysAgo(1) }],
      green: [{ id: 1, lot_id: LOT, weight_kg: 10, storage_date: '2026-09-01', created_at: daysAgo(20) }],
    })).get(LOT);
    expect(tasksForLot(lot, NOW).find((t) => t.kind === 'pack').urgency).toBe('waiting');
  });

  it('cuenta las etiquetas que faltan y reconstruye el peso tostado original', () => {
    const lot = buildLots(snap({
      green: [{ id: 1, lot_id: LOT, weight_kg: 10, storage_date: '2026-09-01', created_at: daysAgo(20) }],
      roasting: [{ id: 7, lot_id: LOT, quantity_sent_kg: 10, status: 'completed', created_at: daysAgo(10) }],
      roasted: [{ id: 3, roasting_id: 7, weight_kg: 0.4, weight_loss_percent: 16, status: 'stored', created_at: daysAgo(8) }],
      roastedStorage: [{ id: 9, roasted_id: 3, status: 'ready_for_packaging', created_at: daysAgo(8) }],
      packaged: [{ id: 21, roasted_storage_id: 9, lot_id: LOT, package_size: '250g', unit_count: 32, created_at: daysAgo(1) }],
      labels: [{ lot_id: LOT, total: 12, printed: 12, last_at: daysAgo(1) }],
      cuppings: [{ id: 1, check_number: `CUP-${LOT}-AB12`, overall_score: 84, check_date: daysAgo(6) }],
    })).get(LOT);

    const label = tasksForLot(lot, NOW).find((t) => t.kind === 'label');
    expect(label).toMatchObject({ facts: { missing: 20 }, ref: { packagedId: 21, quantity: 20 } });
    expect(lot.roasts[0].received.outKg).toBe(8.4);
    expect(lot.balance.packedKg).toBe(8);
    expect(lot.stations.label).toBe('active');
  });
});

describe('bandeja y ficha', () => {
  const multi = () => snap({
    harvests: [
      harvest(),
      harvest({ id: 2, lot_id: 'COL-NAR-1900-GER-NAT-0001', farm: 'finca-nariño', created_at: daysAgo(1) }),
    ],
    farms: [{ slug: 'finca-nariño', name: 'Nariño Premium', caficultor_id: 55 }],
  });

  it('ordena por urgencia y cuenta por nivel', () => {
    const q = buildQueue(multi(), admin, NOW);
    expect(q.tasks.map((t) => t.urgency)).toEqual(['late', 'now']);
    expect(q.counts).toMatchObject({ late: 1, now: 1 });
    expect(q.lots).toHaveLength(2);
    expect(q.tasks[1].lot.farmName).toBe('Nariño Premium');
  });

  it('el caficultor solo ve lotes de sus fincas o sin dueño, y solo sus pasos', () => {
    const q = buildQueue(multi(), { id: 99, role: 'caficultor' }, NOW);
    expect(q.tasks.map((t) => t.lotId)).toEqual([LOT]);

    const lotWithCupping = snap({
      roasting: [{ id: 7, lot_id: LOT, quantity_sent_kg: 10, status: 'completed', created_at: daysAgo(3) }],
      roasted: [{ id: 3, roasting_id: 7, weight_kg: 8.4, weight_loss_percent: 16, status: 'ready_for_storage', created_at: daysAgo(1) }],
      green: [{ id: 1, lot_id: LOT, weight_kg: 10, storage_date: '2026-09-01', created_at: daysAgo(20) }],
    });
    expect(buildQueue(lotWithCupping, { id: 99, role: 'caficultor' }, NOW).tasks).toEqual([]);
  });

  it('la ficha narra la historia en orden y sugiere el perfil de la catación', () => {
    const j = buildJourney(snap({
      green: [{ id: 1, lot_id: LOT, weight_kg: 110, location: 'V-01', storage_date: '2026-09-06', created_at: daysAgo(18) }],
      greenQuants: [{ lot_id: LOT, kg: 10 }],
      roasting: [{ id: 7, lot_id: LOT, quantity_sent_kg: 100, status: 'completed', created_at: daysAgo(12) }],
      roasted: [{ id: 3, roasting_id: 7, weight_kg: 84, weight_loss_percent: 16, status: 'ready_for_storage', created_at: daysAgo(4) }],
      cuppings: [{ id: 1, check_number: `CUP-${LOT}-AB12`, overall_score: 84, acidity_score: 8, body_score: 7.5, balance_score: 9, check_date: daysAgo(2) }],
    }), LOT, admin, NOW);

    expect(j.events.map((e) => e.kind)).toEqual(['harvest', 'green_in', 'sent_roasting', 'roast_received', 'cupping']);
    expect(j.events[3].data).toMatchObject({ kg: 84, lossPct: 16, days: 8 });
    expect(j.suggestedProfile).toMatchObject({ acidity: 3, body: 3, balance: 4 });
    expect(j.strandedGreenKg).toBe(10);
    expect(buildJourney(snap(), 'NO-EXISTE', admin, NOW)).toBeNull();
  });
});
