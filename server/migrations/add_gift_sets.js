import { query } from '../db.js';

export async function addGiftSets() {
    // Verificar que la tabla products existe antes de alterar
    const { rows: tables } = await query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='products'`
    );
    if (!tables.length) {
        console.log('[Migration] Tabla products no existe aún — omitiendo add_gift_sets. Ejecuta el schema base primero.');
        return;
    }

    // Añadir columna is_gift_set a products
    try {
        await query(`ALTER TABLE products ADD COLUMN is_gift_set INTEGER NOT NULL DEFAULT 0`);
        console.log('[Migration] Columna is_gift_set añadida a products.');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('[Migration] Columna is_gift_set ya existe, se omite.');
        } else {
            throw err;
        }
    }

    await query(`CREATE INDEX IF NOT EXISTS idx_products_gift_set ON products(is_gift_set)`);

    // Seed: 3 kits de regalo
    const kits = [
        {
            id: 'kit-iniciacion-barista',
            sku: 'KIT-001',
            name: 'Kit Iniciación Barista',
            slug: 'kit-iniciacion-barista',
            category: 'accesorio',
            description: 'El kit perfecto para quien quiere empezar en el mundo del café de especialidad. Incluye café de origen único y una guía de preparación.',
            price: 89900,
            price_usd: 23,
            stock_quantity: 10,
            image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
            is_gift_set: 1,
            is_active: 1,
            tasting_notes: JSON.stringify({ es: ['Café de origen', 'Guía barista', 'Empaque regalo'], en: ['Single origin coffee', 'Barista guide', 'Gift packaging'] }),
        },
        {
            id: 'kit-regalo-especial',
            sku: 'KIT-002',
            name: 'Kit Regalo Especial',
            slug: 'kit-regalo-especial',
            category: 'accesorio',
            description: 'Dos cafés de distintas regiones de Colombia para explorar los perfiles únicos de cada origen. Presentación especial para regalo.',
            price: 129900,
            price_usd: 34,
            stock_quantity: 8,
            image_url: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?q=80&w=800&auto=format&fit=crop',
            is_gift_set: 1,
            is_active: 1,
            tasting_notes: JSON.stringify({ es: ['2 orígenes', 'Caja de regalo', 'Tarjeta personalizable'], en: ['2 origins', 'Gift box', 'Personalizable card'] }),
        },
        {
            id: 'kit-trazabilidad-completa',
            sku: 'KIT-003',
            name: 'Kit Trazabilidad Completa',
            slug: 'kit-trazabilidad-completa',
            category: 'accesorio',
            description: 'Café con trazabilidad completa de finca a taza. Incluye código QR para rastrear el origen, conocer al caficultor y ver el proceso de tostión.',
            price: 159900,
            price_usd: 42,
            stock_quantity: 5,
            image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?q=80&w=800&auto=format&fit=crop',
            is_gift_set: 1,
            is_active: 1,
            tasting_notes: JSON.stringify({ es: ['Café premium', 'QR trazabilidad', 'Historia del lote'], en: ['Premium coffee', 'Traceability QR', 'Lot history'] }),
        },
    ];

    for (const kit of kits) {
        await query(
            `INSERT INTO products (id, sku, name, slug, category, description, price, price_usd, stock_quantity, image_url, is_gift_set, is_active, tasting_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO NOTHING`,
            [kit.id, kit.sku, kit.name, kit.slug, kit.category, kit.description,
             kit.price, kit.price_usd, kit.stock_quantity, kit.image_url,
             kit.is_gift_set, kit.is_active, kit.tasting_notes]
        );
    }

    console.log('[Migration] 3 kits de regalo insertados.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    import('dotenv/config').then(() =>
        addGiftSets()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(err => { console.error(err); process.exit(1); })
    );
}
