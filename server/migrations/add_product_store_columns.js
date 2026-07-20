import { query } from '../db.js';

/**
 * Columnas de products que consume la tienda pública (tienda.astro,
 * producto/[id].astro, sitio EN) y que se añadieron fuera de db/schema.sql.
 * Idempotente: ALTER TABLE ADD COLUMN falla si la columna ya existe.
 */
export async function addProductStoreColumns() {
  const columns = [
    { name: 'slug',          def: 'TEXT' },
    { name: 'name_en',       def: 'TEXT' },
    { name: 'price_usd',     def: 'INTEGER' },
    { name: 'tasting_notes', def: 'TEXT' },
  ];

  for (const col of columns) {
    try {
      await query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.def}`);
      console.log(`  ✓ products.${col.name} añadida`);
    } catch {
      // columna ya existe — ignorar
    }
  }

  // El slug resuelve la URL pública del producto: no puede repetirse.
  await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');

  // Backfill de slugs faltantes a partir del id, que ya es único.
  await query("UPDATE products SET slug = id WHERE slug IS NULL OR trim(slug) = ''");

  console.log('[Migration] Columnas de tienda en products listas.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addProductStoreColumns()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch(err => { console.error(err); process.exit(1); })
  );
}
