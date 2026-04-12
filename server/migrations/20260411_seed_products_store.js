import { query } from '../db.js';

/**
 * Migración: Columnas de tienda + seed de productos iniciales
 * - Agrega tasting_notes (JSONB), name_en, price_usd a la tabla products
 * - Inserta los 5 productos del catálogo inicial (idempotente)
 */
export async function seedStoreProducts() {
  console.log('🛍️  Iniciando migración de productos de tienda...');

  // 1. Agregar columnas faltantes (idempotente)
  const newColumns = [
    { name: 'tasting_notes',  type: 'JSONB' },
    { name: 'name_en',        type: 'VARCHAR(160)' },
    { name: 'price_usd',      type: 'INTEGER' },
    { name: 'slug',           type: 'VARCHAR(100) UNIQUE' },
  ];

  for (const col of newColumns) {
    const exists = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'products' AND column_name = $1`,
      [col.name]
    );
    if (!exists.rows.length) {
      await query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`);
      console.log(`  ✓ Columna añadida: ${col.name}`);
    }
  }

  // 2. Seed de los 5 productos del catálogo inicial
  const products = [
    {
      id: 'cf-sierra',
      slug: 'sierra-nevada',
      name: 'Sierra Nevada',
      name_en: 'Sierra Nevada',
      category: 'cafe',
      origin: 'Sierra Nevada',
      process: 'Lavado',
      roast: 'Medio',
      tasting_notes: JSON.stringify({ es: ['Cacao', 'Nuez', 'Caramelo'], en: ['Cocoa', 'Hazelnut', 'Caramel'] }),
      price: 42000,
      price_usd: 11,
      rating: 4.6,
      is_deal: true,
      is_bestseller: true,
      is_fast: true,
      is_active: true,
      stock_quantity: 50,
      image_url: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'cf-huila',
      slug: 'huila',
      name: 'Huila',
      name_en: 'Huila',
      category: 'cafe',
      origin: 'Huila',
      process: 'Honey',
      roast: 'Claro',
      tasting_notes: JSON.stringify({ es: ['Cítricos', 'Miel', 'Floral'], en: ['Citrus', 'Honey', 'Floral'] }),
      price: 45000,
      price_usd: 12,
      rating: 4.7,
      is_new: true,
      is_fast: true,
      is_active: true,
      stock_quantity: 40,
      image_url: 'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'cf-nar',
      slug: 'narino',
      name: 'Nariño',
      name_en: 'Nariño',
      category: 'cafe',
      origin: 'Nariño',
      process: 'Natural',
      roast: 'Oscuro',
      tasting_notes: JSON.stringify({ es: ['Frutas Rojas', 'Chocolate', 'Té Negro'], en: ['Red Fruits', 'Chocolate', 'Black Tea'] }),
      price: 48000,
      price_usd: 13,
      rating: 4.5,
      is_active: true,
      stock_quantity: 30,
      image_url: 'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'acc-molinillo',
      slug: 'molinillo-manual',
      name: 'Molinillo Manual',
      name_en: 'Manual Coffee Grinder',
      category: 'accesorio',
      price: 199900,
      price_usd: 52,
      rating: 4.3,
      is_deal: true,
      is_fast: true,
      is_active: true,
      stock_quantity: 15,
      image_url: 'https://images.unsplash.com/photo-1507133750040-4a8f57021524?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'acc-chemex',
      slug: 'chemex-6-tazas',
      name: 'Chemex 6 tazas',
      name_en: 'Chemex 6-cup',
      category: 'accesorio',
      price: 269900,
      price_usd: 70,
      rating: 4.9,
      is_new: true,
      is_active: true,
      stock_quantity: 8,
      image_url: 'https://images.unsplash.com/photo-1503481766315-7a586b20f66f?q=80&w=800&auto=format&fit=crop',
    },
  ];

  for (const p of products) {
    await query(
      `INSERT INTO products
         (id, slug, name, name_en, category, origin, process, roast,
          tasting_notes, price, price_usd, rating,
          is_deal, is_bestseller, is_new, is_fast, is_active,
          stock_quantity, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET
         slug          = EXCLUDED.slug,
         name          = EXCLUDED.name,
         name_en       = EXCLUDED.name_en,
         tasting_notes = EXCLUDED.tasting_notes,
         price         = EXCLUDED.price,
         price_usd     = EXCLUDED.price_usd,
         rating        = EXCLUDED.rating,
         is_deal       = EXCLUDED.is_deal,
         is_bestseller = EXCLUDED.is_bestseller,
         is_new        = EXCLUDED.is_new,
         is_fast       = EXCLUDED.is_fast,
         image_url     = EXCLUDED.image_url,
         updated_at    = NOW()`,
      [
        p.id, p.slug, p.name, p.name_en ?? null, p.category,
        p.origin ?? null, p.process ?? null, p.roast ?? null,
        p.tasting_notes ?? null, p.price, p.price_usd ?? null, p.rating,
        p.is_deal ?? false, p.is_bestseller ?? false,
        p.is_new ?? false, p.is_fast ?? false, p.is_active,
        p.stock_quantity, p.image_url,
      ]
    );
    console.log(`  ✓ Producto seed: ${p.id}`);
  }

  console.log('✅ Migración de productos completada.');
}
