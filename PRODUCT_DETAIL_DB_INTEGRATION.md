# Integración de Páginas de Producto con Base de Datos

## Resumen

Las páginas de detalle de producto ahora están **configuradas para obtener datos de la base de datos** en lugar de usar solo datos estáticos.

## Arquitectura

### 1. Endpoint API Público (`/api/products/:id`)

**Archivo:** `server/routes/public-products.js`

Este endpoint **no requiere autenticación** y está diseñado para ser consumido por el frontend público. Devuelve:

- Información completa del producto (tabla `products`)
- Información del lote asociado si es café (tabla `lots`)
- Solo productos activos (`is_active = 1`)

**Endpoints disponibles:**
- `GET /api/products/:id` - Obtener un producto por ID
- `GET /api/products?category=cafe&limit=50` - Listar productos activos

### 2. Página Dinámica de Producto

**Archivo:** `src/pages/producto/[slug].astro`

**Configuración:**
```astro
export const prerender = false; // SSR habilitado
```

**Flujo de datos:**

1. **Intenta obtener datos de la API:**
   ```javascript
   const response = await fetch(`${API_URL}/products/${slug}`);
   ```

2. **Si es café, obtiene perfil de taza desde la tabla `lots`:**
   - Aroma (`aroma`)
   - Notas de sabor (`flavor_notes`)
   - Acidez (`acidity`)
   - Cuerpo (`body`)
   - Balance (`balance`)
   - Puntuación (`score`)
   - Información de trazabilidad (finca, productor, altura, variedad)

3. **Fallback a datos estáticos:** Si la API no responde, usa datos de `src/data/products.ts`

### 3. Componentes de Vista

**Para Cafés:** `CoffeeDetail.jsx`
- Muestra perfil de taza completo desde BD
- Información de trazabilidad
- Selector de molido
- Compatible con datos de BD y estáticos

**Para Accesorios:** `AccessoryDetail.jsx`
- Vista estilo Amazon
- Especificaciones técnicas
- Características y beneficios
- Compatible con datos de BD y estáticos

## Mapeo de Campos BD → Frontend

### Productos (tabla `products`)

| Campo BD | Propiedad Frontend | Notas |
|----------|-------------------|-------|
| `id` | `id` | Identificador único |
| `name` | `name` | Nombre del producto |
| `description` | `description` | Descripción larga |
| `category` | `category` | 'cafe', 'accesorio', 'merchandising' |
| `subcategory` | `origin` (cafés) | Para cafés: región de origen |
| `origin` | `origin` | Origen del café |
| `process` | `process` | Método de procesamiento |
| `roast` | `roast` | Nivel de tueste |
| `price` | `price` | Precio en COP (entero) |
| `rating` | `rating` | Calificación (decimal 0-5) |
| `is_deal` | `deal` | Producto en oferta |
| `is_bestseller` | `bestseller` | Producto más vendido |
| `is_new` | `new` | Producto nuevo |
| `is_fast` | `fast` | Envío rápido |
| `image_url` | `image` | URL de imagen principal |

### Lotes (tabla `lots`)

| Campo BD | Uso en Frontend |
|----------|----------------|
| `aroma` | Perfil de taza - Aroma |
| `flavor_notes` | Perfil de taza - Notas de sabor |
| `acidity` | Perfil de taza - Acidez |
| `body` | Perfil de taza - Cuerpo |
| `balance` | Perfil de taza - Balance |
| `score` | Puntuación (0-100) |
| `farm` | Trazabilidad - Finca |
| `producer` | Trazabilidad - Productor |
| `altitude` | Trazabilidad - Altura |
| `variety` | Trazabilidad - Variedad |
| `process` | Proceso de café |
| `roast` | Nivel de tueste |

## Variables de Entorno

```bash
PUBLIC_API_URL=http://localhost:3000/api  # URL de la API
```

Para producción en Vercel:
```bash
PUBLIC_API_URL=https://tu-dominio.vercel.app/api
```

## Cómo Agregar Productos a la BD

### 1. Agregar un Producto (Café)

```sql
INSERT INTO products (
  id, name, description, category, subcategory,
  origin, process, roast, price, rating,
  is_active, is_bestseller, image_url
) VALUES (
  'cf-tolima',
  'Café Tolima',
  'Café de altura con notas frutales y cítricas',
  'cafe',
  'Tolima',
  'Tolima',
  'Lavado',
  'Medio',
  45000,
  4.8,
  1,
  1,
  'https://example.com/cafe-tolima.jpg'
);
```

### 2. Agregar Información del Lote (Perfil de Taza)

```sql
INSERT INTO lots (
  code, name, origin, farm, producer,
  altitude, variety, process, roast,
  aroma, flavor_notes, acidity, body, balance,
  score, product_id
) VALUES (
  'TOL-2025-001',
  'Tolima Premium',
  'Tolima',
  'Finca El Mirador',
  'Pedro García',
  '1800-2100 msnm',
  'Caturra, Colombia',
  'Lavado',
  'Medio',
  'Frutal, cítrico',
  'Naranja, mandarina, caramelo',
  'Alta, brillante',
  'Medio, sedoso',
  'Excelente',
  88.5,
  'cf-tolima'
);
```

### 3. Agregar un Accesorio

```sql
INSERT INTO products (
  id, name, description, category,
  price, rating, is_active, image_url,
  dimensions, weight
) VALUES (
  'acc-prensa',
  'Prensa Francesa 1L',
  'Prensa francesa de vidrio borosilicato',
  'accesorio',
  89900,
  4.6,
  1,
  'https://example.com/prensa.jpg',
  '15 x 10 x 25 cm',
  '600g'
);
```

## Endpoints API Disponibles

### Productos Públicos

```bash
# Obtener un producto
GET /api/products/:id

# Listar productos activos
GET /api/products?category=cafe&limit=50

# Respuesta:
{
  "success": true,
  "product": { ... },
  "lot": { ... }  // Solo para cafés
}
```

### Inventario (Requiere autenticación admin)

```bash
# CRUD completo de productos
GET    /api/inventory/products
GET    /api/inventory/products/:id
POST   /api/inventory/products
PUT    /api/inventory/products/:id
DELETE /api/inventory/products/:id
```

## Estado Actual

✅ **Implementado:**
- Endpoint API público sin autenticación
- Página dinámica con SSR
- Obtención de datos de productos desde BD
- Obtención de perfil de taza desde tabla `lots`
- Fallback a datos estáticos si la BD no está disponible
- Compatibilidad con ambos formatos de datos

⚠️ **Pendiente:**
- Sincronizar datos estáticos con BD al desplegar
- Agregar caché para mejorar rendimiento
- Implementar búsqueda de productos relacionados
- Galería de imágenes múltiples desde BD

## Testing

Para probar la integración:

1. **Iniciar servidor:**
   ```bash
   cd server
   npm run dev
   ```

2. **Iniciar Astro:**
   ```bash
   npm run dev
   ```

3. **Probar endpoints:**
   ```bash
   curl http://localhost:3000/api/products/cf-sierra
   ```

4. **Visitar páginas:**
   - http://localhost:4321/producto/cf-sierra (café)
   - http://localhost:4321/producto/acc-molinillo (accesorio)

## Notas Importantes

- Las páginas usan **SSR (Server-Side Rendering)** para consultar la BD en cada request
- Si la API no está disponible, se usa fallback con datos estáticos
- Los componentes son compatibles con ambos formatos (BD y estáticos)
- El endpoint `/api/products` es público y no requiere autenticación
- Los precios se almacenan como enteros (centavos) en la BD
