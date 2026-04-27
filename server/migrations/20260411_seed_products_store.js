import { query } from '../db.js';

export async function seedStoreProducts() {
  console.log('🛍️  Iniciando migración de productos de tienda...');

  // Agregar columnas faltantes (idempotente via try/catch)
  const newColumns = [
    { name: 'tasting_notes', def: 'TEXT' },
    { name: 'name_en',       def: 'TEXT' },
    { name: 'price_usd',     def: 'INTEGER' },
    { name: 'slug',          def: 'TEXT' },
  ];
  for (const col of newColumns) {
    try {
      await query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.def}`);
      console.log(`  ✓ Columna añadida: ${col.name}`);
    } catch {
      // columna ya existe — ignorar
    }
  }

  const products = [
    {
      id: 'cf-sierra', slug: 'sierra-nevada', name: 'Sierra Nevada', name_en: 'Sierra Nevada',
      category: 'cafe', origin: 'Sierra Nevada', process: 'Lavado', roast: 'Medio',
      tasting_notes: JSON.stringify({ es: ['Cacao', 'Nuez', 'Caramelo'], en: ['Cocoa', 'Hazelnut', 'Caramel'] }),
      price: 42000, price_usd: 11, rating: 4.6,
      is_deal: 1, is_bestseller: 1, is_fast: 1, is_active: 1, stock_quantity: 50,
      image_url: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'cf-huila', slug: 'huila', name: 'Huila', name_en: 'Huila',
      category: 'cafe', origin: 'Huila', process: 'Honey', roast: 'Claro',
      tasting_notes: JSON.stringify({ es: ['Cítricos', 'Miel', 'Floral'], en: ['Citrus', 'Honey', 'Floral'] }),
      price: 45000, price_usd: 12, rating: 4.7,
      is_new: 1, is_fast: 1, is_active: 1, stock_quantity: 40,
      image_url: 'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'cf-nar', slug: 'narino', name: 'Nariño', name_en: 'Nariño',
      category: 'cafe', origin: 'Nariño', process: 'Natural', roast: 'Oscuro',
      tasting_notes: JSON.stringify({ es: ['Frutas Rojas', 'Chocolate', 'Té Negro'], en: ['Red Fruits', 'Chocolate', 'Black Tea'] }),
      price: 48000, price_usd: 13, rating: 4.5,
      is_active: 1, stock_quantity: 30,
      image_url: 'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'acc-molinillo', slug: 'molinillo-manual', name: 'Molinillo Manual', name_en: 'Manual Coffee Grinder',
      category: 'accesorio',
      price: 199900, price_usd: 52, rating: 4.3,
      is_deal: 1, is_fast: 1, is_active: 1, stock_quantity: 15,
      image_url: 'https://images.unsplash.com/photo-1507133750040-4a8f57021524?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'acc-chemex', slug: 'chemex-6-tazas', name: 'Chemex 6 tazas', name_en: 'Chemex 6-cup',
      category: 'accesorio',
      price: 269900, price_usd: 70, rating: 4.9,
      is_new: 1, is_active: 1, stock_quantity: 8,
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
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT (id) DO UPDATE SET
         slug          = excluded.slug,
         name          = excluded.name,
         name_en       = excluded.name_en,
         tasting_notes = excluded.tasting_notes,
         price         = excluded.price,
         price_usd     = excluded.price_usd,
         rating        = excluded.rating,
         is_deal       = excluded.is_deal,
         is_bestseller = excluded.is_bestseller,
         is_new        = excluded.is_new,
         is_fast       = excluded.is_fast,
         image_url     = excluded.image_url`,
      [
        p.id, p.slug, p.name, p.name_en ?? null, p.category,
        p.origin ?? null, p.process ?? null, p.roast ?? null,
        p.tasting_notes ?? null, p.price, p.price_usd ?? null, p.rating ?? null,
        p.is_deal ?? 0, p.is_bestseller ?? 0,
        p.is_new ?? 0, p.is_fast ?? 0, p.is_active ?? 1,
        p.stock_quantity, p.image_url,
      ]
    );
    console.log(`  ✓ Producto seed: ${p.id}`);
  }

  console.log('✅ Migración de productos completada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    seedStoreProducts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
  );
}
