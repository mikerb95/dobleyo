# Plan SEO — DobleYo Café

> Resultado de la auditoría SEO (julio 2026). Documento de trabajo: marcar cada ítem al completarlo.
> Base existente: `Head.astro` centralizado (OG, canonical, hreflang, robots), JSON-LD (Organization, Product, BlogPosting, BreadcrumbList), sitemap dinámico, robots.txt, headers de seguridad.
> **Fases 1, 2, 3, 5 y 6 implementadas (2026-07-19).** Fase 4 (Core Web Vitals / migración de imágenes) queda pendiente — es la de mayor esfuerzo y riesgo de regresión visual, se recomienda abordarla aparte con revisión visual página por página.

---

## Fase 1 — Metadatos sociales (impacto inmediato) ✅

### 1.1 `og:image` + Twitter Cards globales ✅
**Archivo:** `src/components/Head.astro`

- [x] Imagen OG de marca por defecto en `public/assets/img/og-default.jpg` (banner de marca existente, 1024×576 — no es el 1200×630 ideal; sirve como placeholder funcional, ver nota abajo)
- [x] Prop `ogImage?: string` en Head con fallback a la imagen por defecto (resuelve rutas relativas a absolutas)
- [x] Emite `og:image`, `og:image:alt` (se omitió `og:image:width/height` — no se conocen las dimensiones reales de cada imagen dinámica de producto/blog/finca)
- [x] Twitter Cards: `twitter:card summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`
- [x] `producto/[id].astro` y `en/product/[id].astro` pasan `ogImage={product.image}`
- [x] `blog/[slug].astro` y `en/blog/[slug].astro` pasan `ogImage={coverImg}`
- [x] `fincas.astro` y `finca/[slug].astro` migrados al prop `ogImage` de Layout — se eliminó el bloque `<head slot="head">` duplicado y una referencia rota a `og-fincas.jpg` (archivo que no existía)

> **Nota:** `og-default.jpg` es un recorte funcional pero no una pieza de diseño dedicada. Si se quiere una imagen OG de marca cuidada (1200×630, con logo/texto), es trabajo de diseño pendiente — reemplazar el archivo en `public/assets/img/og-default.jpg` sin tocar código.

### 1.2 `og:type` dinámico ✅
- [x] Prop `ogType?: 'website' | 'product' | 'article'` en Head (default `website`)
- [x] `product` en páginas de producto (ES/EN); `article` + `article:published_time` en posts del blog (ES/EN)

---

## Fase 2 — Indexación y rastreo ✅

### 2.1 `noindex` en páginas privadas/utilitarias ✅
Agregado `noindex={true}` (o `<meta name="robots" content="noindex, nofollow">` manual en `setup-db.astro`, que no usa Layout) en:

- [x] `setup-db.astro`
- [x] `showcase.astro`
- [x] `sena/python.astro`
- [x] `checkout.astro` y `en/checkout.astro`
- [x] `cart.astro` y `en/cart.astro`
- [x] `confirmacion.astro` y `en/confirmation.astro`
- [x] `verify-email.astro`
- [x] `desuscribirse.astro`
- [x] `solicitar-caficultor.astro`
- [x] `tostar.astro` (hallazgo nuevo: página huérfana sin enlaces internos — se le agregó `noindex` en vez de `canonical`)
- [x] `en/account.astro` (ya lo tenía)
- `login.astro` y `registro.astro` no necesitan noindex — son redirects 302 puros sin HTML propio.

### 2.2 robots.txt — cubrir el subdominio EN ✅
**Archivo:** `public/robots.txt`

- [x] Agregado `Disallow: /account`, `/confirmation` (rutas exclusivas del subdominio EN, sin equivalente ES en la misma ruta)
- [x] Agregado `Disallow: /cart`, `/showcase`, `/sena/`, `/tostar`
- [x] `/en/cart` y `/en/confirmation` agregados a la sección EN existente
- Sitemap propio para el subdominio: no implementado — se optó por un solo sitemap con URLs absolutas para ambos hosts (ver 2.3), que es válido y más simple de mantener que dos sitemaps.

### 2.3 Sitemap completo ✅
**Archivo:** `src/pages/sitemap.xml.ts` (reescrito)

- [x] URLs dinámicas desde BD: productos activos, posts de blog publicados, fincas publicadas — ES y EN
- [x] Estáticas faltantes agregadas: `/nosotros`, `/regalos`, `/suscripcion`, `/en/about`, `/en/blog`, `/en/farms`, `/en/guias`→`/en/guides`, `/en/shipping`, `/en/affiliates`, `/en/partners`
- [x] `<xhtml:link rel="alternate" hreflang="es|en|x-default">` emitido en cada `<url>` con equivalencia
- [x] URLs EN listadas con su host canónico real `https://en.dobleyo.cafe/...` (antes era `dobleyo.cafe/en/*`, contradecía `getCanonicalUrl`)
- [x] `lastmod` usa `updated_at`/`published_at` real de BD cuando existe, con fallback a la fecha de build
- Probado en local contra la BD real: 71 URLs generadas (40 de producto, 15 de fincas, resto estáticas + blog)

### 2.4 Canonicals faltantes ✅
- [x] `/terminos`, `/privacidad`, `/accesibilidad`, `/envios-devoluciones`
- [x] `/tostar` recibió `noindex` en vez de canonical (ver 2.1 — no es contenido público indexable)

### 2.5 Search Console ⬜ (pendiente — requiere acceso externo de Mike)
- [ ] Registrar `dobleyo.cafe` y `en.dobleyo.cafe` en Google Search Console (propiedad de dominio vía DNS)
- [ ] Registrar en Bing Webmaster Tools
- [ ] Enviar sitemaps y monitorear cobertura de indexación

---

## Fase 3 — Accesibilidad (WCAG) — parcial ✅

- [x] **Skip link** "Saltar al contenido" / "Skip to content" agregado en `Layout.astro`, con `id="main"` en `<main>` y estilo `.skip-link` en `styles.css` (oculto fuera de pantalla, visible en `:focus`)
- [x] Verificado: `AdminLayout.astro` y `AppLayout.astro` ya usan landmark `<main>` — sin cambios necesarios
- [ ] Revisar las ~20 `<img>` detectadas: decorativas con `alt=""` explícito, informativas con alt descriptivo
- [ ] Reemplazar iconos tipográficos (`×` del topbar, `☰` del hamburger) por SVG con `aria-hidden` + texto accesible
- [ ] Auditar `:focus-visible` en botones custom y contraste con Lighthouse/axe
- [ ] Formularios: labels asociados en newsletter, contacto y checkout (no solo `aria-label`)
- [ ] `prefers-reduced-motion`: desactivar beans animation, reveal.js y autoplay del video hero
- [ ] Pasada Lighthouse accesibilidad ≥ 95 en home, tienda, producto, blog

---

## Fase 4 — Rendimiento / Core Web Vitals ⬜ (no iniciada — mayor esfuerzo/riesgo)

- [ ] Migrar imágenes a `astro:assets` / `<Image>`: compresión, WebP/AVIF, `srcset`, `width/height` automáticos (hoy: 47 png/jpg crudas, 2 webp, sin srcset)
- [ ] `loading="lazy"` en toda imagen bajo el fold (hoy solo ~10)
- [ ] `loading="eager"` + `fetchpriority="high"` en la imagen/video LCP del hero
- [ ] Video hero: `poster` + `preload="metadata"`
- [ ] Verificar CLS: dimensiones explícitas en todas las imágenes
- [ ] Medir antes/después con Lighthouse (móvil) en home, tienda y producto

> Se dejó fuera de esta ronda a propósito: toca 47+ imágenes en páginas visuales (home, tienda, producto, fincas) y requiere verificación visual manual en navegador para no introducir regresiones de layout/CLS. Mejor abordarla como tarea dedicada.

---

## Fase 5 — Contenido y datos estructurados adicionales — parcial ✅

- [x] RSS del blog: implementado como ruta API propia `src/pages/rss.xml.ts` (XML manual, sin agregar la dependencia `@astrojs/rss` — mismo patrón que `sitemap.xml.ts`, consulta `blog_posts` directo a BD). `<link rel="alternate" type="application/rss+xml">` agregado en Head. Probado en local: 8 items generados desde BD real.
- [ ] JSON-LD `WebSite` + `SearchAction` en home (sitelinks searchbox)
- [ ] JSON-LD `FAQPage` en `/guias` y `/envios-devoluciones`
- [ ] JSON-LD `LocalBusiness` si hay punto de venta físico
- [ ] Calendario editorial del blog con keywords long-tail (trabajo de contenido, no de código)

---

## Fase 6 — Infraestructura menor — parcial ✅

- [x] `site: 'https://dobleyo.cafe'` agregado a `astro.config.mjs`
- [ ] Refactorizar los ~6 sitios con URL hardcodeada (`Head.astro`, `sitemap.xml.ts`, `i18n/index.ts`, JSON-LD) para usar `Astro.site` — se agregó la config pero no se tocaron los usos existentes por alcance/riesgo de esta ronda
- [x] `apple-touch-icon.png` (180×180, generado desde `logo.png` con ImageMagick) + `manifest.json` con iconos 192/512 (mismo origen, mismo método)
- [x] Verificado en local: `/apple-touch-icon.png` y `/manifest.json` responden 200
- [ ] Verificar que `404.astro` devuelve status 404 y ofrece navegación útil (no revisado en esta ronda)

---

## Resumen de archivos tocados en esta ronda

- `src/components/Head.astro` — ogImage/ogType/Twitter Cards, apple-touch-icon, manifest, rss link
- `src/layouts/Layout.astro` — passthrough de props OG, skip link, `id="main"`
- `public/assets/css/styles.css` — estilos `.skip-link`
- `src/pages/producto/[id].astro`, `src/pages/en/product/[id].astro` — ogImage/ogType
- `src/pages/blog/[slug].astro`, `src/pages/en/blog/[slug].astro` — ogImage/ogType/articlePublishedTime
- `src/pages/fincas.astro`, `src/pages/finca/[slug].astro` — refactor a props de Layout, fix de imagen rota
- `src/pages/sitemap.xml.ts` — reescrito completo
- `src/pages/rss.xml.ts` — nuevo
- `public/robots.txt` — reglas ampliadas
- `public/manifest.json`, `public/apple-touch-icon.png`, `public/assets/icon-192.png`, `public/assets/icon-512.png`, `public/assets/img/og-default.jpg` — nuevos
- `astro.config.mjs` — `site`
- noindex agregado en: `setup-db.astro`, `showcase.astro`, `sena/python.astro`, `checkout.astro`, `cart.astro`, `confirmacion.astro`, `verify-email.astro`, `desuscribirse.astro`, `solicitar-caficultor.astro`, `tostar.astro`, `en/checkout.astro`, `en/cart.astro`, `en/confirmation.astro`
- canonical agregado en: `terminos.astro`, `privacidad.astro`, `accesibilidad.astro`, `envios-devoluciones.astro`

Todo probado localmente con `astro dev` contra la base de datos real antes de darlo por cerrado (sitemap, RSS, meta tags OG/Twitter, robots por página, assets estáticos).

## Pendiente para una próxima ronda

1. Fase 3 accesibilidad — el resto del checklist (alts, iconos SVG, focus, reduced-motion, labels)
2. Fase 4 completa — Core Web Vitals / `astro:assets` (la de mayor impacto restante)
3. Fase 5 — JSON-LD adicionales (WebSite/SearchAction, FAQPage) y calendario editorial
4. Fase 6 — `Astro.site` refactor, revisión de `404.astro`
5. Fase 2.5 — Search Console / Bing Webmaster (acción manual de Mike)
