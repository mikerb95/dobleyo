import { query } from '../db.js';

/**
 * Permite que un movimiento de inventory_movements pertenezca a una variante
 * (product_variants) en vez de al producto entero. NULL = movimiento del
 * producto, como hasta ahora; con valor = movimiento de esa variante.
 * Sin esta columna, los ajustes de stock de variantes solo podían sobrescribir
 * el número sin dejar rastro en el libro de movimientos.
 */
export async function addVariantIdToMovements() {
  try {
    await query('ALTER TABLE inventory_movements ADD COLUMN variant_id INTEGER');
    console.log('  ✓ inventory_movements.variant_id añadida');
  } catch {
    // columna ya existe — ignorar
  }

  await query('CREATE INDEX IF NOT EXISTS idx_inv_movements_variant ON inventory_movements(variant_id)');

  console.log('[Migration] inventory_movements.variant_id lista.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addVariantIdToMovements()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch(err => { console.error(err); process.exit(1); })
  );
}
