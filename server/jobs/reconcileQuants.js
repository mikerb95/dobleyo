#!/usr/bin/env node
/**
 * Reconciliación de existencias contra el libro de movimientos.
 *
 * Uso:
 *   node server/jobs/reconcileQuants.js          → solo reporta (no escribe)
 *   node server/jobs/reconcileQuants.js --fix    → reconstruye storage_quants
 *
 * Ejecución manual desde /admin/sistema o desde la terminal. No se registra
 * como cron de Vercel: los crons son una función de plan pago y su activación
 * requiere autorización explícita.
 *
 * El ledger (storage_movements) es la fuente de verdad; storage_quants es una
 * proyección. Si divergen, gana el ledger.
 */
import 'dotenv/config';
import { reconcileReport, rebuildQuants } from '../services/storageService.js';

const fmt = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });

async function main() {
  const shouldFix = process.argv.includes('--fix');

  console.log('🔎 Comparando existencias contra el libro de movimientos...\n');
  const report = await reconcileReport();

  if (report.inSync) {
    console.log('✅ Sin discrepancias: las existencias reflejan el ledger.');
    return 0;
  }

  console.log(`⚠ ${report.discrepancies.length} discrepancia(s) encontrada(s):\n`);
  console.log('   UBICACIÓN            LOTE                          LEDGER      EXISTENCIA   DIFERENCIA');
  for (const d of report.discrepancies) {
    console.log(
      `   ${String(d.location_code).padEnd(20)} ${String(d.lot_id).padEnd(29)} ` +
      `${fmt(d.ledger_kg).padStart(9)} ${fmt(d.quant_kg).padStart(12)} ${fmt(d.diff_kg).padStart(12)}`
    );
  }

  if (!shouldFix) {
    console.log('\n   Ejecute con --fix para reconstruir las existencias desde el ledger.');
    return 1;
  }

  console.log('\n🔧 Reconstruyendo existencias desde el ledger...');
  const result = await rebuildQuants();
  console.log(`   ${result.movements} movimientos procesados → ${result.quants} existencias escritas.`);

  const after = await reconcileReport();
  if (!after.inSync) {
    console.error(`❌ Aún quedan ${after.discrepancies.length} discrepancias tras la reconstrucción.`);
    return 1;
  }
  console.log('✅ Existencias reconstruidas y en sincronía.');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => { console.error('❌', err.message); process.exit(1); });
