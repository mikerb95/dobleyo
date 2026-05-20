# Plan de Ejecución — Auditoría Mayo 20, 2026

> **Alcance:** Corrección de deuda técnica identificada en auditoría de mantenibilidad y escalabilidad.  
> **Fecha:** 2026-05-20  
> **Estado:** Pendiente

---

## Semana 1 — Seguridad Crítica (2026-05-20 al 2026-05-27)

### Tarea 1.1 — Purgar `.env` del historial de git y rotar secretos

**Prioridad:** BLOQUEANTE  
**Responsable:** Mike  
**Riesgo:** Secretos actuales comprometidos (JWT, Resend, credenciales admin)

**Pasos:**
1. Rotar TODOS los secretos antes de purgar (el historial sigue expuesto hasta que se completen ambos pasos):
   - Generar nuevo `JWT_SECRET` y `JWT_REFRESH_SECRET` (min 64 chars hex)
   - Regenerar `RESEND_API_KEY` desde dashboard de Resend
   - Cambiar `ADMIN_PASSWORD`
   - Revocar y regenerar `ML_ACCESS_TOKEN` si aplica
2. Añadir `.env` al `.gitignore`
3. Purgar `.env` del historial con `git filter-repo`:
   ```bash
   pip install git-filter-repo
   git filter-repo --path .env --invert-paths --force
   git push origin --force --all
   ```
4. Actualizar secretos en Vercel (`vercel env add`) y en entorno local
5. Verificar que `.env` no aparece en `git log --all -- .env`

**Criterio de éxito:** `git ls-files .env` no retorna nada. Todos los servicios funcionan con los nuevos secretos.

---

### Tarea 1.2 — Eliminar endpoints de debug/setup de producción

**Prioridad:** CRÍTICA  
**Archivos afectados:**
- `vercel.json` — remover rewrites de: `/api/minimal`, `/api/diagnose`, `/api/debug-login`, `/api/setup-standalone`
- `api/debug_login.js` y `api/debug_login.js.bak` — eliminar
- `api/diagnose.js` y `api/diagnose.js.bak` — eliminar
- `api/minimal.js` — eliminar
- `api/setup_standalone.js` y `api/setup_standalone.js.bak` — eliminar
- `server/index.js` — remover endpoint `/api/debug-env`

**Pasos:**
1. Confirmar que ninguna funcionalidad de producción depende de estos endpoints
2. Eliminar archivos y limpiar `vercel.json`
3. Desplegar y verificar que los endpoints retornan 404

**Criterio de éxito:** `curl https://dobleyo.cafe/api/debug-login` retorna 404.

---

### Tarea 1.3 — Migrar `adminToken` de `localStorage` a HttpOnly cookie

**Prioridad:** CRÍTICA  
**Archivos afectados:**
- `public/assets/js/auth-refresh.js`
- `public/assets/js/admin.js`
- `server/routes/auth.js` (verificar que ya emite cookie en login)

**Contexto:** El backend ya emite tokens como HttpOnly cookies en el flujo principal. El flujo de admin lee el token de `localStorage` en paralelo, anulando la protección XSS.

**Pasos:**
1. Auditar `server/routes/auth.js` — confirmar que `/api/auth/login` ya setea cookie HttpOnly
2. Eliminar `localStorage.setItem('adminToken', ...)` y `localStorage.getItem('adminToken')` de `auth-refresh.js`
3. Modificar `admin.js` para no incluir `Authorization: Bearer` header manual — dejar que la cookie se envíe automáticamente
4. Ajustar las llamadas fetch en `admin.js` a `credentials: 'include'`
5. Eliminar `localStorage.removeItem('userName')` y manejar el nombre de usuario desde la respuesta del endpoint `/api/auth/me`

**Criterio de éxito:** El panel admin funciona sin `localStorage.getItem('adminToken')`. DevTools → Application → Local Storage no muestra el token.

---

## Semana 2 — Coherencia del Backend (2026-05-27 al 2026-06-03)

### Tarea 2.1 — Sincronizar `api/index.js` con `server/index.js`

**Prioridad:** ALTA  
**Problema:** El serverless (Vercel) y el standalone (dev local) tienen funcionalidades distintas. Bugs en producción que no se replican localmente.

**Diferencias detectadas en `server/index.js` que no están en `api/index.js`:**
- Endpoints de audit: `GET /api/audit/logs`, `GET /api/audit/stats`, `GET /api/audit/actions`
- Stubs MercadoPago: `POST /api/mp/create_preference`, `POST /api/mp/webhook`

**Pasos:**
1. Mover los endpoints de audit a `server/routes/audit.js` como router exportable
2. Importar y montar `auditRouter` en `api/index.js`
3. Decidir si los stubs de MercadoPago van en `api/index.js` o en un router separado `server/routes/mercadopago.js`
4. Crear checklist de paridad (lista de todos los routers) y añadirla a `AGENTS.md`

**Criterio de éxito:** `diff <(grep "app.use" server/index.js) <(grep "app.use" api/index.js)` no muestra diferencias en routers de negocio.

---

### Tarea 2.2 — Limpiar archivos legacy

**Prioridad:** MEDIA  
**Archivos a eliminar:**
- `server/index_with_production.js` (CommonJS, reemplazado por ESM)
- `public/assets/js/admin.js` (CRUD localStorage, reemplazado por API)
- Cualquier archivo `.bak` que quede tras Tarea 1.2

**Pasos:**
1. Confirmar que `admin.js` no tiene funcionalidades que la API no cubra
2. Auditar referencias a `admin.js` en páginas Astro (`grep -r "admin.js" src/`)
3. Eliminar archivos confirmados como inactivos
4. Actualizar `AGENTS.md` si alguno estaba documentado

**Criterio de éxito:** `find . -name "*.bak" -o -name "index_with_production.js"` no retorna resultados.

---

## Semana 3 — Datos Dinámicos (2026-06-03 al 2026-06-10)

### Tarea 3.1 — Conectar catálogo de tienda a la base de datos

**Prioridad:** ALTA  
**Problema:** `src/data/products.ts` tiene los 5 productos hardcodeados. Cambios en BD no se reflejan sin rebuild.

**Contexto:** Ya existe tabla `products` en Turso y migración `20260411_seed_products_store.js`. Los datos están en BD; el frontend simplemente no los consume.

**Pasos:**
1. Crear endpoint `GET /api/products/public` (sin auth) que retorne productos activos
2. En `src/pages/tienda.astro`, reemplazar `import { products } from '../data/products.ts'` por un fetch SSR al endpoint
3. En `src/pages/index.astro` (homepage featured), hacer lo mismo para productos destacados
4. Mantener `src/data/products.ts` como fallback temporal durante la migración
5. Una vez validado en producción, eliminar `products.ts`

**Criterio de éxito:** Añadir un producto en admin aparece en la tienda sin rebuild. `src/data/products.ts` eliminado.

---

## Medio Plazo — Observabilidad y Calidad (2026-06-10 en adelante)

### Tarea 4.1 — Instalar logger estructurado (pino)

**Prioridad:** MEDIA  
**Motivación:** 198 `console.error` sin request ID, severidad ni formato parseable. Imposible trazar errores en producción.

**Pasos:**
1. `npm install pino pino-pretty`
2. Crear `server/logger.js` con configuración base:
   ```javascript
   import pino from 'pino';
   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: process.env.NODE_ENV !== 'production'
       ? { target: 'pino-pretty' }
       : undefined,
   });
   ```
3. Reemplazar `console.error` por `logger.error` en rutas (puede hacerse por archivo, no requiere hacerlo todo de una vez)
4. Añadir request ID middleware con `pino-http`

**Criterio de éxito:** Los logs en Vercel muestran JSON estructurado con `requestId`, `level`, `route` y `err`.

---

### Tarea 4.2 — Extraer service layer de rutas monolíticas

**Prioridad:** MEDIA  
**Archivos críticos:** `coffee.js` (1,234 líneas), `finance.js` (763 líneas)

**Patrón a aplicar:**
```
server/routes/coffee.js       → orquestación HTTP únicamente
server/services/coffee.js     → lógica de negocio y queries
```

**Pasos:**
1. Comenzar con `coffee.js` por ser el más grande
2. Extraer funciones de negocio a `server/services/coffee.js`
3. El router solo hace: validar input → llamar servicio → formatear respuesta
4. Repetir para `finance.js` e `inventory.js`
5. Los servicios son más fáciles de testear unitariamente

**Criterio de éxito:** Ningún archivo de rutas supera 300 líneas. Cobertura de tests en servicios >60%.

---

### Tarea 4.3 — Resolver estrategia CSS (Tailwind vs Custom)

**Prioridad:** BAJA  
**Problema:** Coexistencia de CSS custom con variables + Tailwind CDN en algunas páginas. Bundle de Tailwind completo (~300KB) sin tree-shaking.

**Opciones:**
- **A)** Eliminar Tailwind CDN y usar solo CSS custom con variables — mayor control, menos bytes
- **B)** Integrar Tailwind como plugin de Astro (`@astrojs/tailwind`) — tree-shaking automático, sin CDN

**Recomendación:** Opción B si el equipo ya usa clases Tailwind extensivamente. Opción A si es uso marginal.

**Pasos (Opción B):**
1. `npx astro add tailwind`
2. Eliminar el `<link>` al CDN de Tailwind en layouts
3. Configurar `tailwind.config.mjs` con las variables CSS existentes como custom colors
4. Verificar que no hay conflictos con `styles.css`

---

### Tarea 4.4 — Añadir paginación a endpoints de lista

**Prioridad:** BAJA (preventiva)  
**Endpoints a revisar:** Cualquier `SELECT * FROM` sin `LIMIT` en rutas de lista.

**Patrón estándar:**
```javascript
const page = parseInt(req.query.page) || 1;
const limit = Math.min(parseInt(req.query.limit) || 20, 100);
const offset = (page - 1) * limit;
// SELECT ... LIMIT ? OFFSET ?
// Retornar: { data, total, page, limit, pages }
```

---

### Tarea 4.5 — Expandir cobertura de tests

**Prioridad:** MEDIA  
**Estado actual:** 1 test unitario, 1 smoke test E2E.

**Objetivo mínimo:**
- Tests unitarios para los servicios extraídos en Tarea 4.2
- Tests de integración para rutas críticas: auth, products, orders
- E2E para flujos completos: login → tienda → carrito

---

## Seguimiento

| Tarea | Estado | Fecha objetivo | Notas |
|---|---|---|---|
| 1.1 — Purgar .env y rotar secretos | ⬜ Pendiente | 2026-05-21 | BLOQUEANTE |
| 1.2 — Eliminar endpoints debug | ⬜ Pendiente | 2026-05-22 | — |
| 1.3 — Migrar adminToken a cookie | ⬜ Pendiente | 2026-05-24 | — |
| 2.1 — Sincronizar api/ vs server/ | ⬜ Pendiente | 2026-05-30 | — |
| 2.2 — Limpiar archivos legacy | ⬜ Pendiente | 2026-06-01 | — |
| 3.1 — Tienda conectada a BD | ⬜ Pendiente | 2026-06-08 | — |
| 4.1 — Logger estructurado (pino) | ⬜ Pendiente | 2026-06-15 | — |
| 4.2 — Service layer coffee/finance | ⬜ Pendiente | 2026-06-30 | — |
| 4.3 — Estrategia CSS | ⬜ Pendiente | 2026-07-07 | Decidir A o B |
| 4.4 — Paginación endpoints | ⬜ Pendiente | 2026-07-14 | — |
| 4.5 — Cobertura de tests | ⬜ Pendiente | Continuo | — |
