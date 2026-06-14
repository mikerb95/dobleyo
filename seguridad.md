# Seguridad en DobleYo Café — Documento de Auditoría

> **Proyecto de grado.** Plataforma de comercio electrónico de café de especialidad (`dobleyo.cafe`).
> Documento preparado para exposición en clase, dirigido a docentes y estudiantes.
>
> **Tesis central:** en un proyecto donde gran parte del código fue generado con asistencia de IA,
> la competencia profesional que se demuestra ya no es *escribir* el código a mano, sino **auditarlo**:
> leer lo generado, encontrar dónde falla, entender *por qué* es un riesgo y corregirlo con criterio.
> Este documento es la evidencia de ese trabajo de auditoría.

---

## 0. Cómo leer este documento

| Sección | Para quién | Qué encontrará |
|---|---|---|
| 1. El cambio de habilidad | Docentes | Por qué auditar es la competencia evaluable |
| 2. Superficie de ataque | Ambos | Qué hay que proteger y de quién |
| 3. Metodología de auditoría | Docentes | Cómo se revisó, no solo qué se encontró |
| 4. Hallazgos y correcciones | Ambos | El núcleo: vulnerabilidad → riesgo → corrección |
| 5. Arquitectura de seguridad | Estudiantes | Cómo funciona la defensa, capa por capa |
| 6. Pendientes y deuda técnica | Docentes | Honestidad sobre lo que falta |
| 7. Lecciones de auditar código IA | Ambos | La reflexión de fondo |
| 8. Glosario | Estudiantes | Términos técnicos explicados |

---

## 1. El cambio de habilidad: de escribir a auditar

Históricamente, programar significaba escribir cada línea. Hoy, una parte sustancial del código de
este proyecto fue generada con asistencia de IA. Eso **no elimina** la responsabilidad del desarrollador;
la **desplaza**.

La IA produce código que *casi siempre funciona*. El problema de seguridad rara vez está en que el
código no compile —compila— sino en supuestos silenciosos:

- Genera un token y lo usa para dos propósitos distintos sin notar que eso abre una puerta.
- Configura una política de seguridad (CSP) que **solo se aplica a una parte** de la aplicación.
- Deja un endpoint de depuración "para probar" que filtra la configuración del servidor.
- Maneja un error de CORS lanzando una excepción que termina en un **500 con traza de pila**.

Ninguno de esos errores rompe la aplicación en una demo. Todos son explotables. **Encontrarlos exige
leer el código con desconfianza informada** —saber dónde miente el código que "se ve bien"—. Esa es la
habilidad que este documento busca demostrar.

---

## 2. Superficie de ataque

DobleYo Café no es un sitio estático: maneja **dinero, datos personales y trazabilidad**. Esto define
qué hay que proteger.

```
                        ┌─────────────────────────────────────────┐
                        │            NAVEGADOR (cliente)            │
                        │  Astro SSR + React  ·  cookies HttpOnly   │
                        └───────────────────┬───────────────────────┘
                                            │ HTTPS
              ┌─────────────────────────────┼──────────────────────────────┐
              │                  PLATAFORMA VERCEL                          │
              │                                                             │
              │   ┌──────────────────┐         ┌────────────────────────┐  │
              │   │  Páginas (Astro) │         │  API  (Express)        │  │
              │   │  headers vía     │         │  /api/*                │  │
              │   │  vercel.json     │         │  helmet · CORS · JWT   │  │
              │   └──────────────────┘         │  rate limit · roles    │  │
              │                                └───────────┬────────────┘  │
              └────────────────────────────────────────────┼───────────────┘
                                                            │
                  ┌─────────────────────┬──────────────────┼──────────────────┐
                  │ Turso (libSQL/SQLite)│  Resend (email)  │  Servicios 3os    │
                  │  usuarios, órdenes,  │  verificación    │  Wompi, MercadoPago│
                  │  pagos, auditoría    │                  │  Google, ML        │
                  └─────────────────────┴──────────────────┴──────────────────┘
```

### Activos a proteger
- **Credenciales y sesiones** de admin, clientes, proveedores y caficultores.
- **Datos financieros**: contabilidad de doble partida, facturación, pagos.
- **Datos personales** (PII): nombres, direcciones, teléfonos, documentos de identidad.
- **Integridad de la trazabilidad**: el QR de cada empaque debe ser confiable.

### Atacantes que consideramos
- **Anónimo externo**: prueba inyección SQL, fuerza bruta de contraseñas, XSS, clickjacking.
- **Usuario autenticado abusivo**: intenta escalar privilegios (cliente → admin).
- **Atacante que ya logró un XSS**: ¿puede robar la sesión? (Respuesta de diseño: las cookies son
  `HttpOnly`, así que JavaScript no las puede leer.)

### Un detalle de arquitectura que define toda la estrategia de headers

En Vercel hay **dos formas de servir contenido** y eso fue decisivo en la auditoría:

| Qué se sirve | Quién lo sirve | Dónde se ponen los headers de seguridad |
|---|---|---|
| `/api/*` (JSON) | Express (`api/index.js`) | `helmet` dentro de Express |
| Páginas HTML | Adaptador de Astro | **`vercel.json`** (Express **no** las toca) |

Confundir esto fue, de hecho, el origen del hallazgo más grave (ver §4, Hallazgo F).

---

## 3. Metodología de auditoría

No se revisó "a ojo". Se siguió un proceso repetible:

1. **Inventario de la superficie**: listar todos los routers, endpoints y orígenes externos
   (Wompi, MercadoPago, Google, jsDelivr, fuentes, mapas).
2. **Lectura por capas de defensa**: autenticación → autorización → validación de entrada →
   transporte (headers) → persistencia (SQL).
3. **Búsqueda de patrones de riesgo conocidos** (alineados con OWASP Top 10):
   - Inyección SQL (¿se interpolan variables en queries?)
   - Autenticación rota (¿un token sirve para más de lo que debería?)
   - Mala configuración de seguridad (¿headers ausentes? ¿CSP permisiva?)
   - Exposición de datos sensibles (¿endpoints de debug? ¿trazas de error al cliente?)
4. **Verificación de paridad**: el proyecto tiene **dos** entrypoints de Express
   (`server/index.js` standalone y `api/index.js` serverless). Toda corrección debe aplicarse a
   **ambos**, o se crea una brecha entre desarrollo y producción.
5. **Pruebas automatizadas**: ejecutar `vitest` tras cada cambio para confirmar que no se rompió
   el comportamiento esperado.
6. **Distinguir lo verificable localmente de lo que solo se verifica desplegado**: los headers de
   página (`vercel.json`) **solo existen en Vercel**, no en local. Honestidad sobre esto es parte
   de la auditoría (ver §6).

---

## 4. Hallazgos y correcciones

Cada hallazgo se presenta como: **qué se encontró → por qué es un riesgo → cómo se corrigió**.
La severidad usa la escala informal Alta / Media / Baja según impacto y facilidad de explotación.

---

### Hallazgo A — El token de verificación de email servía como token de sesión 🔴 Alta

**Qué se encontró.** Al registrarse, el sistema generaba el token de verificación así:

```javascript
// ANTES (generado por IA, parece correcto)
const verifyToken = auth.generateToken({ ...newUser, type: 'verification' });
```

El problema: `generateToken` firma **solo** `{ id, role }` y **descarta** silenciosamente el campo
`type`. Es decir, el "token de verificación" era, en realidad, **un token de sesión normal** enviado
por correo electrónico.

**Por qué es un riesgo.** El enlace de verificación que llega al email contenía un token válido para
*autenticarse en la API*. Cualquiera con acceso a ese enlace (un correo reenviado, un log, un
historial) obtenía una sesión. Peor: un token pensado para "abrir un enlace una vez" no debería poder
usarse como credencial de acceso a recursos protegidos.

**Cómo se corrigió.** Se separaron los dos propósitos con un token de tipo explícito, y se **rechaza**
cualquier token con `type` en el middleware de sesión:

```javascript
// server/auth.js — token de verificación con propósito explícito
export const generateVerificationToken = (user) => {
  return jwt.sign({ id: user.id, type: 'verification' }, JWT_SECRET, { expiresIn: '24h' });
};

// authenticateToken: un token con 'type' NO es un token de sesión
const verified = verifyToken(token);
if (verified.type) {
  return res.status(401).json({ error: 'Token invalido' });
}
```

Y el endpoint `/verify` ahora exige que el token sea **específicamente** de verificación:

```javascript
const decoded = auth.verifyToken(token);
if (decoded.type !== 'verification') {
  return res.status(400).json({ error: 'Token invalido o expirado' });
}
```

**Lección de auditoría.** El bug no estaba en lo que el código *hacía*, sino en lo que *silenciosamente
no hacía*: pasar un campo a una función que lo ignora. Solo se detecta leyendo la firma de
`generateToken`, no leyendo la línea que la llama.

---

### Hallazgo B — Inconsistencia en la longitud mínima de contraseña 🟡 Media

**Qué se encontró.** El registro exigía `min: 6` caracteres. Una política débil para una plataforma
que maneja pagos y datos personales.

**Cómo se corrigió.** Se elevó el registro a **8 caracteres** (y el cambio de contraseña ya exigía 8):

```javascript
body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
```

**Decisión de criterio (importante para la exposición).** El *login* se dejó deliberadamente en
`min: 6`. ¿Por qué? Porque el control de la fortaleza de una contraseña pertenece al momento en que
**se crea**, no cuando se usa. Subir el mínimo en el login **bloquearía a usuarios antiguos** cuya
contraseña válida tiene 6–7 caracteres, sin ganar seguridad (el atacante de fuerza bruta no se detiene
por una validación de longitud en el login). Esto ilustra que auditar **no es endurecer todo a ciegas**:
es entender qué control va en qué lugar.

---

### Hallazgo C — Endpoint de depuración que filtraba la configuración 🟡 Media

**Qué se encontró.** Existía `GET /api/debug/config`, que revelaba **qué variables de entorno estaban
configuradas** y la lista de orígenes permitidos (`allowedOrigins`). Además, solo existía en el
entrypoint serverless → rompía la paridad.

**Por qué es un riesgo.** Es reconocimiento gratuito para un atacante: saber qué integraciones están
activas (Wompi, ML, Google) y qué orígenes se aceptan acelera un ataque dirigido.

**Cómo se corrigió.** Se **eliminó por completo** el endpoint. Un endpoint de debug no pertenece a
producción.

---

### Hallazgo D — CORS que respondía con 500 y traza de pila 🟡 Media

**Qué se encontró.** Ante un origen no permitido, la configuración de CORS lanzaba un `Error`:

```javascript
// ANTES
if (allowedOrigins.includes(origin)) callback(null, true);
else callback(new Error('No permitido por CORS'));   // ← produce un 500 con stack trace
```

**Por qué es un riesgo.** Lanzar un `Error` en el callback de CORS genera una respuesta **500 con
traza**, que (a) filtra detalles internos y (b) es ruido que confunde monitoreo. Bloquear un origen es
un evento *esperado*, no un fallo del servidor.

**Cómo se corrigió.** Se bloquea limpiamente, sin cabeceras CORS (el navegador impide la lectura por
sí mismo) y se registra el intento:

```javascript
origin: function (origin, callback) {
  // Sin 'origin' = petición no-navegador (SSR, webhooks Wompi/ML, health, curl).
  // CORS solo aplica al navegador; el control real aquí es el JWT / la firma del webhook.
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  logger.warn({ origin }, '[CORS] Origen bloqueado');
  return callback(null, false);   // ← bloqueo limpio, sin 500
}
```

**Matiz que conviene explicar en clase.** Las peticiones **sin `Origin`** (webhooks de Wompi/ML, SSR,
`curl`) se **permiten a propósito**. CORS es una protección **del navegador**: solo el navegador envía
`Origin` y solo él respeta la respuesta. Un webhook servidor-a-servidor no se protege con CORS sino con
la **firma del webhook**, y la API con el **JWT**. Bloquear el no-origin no daría seguridad y rompería
los pagos.

---

### Hallazgo E — `'unsafe-inline'` en la CSP debilita la protección anti-XSS 🟡 Media (parcial)

**Qué se encontró.** La política `script-src` y `style-src` incluyen `'unsafe-inline'`, lo que permite
ejecutar scripts y estilos en línea — exactamente el vector que un atacante usa en un XSS.

**Estado.** Documentado y **parcialmente** abordado. Quitar `'unsafe-inline'` por completo exige
refactorizar ~56 bloques de script en línea y ~60 manejadores `onclick=` del HTML hacia
`addEventListener` (o activar el hashing automático de Astro). Es un cambio grande y propenso a romper
funcionalidad, por lo que se dejó como **fase posterior** documentada (ver §6). Se priorizó algo de
mayor impacto inmediato: el Hallazgo F.

---

### Hallazgo F — Las páginas en producción no tenían NINGÚN header de seguridad 🔴 Alta

**Este fue el hallazgo más importante de toda la auditoría.**

**Qué se encontró.** `helmet` (la librería que pone los headers de seguridad) estaba montado dentro de
Express. Pero en Vercel, **Express solo atiende `/api/*`**: las páginas HTML las sirve el adaptador de
Astro. Conclusión: en producción, **todas las páginas iban sin CSP, sin HSTS, sin X-Frame-Options, sin
nada**. La protección existía... pero solo para las respuestas JSON, no para lo que ve el usuario.

**Por qué es un riesgo.** Sin estos headers, el sitio quedaba expuesto a clickjacking (incrustar la
página en un iframe malicioso), a degradación de HTTPS, y sin ninguna política que limite de dónde se
cargan scripts.

**Cómo se corrigió.** Se replicó la política de seguridad **donde Vercel sí la aplica a las páginas**:
en `vercel.json`, con un `source` que excluye `/api/` (eso lo cubre helmet) y cubre todo lo demás:

```jsonc
// vercel.json (resumen)
"headers": [{
  "source": "/((?!api/).*)",          // todo MENOS /api/  → las páginas
  "headers": [
    { "key": "Content-Security-Policy",   "value": "default-src 'self'; ... upgrade-insecure-requests; ..." },
    { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
    { "key": "X-Content-Type-Options",    "value": "nosniff" },
    { "key": "X-Frame-Options",           "value": "SAMEORIGIN" },
    { "key": "Referrer-Policy",           "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy",        "value": "camera=(self), microphone=(), geolocation=(self)" }
  ]
}]
```

Además se **endureció** la CSP de helmet (que sí cubre `/api/`) y se corrigió **un bug latente**: a
`script-src` le faltaban `cdn.jsdelivr.net` (el escáner QR de trazabilidad) y `accounts.google.com`
(login con Google) → en el servidor standalone, esas funciones se habrían bloqueado.

**Lección de auditoría.** "Configuramos helmet, estamos protegidos" es exactamente el tipo de supuesto
que la IA reproduce y que una auditoría debe cuestionar: *¿protegido dónde, exactamente?* La respuesta
correcta exigía entender el modelo de despliegue de Vercel, no solo el código de Express.

---

### Resumen de hallazgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| A | Token de verificación = token de sesión | 🔴 Alta | ✅ Corregido |
| B | Contraseña mínima inconsistente (6 vs 8) | 🟡 Media | ✅ Corregido |
| C | Endpoint `/api/debug/config` filtra config | 🟡 Media | ✅ Eliminado |
| D | CORS lanza 500 con traza | 🟡 Media | ✅ Corregido |
| E | `'unsafe-inline'` en CSP | 🟡 Media | ⏳ Documentado / fase posterior |
| F | Páginas en prod sin headers de seguridad | 🔴 Alta | ✅ Corregido (requiere validar en deploy) |

---

## 5. Arquitectura de seguridad integral

Esta sección explica **cómo funciona la defensa hoy**, capa por capa. Es la parte más útil para
estudiantes porque muestra un sistema real, no un ejemplo de juguete.

El principio rector es **defensa en profundidad**: ninguna capa es suficiente por sí sola; si una falla,
otra contiene el daño.

```
Petición ──▶ [1] HTTPS/HSTS ──▶ [2] CSP + headers ──▶ [3] CORS ──▶ [4] Rate limit
          ──▶ [5] Autenticación (JWT) ──▶ [6] Autorización (roles)
          ──▶ [7] Validación de entrada ──▶ [8] Consultas parametrizadas ──▶ BD
                                                                  └──▶ [9] Auditoría
```

### Capa 1 — Transporte: HTTPS + HSTS
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` obliga al navegador a usar
HTTPS durante 2 años, incluso si el usuario escribe `http://`. Evita ataques de degradación de
protocolo (man-in-the-middle que fuerza HTTP).

### Capa 2 — Política de contenido (CSP) y headers
La CSP declara **de dónde** se permite cargar cada tipo de recurso (scripts, estilos, imágenes,
conexiones). Es la principal defensa contra XSS: aunque un atacante inyecte `<script src="malo.com">`,
el navegador lo bloquea si `malo.com` no está en la lista. Acompañan:
- `X-Frame-Options: SAMEORIGIN` y `frame-ancestors 'self'` → anti-clickjacking.
- `X-Content-Type-Options: nosniff` → impide que el navegador "adivine" tipos MIME.
- `Permissions-Policy` → desactiva micrófono, restringe cámara y geolocalización a la propia página.

### Capa 3 — CORS
Controla **qué orígenes de navegador** pueden leer respuestas de la API. Lista blanca explícita
(`dobleyo.cafe`, subdominios, localhost de desarrollo). Recordatorio del Hallazgo D: solo protege al
navegador; no es la defensa de los webhooks.

### Capa 4 — Rate limiting (`server/middleware/rateLimit.js`)
Límites por IP para frenar fuerza bruta y abuso:

| Acción | Ventana | Máximo | Notas |
|---|---|---|---|
| Login | 15 min | 5 intentos | Cuenta todos los intentos |
| Registro | 1 hora | 3 | Solo cuenta fallos |
| Refresh token | 5 min | 10 | Detecta abuso de rotación |
| Global `/api` | 15 min | 600 | Red de seguridad; **excluye** webhooks y `/health` |

Detalle de criterio: el limiter global **excluye** los webhooks de pago y los health checks — perder
una confirmación de pago por un 429 sería peor que el abuso que se intenta frenar. Y se usa
`trust proxy = 1` para que el rate limit vea la IP real del cliente (vía `X-Forwarded-For`) y no la del
proxy de Vercel.

### Capa 5 — Autenticación (JWT + refresh tokens)
Modelo de **doble token**:

- **Access token (JWT, 15 min):** firma solo `{ id, role }`. Corto a propósito: si se filtra, expira
  pronto. Viaja en cookie **`HttpOnly`** → JavaScript no puede leerlo, lo que neutraliza el robo de
  sesión vía XSS.
- **Refresh token (opaco, 7 días):** cadena aleatoria de 40 bytes, **no** un JWT. Se guarda en la BD
  **hasheado con SHA-256** — si se filtra la base de datos, los tokens no son utilizables directamente.

```javascript
// Cookies de sesión — server/routes/auth.js
res.cookie('auth_token', accessToken, {
  httpOnly: true,           // inaccesible desde JS
  secure: isProd,           // solo HTTPS en producción
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000    // 15 min
});
res.cookie('refresh_token', refreshToken, {
  httpOnly: true, secure: isProd, sameSite: 'lax',
  path: '/api/auth/refresh', // solo se envía a ESTE endpoint, no a toda la API
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

**Rotación de refresh token (seguridad avanzada).** Cada vez que se refresca, el token usado se
**revoca** (`revoked = 1`) y se emite uno nuevo. Esto permite detectar reutilización: si llega un token
ya revocado, es señal de robo y se limpian las cookies.

**Verificación de identidad federada:** el login con Google verifica el `idToken` contra Google
(`verifyIdToken`) antes de emitir sesión propia — no se confía en datos del cliente sin validar.

### Capa 6 — Autorización (roles)
Separada de la autenticación. `requireRole('admin')` (o un array de roles) protege cada endpoint
sensible. Roles: `admin`, `client`, `provider`, `caficultor`. Un cliente autenticado **no** puede tocar
endpoints de admin: pasa la Capa 5 pero la Capa 6 responde `403`.

```javascript
export const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (req.user && allowed.includes(req.user.role)) return next();
  return res.status(403).json({ error: 'Permisos insuficientes' });
};
```

> Convención deliberada: `401` = no autenticado (token vencido/ausente → refrescar); `403` = autenticado
> pero sin permiso. No mezclarlos facilita el diagnóstico y el manejo en el cliente.

### Capa 7 — Validación de entrada
`express-validator` valida y normaliza **antes** de tocar la lógica: emails con formato, contraseñas
con longitud mínima, campos requeridos. Entrada inválida se rechaza con `400`/`422` y nunca llega a la
base de datos.

### Capa 8 — Consultas parametrizadas (anti-inyección SQL)
**Regla absoluta del proyecto: nunca interpolar variables en SQL.** Se usan parámetros posicionales
`?` de libSQL/Turso. El motor trata los valores como datos, nunca como código:

```javascript
// CORRECTO — el valor jamás se interpreta como SQL
await db.query('SELECT id FROM users WHERE email = ?', [email]);

// PROHIBIDO en este proyecto — vulnerable a inyección
// db.query(`SELECT id FROM users WHERE email = '${email}'`);
```

Contraseñas: nunca en texto plano. Se hashean con **bcrypt** (factor de costo 10). En BD solo vive el
hash; al validar se compara con `bcrypt.compare`.

### Capa 9 — Auditoría
Acciones sensibles (registro, cambio de contraseña, solicitudes de caficultor, etc.) se registran en
`audit_logs` con usuario, acción, entidad y detalle. Permite reconstruir qué pasó tras un incidente —
seguridad no es solo prevenir, también es **poder investigar**.

---

## 6. Pendientes y deuda técnica (honestidad de auditoría)

Una auditoría seria documenta lo que **falta**, no solo lo que se logró.

1. **Validar la CSP en un despliegue de preview (prioridad #1).** Los headers de página de `vercel.json`
   **solo existen desplegados en Vercel**; no se pueden comprobar en local. Antes de producción hay que
   verificar en consola que **no se bloquee** ninguno de estos 4 flujos críticos:
   checkout **Wompi**, login **Google**, escáner **QR** (`/trazabilidad`), **mapa de ventas** (Leaflet).
   Si algo se bloquea, será un origen faltante en la lista blanca → se ajusta en una línea.

2. **CSP estricta (quitar `'unsafe-inline'`).** Exige migrar ~56 scripts en línea y ~60 manejadores
   `onclick=` a `addEventListener` (o activar el hashing automático de Astro). Cambio grande, fase
   posterior. Mientras tanto, la CSP **sí** restringe orígenes externos, que es la mayor parte del
   beneficio.

3. **`devtools.js` usa sintaxis MySQL (`SET FOREIGN_KEY_CHECKS`)** en un proyecto SQLite/Turso. Solo
   afecta a desarrollo y está bloqueado en producción → riesgo bajo, pero es deuda a saldar.

---

## 7. Lecciones de auditar código generado por IA

Las cuatro lecciones que se llevan de este trabajo (y el mensaje de fondo de la exposición):

1. **El código que compila puede ser inseguro.** Ningún hallazgo de este documento impedía que la app
   funcionara en una demo. Todos eran explotables. La seguridad vive en lo que el código *no* hace.

2. **La IA reproduce supuestos plausibles, no garantías.** "Configuramos helmet" sonaba a protección
   completa; en realidad cubría solo `/api`. Auditar es preguntar *"¿dónde, exactamente, y bajo qué
   modelo de despliegue?"*.

3. **Endurecer no es hacer todo más estricto.** Subir el mínimo de contraseña en el *login* habría
   bloqueado usuarios sin ganar seguridad. El criterio —saber qué control va en qué lugar— es
   justamente lo que la IA no aporta y el auditor sí.

4. **La paridad y el contexto importan más que la sintaxis.** El riesgo no estaba en una línea mal
   escrita, sino en dos entrypoints que debían coincidir, en un token usado para dos cosas, en un
   header puesto en el lugar equivocado. Eso solo se ve entendiendo el sistema completo.

> **Conclusión.** Generar código es ahora barato; **confiar** en ese código es caro. La competencia
> profesional demostrada en este proyecto es la capacidad de auditar: leer con desconfianza informada,
> entender el porqué del riesgo, y corregir con criterio — no a ciegas.

---

## 8. Glosario para estudiantes

| Término | Qué es |
|---|---|
| **XSS** (Cross-Site Scripting) | Inyectar JavaScript malicioso en una página para que se ejecute en el navegador de otra víctima. |
| **CSRF** | Engañar al navegador para que envíe una petición autenticada sin que el usuario quiera. Mitigado con `SameSite` en cookies. |
| **Clickjacking** | Incrustar el sitio en un iframe invisible para robar clics. Mitigado con `X-Frame-Options`/`frame-ancestors`. |
| **CSP** (Content Security Policy) | Lista blanca de orígenes desde los que el navegador puede cargar recursos. Principal defensa contra XSS. |
| **CORS** | Reglas que deciden qué orígenes de navegador pueden leer respuestas de una API. |
| **HSTS** | Header que obliga a usar HTTPS siempre. |
| **JWT** | Token firmado que transporta datos (aquí: `id`, `role`). Firmado, no cifrado: no se guardan secretos dentro. |
| **Cookie HttpOnly** | Cookie que JavaScript no puede leer → protege el token de un XSS. |
| **Refresh token** | Token de larga duración que sirve para obtener nuevos access tokens sin re-loguearse. |
| **bcrypt** | Algoritmo de hashing de contraseñas, lento a propósito para frenar la fuerza bruta. |
| **Inyección SQL** | Insertar SQL malicioso a través de un campo de entrada. Se previene con consultas parametrizadas (`?`). |
| **Rate limiting** | Limitar cuántas peticiones por IP en una ventana de tiempo, para frenar fuerza bruta y abuso. |
| **Defensa en profundidad** | Apilar varias capas de seguridad para que la falla de una no comprometa el sistema. |

---

*Documento elaborado como parte de la auditoría de seguridad de DobleYo Café. El detalle cronológico de
cada cambio está en `CHANGELOG.md`.*
