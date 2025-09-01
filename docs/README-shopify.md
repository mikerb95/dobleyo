# Plan de implementación futura — Tienda tipo Shopify (Headless)

Este documento describe cómo evolucionar DobleYo hacia una tienda “tipo Shopify”, aprovechando un backend e-commerce probado (Shopify) con un frontend headless en Next.js (el stack actual), manteniendo performance, control total del UI y escalabilidad.

## Objetivos
- Experiencia de compra completa (catálogo, variantes, carrito, checkout, cuentas de cliente).
- Operación confiable (inventario, impuestos, envíos, pagos, fraude, backoffice).
- SEO técnico sólido, internacionalización, analítica y velocidad.
- Time-to-market rápido con bajo mantenimiento de pagos/seguridad (PCI delegada a Shopify).

## Arquitectura propuesta
- Frontend: Next.js (App Router) en Vercel (ISR/Edge), Tailwind.
- Backend e-commerce: Shopify (Admin + Storefront API GraphQL).
- Autenticación clientes: Shopify Customer Accounts (o tokens Storefront).
- Checkout: Shopify Checkout (Checkout Extensibility) redirigido desde el frontend.
- Media: Shopify Files/Images, opcional CDN externo.
- Integraciones: Webhooks de Shopify -> Revalidate ISR / colas.

## Data model (Shopify)
- Products, Variants (size/grind), Collections.
- Prices, Inventory, Metafields (origen, proceso, tueste, notas de cata).
- Customers, Addresses, Orders, Discounts.

## Flujo principal
1) Catálogo: Next.js consulta Storefront API (GraphQL) con filtros (collection, product tags, metafields).
2) Carrito: usar Storefront Cart API (cartCreate/cartLinesAdd/cartLinesUpdate) persistido en cookie.
3) Checkout: obtener `checkoutUrl` del cart y redirigir al checkout de Shopify.
4) Orden: Shopify procesa pago y notifica por webhook (order/create). Next: revalidate páginas relacionadas.

## Filtros y SEO
- Filtros por origen/proceso/tueste via metafields/tags -> Query variables en Storefront API.
- Rutas amigables y canónicas; sitemap/robots ya integrados en Next.
- ISR con revalidación a eventos (productos, colecciones) por Webhooks.

## Cuentas de cliente
- Registro/login con Customer Accounts (OAuth/hosted) o tokens Storefront (simple).
- Páginas: perfil, direcciones, historial de órdenes (vistas desde Storefront/Admin APIs).

## Descuentos, envíos e impuestos
- Descuentos nativos de Shopify (codes/auto) aplicados en checkout.
- Tarifas de envío desde perfiles de envío de Shopify (se muestran en checkout).
- Impuestos automáticos según región.

## Pasos y fases
- Fase 1 (MVP):
  - Conectar Storefront API (catálogo/variantes).
  - Carrito headless + redirección a `checkoutUrl`.
  - SSO opcional con Customer Accounts.
- Fase 2:
  - Webhooks (products/update, collections/update, order/create) -> revalidate.
  - Páginas de cuenta y órdenes.
  - Contenido CMS (blog/landing) si aplica.
- Fase 3:
  - Checkout Extensibility (UI extensions), recomendaciones, bundles, loyalty.
  - Multi-moneda/idioma, mercados.

## Variables de entorno esperadas
- SHOPIFY_STORE_DOMAIN (ej: my-shop.myshopify.com)
- SHOPIFY_STOREFRONT_API_VERSION (ej: 2024-07)
- SHOPIFY_STOREFRONT_API_TOKEN
- SHOPIFY_ADMIN_API_TOKEN (solo si se usa Admin API del lado servidor)

## Endpoints y Webhooks
- Storefront API: GraphQL endpoint para catálogo, carrito, clientes.
- Webhooks (Admin): order/create, products/update, collections/update.
- Seguridad: validar HMAC de Shopify; colas/retry; rate limiting.

## Migración desde mock/local
- Mapear productos a Shopify (variants/metafields).
- Sincronizar imágenes.
- Actualizar UI para leer Storefront API y mantener fallback local durante transición.

## Observabilidad
- Logging estructurado (server actions / API routes).
- Métricas: Core Web Vitals (Vercel), errores cliente/servidor.
- Alertas en fallos de webhooks/ISR.

## Notas de cumplimiento
- PCI: uso de Shopify Checkout; no almacenar datos de tarjeta en el frontend/backend.
- Privacidad: políticas claras, cookie banner según jurisdicción.

## Roadmap técnico breve
- SDK: cliente Storefront (GraphQL fetch) + tipado.
- Cart context refactor -> Storefront Cart.
- Product queries con SEO (ISR + revalidate by tag).
- Webhooks y revalidate.
- Cuenta de cliente (fase 2).

---
Este enfoque ofrece lo mejor de ambos mundos: UI a medida en Next.js y músculo operativo de Shopify, reduciendo riesgo y tiempo de implementación.
