// Sitemap dinámico generado por Astro (Fase 11 SEO)
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const baseUrl = 'https://dobleyo.cafe';
  const now = new Date().toISOString().split('T')[0];

  // Páginas estáticas públicas con sus prioridades y frecuencia de cambio
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/tienda', priority: '0.9', changefreq: 'weekly' },
    { url: '/trazabilidad', priority: '0.8', changefreq: 'monthly' },
    { url: '/blog', priority: '0.7', changefreq: 'weekly' },
    { url: '/fincas', priority: '0.7', changefreq: 'monthly' },
    { url: '/contacto', priority: '0.6', changefreq: 'yearly' },
    { url: '/envios-devoluciones', priority: '0.5', changefreq: 'yearly' },
    { url: '/privacidad', priority: '0.4', changefreq: 'yearly' },
    { url: '/terminos', priority: '0.4', changefreq: 'yearly' },
    { url: '/accesibilidad', priority: '0.4', changefreq: 'yearly' },
    // Versión en inglés
    { url: '/en/', priority: '0.9', changefreq: 'weekly' },
    { url: '/en/shop', priority: '0.8', changefreq: 'weekly' },
    { url: '/en/traceability', priority: '0.7', changefreq: 'monthly' },
    { url: '/en/contact', priority: '0.5', changefreq: 'yearly' },
  ];

  const urlEntries = staticPages
    .map(
      ({ url, priority, changefreq }) => `
  <url>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
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
