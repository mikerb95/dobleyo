# AGENTS.md — Reglas y Convenciones para Agentes de IA

> Este documento establece las reglas, convenciones y estándares que **todo agente de IA** debe seguir al contribuir al proyecto DobleYo Café.  
> Última actualización: 2026-03-01

---

## 1. Información del Proyecto

| Campo | Valor |
|---|---|
| **Nombre** | DobleYo Café |
| **Dominio** | dobleyo.cafe / en.dobleyo.cafe |
| **Stack** | Astro 5 (SSR) + React 19 + Express 4 + PostgreSQL + Vercel |
| **Tipo de módulo** | ESM (`"type": "module"` en package.json) |
| **Node.js** | >= 20 |
| **Lenguaje de código** | Inglés (variables, funciones, clases, nombres de archivo) |
| **Lenguaje de comentarios** | Español (comentarios en código, commits, docs) |
| **Lenguaje de UI** | Español (primario) + Inglés (versión internacional) |
| **Moneda primaria** | COP (Peso colombiano) |
| **Moneda secundaria** | USD (versión USA) |

---

## 2. Estructura del Proyecto

```
dobleyo/
├── api/                  # Vercel serverless entry points
│   └── index.js          # Express app wrapper for Vercel
├── db/
│   └── schema.sql        # PostgreSQL schema (fuente de verdad)
├── docs/                 # Documentación técnica y funcional
├── public/
│   └── assets/
│       ├── css/styles.css  # CSS global (variables, layout, componentes)
│       ├── js/             # Scripts vanilla del cliente (cart, auth, trazabilidad)
│       ├── img/            # Imágenes estáticas
│       └── data/           # JSON de datos estáticos
├── server/
│   ├── index.js          # Express standalone server
│   ├── db.js             # Pool de conexión PostgreSQL
│   ├── store.js          # [DEPRECADO] In-memory store — reemplazar por BD
│   ├── middleware/        # Rate limiting, auth middleware
│   ├── routes/            # Routers Express por módulo
│   │   └── production/   # Sub-routers del módulo de producción
│   └── services/          # Lógica de negocio (email, MercadoLibre, audit)
├── src/
│   ├── components/        # Componentes Astro + React
│   ├── data/              # Datos estáticos TypeScript (products.ts)
│   ├── i18n/              # Traducciones JSON (es.json, en.json)
│   ├── layouts/           # Layouts (Layout, AdminLayout, AppLayout, MobileLayout)
│   └── pages/             # Páginas Astro (SSR/SSG)
│       ├── admin/         # Panel de administración
│       ├── app/           # App operativa (caficultor/admin)
│       ├── en/            # Versión en inglés
│       ├── finca/         # Landing pages de fincas [slug].astro
│       └── t/             # Trazabilidad QR [code].astro
├── AGENTS.md             # Este archivo — reglas para agentes IA
├── CLAUDE.md             # Instrucciones específicas para Claude
└── package.json          # Dependencias y scripts
```

---

## 3. Convenciones de Código

### 3.1 JavaScript / TypeScript

- **Módulos**: ESM exclusivamente (`import`/`export`). Nunca `require()` / `module.exports`.
- **Async**: Siempre `async/await`. No callbacks ni `.then()` chains para lógica de servidor.
- **Error handling**: `try/catch` en toda ruta Express con `res.status(500).json({ error: '...' })`.
- **Variables**: `camelCase` para variables y funciones, `PascalCase` para componentes React/Astro.
- **Constantes**: `UPPER_SNAKE_CASE` para constantes de configuración.
- **Archivos**: `kebab-case.js` para rutas y utilidades, `PascalCase.jsx/.astro` para componentes.
- **Strings**: Template literals (backticks) para interpolación. Single quotes para strings simples.
- **Imports**: Ordenar: 1) Node built-ins, 2) npm packages, 3) proyecto (absolutos), 4) proyecto (relativos).

```javascript
// ✅ Correcto
import crypto from 'crypto';
import express from 'express';
import { query } from '../db.js';
import { logAudit } from '../services/audit.js';

// ❌ Incorrecto
const express = require('express');
```

### 3.2 SQL (PostgreSQL)

- **Nombres de tabla**: `snake_case` en plural (`production_orders`, `roast_batches`)
- **Columnas**: `snake_case` (`created_at`, `user_id`, `lot_code`)
- **Placeholders**: `$1, $2, $3...` (PostgreSQL parameterized). Nunca interpolación de strings.
- **Tipos preferidos**: `BIGINT GENERATED ALWAYS AS IDENTITY` para PKs, `TIMESTAMPTZ` para fechas, `JSONB` para datos flexibles, `TEXT` en lugar de `VARCHAR(n)` salvo restricción real.
- **Migraciones**: Archivos en `server/migrations/` con formato `YYYY-MM-DD_description.js`.

```sql
-- ✅ Correcto
SELECT o.id, o.total FROM orders o WHERE o.user_id = $1 AND o.status = $2;

-- ❌ Incorrecto (MySQL syntax, string interpolation)
SELECT * FROM orders WHERE user_id = ? AND status = '${status}';
```

### 3.3 CSS

- **Variables**: Usar siempre CSS custom properties definidas en `:root` de `styles.css`.
- **Breakpoints estándar** (mobile-first con `min-width`):
  - `--bp-sm: 480px` — Mobile landscape
  - `--bp-md: 768px` — Tablet
  - `--bp-lg: 1024px` — Desktop
  - `--bp-xl: 1400px` — Wide desktop
- **Colores**: Solo variables (`var(--coffee)`, `var(--accent)`). Nunca hex hardcodeados en componentes.
- **Enfoque**: Mobile-first. Estilos base para mobile, `@media (min-width: ...)` para desktop.
- **Unidades**: `rem` para tipografía/espaciado, `px` para borders/shadows, `%`/`vw` para layout.
- **Touch targets**: Mínimo `44px × 44px` para elementos interactivos en mobile.

```css
/* ✅ Correcto — Mobile first */
.product-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 768px) {
  .product-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .product-grid { grid-template-columns: repeat(3, 1fr); }
}

/* ❌ Incorrecto — Desktop first, hardcoded color */
.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #f7f3ef;
}
@media (max-width: 768px) {
  .product-grid { grid-template-columns: 1fr; }
}
```

### 3.4 Componentes Astro / React

- **Astro**: Para contenido estático y páginas. `PascalCase.astro`.
- **React**: Solo para interactividad del cliente (formularios complejos, mapas, animaciones). `PascalCase.jsx`.
- **Props**: Documentar con JSDoc o TypeScript interfaces.
- **Layouts**: Toda página debe usar un Layout (`Layout.astro`, `AdminLayout.astro`, `AppLayout.astro`).
- **SEO**: Toda página debe incluir `<Head>` con title, description, canonical URL, og:tags.
- **`lang` attribute**: Dinámico según idioma (`es` o `en`).

### 3.5 API REST

- **Formato de respuesta**:
  ```json
  { "success": true, "data": { ... } }
  { "success": false, "error": "Mensaje descriptivo", "code": "ERROR_CODE" }
  ```
- **HTTP status codes**: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity, 500 Internal Server Error.
- **Autenticación**: HttpOnly cookie `auth_token` con JWT. Middleware `authenticateToken` y `requireRole('admin')`.
- **Paginación**: `?limit=20&offset=0` → respuesta incluye `{ data, total, limit, offset }`.
- **Validación**: `express-validator` en toda ruta que acepte input del usuario.

---

## 4. SEO — Reglas Obligatorias

Todo agente que cree o modifique páginas DEBE cumplir:

1. **Un solo `<h1>` por página** con keyword principal.
2. **Meta description** única por página (120-160 chars).
3. **Title tag** único (50-60 chars), formato: `"Página — DobleYo Café"`.
4. **Canonical URL**: `<link rel="canonical" href="https://dobleyo.cafe/path" />`.
5. **Open Graph tags**: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`.
6. **Imágenes**: `alt` descriptivo, formato WebP preferido, `loading="lazy"`, `srcset` para responsive.
7. **Heading hierarchy**: `h1 > h2 > h3` — sin saltos (no h1 → h3).
8. **Structured data**: JSON-LD para productos (`Product`), organización (`Organization`), breadcrumbs (`BreadcrumbList`).
9. **`hreflang`**: En todas las páginas con versión en otro idioma.
10. **URLs**: Limpias, lowercase, con guiones (`/envios-devoluciones`, no `/Envios_Devoluciones`).
11. **`robots` meta**: `noindex, nofollow` en admin/app. `index, follow` en públicas.

---

## 5. Accesibilidad — Reglas Obligatorias

1. **Contraste**: Ratio mínimo 4.5:1 para texto normal, 3:1 para texto grande (WCAG AA).
2. **Focus indicators**: Visible en todos los elementos interactivos (`:focus-visible`).
3. **Alt text**: Todas las imágenes. Decorativas: `alt=""` con `role="presentation"`.
4. **ARIA labels**: En iconos sin texto, modales, menús desplegables.
5. **Skip to content**: Link oculto al inicio de cada página.
6. **Keyboard navigation**: Todo funcional sin mouse (Tab, Enter, Escape, Arrow keys).
7. **`prefers-reduced-motion`**: Respetar preferencia del usuario, deshabilitar animaciones.

---

## 6. Seguridad — Reglas Obligatorias

1. **SQL**: Siempre parameterizado (`$1, $2`). Nunca interpolación de strings en queries.
2. **XSS**: Escapar output dinámico en HTML. Astro lo hace por defecto; en scripts inline usar `escapeHtml()`.
3. **CSRF**: Tokens CSRF en formularios de estado mutante (POST, PUT, DELETE).
4. **Auth tokens**: Solo en HttpOnly cookies. Nunca en localStorage ni en body de respuesta JSON.
5. **Secrets**: Nunca hardcodear. Siempre `process.env.VARIABLE`.
6. **Input validation**: `express-validator` en toda ruta con input del usuario.
7. **Rate limiting**: En endpoints de auth, webhooks, y formularios públicos.
8. **Dependencies**: `npm audit` antes de cada release. No publicar con vulnerabilidades críticas.

---

## 7. Mobile-First — Reglas Obligatorias

1. **CSS base**: Para viewport 320px. Expandir con `@media (min-width: ...)`.
2. **Touch targets**: Mínimo 44px × 44px para botones, links, inputs.
3. **No horizontal scroll**: Verificar en 320px, 375px, 414px.
4. **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1">`.
5. **Safe areas**: `padding: env(safe-area-inset-top)` en header para dispositivos con notch.
6. **Imágenes**: Responsive con `srcset` y `sizes`. Max-width: 100%.
7. **Fuentes**: Mínimo 16px para body text (evita zoom automático en iOS).
8. **Formularios**: Input types correctos (`type="email"`, `type="tel"`, `inputmode="numeric"`).
9. **Testing**: Verificar en Chrome DevTools con: iPhone SE (375px), iPhone 14 (390px), Pixel 7 (412px), iPad (768px).

---

## 8. Internacionalización (i18n)

- **Archivos de traducciones**: `src/i18n/es.json`, `src/i18n/en.json`.
- **Función helper**: `t('key.subkey')` retorna el string localizado.
- **URLs**: Español en raíz (`/tienda`), Inglés en `/en/` (`/en/shop`).
- **`<html lang="...">`**: Dinámico según el idioma de la página.
- **Moneda**: COP para español, USD para inglés. Formatear con `Intl.NumberFormat`.
- **Fechas**: `Intl.DateTimeFormat` con locale correcto.
- **Contenido nuevo**: Siempre crear en ambos idiomas.

---

## 9. Documentación — Reglas para Agentes

### Al terminar cada tarea, el agente DEBE:

1. **Actualizar `CHANGELOG.md`**: Agregar entrada con fecha, archivos creados/modificados, y descripción.
2. **Actualizar `AGENTS.md`** (este archivo): Si la tarea introduce nuevas convenciones, patrones o estructura.
3. **Documentar en código**: JSDoc para funciones públicas, comentarios para lógica compleja.
4. **Registrar en `docs/`**: Si es un módulo nuevo, crear/actualizar documentación técnica relevante.

### Formato de registro en CHANGELOG:

```markdown
## [Fecha] — Fase X.Y: Nombre de la Tarea (Agente: [nombre])

### Archivos Creados
- `ruta/archivo.js` — Descripción breve

### Archivos Modificados
- `ruta/archivo.js` — Qué cambió y por qué

### Decisiones Técnicas
- Por qué se eligió X sobre Y

### Impacto
- Qué funcionalidad nueva/corregida aporta
```

---

## 10. Testing

- **Framework**: Vitest (compatible con Vite/Astro).
- **Test files**: Junto al archivo que prueban: `module.test.js` o en `__tests__/module.test.js`.
- **Coverage mínimo**: 60% en servicios, 80% en rutas de auth.
- **Naming**: `describe('Module Name', () => { it('should do X when Y', ...) })`.
- **E2E**: Playwright para flujos críticos (compra, login, admin CRUD).

---

## 11. Deployment & CI/CD

- **Platform**: Vercel (Astro SSR + Serverless Functions).
- **Branches**: `main` (producción), `develop` (staging), feature branches (`feat/xxx`).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- **PR checks**: Lint → Type check → Tests → Build → Lighthouse CI.
- **Environment variables**: Documentar toda variable nueva en `.env.example`.
- **Secrets**: Solo en Vercel Environment Variables. Nunca en código.

---

## 12. Bugs Conocidos y Deuda Técnica

| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| BUG-001 | 🔴 Crítico | Módulo production usa CommonJS (`require`) en proyecto ESM | ✅ Resuelto Fase 1 |
| BUG-002 | 🔴 Crítico | `api/index.js` no monta productionRouter, emailRouter, contactRouter, caficultorRouter, audit endpoints | ✅ Resuelto Fase 1 |
| BUG-003 | 🔴 Crítico | 3 fuentes de datos de productos desincronizadas (products.ts, index.astro hardcoded, mobile.astro hardcoded) | Pendiente Fase 1 |
| BUG-004 | 🟡 Mayor | `/en/` hereda `<html lang="es">` de Layout.astro | ✅ Resuelto Fase 9 |
| BUG-005 | 🟡 Mayor | Error CSS en styles.css — llave `}` extra | ✅ Resuelto Fase 1 |
| BUG-006 | 🟡 Mayor | Checkout no funcional — sin pasarela de pagos, sin órdenes | ✅ Resuelto Fase 4 |
| BUG-007 | 🟠 Moderado | store.js es in-memory Map — órdenes se pierden al reiniciar | ✅ Resuelto Fase 4 |
| BUG-008 | 🟠 Moderado | Formulario de contacto solo hace console.log | ✅ Resuelto Fase 4 |
| BUG-009 | 🟠 Moderado | Newsletter del footer sin handler de submit | ✅ Resuelto Fase 1 |
| BUG-010 | 🟠 Moderado | Links legales apuntan a `#` | ✅ Resuelto Fase 3 |
| BUG-011 | 🟠 Moderado | CSP deshabilitado en Helmet | ✅ Resuelto Fase 11 |
| BUG-012 | 🟠 Moderado | Auth mixto: HttpOnly cookies + localStorage adminToken | ✅ Resuelto Fase 1 |
| DEBT-001 | 🟡 | README dice PostgreSQL pero código usa MySQL — migrar a PG | ✅ Resuelto Fase 11 |
| DEBT-002 | 🟡 | Breakpoints CSS inconsistentes (700, 768, 900, 980px) | ✅ Resuelto Fase 2 |
| DEBT-003 | 🟡 | Página mobile separada con UA sniffing — eliminar | ✅ Resuelto Fase 2 |
| DEBT-004 | 🟡 | Trazabilidad usa datos hardcodeados, no BD | ✅ Resuelto Fase 5 |
| DEBT-005 | 🟡 | Esquema contable (35+ tablas) sin rutas/servicios implementados | ✅ Resuelto Fase 6 |
| DEBT-006 | 🟡 | admin.html legacy coexiste con páginas Astro admin/ | ✅ Resuelto Fase 10 |
| DEBT-007 | 🟡 | Zero tests automatizados | ✅ Resuelto Fase 12 |
| DEBT-008 | 🟡 | Scripts de setup/seed/migraciones usan MySQL (mysql2, ?, AUTO_INCREMENT) | ✅ Resuelto Post-Fase 12 |

---

## 13. Plan de Fases (Referencia Rápida)

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Fundamentos documentales y gobernanza IA | ✅ En progreso |
| 1 | Estabilización, bug fixes, migración PostgreSQL | ✅ Completo |
| 2 | Diseño mobile-first y armonía visual | ✅ Completo |
| 3 | Normativa colombiana y compliance legal | ✅ Completo |
| 4 | Sistema de órdenes y pasarelas de pago | ✅ Completo |
| 5 | Trazabilidad completa y QR | ✅ Completo |
| 6 | Módulo de finanzas de producción | ✅ Completo |
| 7 | Landing pages de fincas y caficultores | ✅ Completo |
| 8 | Mapa de calor de ventas | ✅ Completo |
| 9 | Internacionalización (i18n) y versión USA | ✅ Completo |
| 10 | Panel de administración profesional | ✅ Completo |
| 11 | SEO, auditoría de seguridad y BD | ✅ Completo |
| 12 | CI/CD, testing y deployment | ✅ Completo |
