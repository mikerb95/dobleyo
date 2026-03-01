# Análisis de Requerimientos — DobleYo Café

> Análisis de viabilidad, dependencias entre módulos, riesgos y decisiones técnicas.  
> Última actualización: 2026-03-01

---

## 1. Análisis de Viabilidad

### 1.1 Viabilidad Técnica

| Área | Estado | Riesgo | Mitigación |
|---|---|---|---|
| **Frontend (Astro + React)** | ✅ Viable | Bajo | Stack moderno, bien soportado por Vercel |
| **Backend (Express + PG)** | ✅ Viable | Medio | Migración MySQL → PostgreSQL requiere adaptar todas las queries |
| **Wompi integration** | ✅ Viable | Bajo | SDK oficial disponible, documentación completa, sandbox gratuito |
| **MercadoPago integration** | ✅ Viable | Bajo | SDK oficial Node.js, amplia documentación |
| **Trazabilidad QR** | ✅ Viable | Bajo | jsQR existente + librería `qrcode` para generación |
| **Mapa de calor** | ✅ Viable | Bajo | Leaflet + leaflet.heat ya integrados, solo falta data de órdenes web |
| **i18n** | ✅ Viable | Medio | Sin framework i18n — implementar sistema JSON manual. Volumen alto de traducción |
| **Facturación electrónica** | ⚠️ Parcial | Alto | Requiere proveedor externo (Alegra/Siigo). Integrar API. Fase posterior |
| **Geocodificación** | ✅ Viable | Medio | Nominatim (OSM) gratuito pero con rate limits. Google Geocoding como alternativa paga |

### 1.2 Viabilidad de Recursos

| Factor | Evaluación |
|---|---|
| **Costo de infraestructura** | Bajo. Vercel free/pro tier. PostgreSQL en Aiven/Supabase/Neon (free tier). Wompi y MercadoPago cobran por transacción, no setup |
| **Volumen esperado** | Bajo-medio (<100 órdenes/día). No requiere infraestructura enterprise |
| **Equipo** | Desarrollo asistido por IA. Requiere revisión humana de compliance legal y UX |
| **Tiempo estimado total** | 60-90 días para las 12 fases completas |

---

## 2. Dependencias entre Módulos

```
Fase 0 (Docs) ─────────────────────────────────────────────────────────┐
    │                                                                   │
    ▼                                                                   │
Fase 1 (Estabilización + PostgreSQL) ──────────────────────────────┐   │
    │                                                               │   │
    ├──► Fase 2 (Mobile-First + Diseño)                            │   │
    │       │                                                       │   │
    │       ▼                                                       │   │
    ├──► Fase 3 (Normativa Legal Colombia)                         │   │
    │       │                                                       │   │
    │       ▼                                                       │   │
    └──► Fase 4 (Órdenes + Pagos) ◄── depende de Fase 1 (PG)     │   │
            │                          y Fase 3 (T&C checkbox)      │   │
            │                                                       │   │
            ├──► Fase 5 (Trazabilidad + QR) ◄── depende de Fase 1  │   │
            │       │                                               │   │
            │       ▼                                               │   │
            ├──► Fase 7 (Fincas) ◄── depende de Fase 5 (enlace)   │   │
            │                                                       │   │
            ├──► Fase 6 (Finanzas) ◄── depende de Fase 4 (órdenes) │   │
            │                                                       │   │
            └──► Fase 8 (Mapa Calor) ◄── depende de Fase 4 (geo)  │   │
                                                                    │   │
Fase 9 (i18n + USA) ◄── depende de Fase 2 (diseño estable)        │   │
    │                    y Fase 4 (checkout traducible)              │   │
    ▼                                                               │   │
Fase 10 (Admin Pro) ◄── depende de Fase 4, 5, 6, 7, 8            │   │
    │               (admin necesita gestionar todos los módulos)     │   │
    ▼                                                               │   │
Fase 11 (SEO + Seguridad) ◄── depende de todas las fases previas  │   │
    │                                                               │   │
    ▼                                                               │   │
Fase 12 (CI/CD + Testing) ◄── depende de código estable            │   │
                                                                    │   │
Documentación continua ◄────────────────────────────────────────────┘   │
(AGENTS.md, CHANGELOG.md) ◄────────────────────────────────────────────┘
```

### Dependencias Críticas (bloqueantes)

| Dependencia | Razón |
|---|---|
| Fase 1 → Fase 4 | Las órdenes y pagos requieren PostgreSQL funcional |
| Fase 1 → Fase 5 | Trazabilidad conectada a BD requiere PG + bugs fixes del módulo production |
| Fase 4 → Fase 6 | Finanzas depende de tener órdenes reales para costeo |
| Fase 4 → Fase 8 | Mapa de calor depende de geocoding de direcciones de órdenes |
| Fase 5 → Fase 7 | Landing de finca enlaza desde página de trazabilidad |
| Fase 2 → Fase 9 | i18n debe traducir un diseño estable, no uno en cambio |

### Módulos Paralelizables (independientes entre sí)

- **Fase 2** (Mobile/Diseño) y **Fase 3** (Legal) pueden ejecutarse en paralelo tras Fase 1
- **Fase 5** (Trazabilidad) y **Fase 6** (Finanzas) pueden avanzar en paralelo tras Fase 4
- **Fase 7** (Fincas) y **Fase 8** (Mapa Calor) pueden avanzar en paralelo tras fases previas

---

## 3. Análisis de Riesgos

### Riesgos Técnicos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R-01 | Migración MySQL→PG rompe queries existentes | Alta | Alto | Ejecutar migración con tests de regresión en cada endpoint |
| R-02 | Webhooks de pago fallan en Vercel serverless (cold start) | Media | Alto | Implementar retry logic + idempotency keys en webhooks |
| R-03 | Rate limits de Nominatim para geocodificación | Media | Medio | Cache agresivo + fallback a geocoding por ciudad (ya implementado) |
| R-04 | Inconsistencia api/index.js vs server/index.js | Alta | Alto | CI check que compare routers montados en ambos archivos |
| R-05 | Producción module CommonJS crash | Confirmado | Alto | Priorizar fix en Fase 1 — convertir a ESM |

### Riesgos de Negocio

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R-10 | Incumplimiento normativa colombiana | Media | Muy Alto | Implementar fase legal (3) temprano. Revisar con abogado |
| R-11 | MercadoLibre cambia API sin previo aviso | Baja | Medio | Versionar API calls, manejar errores gracefully |
| R-12 | Wompi/MercadoPago rechazan sandbox por datos de prueba | Baja | Bajo | Seguir documentación oficial estrictamente |

### Riesgos de Diseño/UX

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R-20 | Diseño inconsistente entre páginas ES y EN | Alta | Medio | Sistema de design tokens compartido + i18n sobre mismo layout |
| R-21 | Experiencia mobile degradada | Alta (actual) | Alto | Fase 2 prioritaria — mobile-first rebuild |
| R-22 | SEO afectado por cambio de URLs o estructura | Media | Alto | Mantener URLs existentes + redirects 301 si cambian |

---

## 4. Decisiones Técnicas Documentadas

### DT-001: PostgreSQL sobre MySQL
**Decisión**: Migrar de MySQL (actual) a PostgreSQL.  
**Razón**: 
- El README ya lo documenta como PG (alinear realidad con docs)
- JSONB nativo para datos flexibles (metadata de productos, audit details)
- PostGIS disponible para geolocalización avanzada (mapa de calor futuro)
- Mejor soporte de funciones, CTEs recursivos, window functions para reportes financieros
- Arrays nativos para variedades, certificaciones de fincas
- Supabase/Neon ofrecen tier gratuito generoso  
**Tradeoffs**: Requiere adaptar ~50+ queries de `?` → `$1`, convertir schema DDL, migrar datos.

### DT-002: Continuar con stack actual (no Odoo)
**Decisión**: Mantener Astro + Express + PostgreSQL.  
**Razón**:
- ~40% del frontend y ~35 tablas ya construidas
- Odoo requeriría reescribir todo + hosting VPS propio
- El volumen de operación (<100 órdenes/día) no justifica ERP enterprise
- Control total del diseño y UX (crucial para marca premium de café)
- Vercel es más económico y simple que hosting Odoo  
**Tradeoffs**: Más código propio que mantener. Si el negocio crece >500 órdenes/día, reevaluar.

### DT-003: Wompi como pasarela primaria
**Decisión**: Implementar Wompi primero, MercadoPago segundo.  
**Razón**:
- Wompi es la pasarela más utilizada en e-commerce colombiano
- Soporta PSE, Nequi, Bancolombia QR (métodos preferidos en Colombia)
- Proceso de integración más directo que MercadoPago para ventas directas
- MercadoPago es mejor complemento para quien ya compra vía MercadoLibre  
**Tradeoffs**: MercadoPago tiene mayor base de usuarios globalmente.

### DT-004: i18n manual con JSON (no framework)
**Decisión**: Archivos `es.json` / `en.json` con función helper `t()`.  
**Razón**:
- Solo 2 idiomas (ES, EN) — no justifica framework pesado como i18next
- Astro no tiene i18n oficial — las soluciones son plugins experimentales
- Control total sobre la estructura de URLs (`/en/shop` vs `/tienda`)
- Menor bundle size  
**Tradeoffs**: Más trabajo manual al agregar strings. No hay detectión automática de traducciones faltantes.

### DT-005: HttpOnly cookies como único mecanismo de auth
**Decisión**: Eliminar patrón localStorage de tokens. Solo HttpOnly cookies.  
**Razón**:
- localStorage es vulnerable a XSS
- El sistema ya tiene cookies HttpOnly configuradas
- Admin y app pages accederán a auth vía cookie en request server-side (Astro SSR)  
**Tradeoffs**: APIs que necesiten auth desde contextos sin cookies (mobile apps futuras) requerirán API keys separadas.

---

## 5. Estimación de Esfuerzo por Fase

| Fase | Esfuerzo | Días Estimados | Complejidad |
|---|---|---|---|
| 0: Documentos fundacionales | Bajo | 2-3 | ⭐ |
| 1: Estabilización + PostgreSQL | Alto | 5-7 | ⭐⭐⭐⭐ |
| 2: Mobile-first + Diseño | Alto | 5-7 | ⭐⭐⭐ |
| 3: Normativa legal | Medio | 3-4 | ⭐⭐ |
| 4: Órdenes + Pagos | Muy Alto | 7-10 | ⭐⭐⭐⭐⭐ |
| 5: Trazabilidad + QR | Alto | 5-7 | ⭐⭐⭐⭐ |
| 6: Finanzas | Alto | 7-10 | ⭐⭐⭐⭐ |
| 7: Fincas | Medio | 4-5 | ⭐⭐⭐ |
| 8: Mapa de calor | Medio | 4-5 | ⭐⭐⭐ |
| 9: i18n + USA | Alto | 7-10 | ⭐⭐⭐⭐ |
| 10: Admin Pro | Alto | 5-7 | ⭐⭐⭐⭐ |
| 11: SEO + Seguridad | Alto | 5-7 | ⭐⭐⭐⭐ |
| 12: CI/CD + Testing | Medio | 5-7 | ⭐⭐⭐ |
| **TOTAL** | | **65-90 días** | |

---

## 6. Criterios de Aceptación por Fase

| Fase | Criterio de Éxito |
|---|---|
| 0 | Todos los documentos creados y completos (AGENTS.md, CLAUDE.md, docs/*.md) |
| 1 | `npm run build` sin errores. `npm start` levanta servidor. Todas las queries PG funcionan. Endpoints montan en Vercel |
| 2 | Lighthouse mobile ≥ 85 en Performance. Sin scroll horizontal 320px. Todos los touch targets ≥ 44px |
| 3 | Páginas legales publicadas. Banner cookies funcional. Información del vendedor visible |
| 4 | Compra end-to-end funcional en sandbox. Orden persiste en BD. Email de confirmación enviado |
| 5 | QR scan → página de trazabilidad con datos reales del lote. Endpoint `/api/traceability/:code` funcional |
| 6 | Dashboard P&L muestra datos reales. Costo/kg calculado correctamente |
| 7 | Landing de finca renderiza con datos de BD. Link desde trazabilidad funciona |
| 8 | Mapa combina datos web + ML. Filtros funcionan. Top 10 muestra datos |
| 9 | Tienda completa en inglés. `en.dobleyo.cafe` funcional. hreflang tags correctos |
| 10 | Admin sin localStorage. CRUD de todos los módulos funcional |
| 11 | Lighthouse ≥ 90 en las 4 métricas. `npm audit` sin vulnerabilidades críticas. Backup probado |
| 12 | CI pasa en PR. Tests > 60% coverage. Deploy automático funcional |
