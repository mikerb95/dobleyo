/**
 * Cafés de Finca Rengifo (Huila): Isnos Geisha y Pitalito Sidra, 250 g en grano.
 *
 * Datos tomados del empaque: municipio, altitud, productor, variedad, proceso
 * (lavado con fermentación anaeróbica de 40 horas) y tostión media. La foto de
 * empaque va en image_url y las fotos de ambiente en images (galería de la ficha).
 *
 * Idempotente: ON CONFLICT DO NOTHING para no pisar precios o stock editados
 * en /admin/productos.
 */
import { query } from '../db.js';

// Precios de referencia: se ajustan desde /admin/productos.
const HUILA_PRODUCTS = [
  {
    id: 'cf-isnos-geisha',
    sku: 'CAF-ISN-GEI-250',
    slug: 'isnos-geisha',
    name: 'Isnos Geisha',
    name_en: 'Isnos Geisha',
    origin: 'Isnos, Huila',
    description: 'Café Geisha de Finca Rengifo, cultivado a 1.620 m.s.n.m. en Isnos, Huila, por Jaime Morales. Proceso lavado con fermentación anaeróbica por 40 horas y tostión media. Presentación en grano de 250 g.',
    price: 72000, price_usd: 19,
    image_url: '/assets/img/cafe/isnos-geisha.webp',
    images: ['/assets/img/cafe/isnos-geisha-cocina.webp', '/assets/img/cafe/isnos-geisha-molino.webp'],
  },
  {
    id: 'cf-pitalito-sidra',
    sku: 'CAF-PIT-SID-250',
    slug: 'pitalito-sidra',
    name: 'Pitalito Sidra',
    name_en: 'Pitalito Sidra',
    origin: 'Pitalito, Huila',
    description: 'Café Sidra de Finca Rengifo, cultivado a 1.700 m.s.n.m. en Pitalito, Huila, por Fabián Muñoz. Proceso lavado con fermentación anaeróbica por 40 horas y tostión media. Presentación en grano de 250 g.',
    price: 65000, price_usd: 17,
    image_url: '/assets/img/cafe/pitalito-sidra.webp',
    images: ['/assets/img/cafe/pitalito-sidra-prensa.webp', '/assets/img/cafe/pitalito-sidra-molino.webp'],
  },
];

// Stock inicial de referencia para que los cafés se puedan comprar desde el día uno.
const INITIAL_STOCK = 20;

export async function addHuilaMicrolots() {
  const { rows: tables } = await query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'`
  );
  if (!tables.length) {
    console.log('[Migration] Tabla products no existe aún, se omite add_huila_microlots.');
    return;
  }

  for (const p of HUILA_PRODUCTS) {
    await query(
      `INSERT INTO products
         (id, sku, slug, name, name_en, description, category, subcategory,
          origin, process, roast, price, price_usd, weight, weight_unit,
          is_new, is_active, stock_quantity, image_url, images, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'cafe', 'Huila', ?, 'Lavado', 'Medio', ?, ?, 250, 'g',
               1, 1, ?, ?, ?, datetime('now'))
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.sku, p.slug, p.name, p.name_en, p.description, p.origin,
       p.price, p.price_usd, INITIAL_STOCK, p.image_url, JSON.stringify(p.images)]
    );
  }
  console.log(`[Migration] ${HUILA_PRODUCTS.length} cafés de Finca Rengifo sembrados.`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addHuilaMicrolots()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch((err) => { console.error(err); process.exit(1); })
  );
}
