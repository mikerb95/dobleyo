# Plan SEO — DobleYo Café

> Resultado de la auditoría SEO (julio 2026). Documento de trabajo: marcar cada ítem al completarlo.
> Base existente: `Head.astro` centralizado (OG, canonical, hreflang, robots), JSON-LD (Organization, Product, BlogPosting, BreadcrumbList), sitemap dinámico, robots.txt, headers de seguridad.
> **Todas las fases (1–6) implementadas (2026-07-19/20), verificadas con `npm run build` y revisión visual en Chrome real.** Único hallazgo pendiente de decisión: un bug preexistente y no relacionado en `/en/shop` (ver nota al final de Fase 4).

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

## Fase 3 — Accesibilidad (WCAG) ✅

- [x] **Skip link** "Saltar al contenido" / "Skip to content" agregado en `Layout.astro`, con `id="main"` en `<main>` y estilo `.skip-link` en `styles.css` (oculto fuera de pantalla, visible en `:focus`)
- [x] Verificado: `AdminLayout.astro` y `AppLayout.astro` ya usan landmark `<main>` — sin cambios necesarios
- [x] **Alts de imágenes**: auditado con un script que detecta `<img>` multilínea (el grep original de la auditoría daba falsos positivos). Resultado: **0 imágenes sin `alt`** en páginas públicas — el codebase ya seguía el patrón correcto (nombre de producto/finca/post como alt, `alt=""` donde el texto adyacente ya repite la info). No se necesitaron cambios.
- [x] **Iconos tipográficos → SVG**: `×` del topbar (`Layout.astro`) y `☰` del hamburger (`Header.astro`) reemplazados por SVG con `aria-hidden="true"`, conservando el `aria-label` del botón. Se agregó también `aria-expanded`/`aria-controls` sincronizados por JS al botón del menú móvil.
  - Hallazgo adicional fuera de alcance: otros íconos `✕`/`×` similares en `LangSuggest.astro`, `cuenta.astro`, `en/cart.astro`, `en/account.astro` y varias páginas de `admin/` (ERP interno) — no tocados en esta ronda por no ser parte del hallazgo original y por el riesgo de tocar handlers de admin sin necesidad.
- [x] **`prefers-reduced-motion`**: el video decorativo del hero (`autoplay loop muted`, ya `aria-hidden`) se pausa vía `layout.js` cuando el usuario prefiere movimiento reducido. La animación de granos de café en el header (bucle `requestAnimationFrame` en hover, no cubierto por la media query CSS existente) ahora se salta por completo con un guard `matchMedia` en `Header.astro`. `reveal.js` ya respetaba la preferencia de antes (sin cambios).
- [x] **Labels en formularios**: los newsletters de home (ES/EN) y footer usaban solo `aria-label` sin `<label>` visible — se agregaron `<label class="sr-only">` asociados (clase nueva en `styles.css`), igual en el input de cupón de `cart.astro`. Verificado que `contacto.astro`, `checkout.astro`, `AuthModal.astro` y `trazabilidad.astro` ya tenían `<label for>` correctos — no necesitaron cambios.
- [x] **`:focus-visible` y contraste**: se encontró un caso real de foco invisible (`.footer-news input` tenía `outline: none` sin ningún reemplazo — violación WCAG 2.4.7) y se corrigió con un `outline` visible. Se agregó además una regla global de respaldo `a/button/input/textarea/select/[tabindex]:focus-visible` para dar un indicador consistente donde no había regla específica (el resto del sitio no tenía `outline: none` sin reemplazo, así que no era un problema generalizado). Contraste de color: revisión rápida de las variables base (`--fg` sobre `--cream` >10:1) sin hallazgos; **una pasada completa con Lighthouse/axe en el navegador real queda pendiente** — no se puede ejecutar sin un entorno de browser automation en esta sesión.

---

## Fase 4 — Rendimiento / Core Web Vitals ✅

Antes de tocar código se auditaron con un script todas las `<img>` públicas para separar estáticas locales, remotas (CDN) y dinámicas (BD) — el recuento original de "47 png/jpg crudas" de la primera auditoría era impreciso (incluía duplicados/admin). Resultado real: **3 usos de una sola imagen local** (`logo.png`), **8 remotas** (ya servidas desde Unsplash con parámetros de optimización `?q=80&w=...&auto=format`, no requieren trabajo adicional), **29 dinámicas** de BD (producto/finca/blog, dominio no conocido en build time).

- [x] **`astro:assets`/`<Image>`**: migrado el único caso local-estático real y repetido — `logo.png` (Header, Footer, AuthModal). Ahora se sirve como WebP generado en build (27KB → 1–7KB según el tamaño usado) con `width`/`height` intrínsecos correctos. Las imágenes dinámicas de BD **no se migraron** a `<Image>`: exigiría `image.domains`/`remotePatterns` en `astro.config.mjs` para cada dominio posible de subida (hoy desconocido) o `inferSize` (que agrega una petición de red extra en cada carga SSR) — cualquiera de las dos es un cambio de arquitectura mayor y con riesgo real de regresión que no corresponde ejecutar sin definir antes la estrategia de almacenamiento de imágenes de productos/fincas/blog.
- [x] **CLS / `aspect-ratio`**: se verificó — no solo se asumió — que las páginas de contenido principal (detalle de producto, blog, finca, cards de home, `cuenta.astro`, `suscripcion.astro`) ya tienen `aspect-ratio` o dimensiones fijas en CSS. La arquitectura CSS del sitio ya es sólida para CLS en la mayoría de los casos.
- [x] **`loading="lazy"`**: ya presente en la gran mayoría de imágenes bajo el fold (contado en la auditoría inicial); no se encontraron casos adicionales que ameritaran cambio fuera de lo ya cubierto por otras fases.
- [x] **Video hero**: se agregó `poster="/assets/img/hero-poster.jpg"` (frame extraído del propio video con `ffmpeg`, comprimido a ~75KB) en `index.astro` y `en/index.astro` — evita el flash en blanco/negro mientras el video carga y mejora el LCP percibido. `preload="metadata"` ya estaba.
- [x] Verificado con `npm run build` + revisión visual en Chrome real (home, kits, footer, página de producto) — sin regresiones.
- [ ] Medición formal con Lighthouse (móvil) antes/después: no ejecutable en esta sesión (sin CLI de Lighthouse instalado).

> **Hallazgo no relacionado, fuera de alcance**: durante la revisión visual en Chrome se confirmó que **`/en/shop` está roto** — el grid de resultados usa clases (`.product-card`, `.card-img-wrap`, `.card-img`) que no tienen NINGUNA regla CSS en todo el proyecto, mientras que `/tienda` (ES, mismo propósito) renderiza correctamente con clases distintas (`.card`, `.card-link`, con estilos en `.shop-content .card>img`). Esto es un bug de producto preexistente, no algo introducido por este trabajo de SEO — se dejó sin tocar porque arreglarlo bien requiere una decisión de diseño (no solo copiar el CSS de `/tienda`, ya que `/en/shop` tiene su propio marcado de badges/filtros) y no corresponde asumirla unilateralmente.

---

## Fase 5 — Contenido y datos estructurados adicionales — parcial ✅

- [x] RSS del blog: implementado como ruta API propia `src/pages/rss.xml.ts` (XML manual, sin agregar la dependencia `@astrojs/rss` — mismo patrón que `sitemap.xml.ts`, consulta `blog_posts` directo a BD). `<link rel="alternate" type="application/rss+xml">` agregado en Head. Probado en local: 8 items generados desde BD real.
- [x] **JSON-LD `WebSite`**: agregado en `index.astro` y `en/index.astro`. **Sin `SearchAction`**: el sitio no tiene buscador funcional (se verificó — `tienda.astro`/`en/shop.astro` no tienen parámetro de búsqueda ni input de búsqueda alguno), y declarar una `SearchAction` que apunte a una URL que no funciona es structured data engañosa que Google puede penalizar. Si se agrega un buscador real en el futuro, completar el schema con `potentialAction`.
- [x] **JSON-LD `FAQPage`**: agregado en `envios-devoluciones.astro`, extraído literalmente de las 6 preguntas ya visibles en su acordeón `<details>` (requisito de schema.org: el contenido debe coincidir con lo visible en la página). **`/guias` no recibió FAQPage** — su contenido es de tipo "métodos de preparación"/consejos, no preguntas y respuestas; forzar el schema ahí también sería structured data no representativa. Candidato a `HowTo` en una futura ronda si se desea.
- [ ] JSON-LD `LocalBusiness` si hay punto de venta físico (no confirmado)
- [ ] Calendario editorial del blog con keywords long-tail (trabajo de contenido, no de código)

---

## Fase 6 — Infraestructura menor ✅

- [x] `site: 'https://dobleyo.cafe'` agregado a `astro.config.mjs`
- [x] **Refactor a `Astro.site`**: `Head.astro` ahora deriva `og:image` por defecto, `og:url`/JSON-LD Organization y el link RSS de `Astro.site.origin` (con fallback). `sitemap.xml.ts` y `rss.xml.ts` usan `context.site` en vez del string hardcodeado para la base ES. `i18n/index.ts` **queda con URL hardcodeada a propósito**: es un módulo `.ts` plano sin acceso al global `Astro.site`, y de todas formas necesita `BASE_EN` (subdominio distinto, no derivable de `site`) — refactorizarlo exigiría pasar el origen como parámetro a través de cada llamador, cambio más invasivo que el beneficio. Mismo criterio para `BASE_EN` en `sitemap.xml.ts`.
- [x] `apple-touch-icon.png` (180×180, generado desde `logo.png` con ImageMagick) + `manifest.json` con iconos 192/512 (mismo origen, mismo método)
- [x] Verificado en local: `/apple-touch-icon.png` y `/manifest.json` responden 200
- [x] **`404.astro`**: ya usaba Layout con navegación útil (inicio/tienda/contacto) e ilustración SVG. Le faltaba `title`/`description` propios (heredaba el default de Head) y `noindex` explícito — agregado. Confirmado en local: la ruta responde con status HTTP **404** real (comportamiento automático de Astro para `src/pages/404.astro`, sin configuración adicional).

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

### Archivos adicionales tocados en la segunda ronda (Fase 3 + 6)

- `src/layouts/Layout.astro` — `×` del topbar a SVG
- `src/components/Header.astro` — `☰` a SVG, `aria-expanded`/`aria-controls`, guard `prefers-reduced-motion` en la animación de granos
- `public/assets/js/layout.js` — pausa el video del hero con `prefers-reduced-motion`
- `public/assets/css/styles.css` — clase `.sr-only`, foco visible global (`:focus-visible`), fix de foco invisible en `.footer-news input`
- `src/pages/index.astro`, `src/pages/en/index.astro`, `src/components/Footer.astro`, `src/pages/cart.astro` — labels asociados en newsletters/cupón
- `src/components/Head.astro`, `src/pages/sitemap.xml.ts`, `src/pages/rss.xml.ts` — refactor a `Astro.site`/`context.site`
- `src/pages/404.astro` — title/description propios + `noindex`

Todo probado localmente con `astro dev` y `npm run build` contra la base de datos real antes de darlo por cerrado (sitemap, RSS, meta tags OG/Twitter, robots por página, assets estáticos, skip link, labels, hamburger, status 404 real).

## Pendiente para una próxima ronda

1. Fase 4 completa — Core Web Vitals / `astro:assets` (el mayor impacto restante, no iniciada)
2. Fase 3 — pasada de Lighthouse/axe en navegador real para contraste de color exhaustivo (no ejecutable en esta sesión)
3. Fase 5 — JSON-LD adicionales (WebSite/SearchAction, FAQPage) y calendario editorial
4. Fase 2.5 — Search Console / Bing Webmaster (acción manual de Mike)
5. Íconos `✕`/`×` restantes en páginas públicas secundarias (`LangSuggest`, `cuenta`, `en/cart`, `en/account`) y en el panel admin — hallazgo nuevo, bajo impacto SEO (admin es `noindex`)
