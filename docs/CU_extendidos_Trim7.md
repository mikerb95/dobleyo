# Revisión de Casos de Uso Extendidos — Trimestre 7 (DobleYo Café)

> Informe de revisión técnica sobre `docs/CASOS_DE_USO.md` (especificación de casos de uso extendidos, CU-001..CU-037) y su visor UML en `/admin/devtools`. Cubre tres ejes: corrección de la notación UML, adecuación del visor implementado y coherencia entre el modelo documentado y el código realmente implementado.

**Fecha de revisión:** 2026-07-09
**Alcance revisado:** `docs/CASOS_DE_USO.md`, `src/pages/admin/devtools.astro`, código fuente relevante (`server/routes/*`, `src/pages/*`).

---

## 1. Corrección del diagrama UML

### 1.1 Hallazgo — dirección de «extend» invertida (corregido)

El diagrama tenía la relación `CU-003 -.->|«extend»| CU-007` (Checkout → extend → Trazabilidad).

En notación UML, la flecha de un `«extend»` se dibuja **desde el caso de uso que extiende hacia el caso de uso base**, es decir, en la dirección opuesta al flujo de ejecución. La propia especificación textual del documento ya seguía esta convención correctamente en la otra relación de extensión:

> *"Aplicar cupón de descuento «extend» CU-003"* → dibujada como `Aplicar cupón -.->|«extend»| CU-003` ✅ correcto.

Pero la relación de trazabilidad estaba invertida: dado que **CU-007 (Consultar trazabilidad) es el comportamiento opcional** que extiende la confirmación del checkout (CU-003), la flecha correcta es:

```
CU-007 -.->|«extend»| CU-003
```

El diagrama era **internamente inconsistente**: dos relaciones «extend» dibujadas con convenciones opuestas. Esto es exactamente el tipo de error que un evaluador de UML detecta primero, porque invierte la semántica (sugiere que el checkout extiende a la trazabilidad, cuando es al revés).

**Estado:** corregido en `docs/CASOS_DE_USO.md` y sincronizado en el visor de `devtools.astro`. También se corrigió la lista textual de relaciones (sección "Relaciones entre casos de uso") para usar la misma convención "extensión → base" en ambas entradas, y se aclaró en la leyenda del diagrama que las flechas punteadas **sin** estereotipo representan precedencia de la cadena de trazabilidad (CU-008 → CU-009 → ... → CU-012), no relaciones include/extend.

### 1.2 Verificado como correcto

- Dirección de «include» (base → incluido): `CU-003 → CU-006` (checkout incluye login) y `CU-014 → CU-012` (etiquetado incluye empaquetado) están bien dibujadas.
- `ADM → CU-008` (el administrador también puede registrar cosecha) está respaldado por la propia especificación de CU-008, cuyo actor primario es "Caficultor / Administrador".
- Las conexiones hacia sistemas externos (Pasarela de pagos, Servicio de email, Servicio de geocodificación) coinciden con las integraciones reales del código (ver sección 3).

### 1.3 Observaciones abiertas (no corregidas — decisiones de modelado a criterio del equipo)

| # | Observación | Detalle |
|---|---|---|
| 1 | `CU-014 «include» CU-012` es discutible | La relación real es más una **precondición** ("solo se etiquetan lotes empaquetados") que un include verdadero, ya que un include implica que el flujo de CU-012 se re-ejecuta dentro de CU-014, lo cual no ocurre. Un evaluador estricto de UML podría objetar esta relación en sustentación. |
| 2 | Relación documentada pero no dibujada | La lista de relaciones dice `CU-021..CU-024 «include» CU-006`, pero esas 4 flechas no aparecen en el diagrama (se omitieron por legibilidad). Es la única relación P1 listada en texto que no tiene representación gráfica. |

---

## 2. Adecuación del visor UML (`/admin/devtools`)

### 2.1 Diseño e implementación

El visor se agregó como una segunda pestaña ("Diagrama UML") junto a la "Zona de peligro" existente, reutilizando el patrón de tabs (`.adm-tabs`/`.adm-panel`) ya establecido en `/admin/finanzas`, sin introducir un componente nuevo.

**Puntos verificados como correctos:**

- **Carga perezosa:** `mermaid.min.js` (CDN) solo se descarga la primera vez que el usuario abre la pestaña — no penaliza la carga inicial de `/admin/devtools` para quien nunca la usa.
- **CSP sin cambios necesarios:** `https://cdn.jsdelivr.net` ya estaba permitido en `scriptSrc` en `server/index.js` **y** `api/index.js` (paridad mantenida sin tocar ninguno de los dos archivos).
- **`securityLevel: 'strict'`:** modo seguro de Mermaid; se confirmó que sigue procesando correctamente `<br/>` dentro de las etiquetas de nodo bajo este modo.
- **Escape de entidades HTML:** el código Mermaid embebido en el `<pre class="mermaid">` usa `&lt;br/&gt;` y `&amp;` en vez de los caracteres literales `<br/>` y `&`, para que el parser HTML del navegador no los interprete como markup antes de que Mermaid los lea desde `textContent`. Se verificó en el HTML compilado (`npm run build`) que las entidades llegan intactas.
- **Manejo de errores:** cubre tanto fallo de carga del script CDN como fallo de render de Mermaid, mostrando el mensaje en `#umlError` sin dejar la pestaña en estado de carga infinita.
- **Exportación SVG:** botón "Descargar SVG" habilitado solo tras un render exitoso, vía `XMLSerializer` + `Blob`, sin dependencias adicionales ni round-trip al servidor.

### 2.2 Limitaciones a tener en cuenta

| Limitación | Impacto |
|---|---|
| El SVG exportado usa `foreignObject` (etiquetas HTML embebidas en el SVG) | Se ve perfecto en navegadores, pero puede renderizarse en blanco o incompleto en herramientas como Inkscape, Word o PowerPoint. Para insertarlo en una presentación de sustentación, es más confiable tomar una captura de pantalla del render en el navegador, o regenerar con `htmlLabels: false` si se necesita un SVG portable. |
| Diagrama duplicado en dos archivos | El código Mermaid vive tanto en `docs/CASOS_DE_USO.md` como en `devtools.astro`. Hoy están sincronizados (incluida la corrección de la sección 1.1), pero cualquier cambio futuro al diagrama debe aplicarse en ambos lugares manualmente — no hay una única fuente de verdad. |
| Solo vista P1 | El visor muestra únicamente CU-001..CU-027; los casos P2/P3 (CU-028..037) no tienen representación gráfica, solo tabular, por decisión de legibilidad tomada durante la iteración P2/P3. |

---

## 3. Coherencia entre el modelo documentado y el código implementado

### 3.1 Conexiones del diagrama verificadas contra el código real

| Relación en el diagrama | Evidencia en el código |
|---|---|
| `CU-003 → PAS` (checkout → pasarela de pagos) | `server/routes/orders.js` — integración Wompi con `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`. |
| `PAS → CU-004` (webhook de pago) | `orders.js` implementa el endpoint de webhook con verificación de firma Wompi. |
| `CU-003 → GEO` (geocodificación en checkout) | `orders.js:263` — `geocodeOrderAsync(orderId, shippingCity, shippingDepartment)`, ejecutada de forma asíncrona tras crear la orden. |
| `Aplicar cupón → CU-003` | `server/routes/coupons.js` + migración `add_discount_codes.js` — sistema de cupones implementado y montado en `/api/coupons`. |
| CU-017/CU-018 (fincas) | `src/pages/fincas.astro`, `src/pages/finca/[slug].astro`, `server/routes/farms.js` — módulo de fincas completo. |
| CU-027 (sitio en inglés) | `src/pages/en/` — landing, tienda, checkout, cuenta, blog, etc. en inglés, montados y funcionales. |

### 3.2 Brechas detectadas (no corregidas — requieren decisión del usuario)

**a) Funcionalidad implementada sin caso de uso documentado:**

| Módulo | Evidencia | Estado en `CASOS_DE_USO.md` |
|---|---|---|
| Suscripciones | `src/pages/suscripcion.astro` + `server/routes/subscriptions.js` (router montado en `/api/subscriptions`) | Sin CU asociado. |
| CRM | `src/pages/admin/crm.astro` + `server/routes/crm.js` (router montado en `/api/crm`) | Sin CU asociado. |
| Sincronización con MercadoLibre | `server/routes/mercadolibre.js` (router montado en `/api/mercadolibre`) | El actor externo "MercadoLibre" no aparece en el diagrama; CU-019 solo cubre el análisis del mapa de calor de ventas, no el proceso de sincronización de órdenes. |
| Pronóstico de demanda | `src/pages/admin/demanda.astro` + `server/routes/forecast.js` (router montado en `/api/ml`) | Sin CU asociado. |

**b) Caso de uso documentado sin implementación verificada:**

| CU | Estado documentado | Hallazgo |
|---|---|---|
| CU-026 — Presentar PQRS | P1, con trazabilidad a RF-115 y HU-031 | No se encontró página ni endpoint específico de PQRS en el código; solo existe `src/pages/contacto.astro` (formulario de contacto general, correspondiente a CU-031). Si PQRS se resolvió reutilizando el formulario de contacto, el documento debería aclararlo explícitamente; si no, es una funcionalidad P1 pendiente de implementar. |

---

## 4. Resumen ejecutivo

| Eje | Resultado |
|---|---|
| **Corrección UML** | 1 error de dirección en relación «extend» (corregido). Diagrama consistente tras la corrección. 2 observaciones menores de modelado quedan abiertas a criterio del equipo. |
| **Adecuación del visor** | Implementación sólida: carga perezosa, sin cambios de CSP, manejo de errores completo, exportación funcional. Limitaciones conocidas: SVG con `foreignObject` no siempre portable, diagrama duplicado en dos archivos sin fuente única de verdad. |
| **Coherencia con el código** | Las relaciones dibujadas sí reflejan integraciones reales (Wompi, geocodificación, cupones, fincas, i18n). Pendiente: documentar 4 módulos implementados sin CU (suscripciones, CRM, sync ML, demanda) y verificar el estado real de CU-026 (PQRS). |

### Recomendación

Para la sustentación del Trimestre 7, priorizar:
1. Confirmar el estado de CU-026 (PQRS) — si el formulario de contacto lo cubre, documentarlo; si no, marcarlo como pendiente de implementación en vez de "P1 completado".
2. Agregar los CU faltantes de suscripciones, CRM, sync ML y pronóstico de demanda para que la matriz de trazabilidad refleje el alcance real del sistema — actualmente estos módulos existen en producción pero son invisibles en el modelo de casos de uso.
