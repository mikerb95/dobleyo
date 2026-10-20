/**
 * Retira de la tienda los productos de demostración (Sierra Nevada, Huila,
 * Nariño, molinillo, Chemex y los tres kits), que se sembraron con fotos de
 * Unsplash y no son el catálogo real.
 *
 * Se desactivan (is_active = 0), no se borran: pedidos y reseñas los referencian.
 * Solo toca los que siguen con foto de stock, así que un producto al que se le
 * suba foto real y se reactive desde /admin/productos no se vuelve a apagar en
 * el siguiente despliegue.
 */
import { query } from '../db.js';

const DEMO_IDS = [
  'cf-sierra',
  'cf-huila',
  'cf-nar',
  'acc-molinillo',
  'acc-chemex',
  'kit-iniciacion-barista',
  'kit-regalo-especial',
  'kit-trazabilidad-completa',
];

export async function retireDemoProducts() {
  const { rows: tables } = await query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'`
  );
  if (!tables.length) {
    console.log('[Migration] Tabla products no existe aún, se omite retire_demo_products.');
    return;
  }

  const placeholders = DEMO_IDS.map(() => '?').join(', ');
  const result = await query(
    `UPDATE products
        SET is_active = 0, updated_at = datetime('now')
      WHERE id IN (${placeholders})
        AND is_active = 1
        AND image_url LIKE 'https://images.unsplash.com/%'`,
    DEMO_IDS
  );
  console.log(`[Migration] Productos demo desactivados: ${result.rowCount ?? 0}`);
}
