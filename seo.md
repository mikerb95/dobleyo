# Plan SEO — DobleYo Café

> Resultado de la auditoría SEO (julio 2026). Documento de trabajo: marcar cada ítem al completarlo.
> Base existente: `Head.astro` centralizado (OG, canonical, hreflang, robots), JSON-LD (Organization, Product, BlogPosting, BreadcrumbList), sitemap dinámico, robots.txt, headers de seguridad.

---

## Fase 1 — Metadatos sociales (impacto inmediato) ✅ / ⬜

### 1.1 `og:image` + Twitter Cards globales ⬜
**Archivo:** `src/components/Head.astro`

- [ ] Crear imagen OG de marca por defecto (1200×630) en `public/assets/img/og-default.jpg`
- [ ] Agregar prop `ogImage?: string` a Head con fallback a la imagen por defecto
- [ ] Emitir: `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`
- [ ] Emitir Twitter Cards: `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`
- [ ] Pasar imagen real del producto en `producto/[id]` y `en/product/[id]`
- [ ] Pasar cover del post en `blog/[slug]` y `en/blog/[slug]`
- [ ] Migrar el `og:image` manual de `fincas.astro` y `finca/[slug].astro` al prop

### 1.2 `og:type` dinámico ⬜
- [ ] Prop `ogType?: 'website' | 'product' | 'article'` en Head (default `website`)
- [ ] `product` en páginas de producto; `article` + `article:published_time` en posts del blog

---

## Fase 2 — Indexación y rastreo ⬜

### 2.1 `noindex` en páginas privadas/utilitarias ⬜
Hoy solo `desarrollo-ia.astro` y `cuenta.astro` lo pasan. Robots.txt con `Disallow` NO impide la indexación — se necesita `noindex={true}` en:

- [ ] `setup-db.astro` ⚠️ (además evaluar si debe existir en producción)
- [ ] `showcase.astro`
- [ ] `sena/python.astro`
- [ ] `login.astro`
- [ ] `registro.astro`
- [ ] `checkout.astro` y `en/checkout.astro`
- [ ] `cart.astro` y `en/cart.astro`
- [ ] `confirmacion.astro` y `en/confirmation.astro`
- [ ] `verify-email.astro`
- [ ] `desuscribirse.astro`
- [ ] `solicitar-caficultor.astro`
- [ ] `en/account.astro`

### 2.2 robots.txt — cubrir el subdominio EN ⬜
**Archivo:** `public/robots.txt`. El mismo archivo se sirve en `en.dobleyo.cafe`, donde las rutas pierden el prefijo `/en`:

- [ ] Agregar `Disallow: /account`, `/checkout`, `/confirmation`, `/cart` (rutas del subdominio)
- [ ] Agregar `Disallow: /showcase`, `/sena/`
- [ ] Evaluar sitemap propio para el subdominio (ver 2.3)

### 2.3 Sitemap completo ⬜
**Archivo:** `src/pages/sitemap.xml.ts`

- [ ] **URLs dinámicas desde BD/datos**: `/producto/[id]`, `/blog/[slug]`, `/finca/[slug]` + equivalentes EN
- [ ] Agregar estáticas faltantes: `/nosotros`, `/regalos`, `/suscripcion`, `/en/about`, `/en/blog`, `/en/farms`, `/en/guides`, `/en/shipping`, `/en/affiliates`, `/en/partners`
- [ ] Emitir `<xhtml:link rel="alternate" hreflang>` para los pares ES/EN (el namespace ya está declarado pero sin uso)
- [ ] Listar URLs EN con su forma canónica `https://en.dobleyo.cafe/...` (hoy el sitemap lista `dobleyo.cafe/en/*` y contradice los canonicals de `getCanonicalUrl`)
- [ ] `lastmod`: usar fechas reales (updated_at de BD) u omitirlo — hoy siempre es "hoy" y Google lo ignora
- [ ] Eliminar `changefreq`/`priority` (Google los ignora) o dejarlos, sin invertir más en ellos

### 2.4 Canonicals faltantes ⬜
- [ ] `/terminos`, `/privacidad`, `/accesibilidad`, `/envios-devoluciones`, `/tostar`

### 2.5 Search Console ⬜ (manual, requiere acceso de Mike)
- [ ] Registrar `dobleyo.cafe` y `en.dobleyo.cafe` en Google Search Console (propiedad de dominio via DNS)
- [ ] Registrar en Bing Webmaster Tools
- [ ] Enviar sitemaps y monitorear cobertura de indexación

---

## Fase 3 — Accesibilidad (WCAG) ⬜

- [ ] **Skip link** "Saltar al contenido" en `Layout.astro` antes del Header, con estilo `:focus` visible y `id="main"` en `<main>`
- [ ] Verificar que `AdminLayout.astro` y `AppLayout.astro` usan landmark `<main>`
- [ ] Revisar las ~20 `<img>` detectadas: decorativas con `alt=""` explícito, informativas con alt descriptivo (no solo `alt={product.name}` genérico)
- [ ] Reemplazar iconos tipográficos (`×` del topbar, `☰` del hamburger) por SVG con `aria-hidden` + texto accesible
- [ ] Auditar `:focus-visible` en botones custom y contraste con Lighthouse/axe
- [ ] Formularios: labels asociados en newsletter, contacto y checkout (no solo `aria-label`)
- [ ] `prefers-reduced-motion`: desactivar beans animation, reveal.js y autoplay del video hero
- [ ] Pasada Lighthouse accesibilidad ≥ 95 en home, tienda, producto, blog

---

## Fase 4 — Rendimiento / Core Web Vitals ⬜

- [ ] Migrar imágenes a `astro:assets` / `<Image>`: compresión, WebP/AVIF, `srcset`, `width/height` automáticos (hoy: 47 png/jpg crudas, 2 webp, sin srcset)
- [ ] `loading="lazy"` en toda imagen bajo el fold (hoy solo ~10)
- [ ] `loading="eager"` + `fetchpriority="high"` en la imagen/video LCP del hero
- [ ] Video hero: `poster` + `preload="metadata"`
- [ ] Verificar CLS: dimensiones explícitas en todas las imágenes
- [ ] Medir antes/después con Lighthouse (móvil) en home, tienda y producto

---

## Fase 5 — Contenido y datos estructurados adicionales ⬜

- [ ] RSS del blog con `@astrojs/rss` → `/rss.xml` (+ `<link rel="alternate" type="application/rss+xml">` en Head)
- [ ] JSON-LD `WebSite` + `SearchAction` en home (sitelinks searchbox)
- [ ] JSON-LD `FAQPage` en `/guias` y `/envios-devoluciones`
- [ ] JSON-LD `LocalBusiness` si hay punto de venta físico
- [ ] Calendario editorial del blog con keywords long-tail: "café de especialidad colombiano", "métodos de preparación", "trazabilidad del café", "café Huila/Nariño"

---

## Fase 6 — Infraestructura menor ⬜

- [ ] `site: 'https://dobleyo.cafe'` en `astro.config.mjs` y usar `Astro.site` (hoy la URL está hardcodeada en ~6 archivos: Head, sitemap, i18n, JSON-LD)
- [ ] `apple-touch-icon` (180×180 png) + `manifest.json` básico
- [ ] Verificar que `404.astro` devuelve status 404 y ofrece navegación útil

---

## Orden de ejecución recomendado

| # | Fase | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | Fase 1 — og:image / Twitter Cards | Bajo | Alto (CTR en compartidos) |
| 2 | Fase 2.1–2.2 — noindex + robots | Bajo | Alto (higiene de indexación) |
| 3 | Fase 2.3 — sitemap completo | Medio | Alto (indexación long-tail) |
| 4 | Fase 3 — accesibilidad | Medio | Medio (+ legal) |
| 5 | Fase 4 — astro:assets / CWV | Alto | Alto (ranking directo) |
| 6 | Fases 5–6 | Bajo–Medio | Medio (compuesto a largo plazo) |
