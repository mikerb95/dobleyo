# iteraciones.md — Exposición de Fases de Desarrollo · DobleYo Café

> Documento de referencia sobre cómo organizar y presentar las fases del proyecto.  
> La fuente de verdad de datos vive en `src/data/iteraciones.ts`; el tablero interactivo en `/admin/iteraciones`.

---

## Marco metodológico

El proyecto adopta **Extreme Programming (XP)** adaptado a un equipo de uno: Mike Restrepo como conductor humano y Claude (Anthropic) como navegador IA. Cada iteración produce historias de usuario con su **Definition of Done (DoD)** verificable, ancladas a commits reales del repositorio.

Las fases no son waterfall: varias corrieron en paralelo y los sprints post-plan son el resultado de retroalimentación continua. El historial total a junio 2026 supera los **1 500 commits**.

---

## Cómo exponer las fases

### Principio general

Las fases se agrupan en **tres capas cronológicas**, de lo más antiguo a lo más reciente. Dentro de cada capa, las iteraciones se muestran en orden cronológico inverso (más reciente primero) para que el estado actual sea lo primero que ve el lector.

```
Capa 1 · Fundación     → qué existía antes del plan formal
Capa 2 · Plan (Fases 0–12) → el roadmap documentado en marzo 2026
Capa 3 · Post-plan     → evolución orgánica derivada del uso real
```

### Estructura recomendada de cada iteración

| Campo | Descripción |
|---|---|
| **ID** | Código único (ej. `jun-erp`, `plan-b`) — clave para vínculos |
| **Fase** | Etiqueta de capa + grupo (ej. `Post-plan · Evolución`) |
| **Nombre** | Título corto que resume el foco del sprint |
| **Rango de fechas** | Periodo real del sprint (ancla temporal) |
| **Enlace a GitHub** | URL de commits filtrados por `since`/`until` — transparencia del trabajo real |
| **Commits** | Conteo cuando está disponible — proxy de esfuerzo |
| **Resumen** | 2–3 oraciones del qué y el por qué — no el cómo |
| **Historias** | Lista de cards XP con tipo, valor, DoD y par humano/IA |

---

## Las 10 iteraciones del proyecto

### Capa 3 · Post-plan (iteraciones en producción)

#### 1. Rediseño del ERP, checkout e internacionalización
**Periodo:** 15–20 jun 2026 · 401 commits  
**Fase:** Post-plan · Evolución

Sprint mayor de pulido. Unificó todo el módulo admin al sistema de diseño compartido, añadió checkout con sesión, navegación localizada ES/EN y los endpoints faltantes del backend.

Historias clave:
- `DY-ERP-01` — Sistema de diseño único para todo el ERP (elimina inconsistencias visuales)
- `DY-ERP-02` — Dashboard ejecutivo con KPIs reales y deltas vs. periodo anterior
- `DY-ERP-03` — Checkout con `optionalAuth`: sesión precargada o invitado
- `DY-ERP-04` — Navegación i18n coherente en Header, Footer y carrito
- `DY-ERP-05` — Bug: endpoints de Inventario y Producción inexistentes — resuelto

---

#### 2. CRM, MercadoLibre, blog y catación SCA
**Periodo:** 16–18 jun 2026  
**Fase:** Post-plan · Datos y contenido

Conexión de datos reales: CRM vinculado a ML, sync automático con webhook, gestor de blog con página pública, y rediseño del scoresheet SCA.

Historias clave:
- `DY-CRM-01` — CRM con LTV calculado y vínculos a ventas ML
- `DY-CRM-02` — Sync incremental + webhook idempotente de MercadoLibre
- `DY-CRM-03` — Blog con gestor admin, SSR público y JSON-LD `BlogPosting`
- `DY-CRM-04` — Scoresheet SCA: radar sensorial, 9 atributos, fórmula real
- `DY-CRM-05` — Drawer de carrito accesible con cierre por Esc/overlay

---

#### 3. Blindaje de seguridad y analítica de demanda (Python)
**Periodo:** 9–14 jun 2026 · 79 commits  
**Fase:** Post-plan · Seguridad y analítica

Endurecimiento de CSP/HSTS, rate limiting, tokens y webhook de pagos. Primer módulo Python para pronóstico de demanda. Avance de la app móvil con cola offline.

Historias clave:
- `DY-SEG-01` — Cabeceras de seguridad y CORS; fuga de config cerrada
- `DY-SEG-02` — Pronóstico de demanda por SKU (Python aislado, exporta Excel)
- `DY-SEG-03` — App móvil: cola offline idempotente + tokens nativos

---

#### 4. App móvil (Expo) y auditoría de mantenibilidad
**Periodo:** Mayo 2026 · 157 commits  
**Fase:** Post-plan · App móvil

Arranque del proyecto Expo/TypeScript con paquete compartido, y auditoría de mantenibilidad del backend (observabilidad, paginación, capa de servicios).

Historias clave:
- `DY-MOV-01` — App Expo con AuthContext, SecureStore y query client offline
- `DY-MOV-02` — Auditoría: observabilidad, paginación, service layer (navegador: Claude Opus)
- `DY-MOV-03` — Página showcase publicada (noindex removido)

---

#### 5. Migración a Turso, MercadoLibre y rediseño del admin
**Periodo:** Abril 2026 · 270 commits  
**Fase:** Post-plan · Plataforma de datos

Consolidación en Turso (libSQL/SQLite), primer panel ML y rediseño de tablas del admin.

Historias clave:
- `DY-TUR-01` — `server/db.js` reescrito de `pg` a `@libsql/client`; schema SQLite completo
- `DY-TUR-02` — Panel `/admin/mercadolibre` con sync de órdenes
- `DY-TUR-03` — Tablas del admin, estadísticas y mapa de ventas rediseñados

---

### Capa 2 · Plan formal (Fases 0–12, marzo 2026)

El plan de 13 fases se documentó entre el 1 y el 4 de marzo de 2026 en AGENTS.md, CLAUDE.md y CHANGELOG.md. Cada fase se implementó como una iteración XP con historias, DoD y commits verificables.

#### 6. Plataforma y calidad: i18n, admin pro, SEO/seguridad y CI/CD
**Periodo:** 2–4 mar 2026  
**Fases cubiertas:** 9, 10, 11, 12

- F9 — i18n con helpers `t`/`getLang`, páginas EN, hreflang ES/EN
- F10 — AdminLayout con sidebar, topbar móvil, dashboard y `/admin/pedidos`
- F11 — robots.txt, sitemap dinámico, JSON-LD, CSP en paridad `server`/`api`
- F12 — Vitest + ESLint + Playwright: 27 pruebas + GitHub Actions CI

---

#### 7. Operación y datos: finanzas, fincas y mapa de calor
**Periodo:** 2–3 mar 2026  
**Fases cubiertas:** 6, 7, 8

- F6 — 15 tablas financieras, router `/api/finance`, dashboard con 4 KPIs
- F7 — Tabla `farms`, slugs auto-generados, catálogo y landing SEO de fincas
- F8 — Geocodificación Nominatim, heatmap combinado web + ML, top-10 ciudades, CSV

---

#### 8. Comercio y trazabilidad: legal, pagos y QR
**Periodo:** 2–3 mar 2026  
**Fases cubiertas:** 3, 4, 5

- F3 — Páginas legales colombianas (Ley 1581, 1480, 1618), CookieBanner
- F4 — `customer_orders`, checkout Wompi, `/confirmacion` con polling, webhook HMAC
- F5 — `/api/traceability/:code` con JOIN completo del pipeline; página `/t/[code]` SSR

---

#### 9. Fundamentos y migración: gobernanza IA, PostgreSQL y mobile-first
**Periodo:** 1 mar 2026  
**Fases cubiertas:** 0, 1, 2

- F0 — AGENTS.md y CLAUDE.md: convenciones, deuda técnica, 79 requisitos
- F1 — Migración de `mysql2` a `pg`; bugs de `router.` y paridad `server`/`api`
- F2 — Breakpoints canónicos (480/768/1024/1400), hero móvil, página `/mobile` eliminada

---

### Capa 1 · Fundación (pre-plan)

#### 10. Backend de producción y contabilidad
**Periodo:** Ene–Feb 2026 · 364 commits  
**Fase:** Fundación · Backend

Núcleo operativo del ERP: módulo de manufactura (lotes, tueste, calidad), módulo contable y API del pipeline de café.

Historias clave:
- `DY-BE-01` — Manufactura: centros de trabajo, BOM, órdenes, calidad, Postman
- `DY-BE-02` — Contabilidad: cuentas, asientos, facturas, datos semilla
- `DY-BE-03` — Router del pipeline: cosecha → tueste → empaque, script de integridad

---

#### 11. Tienda online: catálogo, carrito y checkout inicial
**Periodo:** Ago–Dic 2025 · 134 commits  
**Fase:** Fundación · Tienda

Primeros pasos del sitio: catálogo, carrito con localStorage, checkout inicial y API de stock.

Historias clave:
- `DY-FN-01` — Catálogo, FAQ, políticas, carrito con eventos, filtros con scroll horizontal
- `DY-FN-02` — API de gestión de stock; steppers de cantidad en carrito
- `DY-FN-03` — Logo, navegación, toggle de tema, ajustes de accesibilidad

---

## Reglas para mantener este documento actualizado

1. **Cada nuevo sprint** → agregar una entrada en `ITERACIONES` en `src/data/iteraciones.ts` y actualizar la sección correspondiente aquí.
2. **La numeración** de la lista en este documento es solo orientativa (orden inverso cronológico); el ID textual (`jun-erp`, `plan-a`, etc.) es la referencia canónica.
3. **No duplicar el DoD** aquí — ese nivel de detalle vive en `iteraciones.ts` y se renderiza en el tablero `/admin/iteraciones`.
4. **Los commits y fechas** de este documento deben coincidir con los valores en `iteraciones.ts`; si se actualizan allí, actualizar aquí.

---

## Métricas globales (jun 2026)

| Métrica | Valor |
|---|---|
| Iteraciones documentadas | 10 (2 fundación + 4 plan + 4 post-plan) |
| Historias totales | 36 |
| Commits en el historial | ~1 520 |
| Mes de mayor actividad | Jun 2026 (474 commits) |
| Criterios DoD cumplidos | ~95 % (mayoría `pass`, 2 `pend` activos) |
| Pares de trabajo | Mike Restrepo (conductor) + Claude / Claude Opus / GitHub Copilot (navegadores) |
