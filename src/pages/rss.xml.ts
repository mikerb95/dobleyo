// RSS del blog — Fase 5 SEO
import type { APIRoute } from 'astro';

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
    const baseUrl = (site ?? new URL('https://dobleyo.cafe/')).origin;
    let posts: any[] = [];

    try {
        const { query } = await import('../../server/db.js');
        const { rows } = await query(
            `SELECT slug, title, excerpt, published_at
             FROM blog_posts
             WHERE is_published = 1
             ORDER BY published_at DESC
             LIMIT 30`
        );
        posts = rows;
    } catch (_) {
        posts = [];
    }

    const items = posts
        .map(
            (post) => `
  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${baseUrl}/blog/${post.slug}</link>
    <guid>${baseUrl}/blog/${post.slug}</guid>
    ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ''}
    ${post.published_at ? `<pubDate>${new Date(post.published_at).toUTCString()}</pubDate>` : ''}
  </item>`
        )
        .join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog DobleYo Café</title>
    <link>${baseUrl}/blog</link>
    <description>Café de especialidad colombiano: guías, trazabilidad y novedades de DobleYo Café.</description>
    <language>es-CO</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

    return new Response(rss, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
};
