# Sustentación — Módulo Python · DobleYo Café

## 1. Visión general

El proyecto DobleYo Café está construido con **Astro + Node/Express**. La capa de **analítica de datos y el CRUD académico** están implementados en **Python**, porque es el lenguaje estándar para cálculo numérico (pandas, numpy). Ambos lenguajes conviven en el mismo proyecto: Node atiende la tienda y las APIs transaccionales; Python hace el cálculo y el CRUD de demanda.

---

## 2. Archivos del módulo Python

```
dobleyo/
├── requirements.txt          # Dependencias Python: numpy >=1.26 y pandas >=2.1
├── api/
│   └── ml/
│       ├── demand.py         # CRUD 100% Python sobre la tabla demand_records
│       └── recompute.py      # Pronóstico de demanda con suavizado exponencial
└── migrate_placeholders.py   # Script utilitario puntual (mantenimiento de datos)
```

**Páginas relacionadas:**

| Ruta | Archivo | Descripción |
|---|---|---|
| `/sena/python` | `src/pages/sena/python.astro` | Documentación técnica pública del módulo (SENA) |
| `/admin/python` | `src/pages/admin/python.astro` | Panel operativo: pronóstico + CRUD en vivo |
| `/admin/demanda` | `src/pages/admin/demanda.astro` | Interfaz de gestión de registros de demanda |

---

## 3. Cómo Vercel ejecuta Python

Vercel usa **enrutamiento por archivos**: un archivo `.py` dentro de `api/` se convierte automáticamente en un endpoint HTTP al hacer el deploy.

```
api/ml/demand.py    →  URL: /api/ml/demand
api/ml/recompute.py →  URL: /api/ml/recompute
```

Cada archivo define una clase `handler` que hereda de `BaseHTTPRequestHandler` (librería estándar de Python) con un método por verbo HTTP:

```python
class handler(BaseHTTPRequestHandler):
    def do_GET(self):    ...  # Leer
    def do_POST(self):   ...  # Crear
    def do_PUT(self):    ...  # Actualizar
    def do_DELETE(self): ...  # Eliminar
```

Como el proyecto también tiene un backend Node (`api/index.js`), en `vercel.json` se le indica a Vercel que **no** envíe las rutas Python al backend Node:

```json
"source": "/api/((?!ml/(recompute|demand)).*)",
"destination": "/api/index.js"
```

> **Importante:** en desarrollo local con `npm run dev` (Express standalone), las funciones Python **no corren**. Solo funcionan con `vercel dev` o en el deploy real de Vercel.

---

## 4. Acceso a la base de datos (Turso / Hrana)

La base de datos es **Turso** (libSQL, compatible con SQLite). Node usa el cliente oficial `@libsql/client`, pero desde Python se accede vía la **API HTTP de Turso (protocolo Hrana)** usando solo `urllib` de la librería estándar — sin instalar nada extra.

```python
def turso_batch(statements):
    # statements = lista de (sql, [args])
    endpoint = TURSO_DATABASE_URL.replace("libsql://", "https://") + "/v2/pipeline"
    # Cada statement se envía con sus parámetros tipados (protocolo Hrana)
    # Nunca se interpola texto en el SQL → previene inyección SQL
    ...
```

**Convenciones aplicadas (iguales a Node):**

- Parámetros posicionales `?` (no `$1`)
- Fechas con `datetime('now')` (SQLite)
- Booleanos como `0`/`1`
- Respuesta estándar del proyecto: `{ "success": true/false, "data": ... }`

---

## 5. CRUD de demanda (`api/ml/demand.py`)

Es el módulo central de la entrega. Un **único archivo Python** implementa el ciclo de vida completo de los registros en la tabla `demand_records`, que el propio Python crea si no existe (`CREATE TABLE IF NOT EXISTS`).

### Tabla `demand_records`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER | Clave primaria autoincremental |
| `category` | TEXT | Categoría de demanda (obligatorio) |
| `product_key` | TEXT | Producto asociado (opcional) |
| `period` | TEXT | Período, p. ej. `2026-W24` (opcional) |
| `demand_value` | REAL | Valor de la demanda (obligatorio, ≥ 0) |
| `unit` | TEXT | Unidad (por defecto `units`) |
| `notes` | TEXT | Observaciones (opcional) |
| `created_at` / `updated_at` | TEXT | Marcas de tiempo |

### Las cuatro operaciones

| Operación | Verbo | Endpoint | Qué hace |
|---|---|---|---|
| **Create** | POST | `/api/ml/demand` | Inserta un registro. Valida `category` y `demand_value`. |
| **Read** | GET | `/api/ml/demand` | Lista registros. Filtros: `?id=`, `?category=`, `?limit=`. |
| **Update** | PUT | `/api/ml/demand?id=N` | Actualiza campos parciales y refresca `updated_at`. |
| **Delete** | DELETE | `/api/ml/demand?id=N` | Elimina el registro indicado. |

### Flujo interno por operación

```
HTTP Request
    │
    ▼
handler._guard()          ← verifica JWT (cookie auth_token o Bearer)
    │  rol != admin → 403
    │  token inválido → 401
    ▼
ensure_table()            ← CREATE TABLE IF NOT EXISTS (idempotente)
    ▼
_validate_create() / update_record() / ...
    │  errores de validación → 422
    ▼
turso_batch([(sql, args)])  ← HTTP POST a Turso /v2/pipeline
    ▼
_respond(status, payload)   ← JSON { success, data/error }
```

### Formato de respuesta

```json
// Éxito
{ "success": true, "data": { "id": 1, "category": "cafe-grano", ... } }

// Error de validación
{ "success": false, "errors": ["demand_value debe ser >= 0"] }

// No encontrado
{ "success": false, "error": "Registro no encontrado" }
```

---

## 6. Pronóstico de demanda (`api/ml/recompute.py`)

Archivo de analítica que calcula proyecciones a **8 semanas** usando ventas reales de MercadoLibre.

### Flujo

```
GET /api/ml/recompute  (Vercel Cron, diario)
POST /api/ml/recompute (desde panel admin — botón "Recalcular ahora")
    │
    ▼
_authorized()             ← verifica CRON_SECRET en header Authorization
    ▼
build_forecasts()
    │
    ├─ 1. Lee sales_tracking (ventas ML desde Turso)
    │
    ├─ 2. Explota JSON de productos → filas [fecha, producto, qty, revenue]
    │
    ├─ 3. Agrupa por semana con pandas (bucketing a lunes)
    │
    ├─ 4. Por cada SKU: forecast_series()
    │       ├─ n >= 6 semanas → Holt (nivel + tendencia)  → modelo: "holt"
    │       └─ n <  6 semanas → Media móvil (ventana 4)   → modelo: "moving_avg"
    │
    ├─ 5. También pronostica ingresos totales (TOTAL)
    │
    └─ 6. Calcula banda de confianza ~95% (Z = 1.96 × σ de residuos)
    │
    ▼
persist(generated_at, rows)
    ├─ INSERT INTO demand_forecasts (por lotes de 100)
    └─ DELETE corridas con más de 90 días
    │
    ▼
{ "success": true, "rows_written": N, "series": M, "generated_at": "..." }
```

### Modelos

| Modelo | Cuándo se usa | Qué calcula |
|---|---|---|
| **Holt** | ≥ 6 semanas de historia | Nivel + tendencia, suavizado exponencial doble |
| **Media móvil** | < 6 semanas | Promedio de las últimas 4 semanas |

### Diferencia clave con el CRUD

- `demand.py` → permite **gestionar manualmente** registros de demanda (CRUD).
- `recompute.py` → **calcula y escribe** resultados derivados automáticamente. Son módulos independientes.

---

## 7. Seguridad: verificación JWT

El CRUD reutiliza el **mismo token de sesión (JWT)** que emite el backend Node al iniciar sesión. El token viaja en una cookie `HttpOnly` llamada `auth_token`.

Python **verifica la firma con la librería estándar** (`hmac` + `hashlib`), sin instalar ninguna librería de JWT:

```python
def verify_jwt(token):
    header_b64, payload_b64, sig_b64 = token.split(".")
    expected = hmac.new(
        JWT_SECRET.encode("utf-8"),
        (header_b64 + "." + payload_b64).encode("utf-8"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
        return None  # firma inválida
    ...
```

Verifica que:
- La firma **HS256** es válida con `JWT_SECRET` (el mismo secreto de Node).
- El token **no esté vencido** (campo `exp`).
- No sea un token de verificación de correo (rechaza los que traen `type`).
- El usuario tenga el rol **`admin`**.

---

## 8. Cómo ejecutar y probar

### Smoke test local (CRUD)

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... python3 api/ml/demand.py
```

Salida esperada:
```
→ ensure_table()
→ create   201  { "success": true, ... }
→ read     200  count= 1
→ update   200  { "success": true, ... }
→ delete   200  { "success": true, "data": { "deleted": true } }
```

### Verificar sintaxis sin correr

```bash
python3 -m py_compile api/ml/demand.py
python3 -m py_compile api/ml/recompute.py
```

### Smoke test del pronóstico

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... python3 api/ml/recompute.py
```

### En producción / staging

```bash
vercel dev   # levanta tanto Node como Python en local
```

---

## 9. Qué hace pandas y qué hace numpy

Ambas librerías se usan exclusivamente en `recompute.py` (el pronóstico). Están declaradas en `requirements.txt` como las únicas dependencias Python del proyecto.

**pandas** — maneja la tabla de datos:
- Parsea fechas de ventas de MercadoLibre (`pd.to_datetime`)
- Construye el DataFrame con todas las ventas explotadas por producto
- Calcula el "lunes de la semana" de cada venta para agrupar en buckets uniformes
- Genera el rango de semanas completo sin huecos (`pd.date_range`)
- Agrega demanda por SKU y por semana con `groupby + unstack`, rellenando con cero las semanas sin ventas

**numpy** — hace los cálculos estadísticos dentro del modelo:
- Calcula la desviación estándar de los residuos del modelo Holt (`np.std`)
- Calcula el promedio de las últimas N semanas en la media móvil (`np.mean`)
- Con ese resultado construye la banda de confianza ~95%: `± 1.96 × σ`

**Diferencia en una frase:** pandas organiza los datos crudos en series de tiempo limpias; numpy hace los números dentro de cada serie ya ordenada.

---

## 10. Seguridad — visión completa del proyecto

### 10.1 Tokens JWT (acceso + refresco)

Al iniciar sesión Node emite dos tokens:

| Token | Duración | Cómo viaja | Dónde se guarda |
|---|---|---|---|
| **Access token** (JWT firmado HS256) | 15 minutos | Cookie `auth_token` HttpOnly | Solo en memoria del cliente |
| **Refresh token** (string aleatorio de 40 bytes) | 7 días | Cookie `refresh_token` HttpOnly | SHA-256 hasheado en tabla `refresh_tokens` |

El refresh token **nunca viaja ni se guarda en texto plano** — en la base de datos solo existe su hash SHA-256. Cuando se usa para renovar la sesión, el token viejo se revoca y se emite uno nuevo (**rotación de refresh tokens**). Si alguien reutiliza un token ya revocado, el sistema lo detecta y puede forzar logout global del usuario.

### 10.2 Cookies HttpOnly

Las cookies llevan los flags:
- `HttpOnly` → JavaScript del navegador no puede leerlas (previene robo por XSS)
- `Secure` → solo se envían por HTTPS en producción
- `SameSite: lax` → protección básica contra CSRF
- El refresh token tiene `path: /api/auth/refresh` → solo se envía a ese endpoint, no a toda la API

### 10.3 Contraseñas

Las contraseñas se almacenan con **bcrypt** (salt factor 10). Nunca se guarda ni se transmite la contraseña en texto plano. Si la cuenta fue creada con Google o Apple Sign-In, no existe `password_hash` en la base de datos.

### 10.4 Rate limiting

Cada endpoint crítico tiene un límite distinto por IP:

| Endpoint | Límite | Ventana |
|---|---|---|
| `POST /api/auth/login` | 5 intentos | 15 minutos |
| `POST /api/auth/register` | 3 registros | 1 hora |
| `POST /api/auth/refresh` | 10 requests | 5 minutos |
| Toda la API (`/api/*`) | 600 requests | 15 minutos |

Los webhooks de pagos (Wompi, MercadoPago) y el endpoint `/health` están excluidos del límite global para no perder confirmaciones de pago.

### 10.5 Roles y autorización

El sistema tiene cuatro roles: `admin`, `client`, `provider`, `caficultor`. Cada ruta protegida aplica dos middlewares en cadena:

```
authenticateToken  →  verifica el JWT y adjunta req.user
requireRole('admin')  →  verifica que req.user.role sea el esperado
```

Los tokens de verificación de correo llevan un campo `type: 'verification'` que los hace **incompatibles con sesiones**: si alguien intenta usar un enlace de email como token de acceso, el sistema lo rechaza (tanto en Node como en Python).

### 10.6 OAuth social (Google y Apple)

- **Google**: verifica el `id_token` con la librería `google-auth-library` contra `GOOGLE_CLIENT_ID`. Si el email ya existe en la base de datos, vincula el `google_id` a la cuenta existente en lugar de duplicarla.
- **Apple**: descarga las claves públicas de Apple (JWKS) con caché de 1 hora, convierte el JWK a PEM con `crypto` de Node y verifica la firma RS256 del `id_token`. Apple solo envía nombre y apellido en la primera autorización.

Ambos flujos emiten los mismos access/refresh tokens que el login por contraseña.

### 10.7 Seguridad en la base de datos

- Todas las queries usan **parámetros posicionales `?`** — nunca se interpolan variables en el SQL (previene inyección SQL).
- Esto aplica tanto en Node (`@libsql/client`) como en Python (protocolo Hrana con args tipados).

### 10.8 Validación de entrada

Todas las rutas que reciben datos del cliente usan `express-validator` en Node y validación manual en Python. Los errores retornan `422 Unprocessable Entity` con la lista de campos inválidos — nunca se guarda datos sin validar.

### 10.9 Seguridad del módulo Python (cron)

El endpoint de pronóstico (`api/ml/recompute.py`) está protegido con `CRON_SECRET`: el header `Authorization: Bearer <CRON_SECRET>` es obligatorio. En Vercel el cron lo envía automáticamente; en desarrollo local se omite la verificación si la variable no está definida.

### 10.10 Auditoría

Cada acción relevante (registro, login, cambio de contraseña, solicitud de rol caficultor, edición de perfil) se registra en la tabla `audit_logs` con `user_id`, `action`, `entity_type`, `entity_id` y un JSON de detalles. Esto permite rastrear quién hizo qué y cuándo.

---

## 11. Variables de entorno requeridas

| Variable | Usada en | Propósito |
|---|---|---|
| `TURSO_DATABASE_URL` | Node, Python | URL de la base de datos Turso |
| `TURSO_AUTH_TOKEN` | Node, Python | Token de autenticación Turso |
| `JWT_SECRET` | Node, Python | Firma de access tokens y tokens de verificación |
| `JWT_REFRESH_SECRET` | Node | Firma de refresh tokens (separado del access) |
| `CRON_SECRET` | `recompute.py` | Protege el endpoint del cron |
| `GOOGLE_CLIENT_ID` | Node | OAuth Google |
| `APPLE_CLIENT_ID` | Node | OAuth Apple |

---

## 12. Resumen para la sustentación

El módulo Python demuestra:

1. **CRUD completo** — las 4 operaciones en un solo archivo (`demand.py`).
2. **Validación de datos** — campos obligatorios, tipos numéricos, restricciones de valor.
3. **Acceso a base de datos** con consultas parametrizadas (sin interpolación → no hay inyección SQL).
4. **Autenticación JWT** implementada desde cero con la librería estándar (sin dependencias extra).
5. **Analítica** con pandas (organización de datos) y numpy (cálculo estadístico): Holt, media móvil, banda de confianza ~95%.
6. **Despliegue serverless** en Vercel como función nativa Python.
7. **Convivencia de lenguajes** — Node y Python en el mismo proyecto, cada uno en lo que mejor hace.

La seguridad del proyecto en su conjunto cubre: JWT de corta vida + refresh tokens rotativos hasheados, cookies HttpOnly, bcrypt para contraseñas, rate limiting por endpoint, roles, OAuth Google/Apple, queries parametrizadas y auditoría completa.
