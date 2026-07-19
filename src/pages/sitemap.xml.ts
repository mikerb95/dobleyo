// Sitemap dinámico generado por Astro (Fase 11 SEO)
import type { APIRoute } from 'astro';

const BASE_ES = 'https://dobleyo.cafe';
const BASE_EN = 'https://en.dobleyo.cafe';

type Entry = {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: string;
    /** Ruta equivalente en el otro idioma para anotar hreflang (empieza en /) */
    altEs?: string;
    altEn?: string;
};

function fmtDate(d: unknown): string | undefined {
    if (!d) return undefined;
    try {
        return new Date(d as string).toISOString().split('T')[0];
    } catch {
        return undefined;
    }
}

export const GET: APIRoute = async () => {
    const now = new Date().toISOString().split('T')[0];

    // ── Páginas estáticas con equivalencia ES/EN ────────────────────────────
    const staticPairs: { es: string; en: string; priority: string; changefreq: string }[] = [
        { es: '/', en: '/', priority: '1.0', changefreq: 'weekly' },
        { es: '/tienda', en: '/shop', priority: '0.9', changefreq: 'weekly' },
        { es: '/mayoristas', en: '/wholesale', priority: '0.7', changefreq: 'monthly' },
        { es: '/trazabilidad', en: '/traceability', priority: '0.8', changefreq: 'monthly' },
        { es: '/blog', en: '/blog', priority: '0.7', changefreq: 'weekly' },
        { es: '/guias', en: '/guides', priority: '0.6', changefreq: 'monthly' },
        { es: '/fincas', en: '/farms', priority: '0.7', changefreq: 'monthly' },
        { es: '/nosotros', en: '/about', priority: '0.6', changefreq: 'monthly' },
        { es: '/partners', en: '/partners', priority: '0.5', changefreq: 'monthly' },
        { es: '/afiliados', en: '/affiliates', priority: '0.5', changefreq: 'monthly' },
        { es: '/contacto', en: '/contact', priority: '0.6', changefreq: 'yearly' },
        { es: '/envios-devoluciones', en: '/shipping', priority: '0.5', changefreq: 'yearly' },
        { es: '/privacidad', en: '/privacy', priority: '0.4', changefreq: 'yearly' },
        { es: '/terminos', en: '/terms', priority: '0.4', changefreq: 'yearly' },
        { es: '/accesibilidad', en: '/accessibility', priority: '0.4', changefreq: 'yearly' },
    ];

    // ── Páginas estáticas solo en español ───────────────────────────────────
    const staticEsOnly: { url: string; priority: string; changefreq: string }[] = [
        { url: '/accesorios', priority: '0.7', changefreq: 'weekly' },
        { url: '/regalos', priority: '0.6', changefreq: 'weekly' },
        { url: '/suscripcion', priority: '0.5', changefreq: 'monthly' },
    ];

    const entries: Entry[] = [];

    for (const p of staticPairs) {
        entries.push({
            loc: `${BASE_ES}${p.es}`,
            lastmod: now,
            changefreq: p.changefreq,
            priority: p.priority,
            altEs: p.es,
            altEn: p.en,
        });
        entries.push({
            loc: `${BASE_EN}${p.en}`,
            lastmod: now,
            changefreq: p.changefreq,
            priority: p.priority,
            altEs: p.es,
            altEn: p.en,
        });
    }

    for (const p of staticEsOnly) {
        entries.push({ loc: `${BASE_ES}${p.url}`, lastmod: now, changefreq: p.changefreq, priority: p.priority });
    }

    // ── Contenido dinámico desde BD: productos, posts de blog, fincas ──────
    try {
        const { query } = await import('../../server/db.js');

        const [{ rows: products }, { rows: posts }, { rows: farms }] = await Promise.all([
            query(`SELECT id, updated_at FROM products WHERE is_active = 1`),
            query(`SELECT slug, published_at, updated_at FROM blog_posts WHERE is_published = 1`),
            query(`SELECT slug, updated_at FROM farms WHERE is_published = 1`),
        ]);

        for (const p of products) {
            entries.push({
                loc: `${BASE_ES}/producto/${p.id}`,
                lastmod: fmtDate(p.updated_at) ?? now,
                changefreq: 'weekly',
                priority: '0.8',
                altEs: `/producto/${p.id}`,
                altEn: `/product/${p.id}`,
            });
            entries.push({
                loc: `${BASE_EN}/product/${p.id}`,
                lastmod: fmtDate(p.updated_at) ?? now,
                changefreq: 'weekly',
                priority: '0.8',
                altEs: `/producto/${p.id}`,
                altEn: `/product/${p.id}`,
            });
        }

        for (const post of posts) {
            entries.push({
                loc: `${BASE_ES}/blog/${post.slug}`,
                lastmod: fmtDate(post.updated_at ?? post.published_at) ?? now,
                changefreq: 'monthly',
                priority: '0.6',
                altEs: `/blog/${post.slug}`,
                altEn: `/blog/${post.slug}`,
            });
            entries.push({
                loc: `${BASE_EN}/blog/${post.slug}`,
                lastmod: fmtDate(post.updated_at ?? post.published_at) ?? now,
                changefreq: 'monthly',
                priority: '0.6',
                altEs: `/blog/${post.slug}`,
                altEn: `/blog/${post.slug}`,
            });
        }

        for (const farm of farms) {
            entries.push({
                loc: `${BASE_ES}/finca/${farm.slug}`,
                lastmod: fmtDate(farm.updated_at) ?? now,
                changefreq: 'monthly',
                priority: '0.6',
                altEs: `/finca/${farm.slug}`,
                altEn: `/farm/${farm.slug}`,
            });
            entries.push({
                loc: `${BASE_EN}/farm/${farm.slug}`,
                lastmod: fmtDate(farm.updated_at) ?? now,
                changefreq: 'monthly',
                priority: '0.6',
                altEs: `/finca/${farm.slug}`,
                altEn: `/farm/${farm.slug}`,
            });
        }
    } catch (_) {
        // Errores de conexión a BD no interrumpen el sitemap estático
    }

    const urlEntries = entries
        .map((e) => {
            const hreflang =
                e.altEs && e.altEn
                    ? `
    <xhtml:link rel="alternate" hreflang="es" href="${BASE_ES}${e.altEs}" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_EN}${e.altEn}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_ES}${e.altEs}" />`
                    : '';
            return `
  <url>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority ? `\n    <priority>${e.priority}</priority>` : ''}${hreflang}
  </url>`;
        })
        .join('');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">${urlEntries}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
        },
    });
};
