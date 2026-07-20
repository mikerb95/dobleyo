# Sección "Conoce al caficultor" en /trazabilidad

## Contexto

Una de las misiones de DobleYo es visibilizar el campo colombiano. Hoy, al consultar un lote en `/trazabilidad`, el resultado muestra la cadena de producción pero del origen humano solo aparece el nombre de la finca como chip de texto. Ya existe infraestructura de Fase 7 (tabla `farms` con `story`, `short_description`, `cover_image_url`, `caficultor_id` → `users`, y páginas públicas `/finca/[slug]`) que no se está aprovechando en trazabilidad.

**Objetivo:** al consultar un lote, mostrar una tarjeta de introducción al caficultor y su finca, con enlace a la página completa `/finca/[slug]`.

## Camino de datos

`coffee_harvests.farm` (texto) → `farms.name` → `farms.caficultor_id` → `users.name`.

No hay FK entre harvests y farms; el match por nombre es el patrón ya establecido en `server/routes/farms.js:161` (`WHERE ch.farm = ?`). Se reutiliza ese patrón — no se normaliza el schema en esta tarea. Si no hay finca publicada que coincida, la sección simplemente no se muestra (comportamiento degradado sin error).

## Cambios

### 1. Backend — `server/routes/traceability.js` ✅ (ya aplicado)

En las dos consultas (`lookupByLabelCode` y `lookupByLotId`) se agregó:

```sql
LEFT JOIN farms fm ON fm.name = ch.farm AND fm.is_published = 1
LEFT JOIN users u  ON u.id = fm.caficultor_id
```

seleccionando: `fm.slug AS farm_slug`, `fm.municipality`, `fm.short_description AS farm_short_description`, `fm.story AS farm_story`, `fm.cover_image_url AS farm_cover`, `u.name AS caficultor_name`, `u.city AS caficultor_city`.

En `formatRow()` se agregó el bloque condicional:

```js
// Finca y caficultor (solo si hay finca publicada que coincide)
farm: row.farm_slug ? {
  slug: row.farm_slug,
  name: row.farm,
  municipality: row.municipality,
  short_description: row.farm_short_description,
  story: row.farm_story,
  cover_image_url: row.farm_cover,
  caficultor_name: row.caficultor_name,
  caficultor_city: row.caficultor_city,
} : null,
```

Sin cambios en `server/index.js` / `api/index.js`: el router ya está montado en ambos con paridad.

### 2. Frontend — `src/pages/trazabilidad.astro` (pendiente)

Agregar dentro de `#result`, entre el hero y el timeline (~L169), una tarjeta oculta por defecto:

```html
<!-- Caficultor -->
<div class="card trace-farmer-card" id="resFarmerCard" style="display:none">
  <h3 class="trace-section-title">El caficultor detrás de este lote</h3>
  <div class="trace-farmer" id="resFarmerBody"></div>
</div>
```

### 3. Frontend — `public/assets/js/trazabilidad.js` (pendiente)

- Registrar refs DOM (`#resFarmerCard`, `#resFarmerBody`) junto a los existentes (L22-45).
- Nueva función `renderFarmer(data.farm)` llamada desde `renderResult()` (después del bloque de notas de sabor, ~L196) y ocultarla en `renderIdle()`.
- Render: foto de la finca (`cover_image_url`, si existe), nombre del caficultor, "Finca {name} · {municipality|region}", texto de introducción (`short_description`, con fallback a un recorte de `story` ~220 caracteres), y enlace `<a class="btn" href="/finca/{slug}">Conocer la finca</a>`.
- Construir el contenido con `createElement`/`textContent` (los datos de `story` los escribe el caficultor — no interpolar en `innerHTML` sin escape).
- Si `data.farm` es null, la tarjeta queda oculta.
- Copy en español formal colombiano (usted / neutro), sin voseo.

### 4. CSS — `public/assets/css/styles.css` (pendiente)

Clases `trace-farmer-*` junto a los demás estilos `trace-*`: layout foto + texto (foto pequeña a la izquierda en desktop, apilado en mobile). Solo variables CSS existentes, mobile-first, breakpoints estándar (480, 768, 1024, 1400).

### 5. Documentación (pendiente)

Actualizar `CHANGELOG.md` (y `AGENTS.md` solo si aplica algo estructural).

## Verificación

1. Levantar el server standalone y probar:
   - `GET /api/traceability/<lot_id con finca publicada>` → respuesta incluye bloque `farm` con `slug` y `caficultor_name`.
   - Lote cuya finca no existe en `farms` o no está publicada → `farm: null` y el resto de la respuesta intacta.
2. En el navegador, `/trazabilidad?lote=<código>`:
   - Con finca publicada: aparece la tarjeta del caficultor con foto, intro y botón que navega a `/finca/[slug]`.
   - Sin finca: la tarjeta no aparece y no hay errores en consola.
   - Verificar responsive en 480/768 px.
3. Confirmar que el flujo QR (deep-link `?lote=`) sigue funcionando igual.
