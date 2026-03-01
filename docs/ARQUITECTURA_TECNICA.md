# Arquitectura Técnica — DobleYo Café

> Documentación de la arquitectura del sistema, flujos de datos, y decisiones de diseño.  
> Última actualización: 2026-03-01

---

## 1. Vista General de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Browser  │  │ Mobile   │  │ QR Scan  │  │ MercadoLibre │   │
│  │ (ES/EN)  │  │ Browser  │  │ (Camera) │  │ (API sync)   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
└───────┼──────────────┼──────────────┼───────────────┼───────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VERCEL EDGE NETWORK                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ CDN: Static assets (CSS, JS, images, fonts)               │  │
│  │ dobleyo.cafe → / (español)                                │  │
│  │ en.dobleyo.cafe → /en/ (inglés)                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────┬───────────────────────────────────────┬───────────────┘
          │                                       │
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────────┐
│ ASTRO SSR (Vercel)   │              │ SERVERLESS FUNCTIONS     │
│                      │              │ (api/index.js)           │
│ • src/pages/*.astro  │              │                          │
│ • SSR rendering      │  ─REST API─▶ │ Express App:             │
│ • Layouts + Head     │              │ • /api/auth/*            │
│ • i18n routing       │              │ • /api/stock/*           │
│ • React hydration    │              │ • /api/coffee/*          │
│                      │              │ • /api/orders/*          │
└──────────────────────┘              │ • /api/labels/*          │
                                      │ • /api/production/*      │
                                      │ • /api/accounting/*      │
                                      │ • /api/mercadolibre/*    │
                                      │ • /api/webhooks/*        │
                                      └──────────┬───────────────┘
                                                  │
                              ┌────────────────────┼───────────────┐
                              │                    │               │
                              ▼                    ▼               ▼
                    ┌──────────────┐   ┌──────────────┐  ┌─────────────┐
                    │ PostgreSQL   │   │ Resend       │  │ External    │
                    │ (Aiven/Neon) │   │ (Email)      │  │ APIs        │
                    │              │   │              │  │             │
                    │ 35+ tables   │   │ • Welcome    │  │ • Wompi     │
                    │ • users      │   │ • Order conf │  │ • MercadoPago│
                    │ • products   │   │ • Contact    │  │ • ML API    │
                    │ • orders     │   │ • Verify     │  │ • Nominatim │
                    │ • lots       │   └──────────────┘  │ • DHL/FedEx │
                    │ • accounting │                      └─────────────┘
                    │ • production │
                    │ • farms      │
                    └──────────────┘
```

---

## 2. Capas de la Aplicación

### 2.1 Capa de Presentación (Frontend)

```
src/
├── layouts/
│   ├── Layout.astro          # Público: header + footer + scripts globales
│   ├── AdminLayout.astro     # Admin: auth check → redirect si no admin
│   └── AppLayout.astro       # App operativa: auth admin/caficultor
│
├── pages/                     # Astro SSR → HTML por ruta
│   ├── index.astro           # Homepage ES
│   ├── tienda.astro          # Catálogo ES
│   ├── carrito.astro         # Carrito ES
│   ├── checkout.astro        # Checkout ES
│   ├── t/[code].astro        # Trazabilidad QR (SSR dinámico)
│   ├── finca/[slug].astro    # Landing finca (SSR dinámico)
│   ├── en/                   # Mirror de páginas en inglés
│   ├── admin/                # Panel admin
│   └── app/                  # App operativa caficultor
│
├── components/
│   ├── Head.astro            # SEO meta tags, OG, canonical, hreflang
│   ├── Header.astro          # Nav principal + auth state
│   ├── Footer.astro          # Footer + newsletter + legal links
│   ├── ProductCard.astro     # Card de producto SSR
│   ├── SalesHeatmap.jsx      # React: mapa Leaflet interactivo
│   └── CookieConsent.astro   # Banner de cookies (por crear)
│
├── i18n/
│   ├── es.json               # Traducciones español
│   ├── en.json               # Traducciones inglés
│   └── index.js              # Helper t('key') + locale detection
│
└── data/
    └── products.ts           # [TEMPORAL] Migrar a BD en Fase 1
```

### 2.2 Capa de API (Backend)

```
server/
├── index.js                   # Express standalone (dev + producción directa)
├── db.js                      # Pool PostgreSQL (pg)
│
├── middleware/
│   ├── rateLimit.js           # Rate limiters por tipo de endpoint
│   ├── auth.js                # authenticateToken + requireRole (extraer de routes/auth.js)
│   └── csrf.js                # CSRF token validation (por crear)
│
├── routes/
│   ├── auth.js                # Login, register, refresh, logout, me, verify
│   ├── orders.js              # [POR CREAR] CRUD órdenes + checkout
│   ├── stock.js               # Stock público + gestión
│   ├── coffee.js              # Pipeline: harvest → packaging
│   ├── production.js          # Router padre → sub-routers
│   │   ├── orders.js          # Órdenes de producción [FIX: ESM]
│   │   ├── batches.js         # Lotes de tueste [FIX: ESM]
│   │   ├── quality.js         # Control calidad/cupping [FIX: ESM]
│   │   └── dashboard.js       # KPIs producción [FIX: ESM]
│   ├── accounting.js          # [POR CREAR] Contabilidad
│   ├── invoices.js            # [POR CREAR] Facturación
│   ├── expenses.js            # [POR CREAR] Gastos
│   ├── farms.js               # [POR CREAR] CRUD fincas
│   ├── labels.js              # Etiquetas + QR
│   ├── inventory.js           # Inventario + proveedores
│   ├── users.js               # Gestión de usuarios (admin)
│   ├── mercadolibre.js        # Sync ML + sales + heatmap
│   ├── contact.js             # Formulario contacto [FIX: persistir en BD]
│   ├── emails.js              # Envío de emails
│   └── webhooks/              # [POR CREAR]
│       ├── wompi.js           # Webhook Wompi
│       └── mercadopago.js     # Webhook MercadoPago
│
├── services/
│   ├── email.js               # Resend wrapper + templates HTML
│   ├── mercadolibre.js        # ML API client + geocoding
│   ├── audit.js               # Audit logging
│   ├── wompi.js               # [POR CREAR] Wompi SDK wrapper
│   ├── mercadopago.js         # [POR CREAR] MercadoPago SDK wrapper
│   └── geocoding.js           # [POR CREAR] Nominatim/Google geocoding
│
└── migrations/
    └── *.js                   # Migraciones incrementales

api/
└── index.js                   # Vercel serverless wrapper (DEBE montar TODOS los routers)
```

### 2.3 Capa de Datos (PostgreSQL)

```
Módulos de BD:

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   CORE          │     │   E-COMMERCE     │     │   PRODUCCIÓN    │
│                 │     │                  │     │                 │
│ • users         │◄───►│ • orders         │     │ • coffee_*      │
│ • refresh_tokens│     │ • order_items    │◄───►│ • roast_batches │
│ • audit_logs    │     │ • sales_invoices │     │ • production_*  │
│ • products      │◄───►│ • payments       │     │ • work_centers  │
│ • lots          │     │ • sales_tracking │     │ • quality_checks│
│ • farms         │     │                  │     │                 │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ INVENTARIO      │     │ CONTABILIDAD     │
│                 │     │                  │
│ • inventory_*   │     │ • accounting_*   │
│ • product_*     │◄───►│ • bank_*         │
│                 │     │ • purchase_*     │
│                 │     │ • expenses       │
│                 │     │ • budgets        │
│                 │     │ • tax_rates      │
└─────────────────┘     └──────────────────┘
```

---

## 3. Flujos de Datos Principales

### 3.1 Flujo de Compra (E-commerce)

```
Cliente                          Frontend                    API                         BD / Servicios
  │                                │                          │                              │
  │──── Agrega producto ──────────►│                          │                              │
  │                                │── localStorage.Cart ──►  │                              │
  │                                │   (sync si logueado)     │                              │
  │                                │                          │                              │
  │──── Checkout ─────────────────►│                          │                              │
  │                                │── POST /api/orders ─────►│                              │
  │                                │   {items, shipping,      │── INSERT orders ────────────►│
  │                                │    payment_method}        │── INSERT order_items ───────►│
  │                                │                          │── geocode(address) ──────────►│ Nominatim
  │                                │                          │── UPDATE orders(lat,lng) ────►│
  │                                │◄─ {order_id, payment_url}│                              │
  │                                │                          │                              │
  │──── Redirect a Wompi ─────────►│                          │                              │
  │     (o MercadoPago widget)     │                          │                              │
  │                                │                          │                              │
  │◄─── Callback payment ─────────│                          │                              │
  │                                │                          │◄── Webhook (Wompi/MP) ───────│
  │                                │                          │── UPDATE order.status ───────►│
  │                                │                          │── send confirmation email ──►│ Resend
  │                                │                          │── logAudit('sale') ──────────►│
  │                                │                          │                              │
  │◄─── Página confirmación ──────│◄── GET /api/orders/:id ──│◄── SELECT order + items ─────│
  │     (ref, resumen, QR lot)     │                          │                              │
```

### 3.2 Flujo de Trazabilidad (QR)

```
Cliente                          Frontend                    API                         BD
  │                                │                          │                           │
  │──── Escanea QR ───────────────►│                          │                           │
  │     (cámara → jsQR)            │── GET /t/{LOT_CODE} ────►│                           │
  │                                │   (Astro SSR page)       │── GET /api/traceability/ ─►│
  │                                │                          │   /:code                   │
  │                                │                          │                           │
  │                                │                          │◄── JOIN:                  │
  │                                │                          │    lots                    │
  │                                │                          │    + coffee_harvests       │
  │                                │                          │    + roast_batches         │
  │                                │                          │    + production_quality    │
  │                                │                          │    + farms                 │
  │                                │                          │    + generated_labels      │
  │                                │                          │                           │
  │◄─── Página trazabilidad ──────│◄── {timeline, farm,      │                           │
  │     (timeline, finca, cupping) │    cupping, dates}       │                           │
  │                                │                          │                           │
  │──── Click "Conoce la finca" ──►│── GET /finca/{slug} ────►│── SELECT farms WHERE ─────►│
  │                                │   (Astro SSR page)       │   slug = $1               │
  │◄─── Landing de finca ─────────│◄── {farm data + gallery} │                           │
```

### 3.3 Flujo de Producción (Café)

```
Caficultor/Admin                   App Pages                  API (coffee.js)              BD
  │                                │                          │                           │
  │──── Registra cosecha ─────────►│ app/harvest.astro       │                           │
  │                                │── POST /coffee/harvest ─►│── INSERT coffee_harvests ──►│
  │                                │                          │── logAudit() ──────────────►│
  │                                │                          │                           │
  │──── Almacena café verde ──────►│ app/inventory-storage    │                           │
  │                                │── POST /coffee/          │── INSERT green_coffee_inv ──►│
  │                                │   inventory-storage      │── UPDATE harvest status ───►│
  │                                │                          │                           │
  │──── Envía a tostión ──────────►│ app/send-roasting        │                           │
  │                                │── POST /coffee/          │── INSERT roasting_batches ──►│
  │                                │   send-roasting          │── UPDATE inventory status ─►│
  │                                │                          │                           │
  │──── Registra resultado ───────►│ app/roast-retrieval      │                           │
  │     tueste                     │── POST /coffee/          │── UPDATE roast_batch ──────►│
  │                                │   roast-retrieval        │── calc weight loss % ──────►│
  │                                │                          │                           │
  │──── Almacena café tostado ────►│ app/roasted-storage      │                           │
  │                                │── POST /coffee/          │── INSERT roasted_coffee ───►│
  │                                │   roasted-storage        │                           │
  │                                │                          │                           │
  │──── Empaqueta ────────────────►│ app/packaging            │                           │
  │                                │── POST /coffee/packaging ►│── INSERT packaged_coffee ──►│
  │                                │                          │── UPDATE lot status ───────►│
  │                                │                          │                           │
  │──── Genera etiqueta + QR ─────►│ app/etiquetas            │                           │
  │                                │── POST /labels/generate ─►│── INSERT generated_labels ──►│
  │                                │                          │── generate QR code image ──►│
```

---

## 4. Modelo de Autenticación

```
┌──────────────┐                   ┌──────────────┐              ┌──────────────┐
│   REGISTRO   │                   │    LOGIN     │              │   REQUEST    │
│              │                   │              │              │  PROTEGIDO   │
│ email +      │                   │ email +      │              │              │
│ password     │                   │ password     │              │ Cookie:      │
│              │                   │              │              │ auth_token   │
└──────┬───────┘                   └──────┬───────┘              └──────┬───────┘
       │                                  │                             │
       ▼                                  ▼                             ▼
┌──────────────┐                   ┌──────────────┐              ┌──────────────┐
│ bcrypt hash  │                   │ bcrypt       │              │ JWT verify   │
│ (10 rounds)  │                   │ compare      │              │ (access tok) │
│              │                   │              │              │              │
│ INSERT users │                   │ Generate:    │              │ Decode:      │
│              │                   │ • access JWT │              │ • user.id    │
│ Send verify  │                   │   (15 min)   │              │ • user.role  │
│ email        │                   │ • refresh JWT│              │ • user.email │
│              │                   │   (7 days)   │              │              │
└──────────────┘                   │              │              │ Check role   │
                                   │ Set-Cookie:  │              │ requireRole()│
                                   │ auth_token   │              │              │
                                   │ (HttpOnly)   │              │ ✓ / 401/403 │
                                   └──────────────┘              └──────────────┘

Auto-refresh (cada 12 min):
  Browser ──► POST /api/auth/refresh ──► Verify refresh token
                                          ──► Revoke old refresh
                                          ──► Issue new access + refresh
                                          ──► Set-Cookie: auth_token (new)
```

---

## 5. Modelo de Deployment

```
┌─────────────────────────────────────────────────┐
│                   GitHub                         │
│  main branch ───────────────────────────────────┤
│                                                  │
│  PR → CI Pipeline:                              │
│    1. ESLint                                     │
│    2. Type check                                 │
│    3. Vitest (unit + integration)                │
│    4. astro build                                │
│    5. Lighthouse CI                              │
│                                                  │
│  Merge → Auto deploy to Vercel                  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                 VERCEL                            │
│                                                  │
│  ┌────────────────┐    ┌────────────────────┐   │
│  │ Astro Build    │    │ Serverless Funcs   │   │
│  │ (SSR + Static) │    │ (api/index.js)     │   │
│  │                │    │                    │   │
│  │ dist/          │    │ Cold start: ~2s    │   │
│  │ _astro/        │    │ Max duration: 10s  │   │
│  └────────────────┘    └────────┬───────────┘   │
│                                 │                │
│  Domains:                       │                │
│  • dobleyo.cafe                 │                │
│  • www.dobleyo.cafe             │                │
│  • en.dobleyo.cafe → /en/*      │                │
│                                 │                │
│  Environment Variables:         │                │
│  • DATABASE_URL (encrypted)     │                │
│  • JWT_SECRET (encrypted)       │                │
│  • WOMPI_* (encrypted)          │                │
│  • MERCADOPAGO_* (encrypted)    │                │
└─────────────────────────────────┼────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │    PostgreSQL (Cloud)    │
                    │    Aiven / Neon / Supa   │
                    │                         │
                    │  SSL: required           │
                    │  Pool: 5 connections     │
                    │  Backup: daily auto      │
                    └─────────────────────────┘
```

---

## 6. Convenciones de API

### Formato de Respuesta Estándar

```json
// Éxito
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}

// Error
{
  "success": false,
  "error": "Descripción legible del error",
  "code": "VALIDATION_ERROR",
  "details": [ ... ]  // Solo en errores de validación
}
```

### Códigos de Error Estándar

| Código | HTTP | Uso |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Input inválido |
| `AUTHENTICATION_REQUIRED` | 401 | No autenticado |
| `FORBIDDEN` | 403 | Sin permisos |
| `NOT_FOUND` | 404 | Recurso no existe |
| `CONFLICT` | 409 | Recurso duplicado |
| `INTERNAL_ERROR` | 500 | Error del servidor |
| `PAYMENT_FAILED` | 402 | Fallo en pasarela de pagos |
| `RATE_LIMITED` | 429 | Too many requests |

---

## 7. Variables CSS — Design System

```css
:root {
  /* Colores principales */
  --coffee: #251a14;
  --cream: #f7f3ef;
  --accent: #c67b4e;
  --dark: #1f1f1f;

  /* Superficie y texto */
  --bg: var(--cream);
  --fg: #1f2937;
  --card: #ffffff;
  --border: #e6e6e6;
  --muted-fg: #6b7280;

  /* Breakpoints (referencia, no usables directamente en media queries) */
  --bp-sm: 480px;   /* Mobile landscape */
  --bp-md: 768px;   /* Tablet */
  --bp-lg: 1024px;  /* Desktop */
  --bp-xl: 1400px;  /* Wide */

  /* Spacing scale (base 4px) */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */

  /* Typography */
  --font-heading: 'Playfair Display', Georgia, serif;
  --font-body: 'Lora', Georgia, serif;
  --font-ui: 'Montserrat', Arial, sans-serif;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.1);

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Layout */
  --page-width: 1400px;
  --page-gutter: 2rem;
}
```

---

## 8. Tecnologías y Versiones

| Tecnología | Versión | Propósito |
|---|---|---|
| Node.js | >= 20 | Runtime |
| Astro | 5.16.x | SSR + Static Site Generation |
| React | 19.x | Componentes interactivos |
| Express | 4.19.x | Backend API |
| PostgreSQL | 15+ | Base de datos relacional |
| pg (node-postgres) | 8.x | Driver PostgreSQL |
| bcryptjs | 2.x | Hash de contraseñas |
| jsonwebtoken | 9.x | JWT auth |
| Resend | 6.x | Email transaccional |
| Leaflet | 1.9.x | Mapas interactivos |
| Helmet | 8.x | Headers de seguridad HTTP |
| Vitest | latest | Testing framework |
| Playwright | latest | E2E testing |
| Vercel | CLI latest | Deploy platform |
