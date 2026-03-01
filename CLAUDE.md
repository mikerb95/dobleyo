# CLAUDE.md — Instrucciones Específicas para Claude

> Contexto y reglas para interactuar con el proyecto DobleYo Café.  
> Lee primero `AGENTS.md` para convenciones generales. Este archivo contiene directivas específicas para Claude.

---

## Contexto del Proyecto

**DobleYo Café** es una plataforma de comercio electrónico de café de especialidad colombiano con módulos de:
- **Tienda online** (B2C Colombia + B2B/B2C USA)  
- **Trazabilidad** del grano: finca → cosecha → tostión → empaque → venta, con QR en empaque
- **Producción**: gestión de órdenes de producción, lotes de tueste, control de calidad (cupping SCA)
- **Finanzas**: contabilidad de doble partida, costeo de producción, facturación
- **Admin/ERP**: panel de administración con inventario, usuarios, fincas, mapa de calor de ventas
- **Integración MercadoLibre**: sync de órdenes, tracking de envíos, datos de ventas

---

## Stack Tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| **Frontend SSR** | Astro 5.16 + `@astrojs/vercel` | Genera HTML estático + SSR en rutas dinámicas |
| **UI interactiva** | React 19 + Framer Motion | Solo para componentes que necesitan estado/interactividad |
| **Estilos** | CSS custom (`public/assets/css/styles.css`) + TailwindCSS CDN (algunas páginas) | Variables CSS en `:root`, mobile-first |
| **Backend API** | Express 4.19 | Montado en `server/index.js` (standalone) y `api/index.js` (Vercel) |
| **Base de datos** | PostgreSQL | Migración desde MySQL en progreso. Driver: `pg` |
| **Auth** | JWT (access 15min + refresh 7d) | HttpOnly cookies. Roles: admin, client, provider, caficultor |
| **Email** | Resend | Templates HTML para verificación, confirmación de orden, contacto |
| **Mapas** | Leaflet + leaflet.heat | Heatmap de ventas en admin |
| **Deploy** | Vercel | Astro SSR + Serverless Functions para API |
| **Dominio** | `dobleyo.cafe`, `en.dobleyo.cafe` | Subdomain routing en vercel.json |

---

## Archivos Clave — Mapa de Navegación

### Entrada y Configuración
| Archivo | Propósito |
|---|---|
| `package.json` | Dependencias, scripts, engines (Node >=20), `"type": "module"` |
| `astro.config.mjs` | Astro + React + Vercel adapter |
| `vercel.json` | Rewrites: subdomain EN, API catch-all → `api/index.js` |
| `.env.example` | Variables de entorno requeridas |

### Base de Datos
| Archivo | Propósito |
|---|---|
| `server/db.js` | Pool de conexión PostgreSQL (migrar de mysql2 → pg) |
| `db/schema.sql` | Schema completo (~1082 líneas, 35+ tablas). FUENTE DE VERDAD del modelo de datos |
| `db/seed_data.sql` | Datos semilla para desarrollo |
| `server/migrations/*.js` | Migraciones incrementales |

### Backend (Express)
| Archivo | Propósito |
|---|---|
| `server/index.js` | Express standalone (268 líneas). Monta TODOS los routers + audit/debug/health endpoints |
| `api/index.js` | Express para Vercel serverless. ⚠️ NO monta todos los routers — VERIFICAR PARIDAD |
| `server/routes/auth.js` | Auth completo: register, login, refresh, logout, me, verify, caficultor status |
| `server/routes/coffee.js` | Pipeline de café: harvest → storage → roasting → retrieval → packaging → sale |
| `server/routes/production.js` | Router padre que monta sub-routers de `production/` |
| `server/routes/production/*.js` | ⚠️ USAN CommonJS — DEBEN MIGRARSE A ESM |
| `server/routes/inventory.js` | CRUD de productos, movimientos, proveedores |
| `server/routes/mercadolibre.js` | Sync ML, sales, heatmap data |
| `server/routes/labels.js` | Sistema de etiquetas/QR |
| `server/routes/stock.js` | Stock público y gestión |
| `server/services/email.js` | Servicio de email con Resend y templates HTML |
| `server/services/mercadolibre.js` | Servicio ML: fetch orders, geocoding, DB persistence |
| `server/services/audit.js` | Logging de auditoría a tabla `audit_logs` |

### Frontend — Páginas Públicas
| Archivo | Propósito |
|---|---|
| `src/pages/index.astro` | Homepage con hero video, productos featured |
| `src/pages/tienda.astro` | Catálogo con filtros. Lee de `src/data/products.ts` (migrar a BD) |
| `src/pages/carrito.astro` | Carrito (localStorage via `cart.js`) |
| `src/pages/checkout.astro` | Checkout (⚠️ PAGOS DESHABILITADOS) |
| `src/pages/trazabilidad.astro` | Scanner QR + búsqueda manual de lotes |
| `src/pages/en/index.astro` | Landing B2B en inglés (1127 líneas, página autónoma) |
| `src/pages/contacto.astro` | Formulario de contacto |
| `src/pages/blog.astro` | Blog (localStorage — migrar a BD) |

### Frontend — Admin
| Archivo | Propósito |
|---|---|
| `src/pages/admin/inventario.astro` | Gestión de inventario |
| `src/pages/admin/lotes.astro` | Gestión de lotes |
| `src/pages/admin/sales-map.astro` | Mapa de calor de ventas (React + Leaflet) |
| `src/pages/admin/usuarios.astro` | Gestión de usuarios |

### Frontend — App Operativa (Caficultor/Admin)
| Archivo | Propósito |
|---|---|
| `src/pages/app/harvest.astro` | Registro de cosechas |
| `src/pages/app/inventory-storage.astro` | Almacenamiento de inventario verde |
| `src/pages/app/send-roasting.astro` | Enviar a tostión |
| `src/pages/app/roast-retrieval.astro` | Recibir café tostado |
| `src/pages/app/roasted-storage.astro` | Almacén de café tostado |
| `src/pages/app/packaging.astro` | Empaquetado |
| `src/pages/app/etiquetas.astro` | Generación de etiquetas |
| `src/pages/app/finanzas.astro` | Dashboard financiero (estructura base) |
| `src/pages/app/ventas.astro` | Ventas MercadoLibre |
| `src/pages/app/auditoria.astro` | Logs de auditoría |
| `src/pages/app/estadisticas.astro` | Estadísticas |

### Componentes
| Archivo | Tipo | Propósito |
|---|---|---|
| `src/components/Head.astro` | Astro | `<head>` reutilizable con SEO meta |
| `src/components/Header.astro` | Astro | Navegación principal + coffee beans animation |
| `src/components/Footer.astro` | Astro | Footer con newsletter, links, social |
| `src/components/ProductCard.astro` | Astro | Card de producto para grid de tienda |
| `src/components/SalesHeatmap.jsx` | React | Mapa de calor Leaflet + heatmap plugin |
| `src/components/SalesTable.jsx` | React | Tabla de ventas ordenable |
| `src/components/RoastForm.jsx` | React | Formulario de tostión |

### Layouts
| Archivo | Propósito |
|---|---|
| `src/layouts/Layout.astro` | Público: Header + Footer + cart.js + auth-refresh.js. `<html lang="es">` ⚠️ hardcoded |
| `src/layouts/AdminLayout.astro` | Admin: auth check, redirect no-admins, noindex |
| `src/layouts/AppLayout.astro` | App: auth para admin/caficultor, timeout 10s, noindex |
| `src/layouts/MobileLayout.astro` | Mobile: layout específico para app operativa mobile |

### Datos Estáticos
| Archivo | Propósito |
|---|---|
| `src/data/products.ts` | 5 productos (3 cafés, 2 accesorios). FUENTE ÚNICA de productos front (migrar a BD) |

### Scripts del Cliente (Vanilla JS)
| Archivo | Propósito |
|---|---|
| `public/assets/js/cart.js` | `window.Cart` — localStorage cart API (37 líneas) |
| `public/assets/js/auth-refresh.js` | Auto-refresh de JWT cada 12 min |
| `public/assets/js/admin.js` | Legacy admin panel (localStorage CRUD) |
| `public/assets/js/trazabilidad.js` | Scanner QR + lookup de lotes (datos hardcodeados ⚠️) |

---

## Reglas Específicas para Claude

### Al recibir una tarea:

1. **Lee `AGENTS.md` primero** — contiene todas las convenciones de código, SEO, seguridad, mobile-first.
2. **Verifica el archivo antes de editarlo** — el proyecto tiene archivos legacy y archivos Astro nuevos. No editar archivos legacy sin confirmar que son activos.
3. **Mantén paridad** entre `server/index.js` y `api/index.js` — si agregas un router al standalone, agrégalo también al serverless.
4. **Nunca uses `require()`** — el proyecto es ESM (`"type": "module"`).
5. **Base de datos es PostgreSQL** — usa `$1, $2` para parámetros, no `?`.
6. **Formato de respuesta API** estandarizado: `{ success: true/false, data/error, ... }`.
7. **Al crear páginas**: usa `Layout.astro` o `AdminLayout.astro` según contexto. Incluye `<Head>` con SEO.
8. **CSS**: solo variables CSS. Breakpoints mobile-first estándar (480, 768, 1024, 1400).
9. **Al terminar**: actualiza `CHANGELOG.md` y `AGENTS.md` si aplica.

### Patrones de código aprobados:

```javascript
// Ruta Express con validación, auth y error handling
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from './auth.js';
import { logAudit } from '../services/audit.js';

export const exampleRouter = Router();

exampleRouter.post('/',
  authenticateToken,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Nombre requerido'),
    body('price').isInt({ min: 1 }).withMessage('Precio debe ser positivo'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, price } = req.body;
      const result = await query(
        'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id',
        [name, price]
      );

      await logAudit(req.user.id, 'create', 'product', result.rows[0].id, { name, price });

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[POST /api/example] Error:', err);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);
```

### Cosas que NO debes hacer:

- ❌ Crear archivos `.md` de documentación de cambios (excepto actualizar `CHANGELOG.md` y `AGENTS.md`)
- ❌ Usar `require()` o `module.exports`
- ❌ Interpolar variables en queries SQL
- ❌ Almacenar tokens en localStorage
- ❌ Usar colores hex hardcodeados en CSS
- ❌ Crear breakpoints no estándar
- ❌ Olvidar SEO meta tags en páginas públicas
- ❌ Crear páginas sin responsive design
- ❌ Ignorar la paridad `server/index.js` ↔ `api/index.js`

---

## Variables de Entorno Requeridas

```bash
# Base de datos PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/dobleyo

# Auth
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>

# Email (Resend)
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=noreply@dobleyo.cafe

# Site
SITE_BASE_URL=https://dobleyo.cafe
NODE_ENV=production
PORT=4000

# Admin setup
ADMIN_EMAIL=admin@dobleyo.cafe
ADMIN_PASSWORD=<secure password>
SETUP_SECRET_KEY=<random string>

# MercadoLibre
ML_ACCESS_TOKEN=APP_USR-xxxx
ML_SELLER_ID=123456

# Pagos (Fase 4)
WOMPI_PUBLIC_KEY=pub_xxxx
WOMPI_PRIVATE_KEY=prv_xxxx
WOMPI_EVENTS_SECRET=events_xxxx
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxx
```

---

## Modelo de Datos — Tablas Principales

> Schema completo en `db/schema.sql` (1082 líneas). Aquí las tablas más referenciadas:

### Core
- `users` — Todos los roles (admin, client, provider, caficultor)
- `products` — Productos con categoría, origen, proceso, tueste, precio
- `lots` — Lotes de café con trazabilidad completa
- `orders` — (POR CREAR en Fase 4) Pedidos del e-commerce
- `order_items` — (POR CREAR) Ítems de cada pedido

### Producción / Trazabilidad
- `coffee_harvests` — Cosechas en finca (migración)
- `green_coffee_inventory` — Inventario de café verde
- `roast_batches` — Lotes de tostión con datos de curva
- `production_orders` — Órdenes de manufactura
- `production_quality_checks` — Cupping SCA scores
- `generated_labels` — Etiquetas con QR y metadata

### Finanzas
- `accounting_accounts` — Plan de cuentas (doble partida)
- `accounting_entries` + `accounting_entry_lines` — Asientos contables
- `sales_invoices` + `purchase_invoices` — Facturación
- `payments` + `payment_allocations` — Pagos multi-factura
- `expenses` — Gastos con aprobación
- `budgets` + `budget_lines` — Presupuestos

### Ventas Externas
- `sales_tracking` — Datos de MercadoLibre con geocoordenadas

### Fincas (POR CREAR en Fase 7)
- `farms` — Fincas con datos geográficos, galería, caficultor

---

## Orden de Ejecución de Fases

```
Fase 0  →  Fase 1  →  Fase 2  →  Fase 3  →  Fase 4  →  Fase 5
(docs)    (estab.)   (mobile)   (legal)    (pagos)   (trazab.)

→  Fase 6  →  Fase 7  →  Fase 8  →  Fase 9   →  Fase 10  →  Fase 11  →  Fase 12
  (finanz.)  (fincas)   (heatmap)  (i18n/USA)   (admin)     (SEO/sec)   (CI/CD)
```

Cada fase termina con documentación en `AGENTS.md` y `CHANGELOG.md`.
