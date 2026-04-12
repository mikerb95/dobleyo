# Plan de Mejoras — DobleYo Café

> Fecha: 2026-04-11  
> Alcance: Seguridad, Escalabilidad, Pagos (Wompi), Módulo Tienda, Módulo ERP  
> Prioridad: Crítica → Alta → Media → Baja

---

## Índice

1. [Seguridad](#1-seguridad)
2. [Escalabilidad](#2-escalabilidad)
3. [Pagos con Wompi](#3-pagos-con-wompi)
4. [Módulo Tienda](#4-módulo-tienda)
5. [Módulo ERP — Cadena de Producción](#5-módulo-erp--cadena-de-producción)
6. [Resumen de Tareas por Fase](#6-resumen-de-tareas-por-fase)

---

## 1. Seguridad

### 1.1 Vulnerabilidades Críticas (resolver antes de producción)

| # | Severidad | Problema | Archivo | Acción |
|---|-----------|----------|---------|--------|
| S-01 | CRÍTICA | Credenciales reales en `.env` potencialmente en git history | `.env` | Rotar TODOS los secretos, auditar git history con `git log --all --full-history -- .env`, usar BFG Repo Cleaner |
| S-02 | CRÍTICA | Webhook de Wompi procesado sin verificar si `WOMPI_INTEGRITY_SECRET` no está configurado | `server/routes/orders.js:281` | Hacer la verificación obligatoria — lanzar error 500 si el secret no está configurado |
| S-03 | CRÍTICA | Sin deduplicación de transacciones — el mismo pago puede procesarse dos veces | `server/routes/orders.js:303` | Agregar columna `wompi_transaction_id UNIQUE` en tabla `orders` y verificar antes de actualizar |

#### Acciones S-01 inmediatas:
```bash
# 1. Revocar y regenerar TODOS los secretos expuestos:
#    - DATABASE_URL → cambiar contraseña en Aiven
#    - JWT_SECRET y JWT_REFRESH_SECRET → generar nuevos (node -e "require('crypto').randomBytes(64).toString('hex')")
#    - RESEND_API_KEY → revocar en dashboard de Resend
#    - WOMPI_INTEGRITY_SECRET → revocar en dashboard de Wompi
#    - ADMIN_PASSWORD → cambiar en BD

# 2. Limpiar git history
npx bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### Fix S-02 (`server/routes/orders.js`):
```javascript
// Reemplazar la verificación opcional por obligatoria
const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
if (!integritySecret) {
  console.error('[Wompi Webhook] WOMPI_INTEGRITY_SECRET no configurado');
  return res.status(500).json({ error: 'Configuración incompleta' });
}
// ... continuar con verificación
```

#### Fix S-03 — Deduplicación:
```sql
-- Migración
ALTER TABLE orders ADD COLUMN wompi_transaction_id VARCHAR(100) UNIQUE;
CREATE INDEX idx_orders_wompi_transaction ON orders(wompi_transaction_id);
```

```javascript
// En el handler del webhook, antes de actualizar:
const existingOrder = await query(
  'SELECT id FROM orders WHERE wompi_transaction_id = $1',
  [transactionId]
);
if (existingOrder.rows.length > 0 && existingOrder.rows[0].status === 'paid') {
  return res.status(200).json({ received: true }); // idempotente
}
await query(
  'UPDATE orders SET status = $1, wompi_transaction_id = $2 WHERE reference = $3',
  ['paid', transactionId, reference]
);
```

---

### 1.2 Vulnerabilidades Altas

| # | Severidad | Problema | Archivo | Acción |
|---|-----------|----------|---------|--------|
| S-04 | ALTA | Sin replay attack prevention en webhook — firma sin timestamp | `server/routes/orders.js:278` | Agregar verificación de timestamp (máx. 5 min de antigüedad) |
| S-05 | ALTA | Política de contraseñas débil (mínimo 6 chars, sin reglas de complejidad) | `server/routes/auth.js:88` | Subir a mínimo 8 chars con al menos 1 número y 1 especial |
| S-06 | ALTA | Sin validación de inventario en compra — se puede vender cantidad ilimitada | `server/routes/orders.js:71-135` | Verificar stock antes de crear orden |
| S-07 | ALTA | Un caficultor puede crear cosechas para cualquier finca sin autorización | `server/routes/coffee.js:15-84` | Verificar que `farm_id` pertenezca al usuario autenticado |

#### Fix S-04 — Timestamp freshness:
```javascript
// En webhook handler de Wompi
const eventTimestamp = req.body?.data?.transaction?.created_at;
if (eventTimestamp) {
  const eventAge = Date.now() - new Date(eventTimestamp).getTime();
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (eventAge > FIVE_MINUTES) {
    return res.status(400).json({ error: 'Evento demasiado antiguo' });
  }
}
```

#### Fix S-05 — Política de contraseñas:
```javascript
// server/routes/auth.js
body('password')
  .isLength({ min: 8 })
  .withMessage('Contraseña debe tener mínimo 8 caracteres')
  .matches(/^(?=.*[0-9])(?=.*[!@#$%^&*])/)
  .withMessage('Contraseña debe incluir al menos un número y un caracter especial'),
```

#### Fix S-07 — Autorización de finca:
```javascript
// server/routes/coffee.js — al inicio del handler de cosecha
const farmCheck = await query(
  'SELECT id FROM farms WHERE id = $1 AND user_id = $2',
  [farm_id, req.user.id]
);
if (farmCheck.rows.length === 0 && req.user.role !== 'admin') {
  return res.status(403).json({ success: false, error: 'No autorizado para esta finca' });
}
```

---

### 1.3 Vulnerabilidades Medias

| # | Severidad | Problema | Archivo | Acción |
|---|-----------|----------|---------|--------|
| S-08 | MEDIA | Sin protección CSRF en formulario de checkout | `src/pages/checkout.astro` | Implementar CSRF tokens en formularios sensibles |
| S-09 | MEDIA | `unsafe-inline` en CSP — permite XSS inline | `server/index.js:35-36` | Migrar a nonces para scripts inline |
| S-10 | MEDIA | `lotId` generado con `Math.random()` — predecible | `server/routes/coffee.js:48` | Usar `crypto.randomBytes()` |
| S-11 | MEDIA | Validación insuficiente en campos de envío (dirección, ciudad, teléfono) | `server/routes/orders.js:55-56` | Agregar validación de longitud y formato |
| S-12 | MEDIA | `sameSite: 'lax'` en cookies — podría ser 'strict' | `server/routes/auth.js:127` | Evaluar cambiar a 'strict' según UX needs |

#### Fix S-10 — Lot ID seguro:
```javascript
import { randomBytes } from 'crypto';
// Reemplazar Math.random() por:
const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
const lotId = `LOT-${year}${month}-${randomSuffix}`;
```

---

### 1.4 Mejoras de Seguridad Adicionales

- **Logging de seguridad**: Registrar intentos de login fallidos con IP en tabla `security_events`
- **2FA para admin**: Implementar TOTP (usando `speakeasy`) para cuentas de administrador
- **Headers adicionales**: Agregar `Permissions-Policy` para deshabilitar APIs de browser no usadas
- **Dependency scanning**: Agregar `npm audit` al pipeline de CI/CD
- **Secrets management**: Migrar a Vercel Environment Variables o Vault en producción

---

## 2. Escalabilidad

### 2.1 Base de Datos

#### Problema actual
- Pool de conexiones en `server/db.js` con `max: 5` — correcto para serverless pero sin retry logic
- Sin índices documentados fuera del schema inicial
- Queries con múltiples JOINs sin optimización visible
- Sin query caching (Redis u otro)

#### Mejoras propuestas

**2.1.1 Connection Pool con retry:**
```javascript
// server/db.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '5'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client', err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB Slow Query] ${duration}ms — ${text.substring(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error('[DB Query Error]', err.message, text.substring(0, 80));
    throw err;
  }
}
```

**2.1.2 Índices críticos faltantes:**
```sql
-- Agregar en nueva migración: 20260411_performance_indexes.js

-- Orders: búsquedas por usuario y estado
CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders(user_id, status);
CREATE INDEX CONCURRENTLY idx_orders_reference ON orders(reference);
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at DESC);

-- Production: filtros frecuentes
CREATE INDEX CONCURRENTLY idx_production_orders_state ON production_orders(state);
CREATE INDEX CONCURRENTLY idx_production_orders_dates ON production_orders(planned_start_date, planned_end_date);
CREATE INDEX CONCURRENTLY idx_roast_batches_date ON roast_batches(roast_date DESC);

-- Coffee chain
CREATE INDEX CONCURRENTLY idx_coffee_harvests_farm ON coffee_harvests(farm_id);
CREATE INDEX CONCURRENTLY idx_lots_lot_id ON lots(lot_id);
CREATE INDEX CONCURRENTLY idx_green_inventory_lot ON green_coffee_inventory(lot_id);

-- Audit logs: evitar full table scans
CREATE INDEX CONCURRENTLY idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX CONCURRENTLY idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

**2.1.3 Paginación obligatoria:**
```javascript
// middleware/pagination.js
export function paginationMiddleware(req, res, next) {
  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;
  req.pagination = {
    limit: Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT),
    offset: Math.max(parseInt(req.query.offset) || 0, 0),
    page: Math.max(parseInt(req.query.page) || 1, 1),
  };
  req.pagination.offset = (req.pagination.page - 1) * req.pagination.limit;
  next();
}
```

---

### 2.2 API y Arquitectura

**2.2.1 Versionado de API:**
```javascript
// server/index.js y api/index.js
// Agregar prefijo de versión
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/orders', ordersRouter);
// ... mantener /api/* sin versión como deprecated hasta migrar frontend
```

**2.2.2 Paridad server/index.js ↔ api/index.js:**

Verificación pendiente — crear test que compare routes entre ambos archivos:
```javascript
// tests/api-parity.test.js
// Importar ambos apps y verificar que tengan las mismas rutas registradas
```

**2.2.3 Response time logging:**
```javascript
// middleware/timing.js
export function timingMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    if (duration > 500) {
      console.warn(`[SLOW] ${req.method} ${req.path} — ${duration.toFixed(0)}ms`);
    }
  });
  next();
}
```

---

### 2.3 Caching Strategy

**2.3.1 Cache headers para assets estáticos (`vercel.json`):**
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

**2.3.2 Cache de datos estáticos en frontend:**
```javascript
// Para la tienda: productos cargados desde BD se pueden cachear en memoria (Vercel Edge)
// astro.config.mjs — usar output: 'hybrid' para páginas que pueden ser estáticas
```

**2.3.3 Redis para sesiones y rate limiting (largo plazo):**
- Migrar rate limiting de `express-rate-limit` en-memory a Redis store
- Cachear productos activos con TTL de 5 minutos
- Cachear datos de fincas con TTL de 1 hora

---

### 2.4 Monitoreo y Observabilidad

- **Vercel Analytics**: Activar para métricas de performance de Astro
- **Sentry**: Integrar para error tracking en backend y frontend
- **Uptime monitoring**: Usar Better Uptime o Checkly para alertas de disponibilidad
- **DB monitoring**: Activar `pg_stat_statements` en Aiven para identificar queries lentas

---

## 3. Pagos con Wompi

### 3.1 Estado Actual

- Integración básica funcional: flujo de hosted checkout implementado
- Webhook handler existe pero con vulnerabilidades críticas (ver S-02, S-03, S-04)
- Sin manejo de estados intermedios (PENDING, VOIDED, ERROR)
- Sin emails de confirmación de pago
- MercadoPago: solo stub (501 Not Implemented)

### 3.2 Flujo Completo Propuesto

```
Cliente → Checkout → POST /api/orders/create
                          ↓
                    Validar inventario
                          ↓
                    Insertar orden (status: 'pending')
                          ↓
                    Generar integrity_hash
                          ↓
                    Retornar checkout_url (Wompi Hosted)
                          ↓
                    Redirect a Wompi ←── Cliente completa pago
                          ↓
                    Wompi → POST /api/orders/webhook
                          ↓
                    Verificar firma (obligatorio)
                          ↓
                    Verificar timestamp (< 5 min)
                          ↓
                    Verificar deduplicación
                          ↓
               ┌──────────┴──────────┐
           APPROVED              DECLINED/VOIDED
               ↓                      ↓
        Actualizar orden         Liberar inventario
        Reducir inventario       Notificar cliente
        Enviar email             Actualizar orden
        Generar factura
```

### 3.3 Mejoras Específicas Wompi

**3.3.1 Validación completa del webhook:**
```javascript
// server/routes/orders.js — reemplazar handler de webhook
app.post('/webhook',
  express.raw({ type: 'application/json' }), // raw body para verificación de firma
  async (req, res) => {
    // 1. Verificación obligatoria del secret
    const secret = process.env.WOMPI_INTEGRITY_SECRET;
    if (!secret) {
      console.error('[Wompi] WOMPI_INTEGRITY_SECRET no configurado');
      return res.status(500).end();
    }

    // 2. Verificar firma
    const signature = req.headers['x-event-checksum'];
    const body = req.body;
    const expectedHash = crypto
      .createHash('sha256')
      .update(body + secret)
      .digest('hex');
    if (signature !== expectedHash) {
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const event = JSON.parse(body);

    // 3. Verificar freshness del evento
    const eventTime = new Date(event?.data?.transaction?.created_at).getTime();
    if (Date.now() - eventTime > 10 * 60 * 1000) { // 10 minutos
      console.warn('[Wompi] Evento demasiado antiguo, ignorando');
      return res.status(200).end(); // Retornar 200 para que Wompi no reintente
    }

    // 4. Responder rápido a Wompi
    res.status(200).end();

    // 5. Procesar en background (con manejo de errores)
    processWompiEvent(event).catch(err => {
      console.error('[Wompi] Error procesando evento:', err);
    });
  }
);

async function processWompiEvent(event) {
  const { reference, status, id: transactionId } = event.data.transaction;

  // 6. Deduplicación
  const { rows } = await query(
    'SELECT id, status FROM orders WHERE reference = $1',
    [reference]
  );
  if (!rows.length) return;

  const order = rows[0];
  if (order.status === 'paid') return; // Ya procesado

  // 7. Procesar por status
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (status === 'APPROVED') {
      await client.query(
        'UPDATE orders SET status = $1, wompi_transaction_id = $2, paid_at = NOW() WHERE reference = $3',
        ['paid', transactionId, reference]
      );
      // Reducir inventario
      await reduceInventoryForOrder(client, order.id);
      // Enviar email de confirmación
      await sendOrderConfirmationEmail(order.id);
    } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(status)) {
      await client.query(
        'UPDATE orders SET status = $1, wompi_transaction_id = $2 WHERE reference = $3',
        ['failed', transactionId, reference]
      );
      // Liberar inventario reservado si se implementa reserva
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**3.3.2 Reserva de inventario temporal:**
```sql
-- Nueva columna para reserva de stock
ALTER TABLE order_items ADD COLUMN inventory_reserved BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN stock_reserved INTEGER DEFAULT 0;

-- Al crear orden: reservar stock
UPDATE products SET stock_reserved = stock_reserved + $1 WHERE id = $2;

-- Al confirmar pago: mover de reservado a vendido
UPDATE products
  SET stock_available = stock_available - $1, stock_reserved = stock_reserved - $1
  WHERE id = $2;

-- Job cada hora: liberar reservas de órdenes pendientes > 30 min
UPDATE products p
  SET stock_reserved = stock_reserved - oi.quantity
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p.id
    AND o.status = 'pending'
    AND o.created_at < NOW() - INTERVAL '30 minutes';
```

**3.3.3 Email de confirmación (template mínimo):**
```javascript
// server/services/email.js — agregar función
export async function sendOrderConfirmationEmail(orderId) {
  const { rows } = await query(
    `SELECT o.*, u.email, u.name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!rows.length) return;
  const order = rows[0];

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: order.email,
    subject: `DobleYo Café — Pedido #${order.reference} confirmado`,
    html: orderConfirmationTemplate(order),
  });
}
```

### 3.4 Mejoras UI del Checkout

- [ ] Mostrar desglose de costos (subtotal + envío + IVA) antes de redirigir a Wompi
- [ ] Validar stock disponible en el frontend antes de enviar formulario
- [ ] Página de retorno exitosa (`/pedido-confirmado?ref=...`) con polling del estado
- [ ] Página de error de pago con opciones de reintento
- [ ] Guardar datos de envío en `localStorage` para pre-llenar en próxima compra
- [ ] Agregar campo de cupón de descuento (preparar BD: tabla `discount_codes`)

### 3.5 MercadoPago (Fase 4 — pendiente)

> Los endpoints actuales retornan 501. Implementar cuando se habilite para mercado USA.

- Flujo similar a Wompi pero con Checkout Pro
- Webhook en `/api/orders/mp-webhook`
- Soporta PSE, tarjetas débito/crédito, efecty

---

## 4. Módulo Tienda

### 4.1 Estado Actual

- 5 productos hardcodeados en `src/data/products.ts` — no hay integración con BD
- Sin paginación
- Sin sistema de variantes (tamaños de bolsa: 250g, 500g, 1kg)
- Sin gestión de stock visible al usuario
- Sin filtros avanzados (proceso, origen, perfil de taza)
- Sin reviews/calificaciones
- Sin sistema de búsqueda

### 4.2 Migración de Productos a Base de Datos

**4.2.1 Schema de productos (mejorado):**
```sql
-- Migración: 20260411_products_full.js

-- Tabla de productos mejorada
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stock_available INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimum INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER, -- para cálculo de envío
  ADD COLUMN IF NOT EXISTS meta_title VARCHAR(60),
  ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160);

-- Variantes de producto (ej: 250g, 500g, 1kg)
CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- "250g", "500g", "1kg"
  sku VARCHAR(50) UNIQUE,
  price INTEGER NOT NULL, -- en centavos (COP)
  stock_available INTEGER DEFAULT 0,
  weight_grams INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- Imágenes de producto
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text VARCHAR(200),
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- Script de seed para migrar productos actuales de products.ts a BD
```

**4.2.2 API de productos (nueva ruta pública):**
```javascript
// server/routes/products.js
import { Router } from 'express';
import { query } from '../db.js';

export const productsRouter = Router();

// GET /api/products — listado con filtros
productsRouter.get('/', async (req, res) => {
  const {
    category, origin, process, roast,
    sort = 'featured', page = 1, limit = 12
  } = req.query;

  const conditions = ['p.is_active = TRUE'];
  const params = [];

  if (category) { params.push(category); conditions.push(`p.category = $${params.length}`); }
  if (origin)   { params.push(origin);   conditions.push(`p.origin = $${params.length}`); }
  if (process)  { params.push(process);  conditions.push(`p.process = $${params.length}`); }
  if (roast)    { params.push(roast);    conditions.push(`p.roast = $${params.length}`); }

  const sortMap = {
    featured: 'p.is_featured DESC, p.id ASC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    newest: 'p.created_at DESC',
  };
  const orderBy = sortMap[sort] || sortMap.featured;

  const offset = (Math.max(parseInt(page), 1) - 1) * Math.min(parseInt(limit), 24);

  params.push(Math.min(parseInt(limit), 24), offset);

  const { rows: products } = await query(
    `SELECT p.*,
       json_agg(DISTINCT jsonb_build_object('id', pv.id, 'name', pv.name, 'price', pv.price, 'stock', pv.stock_available))
         FILTER (WHERE pv.id IS NOT NULL) AS variants,
       json_agg(DISTINCT jsonb_build_object('url', pi.url, 'alt', pi.alt_text))
         FILTER (WHERE pi.id IS NOT NULL AND pi.is_primary = TRUE) AS images
     FROM products p
     LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = TRUE
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: [{ total }] } = await query(
    `SELECT COUNT(*) AS total FROM products p WHERE ${conditions.join(' AND ')}`,
    params.slice(0, -2)
  );

  res.json({
    success: true,
    data: products,
    pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(total) }
  });
});
```

### 4.3 Mejoras de UX en Tienda

**4.3.1 Página de producto individual:**
- Ruta: `/tienda/[slug]`
- Galería de imágenes con zoom
- Selector de variante (peso)
- Indicador de stock ("Solo quedan 3")
- Descripción detallada + notas de cata
- Sección de información: origen, finca, proceso, altitud
- Botón "Rastrear este café" (link a trazabilidad con lote actual)
- Productos relacionados

**4.3.2 Mejoras al listado:**
```astro
<!-- src/pages/tienda.astro — mejoras -->
<!-- 1. Filtros por proceso, origen, tueste -->
<!-- 2. Paginación: mostrar 12 productos por página -->
<!-- 3. Badge de stock bajo ("Últimas unidades") -->
<!-- 4. Contador de resultados -->
<!-- 5. URL params para compartir búsquedas filtradas -->
```

**4.3.3 Carrito mejorado:**
- Soporte para variantes en el carrito (ej: "Geisha 500g")
- Verificar stock al agregar al carrito (llamada rápida a API)
- Tiempo de expiración del carrito (72 horas)
- Contador visual en header del número de items

### 4.4 Funcionalidades Pendientes

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Búsqueda | Alta | Full-text search en productos (`pg_trgm` o ElasticSearch) |
| Suscripciones | Media | Plan mensual de café (integrar con Wompi subscriptions) |
| Programa de puntos | Media | Acumular puntos por compra, canjear en próximo pedido |
| Reviews | Baja | Sistema de reseñas verificadas (solo compradores) |
| Bundle/kits | Baja | Crear paquetes de múltiples productos con descuento |
| Wishlist | Baja | Lista de deseos (requiere login) |

---

## 5. Módulo ERP — Cadena de Producción

### 5.1 Estado Actual

#### Módulos implementados (parcialmente):
- **Cosecha** (`app/harvest.astro`, `server/routes/coffee.js`) — funcional básico
- **Almacenamiento verde** (`app/inventory-storage.astro`) — implementado
- **Envío a tostión** (`app/send-roasting.astro`) — implementado
- **Recepción de tostado** (`app/roast-retrieval.astro`) — implementado
- **Almacén tostado** (`app/roasted-storage.astro`) — implementado
- **Empaquetado** (`app/packaging.astro`) — implementado
- **Etiquetas QR** (`app/etiquetas.astro`) — implementado

#### Módulos con deuda técnica:
- **Trazabilidad pública** (`trazabilidad.js`) — datos hardcodeados, no conectado a BD
- **Finanzas** (`app/finanzas.astro`) — estructura base, sin datos reales
- **Dashboard estadísticas** (`app/estadisticas.astro`) — sin implementar completamente

### 5.2 Mejoras al Pipeline de Café

**5.2.1 Validaciones de estado (state machine):**
```javascript
// server/services/lotStateMachine.js
const LOT_STATES = {
  'harvested':        ['stored_green'],
  'stored_green':     ['sent_to_roasting'],
  'sent_to_roasting': ['roasting', 'returned_green'], // puede devolverse
  'roasting':         ['roasted'],
  'roasted':          ['stored_roasted', 'quality_check'],
  'quality_check':    ['stored_roasted', 'rejected'],
  'stored_roasted':   ['packaging'],
  'packaging':        ['labeled', 'shipped'],
  'labeled':          ['shipped'],
  'shipped':          [], // estado final
  'rejected':         [], // estado final
};

export function canTransitionTo(currentState, nextState) {
  return LOT_STATES[currentState]?.includes(nextState) ?? false;
}

export async function transitionLot(lotId, nextState, userId, metadata = {}) {
  const { rows } = await query('SELECT state FROM lots WHERE id = $1', [lotId]);
  if (!rows.length) throw new Error('Lote no encontrado');

  const currentState = rows[0].state;
  if (!canTransitionTo(currentState, nextState)) {
    throw new Error(`Transición inválida: ${currentState} → ${nextState}`);
  }

  await query(
    'UPDATE lots SET state = $1, updated_at = NOW() WHERE id = $2',
    [nextState, lotId]
  );

  await logAudit(userId, 'state_change', 'lot', lotId, {
    from: currentState,
    to: nextState,
    ...metadata
  });
}
```

**5.2.2 Trazabilidad conectada a BD:**
```javascript
// server/routes/traceability.js — nueva ruta pública
import { Router } from 'express';
import { query } from '../db.js';

export const traceabilityRouter = Router();

// GET /api/traceability/:lotId — para el QR público
traceabilityRouter.get('/:lotId', async (req, res) => {
  const { lotId } = req.params;

  const { rows } = await query(
    `SELECT
       l.*,
       f.name AS farm_name, f.municipality, f.department, f.altitude_masl,
       ch.harvest_date, ch.coffee_variety, ch.harvest_method,
       rb.roast_date, rb.roast_profile, rb.final_temp, rb.duration_minutes,
       pqc.aroma_score, pqc.flavor_score, pqc.overall_score, pqc.cupper_notes,
       u_farmer.name AS farmer_name
     FROM lots l
     LEFT JOIN coffee_harvests ch ON ch.lot_id = l.id
     LEFT JOIN farms f ON f.id = ch.farm_id
     LEFT JOIN roast_batches rb ON rb.lot_id = l.id
     LEFT JOIN production_quality_checks pqc ON pqc.lot_id = l.id
     LEFT JOIN users u_farmer ON u_farmer.id = f.user_id
     WHERE l.lot_id = $1`,
    [lotId]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, error: 'Lote no encontrado' });
  }

  res.json({ success: true, data: rows[0] });
});
```

**5.2.3 Autorización por finca en toda la cadena:**
```javascript
// server/middleware/farmAuth.js
export async function requireFarmAccess(req, res, next) {
  if (req.user.role === 'admin') return next();

  const farmId = req.body.farm_id || req.query.farm_id || req.params.farm_id;
  if (!farmId) return next(); // sin farm_id, dejar que la ruta decida

  const { rows } = await query(
    'SELECT id FROM farms WHERE id = $1 AND user_id = $2',
    [farmId, req.user.id]
  );

  if (!rows.length) {
    return res.status(403).json({ success: false, error: 'Acceso no autorizado a esta finca' });
  }
  next();
}
```

### 5.3 Dashboard de Producción

**5.3.1 KPIs clave a mostrar:**

```sql
-- Query para dashboard de producción (admin)
SELECT
  COUNT(*) FILTER (WHERE state = 'harvested')        AS lots_harvested,
  COUNT(*) FILTER (WHERE state = 'roasting')         AS lots_in_roasting,
  COUNT(*) FILTER (WHERE state = 'stored_roasted')   AS lots_ready,
  COUNT(*) FILTER (WHERE state = 'shipped')          AS lots_shipped,
  SUM(weight_kg) FILTER (WHERE state NOT IN ('shipped', 'rejected')) AS kg_in_pipeline,
  AVG(pqc.overall_score)                             AS avg_cupping_score
FROM lots l
LEFT JOIN production_quality_checks pqc ON pqc.lot_id = l.id
WHERE l.created_at >= NOW() - INTERVAL '90 days';
```

**5.3.2 Páginas de ERP faltantes o incompletas:**

| Página | Estado | Trabajo Requerido |
|--------|--------|-------------------|
| `app/harvest.astro` | Parcial | Conectar a fincas reales del usuario |
| `app/finanzas.astro` | Estructura base | Conectar contabilidad doble partida |
| `app/estadisticas.astro` | Sin datos | Implementar queries de KPIs |
| `trazabilidad.astro` | Hardcoded | Conectar a nueva ruta `/api/traceability/:id` |
| `app/cupping.astro` | No existe | Crear formulario de cupping SCA |
| `admin/fincas.astro` | No existe | CRUD de fincas (Fase 7) |

### 5.4 Módulo de Cupping SCA (Nuevo)

Crear formulario completo de cupping siguiendo protocolo SCA:

```javascript
// Campos del formulario de cupping
const cuppingFields = {
  // Atributos (escala 6-10, paso 0.25)
  fragrance:    { min: 6, max: 10, step: 0.25 },
  aroma:        { min: 6, max: 10, step: 0.25 },
  flavor:       { min: 6, max: 10, step: 0.25 },
  aftertaste:   { min: 6, max: 10, step: 0.25 },
  acidity:      { min: 6, max: 10, step: 0.25 },
  body:         { min: 6, max: 10, step: 0.25 },
  balance:      { min: 6, max: 10, step: 0.25 },
  uniformity:   { min: 6, max: 10, step: 0.25 },
  clean_cup:    { min: 6, max: 10, step: 0.25 },
  sweetness:    { min: 6, max: 10, step: 0.25 },
  overall:      { min: 6, max: 10, step: 0.25 },
  // Penalizaciones
  defects:      { count: 0, intensity: 2 | 4 },
};
// Score final = suma de atributos - penalizaciones
// Specialty = score >= 80
```

### 5.5 Finanzas (Estructura Doble Partida)

El schema ya tiene las tablas. Falta implementar:

- API endpoints para crear/listar asientos contables
- Cálculo automático de costo de producción por lote
- Dashboard con P&L mensual
- Reportes de flujo de caja
- Integración: cuando se confirma un pago, crear asiento de ingreso automáticamente

---

## 6. Resumen de Tareas por Fase

### FASE INMEDIATA — Seguridad Crítica (1-2 días)

- [ ] **S-01**: Rotar todos los secretos expuestos en `.env`
- [ ] **S-02**: Hacer verificación de webhook Wompi obligatoria
- [ ] **S-03**: Agregar deduplicación de transacciones Wompi
- [ ] **S-04**: Agregar verificación de timestamp en webhook
- [ ] **S-10**: Reemplazar `Math.random()` con `crypto.randomBytes()` en lot IDs

### SPRINT 1 — Seguridad y Pagos (1 semana)

- [ ] **S-05**: Fortalecer política de contraseñas
- [ ] **S-06**: Validación de inventario en compra
- [ ] **S-07**: Autorización de finca en módulo de cosecha
- [ ] **W-01**: Manejo completo de estados de pago Wompi (APPROVED/DECLINED/VOIDED)
- [ ] **W-02**: Email de confirmación de pedido
- [ ] **W-03**: Página de retorno exitoso y de error de pago

### SPRINT 2 — Escalabilidad y Base de Datos (1 semana)

- [ ] **DB-01**: Agregar índices de performance
- [ ] **DB-02**: Implementar paginación obligatoria con middleware
- [ ] **DB-03**: Mejorar connection pool con slow query logging
- [ ] **API-01**: Agregar response timing logging
- [ ] **CFG-01**: Configurar cache headers en `vercel.json`

### SPRINT 3 — Módulo Tienda (2 semanas)

- [ ] **T-01**: Migrar productos de `products.ts` a tabla `products` en BD
- [ ] **T-02**: Crear tabla `product_variants` y migrar variantes
- [ ] **T-03**: Implementar API pública de productos con filtros y paginación
- [ ] **T-04**: Crear página individual de producto (`/tienda/[slug]`)
- [ ] **T-05**: Actualizar `tienda.astro` para leer de API en lugar de datos estáticos
- [ ] **T-06**: Agregar indicadores de stock en tienda y carrito
- [ ] **T-07**: Implementar reserva temporal de stock al crear orden

### SPRINT 4 — Módulo ERP (2-3 semanas)

- [ ] **E-01**: Implementar state machine de lotes
- [ ] **E-02**: Conectar trazabilidad pública a BD (reemplazar datos hardcodeados)
- [ ] **E-03**: Crear middleware de autorización por finca
- [ ] **E-04**: Implementar dashboard de KPIs de producción
- [ ] **E-05**: Crear formulario de cupping SCA
- [ ] **E-06**: Conectar módulo de finanzas con datos reales

### SPRINT 5 — Monitoreo y Observabilidad (1 semana)

- [ ] Integrar Sentry para error tracking
- [ ] Activar Vercel Analytics
- [ ] Configurar alertas de disponibilidad
- [ ] Agregar `npm audit` a CI/CD
- [ ] Documentar runbook de incidentes

---

## Notas Finales

- Este plan asume que la migración a PostgreSQL está completa (driver `pg` activo).
- Las fases se pueden paralelizar si hay múltiples desarrolladores.
- Antes de cada sprint, revisar paridad entre `server/index.js` y `api/index.js`.
- Todo cambio a tablas debe acompañarse de una migración en `server/migrations/`.
- Actualizar `AGENTS.md` y `CHANGELOG.md` al cerrar cada sprint.
