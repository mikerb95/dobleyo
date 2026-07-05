# Auditoría de Integridad del Sistema — DobleYo Café

> **Fecha:** 2026-07-05
> **Alcance:** paridad de backends, residuos de la migración PostgreSQL→Turso, esquema de BD, autenticación/autorización, suite de tests y documentación.
> **Rama auditada:** `main` (commit `8d6b1a2`)

---

## Estado general

El núcleo del sistema está sano:

- ✅ **Sin CommonJS residual** en el backend — todo `server/` y `api/` es ESM.
- ✅ **Sin tokens en localStorage** — auth vía cookies HttpOnly como está diseñado.
- ✅ **Secretos JWT sin fallbacks inseguros** — `server/auth.js` lanza error fatal si faltan `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- ✅ **`db/schema.sql` limpio de dialecto PostgreSQL** — es una fuente de verdad válida para SQLite/libSQL.
- ✅ **Paridad de routers casi total** entre `server/index.js` y `api/index.js` (32 routers montados en ambos, mismo middleware de seguridad: helmet/CSP, CORS, rate limiting, trust proxy).

Sin embargo, quedan **residuos de la migración PostgreSQL→Turso** que afectan la integridad. Se detallan a continuación por severidad.

---

## Hallazgos

### 1. 🔴 Tests desactualizados — la suite falla (3 de 29)

**Archivo:** `server/services/__tests__/audit.test.js`

Los tests siguen esperando placeholders PostgreSQL:

```javascript
expect(sql).toContain('LIMIT $1 OFFSET $2'); // ← el código ya usa LIMIT ? OFFSET ?
```

mientras el código de producción ya fue migrado a `?`. Resultado actual de `npm test`:

```
Test Files  1 failed | 2 passed (3)
     Tests  3 failed | 26 passed (29)
```

**Impacto:** la suite reporta rojo permanente, lo que anula su valor como red de seguridad — un fallo real pasaría desapercibido entre los fallos conocidos.

**Corrección sugerida:** actualizar las aserciones del test al dialecto libSQL (`LIMIT ? OFFSET ?`).

---

### 2. 🔴 Migración de finanzas rota y silenciada en cada deploy

**Archivo:** `server/migrations/create_finance_tables.js` (registrada en `run_all_migrations.js:43`)

Es DDL PostgreSQL puro que SQLite rechaza con error de sintaxis:

```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- ← no existe en SQLite
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),       -- ← NOW() no existe en SQLite
```

El script `vercel-build` ejecuta `MIGRATE_SOFT_FAIL=1 npm run migrate`, así que **esta migración falla en cada deploy y el soft-fail lo oculta**.

**Impacto:** no hay daño actual — las tablas existen porque `db/schema.sql` las define en dialecto SQLite correcto. Pero el pipeline de migraciones reporta éxito falso en cada build, y ese ruido puede enmascarar el fallo real de una migración futura.

**Corrección sugerida:** reescribir la migración en dialecto SQLite (o eliminarla del registro si `schema.sql` ya la cubre), y dejar que `MIGRATE_SOFT_FAIL` solo tolere errores de re-ejecución genuinos.

---

### 3. 🟠 `farmAuth.js` — autorización que falla en "permitir" (fail-open)

**Archivo:** `server/middleware/farmAuth.js:31-38`

```javascript
try {
  ({ rows } = await query(
    'SELECT caficultor_id FROM farms WHERE slug = $1 LIMIT 1',
    [farmSlug]
  ));
} catch {
  // Si la tabla farms no existe aún → permitir (migración pendiente)
  return;
}
```

Dos problemas:

1. **El `catch` vacío traga *cualquier* error de query**, no solo "tabla no existe". Si un cambio futuro rompe esa consulta, el control de propiedad de finca se desactiva en silencio (fail-open) en lugar de negar acceso (fail-closed).
2. **Usa placeholder `$1`** — verificado empíricamente que libSQL lo acepta (SQLite lo trata como parámetro nombrado con índice 1), así que funciona hoy, pero es el único punto del código de runtime fuera de la convención `?` del proyecto y es frágil.

**Corrección sugerida:** cambiar `$1` → `?`, y en el `catch` distinguir "no such table" (permitir por compatibilidad) de cualquier otro error (relanzar o negar).

---

### 4. 🟡 Scripts de seed/reset con SQL PostgreSQL

**Archivos:** `server/seed_products.js`, `server/seed_inventory.js`, `server/reset_database.js`

Usan placeholders `$1..$n` (funcionan por coincidencia — SQLite asigna índices en orden de aparición) y funciones inexistentes en SQLite:

```sql
updated_at = NOW()  -- seed_products.js:102 → falla en runtime
```

**Impacto:** son herramientas de desarrollo, no de producción, pero están parcialmente rotas — el camino de actualización de `seed_products.js` falla al ejecutarse contra Turso.

**Corrección sugerida:** migrar placeholders a `?` y `NOW()` → `datetime('now')`.

---

### 5. 🟡 Paridad `server/index.js` ↔ `api/index.js` — brecha menor

Los stubs de MercadoPago existen solo en el standalone (`server/index.js:158-164`):

| Endpoint | `server/index.js` | `api/index.js` (Vercel) |
|---|---|---|
| `POST /api/mp/create_preference` | 501 (stub) | ❌ 404 |
| `POST /api/mp/webhook` | 200 (stub) | ❌ 404 |

**Impacto:** bajo — son stubs de la Fase 4 pendiente. Pero es exactamente el tipo de deriva que la regla de paridad del proyecto intenta evitar.

**Corrección sugerida:** agregar los mismos stubs a `api/index.js` (o eliminarlos de ambos hasta implementar MercadoPago).

---

### 6. 🟢 Documentación desincronizada (menor)

- `CLAUDE.md` advierte que `server/routes/production/*.js` usa CommonJS y "DEBEN MIGRARSE A ESM" — **ya están migrados**; la advertencia es obsoleta.
- El comentario del health check en `api/index.js:145` aún dice "ping real a BD para verificar **PgBouncer + PostgreSQL**" — la BD es Turso/libSQL.
- El comentario de cabecera de `create_finance_tables.js:1` aún dice "(PostgreSQL)".

**Corrección sugerida:** actualizar estas referencias al stack actual.

---

## Resumen y prioridad de corrección

| # | Hallazgo | Severidad | Esfuerzo |
|---|---|---|---|
| 1 | Tests de audit con placeholders PG (suite en rojo) | 🔴 Alta | Trivial |
| 2 | Migración de finanzas PG rota, silenciada por soft-fail | 🔴 Alta | Bajo |
| 3 | `farmAuth.js` fail-open + placeholder `$1` | 🟠 Media (seguridad) | Bajo |
| 4 | Seeds/reset con SQL PostgreSQL | 🟡 Baja | Medio |
| 5 | Stubs `/api/mp/*` ausentes en `api/index.js` | 🟡 Baja | Trivial |
| 6 | Documentación desincronizada | 🟢 Informativo | Trivial |

**Orden recomendado:** primero el **#1** (trivial, recupera la suite verde) y el **#3** (único con implicación de seguridad); luego #2, #5, #4 y #6.
