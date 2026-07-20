import { query } from './server/db.js';
import { storeGreenCoffee, sendToRoasting, receiveRoasted, storeRoasted } from './server/services/coffeeService.js';
import { listLocations, transferStock, adjustStock, reconcileReport, postMovement } from './server/services/storageService.js';

const user = { id: 1 };
const show = async (label) => {
  const locs = await listLocations({ includeInactive: true });
  console.log(`\n── ${label}`);
  for (const l of locs.filter((x) => x.occupied_kg > 0)) {
    console.log(`   ${l.code.padEnd(20)} ${String(l.occupied_kg).padStart(8)} kg  ${l.fill_pct != null ? l.fill_pct + '%' : '—'}`);
  }
};

const expectFail = async (label, fn) => {
  try { await fn(); console.log(`   ❌ NO falló: ${label}`); }
  catch (e) { console.log(`   ✅ ${label} → [${e.status}] ${e.message}`); }
};

await query(`INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, region, altitude)
  VALUES ('COL-CAU-1750-CAS-NAT-EF56','finca-cauca','CAS','templado','NAT','frutal','mora','CAU',1750)`);

console.log('\n=== 1. Almacenar café verde ===');
const g = await storeGreenCoffee({ lotId: 'COL-CAU-1750-CAS-NAT-EF56', weight: 400, weightUnit: 'kg', location: 'GREEN-A-01', storageDate: '2026-07-20', user });
console.log('   guardado en', g.location, 'id', g.storageId);
await show('Ocupación');

console.log('\n=== 2. Validaciones de negocio ===');
const L = 'COL-CAU-1750-CAS-NAT-EF56';
await expectFail('Ubicación inexistente', () => postMovement({ type: 'receipt', to: 'NO-EXISTE', lotId: L, stockState: 'green', qtyKg: 10, user }));
await expectFail('Tipo incompatible (verde en estante de tostado)', () => postMovement({ type: 'receipt', to: 'ROASTED-A-01', lotId: L, stockState: 'green', qtyKg: 10, user }));
await expectFail('Capacidad excedida (GREEN-A-01 cabe 1500)', () => postMovement({ type: 'receipt', to: 'GREEN-A-01', lotId: L, stockState: 'green', qtyKg: 2000, user }));
await query(`UPDATE storage_locations SET is_blocked = 1, block_reason = 'Conteo en curso' WHERE code = 'GREEN-B-01'`);
await expectFail('Ubicación bloqueada', () => postMovement({ type: 'receipt', to: 'GREEN-B-01', lotId: L, stockState: 'green', qtyKg: 10, user }));
await query(`UPDATE storage_locations SET is_blocked = 0, block_reason = NULL WHERE code = 'GREEN-B-01'`);
await expectFail('Traslado sin existencia suficiente', () => transferStock({ fromCode: 'GREEN-A-01', toCode: 'GREEN-B-01', lotId: 'COL-CAU-1750-CAS-NAT-EF56', stockState: 'green', qtyKg: 9999, user }));
await expectFail('Origen igual a destino', () => transferStock({ fromCode: 'GREEN-A-01', toCode: 'GREEN-A-01', lotId: 'COL-CAU-1750-CAS-NAT-EF56', stockState: 'green', qtyKg: 1, user }));

console.log('\n=== 3. Idempotencia ===');
const uid = 'test-op-abc-123';
const m1 = await postMovement({ type: 'transfer', from: 'GREEN-A-01', to: 'GREEN-B-01', lotId: 'COL-CAU-1750-CAS-NAT-EF56', stockState: 'green', qtyKg: 100, movementUid: uid, user });
const m2 = await postMovement({ type: 'transfer', from: 'GREEN-A-01', to: 'GREEN-B-01', lotId: 'COL-CAU-1750-CAS-NAT-EF56', stockState: 'green', qtyKg: 100, movementUid: uid, user });
console.log(`   1er envío: movimiento ${m1.movementId}, idempotent=${m1.idempotent}`);
console.log(`   reintento: movimiento ${m2.movementId}, idempotent=${m2.idempotent}`);
console.log(m1.movementId === m2.movementId && m2.idempotent ? '   ✅ El reintento no duplicó stock' : '   ❌ Se duplicó');
await show('Tras traslado de 100 kg');

console.log('\n=== 4. Envío a tostión (consumo FIFO multiubicación) ===');
const r = await sendToRoasting({ lotId: 'COL-CAU-1750-CAS-NAT-EF56', quantitySent: 350, targetTemp: 210, user });
console.log('   retirado de:', JSON.stringify(r.issuedFrom.map((i) => `${i.location}:${i.qty_kg}kg`)));
await show('Tras enviar 350 kg a tostión');

console.log('\n=== 5. Tostión y almacenamiento de tostado ===');
const rc = await receiveRoasted({ roastingId: r.roastingId, roastLevel: 'MEDIUM', roastedWeight: 297 });
const sr = await storeRoasted({ roastedId: rc.roastedId, location: 'CLIMATE-02', container: 'BAG-5KG', containerCount: 60, user });
console.log(`   pérdida ${rc.weightLossPercent}% → almacenado en ${sr.location}`);
await show('Ocupación final');

console.log('\n=== 6. Ajuste con motivo (merma detectada) ===');
const adj = await adjustStock({ locationCode: 'CLIMATE-02', lotId: 'COL-CAU-1750-CAS-NAT-EF56', stockState: 'roasted', targetQtyKg: 295, reason: 'Merma por humedad detectada en inspección', user });
console.log(`   delta ${adj.delta} kg, movimiento ${adj.movementId}`);

console.log('\n=== 7. Salud del inventario (ledger vs proyección) ===');
const rec = await reconcileReport();
console.log(rec.inSync ? '   ✅ Ledger y existencias en sincronía' : `   ❌ ${rec.discrepancies.length} discrepancias`);

const tot = await query('SELECT COUNT(*) c FROM storage_movements');
console.log(`\n   Movimientos en el libro: ${tot.rows[0].c}`);
process.exit(0);
