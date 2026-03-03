# Guía Maestra de Setup — DobleYo Café

> Guía completa para configurar la base de datos y poner en marcha el proyecto desde cero.  
> Todos los scripts están migrados a PostgreSQL. No se requiere MySQL.

---

## Requisitos Previos

| Requisito | Versión |
|---|---|
| Node.js | >= 20 |
| PostgreSQL | >= 14 |
| npm | >= 9 |

### Proveedores de PostgreSQL compatibles
- **Neon** (recomendado, free tier) — neon.tech
- **Supabase** — supabase.com
- **Railway** — railway.app  
- **Local** — `brew install postgresql` / `apt install postgresql`

---

## Paso 1: Variables de Entorno

Copia `.env.example` a `.env` en la raíz del proyecto y completa los valores:

```bash
cp .env.example .env
```

**Variables obligatorias para setup:**

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/dobleyo` |
| `JWT_SECRET` | Secreto para access tokens (min 32 chars) | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens (min 32 chars) | `openssl rand -base64 48` |
| `ADMIN_EMAIL` | Email del admin inicial | `admin@dobleyo.cafe` |
| `ADMIN_PASSWORD` | Password del admin inicial (min 12 chars) | `contraseña_segura_12+` |
| `SETUP_SECRET_KEY` | Clave para proteger el endpoint `/api/setup` | `string_aleatorio_largo` |

**Variables opcionales (agregar después):**

| Variable | Módulo |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email transaccional |
| `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET` | Pagos Wompi (Colombia) |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` | Pagos MercadoPago |
| `ML_ACCESS_TOKEN`, `ML_SELLER_ID` | Sync MercadoLibre |

---

## Paso 2: Instalar Dependencias

```bash
npm install
```

---

## Paso 3: Crear la Base de Datos

Elige **UNA** de las siguientes opciones:

### Opción A: Schema completo con `init_db.js` (RECOMENDADA)

Ejecuta el schema SQL maestro que crea **todas** las tablas (~40+):

```bash
node server/init_db.js
```

Este script lee `db/schema.sql` y ejecuta cada sentencia. Es idempotente (ignora errores de "ya existe").

### Opción B: Reset completo con `reset_database.js`

⚠️ **CUIDADO: Borra todas las tablas y las recrea desde cero.**

```bash
node server/reset_database.js
```

Hace `DROP TABLE ... CASCADE` de todas las tablas, luego aplica `db/schema.sql` + migraciones adicionales + crea el admin.

### Opción C: Vía interfaz web (setup-db)

1. Inicia el servidor: `npm run start`
2. Visita: `http://localhost:4000/setup-db`
3. Ingresa tu `SETUP_SECRET_KEY` y haz clic en "Configurar Base de Datos"

Esto llama a `POST /api/setup/full-setup` que crea tablas y admin.

### Opción D: Vía API directamente (curl)

```bash
curl -X POST http://localhost:4000/api/setup/full-setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_SETUP_SECRET_KEY" \
  -d '{}'
```

---

## Paso 4: Crear Usuario Administrador

Si usaste la Opción A (`init_db.js`), necesitas crear el admin por separado:

```bash
node server/create_admin.js
```

Usa las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`.

> Las opciones B, C y D ya crean el admin automáticamente.

---

## Paso 5: Datos de Ejemplo (Opcional)

### Productos de tienda
```bash
node server/seed_products.js
```
Inserta los 5 productos del catálogo (3 cafés + 2 accesorios).

### Inventario y proveedores
```bash
node server/seed_inventory.js
```
Crea datos de inventario, movimientos, proveedores y relaciones.

### Seed data completo
```bash
psql "$DATABASE_URL" -f db/seed_data.sql
```
Inserta usuarios de prueba, equipos, centros de trabajo, materias primas, lotes, curvas de tostión, etc. (331 líneas de datos).

---

## Paso 6: Migraciones Adicionales (Opcional)

Solo necesarias si ejecutaste el schema base y quieres agregar tablas de módulos específicos:

| Script | Módulo | Qué hace |
|---|---|---|
| `node server/migrations/create_coffee_tables.js` | Trazabilidad | 6 tablas del pipeline de café |
| `node server/migrations/run_coffee_migration.js` | Trazabilidad | Alternativa al anterior (mismas tablas) |
| `node server/migrations/create_inventory_tables.js` | Inventario | Extiende `products` + crea `inventory_movements`, `product_suppliers` |
| `node server/migrations/create_labels_tables.js` | Etiquetas | Tablas de etiquetas y templates QR |
| `node server/migrations/add_labels_tables.js` | Etiquetas | Alternativa al anterior |
| `node server/migrations/create_customer_orders.js` | Órdenes | Tablas `orders` y `order_items` |
| `node server/migrations/create_farms_table.js` | Fincas | Tabla `farms` |
| `node server/migrations/create_finance_tables.js` | Finanzas | ~15 tablas de contabilidad |
| `node server/migrations/add_roast_fields.js` | Tostión | Campos extra en tabla `lots` |
| `node server/migrations/add_origin_fields_to_coffee_harvests.js` | Trazabilidad | Campos `region` y `altitude` |
| `node server/migrations/split_name_fields.js` | Usuarios | Migra `name` → `first_name` + `last_name` |
| `node server/migrations/add_geocoding_to_orders.js` | Órdenes | Campos de geocodificación |

> **Nota**: Si usaste `reset_database.js` (Opción B), ya ejecuta automáticamente: `create_customer_orders`, `create_farms_table`, `create_finance_tables`, y `split_name_fields`.

> **Nota**: El schema completo (`db/schema.sql`) ya incluye las definiciones de la mayoría de estas tablas, así que las migraciones solo son necesarias para agregar campos o índices que no estén en el schema.

---

## Paso 7: Iniciar el Servidor

### Desarrollo (Astro + hot reload)
```bash
npm run dev
```
Corre en `http://localhost:4321` (Astro dev server).

### Producción local (Express standalone)
```bash
npm run start
```
Corre en `http://localhost:4000` (Express con todas las rutas API).

### Build para Vercel
```bash
npm run build
```

---

## Paso 8: Verificar

1. **Health check**: `curl http://localhost:4000/api/health`
2. **Login admin**: Visita `/login` con las credenciales de `ADMIN_EMAIL`
3. **Tienda**: Visita `/tienda` para ver los productos
4. **Admin panel**: Visita `/admin/inventario` (requiere sesión admin)

---

## Resumen de Orden de Ejecución

### Instalación nueva (mínima)
```bash
cp .env.example .env          # 1. Configurar variables
nano .env                      #    completar valores
npm install                    # 2. Instalar dependencias
node server/init_db.js         # 3. Crear schema
node server/create_admin.js    # 4. Crear admin
node server/seed_products.js   # 5. Productos (opcional)
npm run start                  # 6. Iniciar servidor
```

### Instalación nueva (completa con datos de ejemplo)
```bash
cp .env.example .env
nano .env
npm install
node server/reset_database.js  # Schema + migraciones + admin
node server/seed_products.js   # Productos del catálogo
node server/seed_inventory.js  # Inventario y proveedores
psql "$DATABASE_URL" -f db/seed_data.sql  # Datos de prueba
npm run start
```

### Tests
```bash
npm test                       # Unit + integration tests (Vitest)
npm run test:e2e               # E2E tests (Playwright)
npm run test:coverage          # Coverage report
```

---

## Solución de Problemas

| Error | Causa | Solución |
|---|---|---|
| `ECONNREFUSED` | PostgreSQL no disponible | Verificar `DATABASE_URL` y que PG esté corriendo |
| `relation "users" does not exist` | Schema no ejecutado | Ejecutar `node server/init_db.js` |
| `403 Unauthorized` en `/api/setup` | Falta `SETUP_SECRET_KEY` | Configurar en `.env` y pasar en header `Authorization: Bearer <key>` |
| `duplicate key value violates unique constraint` | Dato ya existe | Normal con scripts idempotentes, ignorar |
| `password authentication failed` | Credenciales PG incorrectas | Verificar user/password en `DATABASE_URL` |
| `SSL connection required` | Proveedor cloud requiere SSL | Agregar `?sslmode=require` al final de `DATABASE_URL` |
