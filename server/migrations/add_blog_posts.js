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
            title: 'Mi receta de V60 para empezar la mañana',
            excerpt: 'No necesitas equipo de campeonato para sacar una taza honesta en casa. Esta es la receta con la que arranco casi todos los días.',
            content_md: `La primera vez que preparé un V60 me salió aguado y sin gracia. Estaba convencido de que el problema era el café, hasta que un compañero de barra me dijo lo de siempre: "no es el grano, es la mano". Tenía razón. El V60 perdona poco, pero justamente por eso enseña tanto. Una vez le coges el pulso, te da una taza limpia, dulce y con todos los matices del origen sobre la mesa.\n\nEsta es la receta con la que arranco casi todos los días. Nada de básculas de laboratorio ni termómetros caros: solo lo justo para que te quede rica y la puedas repetir mañana.\n\n## Lo que vas a necesitar\n\n- **15 g de café**, molido un punto más fino que la sal de mesa\n- **250 ml de agua** apenas por debajo del hervor (unos 92–94 °C: deja reposar la olla medio minuto después de hervir)\n- Tu cafetera V60, un filtro de papel y, si tienes, una báscula y un cronómetro\n\nUna relación de 1 a 16 entre café y agua es un punto de partida seguro. Si la quieres con más cuerpo, sube a 16 g; si la prefieres más liviana para la tarde, bájale a 14 g. Ahí no hay reglas sagradas, hay gustos.\n\n## El paso a paso\n\n1. **Enjuaga el filtro** con agua caliente antes de nada. Esto le quita ese saborcito a papel y, de paso, calienta la cafetera y la taza. Bota esa agua.\n2. **Echa el café** y haz un huequito en el centro con el dedo. Esto ayuda a que el agua moje todo parejo.\n3. **El bloom.** Vierte unos 40 ml de agua, lo justo para empapar todo el café, y espera 30 segundos. Vas a ver cómo sube una espumita: ese es el CO₂ escapando. Si el café es fresco, infla bonito; si está viejo, casi ni se mueve. Es la mejor prueba de frescura que conozco.\n4. **Vierte en círculos**, despacio y desde el centro hacia afuera, sin tocar las paredes del filtro. Hazlo en dos o tres tandas hasta llegar a los 250 ml.\n5. **Espera el goteo final.** El total, contando el bloom, debería estar entre 2:30 y 3:00 minutos.\n\n## Si algo no te cuadra\n\nTe pasa, nos pasa a todos. Dos pistas rápidas:\n\n- **Sabe amarga o áspera** → la extracción se fue larga. Muele un poco más grueso o baja el tiempo.\n- **Sabe ácida y vacía, como a agua con sabor** → se quedó corta. Muele más fino o vierte más lento.\n\nEl truco es cambiar **una sola cosa a la vez**. Si mueves todo junto nunca vas a saber qué fue lo que arregló la taza. Ten paciencia con las primeras: el café de especialidad es de las pocas cosas que mejoran cuando uno se equivoca con calma.`,
            cover_image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop',
            reading_time_min: 4,
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
