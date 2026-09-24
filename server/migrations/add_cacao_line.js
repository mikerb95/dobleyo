/**
 * Línea de cacao: nueva categoría 'cacao' en products + seed de los 5 productos.
 *
 * SQLite no permite modificar un CHECK con ALTER TABLE, así que la tabla se
 * reconstruye: se toma el DDL vivo (conserva el orden de columnas, incluidas
 * las añadidas por migraciones posteriores), se crea products_new con el CHECK
 * ampliado, se copian los datos, se reemplaza la tabla y se recrean los
 * índices. Todo va en client.migrate(), que ejecuta el lote en una sola
 * transacción con las foreign keys desactivadas: las 14 tablas que referencian
 * products siguen apuntando por nombre a la tabla nueva sin perder filas.
 *
 * Idempotente: si el DDL ya admite 'cacao' no reconstruye, y el seed usa
 * ON CONFLICT DO NOTHING para no pisar precios o stock editados en el admin.
 */
import libsqlClient, { query } from '../db.js';

const OLD_CHECK = /CHECK\s*\(\s*category\s+IN\s*\(\s*'cafe'\s*,\s*'accesorio'\s*,\s*'merchandising'\s*\)\s*\)/i;
const NEW_CHECK = `CHECK (category IN ('cafe', 'accesorio', 'merchandising', 'cacao'))`;

// Precios y gramajes de referencia: se ajustan desde /admin/productos.
const CACAO_PRODUCTS = [
  {
    id: 'cac-mesa',
    sku: 'CAC-001',
    slug: 'chocolate-de-mesa',
    name: 'Chocolate de Mesa',
    name_en: 'Drinking Chocolate Tablets',
    subcategory: 'chocolate',
    description: 'Chocolate de mesa 100% ecológico con 70% de cacao, en pastillas. Más cacao por porción, más rendidor en cada taza.',
    notes: { es: ['70% cacao', 'Ecológico', 'En pastillas'], en: ['70% cacao', 'Organic', 'Tablets'] },
    price: 26000, price_usd: 7, weight: 500, weight_unit: 'g',
    image_url: '/assets/img/cacao/chocolate-de-mesa.webp',
  },
  {
    id: 'cac-barra',
    sku: 'CAC-002',
    slug: 'barras-de-cacao',
    name: 'Barras de Cacao',
    name_en: 'Cacao Bars',
    subcategory: 'barra',
    description: 'Barras de cacao para disfrutar y aprovechar todo su potencial energético y nutritivo.',
    notes: { es: ['100% cacao', 'Energético', 'Nutritivo'], en: ['100% cacao', 'Energizing', 'Nutritious'] },
    price: 12000, price_usd: 3, weight: 100, weight_unit: 'g',
    image_url: '/assets/img/cacao/barras-de-cacao.webp',
  },
  {
    id: 'cac-polvo',
    sku: 'CAC-003',
    slug: 'cacao-en-polvo',
    name: 'Cacao en Polvo 100%',
    name_en: '100% Cacao Powder',
    subcategory: 'polvo',
    description: 'Cacao en polvo 100%, ideal para repostería y pastelería. Se disfruta frío o caliente, de manera más rápida.',
    notes: { es: ['100% cacao', 'Repostería', 'Frío o caliente'], en: ['100% cacao', 'Baking', 'Hot or cold'] },
    price: 22000, price_usd: 6, weight: 250, weight_unit: 'g',
    image_url: '/assets/img/cacao/cacao-en-polvo.webp',
  },
  {
    id: 'cac-grano',
    sku: 'CAC-004',
    slug: 'cacao-en-forma-de-cafe',
    name: 'Cacao en Forma de Café',
    name_en: 'Coffee Bean Shaped Cacao',
    subcategory: 'chocolate',
    description: 'Cacao moldeado en forma de grano de café. Maridaje ideal para el café y para decorar postres.',
    notes: { es: ['Maridaje con café', 'Decoración de postres'], en: ['Coffee pairing', 'Dessert topping'] },
    price: 16000, price_usd: 4, weight: 150, weight_unit: 'g',
    image_url: '/assets/img/cacao/cacao-forma-de-cafe.webp',
  },
  {
    id: 'cac-manteca',
    sku: 'CAC-005',
    slug: 'manteca-de-cacao',
    name: 'Manteca de Cacao',
    name_en: 'Cacao Butter',
    subcategory: 'manteca',
    description: 'Manteca de cacao de extracción en frío, pensada para chocolateros y reposteros.',
    notes: { es: ['Extracción en frío', 'Chocolatería', 'Repostería'], en: ['Cold pressed', 'Chocolate making', 'Baking'] },
    price: 38000, price_usd: 10, weight: 250, weight_unit: 'g',
    image_url: '/assets/img/cacao/manteca-de-cacao.webp',
  },
];

// Stock inicial de referencia para que la línea se pueda comprar desde el día uno.
const INITIAL_STOCK = 20;

async function widenCategoryCheck() {
  const { rows } = await query(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'products'`);
  const ddl = rows[0]?.sql ?? '';
  if (/'cacao'/.test(ddl)) {
    console.log('[Migration] products ya admite la categoría cacao, se omite la reconstrucción.');
    return;
  }
  if (!OLD_CHECK.test(ddl)) {
    throw new Error('El CHECK de products.category no coincide con el esperado; revise el DDL antes de reconstruir.');
  }

  const newDdl = ddl
    .replace(/^CREATE TABLE\s+"?products"?/i, 'CREATE TABLE products_new')
    .replace(OLD_CHECK, NEW_CHECK);

  // Los autoindex (PK y UNIQUE) se regeneran solos con el CREATE TABLE.
  const { rows: indexes } = await query(
    `SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'products' AND sql IS NOT NULL`
  );

  await libsqlClient.migrate([
    'DROP TABLE IF EXISTS products_new',
    newDdl,
    'INSERT INTO products_new SELECT * FROM products',
    'DROP TABLE products',
    'ALTER TABLE products_new RENAME TO products',
    ...indexes.map((i) => i.sql),
  ]);

  const { rows: violations } = await query('PRAGMA foreign_key_check');
  if (violations.length) {
    console.warn(`[Migration] foreign_key_check reporta ${violations.length} filas huérfanas (preexistentes).`);
  }
  console.log('[Migration] products reconstruida con la categoría cacao.');
}

export async function addCacaoLine() {
  const { rows: tables } = await query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'`
  );
  if (!tables.length) {
    console.log('[Migration] Tabla products no existe aún, se omite add_cacao_line.');
    return;
  }

  await widenCategoryCheck();

  for (const p of CACAO_PRODUCTS) {
    await query(
      `INSERT INTO products
         (id, sku, slug, name, name_en, description, category, subcategory,
          tasting_notes, price, price_usd, weight, weight_unit,
          is_new, is_active, stock_quantity, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'cacao', ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, datetime('now'))
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.sku, p.slug, p.name, p.name_en, p.description, p.subcategory,
       JSON.stringify(p.notes), p.price, p.price_usd, p.weight, p.weight_unit,
       INITIAL_STOCK, p.image_url]
    );
  }
  console.log(`[Migration] ${CACAO_PRODUCTS.length} productos de cacao sembrados.`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addCacaoLine()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch((err) => { console.error(err); process.exit(1); })
  );
}
