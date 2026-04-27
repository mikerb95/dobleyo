import { query } from '../db.js';

export async function addBlogPosts() {
    await query(`
        CREATE TABLE IF NOT EXISTS blog_posts (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            slug             TEXT NOT NULL UNIQUE,
            title            TEXT NOT NULL,
            excerpt          TEXT,
            content_md       TEXT,
            cover_image_url  TEXT,
            author           TEXT NOT NULL DEFAULT 'DobleYo Café',
            reading_time_min INTEGER DEFAULT 3,
            tags             TEXT,
            is_published     INTEGER NOT NULL DEFAULT 0,
            published_at     TIMESTAMP NULL,
            created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP NULL
        )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_slug      ON blog_posts(slug)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(is_published)`);

    // Seed: los 3 posts existentes como punto de partida
    const posts = [
        {
            slug: 'receta-v60',
            title: 'Receta V60 básica',
            excerpt: 'Aprende a preparar un café perfecto con la cafetera de goteo japonesa más popular del mundo.',
            content_md: `# Receta V60 básica\n\nEl V60 es uno de los métodos de preparación más populares entre los amantes del café de especialidad. Su diseño permite un control preciso del flujo y la temperatura.\n\n## Ingredientes\n- 15g de café molido (molienda media-fina)\n- 250ml de agua a 92°C\n\n## Pasos\n1. Humecta el filtro de papel\n2. Añade el café molido\n3. Vierte 30ml de agua para el bloom (30 seg)\n4. Continúa vertiendo en espiral hasta completar 250ml\n5. El tiempo total debe ser 2:30–3:00 min`,
            cover_image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 3,
            tags: JSON.stringify(['receta', 'v60', 'preparacion']),
            is_published: 1,
            published_at: new Date().toISOString(),
        },
        {
            slug: 'notas-cata-huila',
            title: 'Notas de cata: Huila',
            excerpt: 'Descubre el perfil sensorial del café del Huila, una de las regiones más premiadas de Colombia.',
            content_md: `# Notas de cata: Huila\n\nEl Huila es conocido mundialmente por producir cafés con perfiles únicos y complejos. Su geografía montañosa y microclimas especiales crean condiciones ideales.\n\n## Perfil del Huila DobleYo\n- **Proceso:** Honey\n- **Tueste:** Claro\n- **Altitud:** 1.700–1.900 msnm\n\n## Notas de cata\n- **Aroma:** Cítricos, floral\n- **Sabor:** Miel, durazno, bergamota\n- **Acidez:** Alta y brillante\n- **Cuerpo:** Medio`,
            cover_image_url: 'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 4,
            tags: JSON.stringify(['cata', 'huila', 'origen']),
            is_published: 1,
            published_at: new Date().toISOString(),
        },
        {
            slug: 'guia-molienda',
            title: 'Guía de molienda por método',
            excerpt: 'La molienda correcta marca la diferencia entre un café ordinario y uno extraordinario.',
            content_md: `# Guía de molienda por método\n\nEl tamaño de molienda es uno de los factores más importantes en la preparación del café. Una molienda incorrecta puede resultar en sobreextracción (amargo) o subextracción (ácido).\n\n## Guía rápida\n\n| Método | Molienda | Tamaño |\n|--------|----------|--------|\n| Espresso | Muy fina | Harina |\n| Moka | Fina | Sal fina |\n| V60 / Chemex | Media | Sal gruesa |\n| Prensa francesa | Gruesa | Panela |\n| Cold Brew | Muy gruesa | Azúcar moreno |\n\n## Consejo\nMuele justo antes de preparar para conservar los aromas volátiles.`,
            cover_image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 5,
            tags: JSON.stringify(['guia', 'molienda', 'preparacion']),
            is_published: 1,
            published_at: new Date().toISOString(),
        },
    ];

    for (const p of posts) {
        await query(
            `INSERT INTO blog_posts (slug, title, excerpt, content_md, cover_image_url, reading_time_min, tags, is_published, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (slug) DO NOTHING`,
            [p.slug, p.title, p.excerpt, p.content_md, p.cover_image_url, p.reading_time_min, p.tags, p.is_published, p.published_at]
        );
    }

    console.log('[Migration] blog_posts creada con 3 posts seed.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    import('dotenv/config').then(() =>
        addBlogPosts()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(err => { console.error(err); process.exit(1); })
    );
}
