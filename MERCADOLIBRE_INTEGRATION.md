# Integración MercadoLibre - Sistema de Sincronización de Ventas

## Descripción General

Este módulo integra la API de MercadoLibre con tu sistema de gestión de DobleYo Café, permitiendo:

1. **Sincronización de órdenes** desde MercadoLibre a tu base de datos
2. **Análisis comercial** con tabla de ventas interactiva
3. **Visualización geográfica** con mapa de calor de distribución de ventas

---

## Componentes Implementados

### 1. **Esquema de Base de Datos**

Nueva tabla `sales_tracking` con los siguientes campos:

- `id` - Identificador único
- `ml_order_id` - ID de la orden en MercadoLibre (único)
- `purchase_date` - Fecha y hora de la compra
- `total_amount` - Monto total en ARS
- `order_status` - Estado de la orden (pending, confirmed, shipped, delivered, cancelled)
- `shipping_method` - Método de envío utilizado
- `recipient_city` - Ciudad de destino
- `recipient_state` - Provincia/Estado
- `recipient_country` - País (default: AR)
- `recipient_zip_code` - Código postal
- `latitude` / `longitude` - Coordenadas aproximadas para mapping
- `products` - JSON con detalles de productos [id, title, quantity, unit_price, full_price]
- `sync_date` - Fecha de sincronización
- `updated_at` - Última actualización

### 2. **Servicio MercadoLibre** (`server/services/mercadolibre.js`)

Clase `MercadoLibreService` que proporciona:

#### Métodos públicos:

- `fetchOrders(sellerId)` - Obtiene órdenes del vendedor
- `fetchOrderDetails(orderId)` - Obtiene detalles completos de una orden
- `fetchShipment(shipmentId)` - Obtiene información de envío
- `transformOrderData(order, orderDetails, shipment)` - Transforma datos para BD
- `saveSalesData(salesData)` - Guarda datos en la BD (insert/update)
- `getSalesData(options)` - Recupera ventas con filtros
- `getSalesHeatmapData()` - Obtiene datos agregados por localidad

#### Características especiales:

- Base de coordenadas pre-cargada para principales ciudades argentinas
- Fallback a Buenos Aires si la ciudad no existe
- Manejo de errores robusto en cada nivel

### 3. **API Endpoints** (`server/routes/mercadolibre.js`)

#### POST `/api/mercadolibre/sync`

Sincroniza órdenes desde MercadoLibre a la BD local.

**Requerimientos:**

- Autenticación (usuario admin)
- Variables de entorno: `ML_ACCESS_TOKEN`, `ML_SELLER_ID`

**Response:**

```json
{
  "success": true,
  "message": "Synchronization completed",
  "processed": 45,
  "failed": 2,
  "saved": 40,
  "total_orders_fetched": 47
}
```

#### GET `/api/mercadolibre/sales`

Obtiene ventas guardadas con filtros y paginación.

**Query params:**

- `limit` (default: 50)
- `offset` (default: 0)
- `city` (opcional)
- `state` (opcional)
- `dateFrom` (opcional)
- `dateTo` (opcional)

**Response:**

```json
{
  "success": true,
  "data": [...ventas],
  "pagination": {
    "total": 143,
    "limit": 50,
    "offset": 0,
    "pages": 3
  }
}
```

#### GET `/api/mercadolibre/heatmap-data`

Obtiene datos agregados por ciudad para el mapa de calor.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "city": "Buenos Aires",
      "state": "Buenos Aires",
      "latitude": -34.6037,
      "longitude": -58.3816,
      "order_count": 45,
      "total_sales": 15450.50
    },
    ...
  ]
}
```

#### GET `/api/mercadolibre/stats`

Obtiene estadísticas generales y top 10 ciudades.

**Response:**

```json
{
  "success": true,
  "overview": {
    "total_orders": 143,
    "total_revenue": 45670.75,
    "avg_order_value": 319.38,
    "unique_cities": 28,
    "unique_states": 10,
    "first_order_date": "2024-01-15T10:30:00.000Z",
    "last_order_date": "2026-01-06T15:45:00.000Z"
  },
  "top_cities": [...]
}
```

### 4. **Componente React: Tabla de Ventas** (`src/components/SalesTable.jsx`)

Interfaz interactiva para:

- Ver todas las ventas sincronizadas
- Filtrar por ciudad, provincia, rango de fechas
- Sincronizar nuevas ventas con un clic
- Ver estadísticas en tarjetas resumen
- Expandir detalles de productos por orden
- Paginación intuitiva
- Top 10 ciudades con más pedidos

**Características:**

- Actualización en tiempo real
- Formateo de moneda local (ARS)
- Estados con badges de color
- Responsive design

### 5. **Componente React: Mapa de Calor** (`src/components/SalesHeatmap.jsx`)

Visualización geográfica interactiva usando Leaflet:

**Características:**

- Círculos de tamaño proporcional al volumen de pedidos
- Color gradual basado en intensidad de ventas:
  - 🔴 Rojo oscuro: 80%+ del máximo
  - 🔴 Rojo: 60-80%
  - 🟠 Naranja: 40-60%
  - 🟡 Amarillo claro: 20-40%
  - 💛 Crema: <20%
- Popup interactivo al hacer clic
- Tabla de top 10 ciudades
- Leyenda con explicaciones
- Centro automático en Argentina

### 6. **Páginas Astro**

#### `/admin/` - Panel principal

- Card de "Ventas MercadoLibre" + acceso directo a tabla
- Card de "Mapa de Ventas" + acceso al mapa
- Tabla de ventas integrada en scroll

#### `/admin/sales-map` - Página dedicada

- Mapa de calor en tamaño completo
- Estadísticas detalladas
- Guía de uso interactiva

---

## Configuración Requerida

### Variables de Entorno (`.env`)

```env
# MercadoLibre API Credentials
ML_ACCESS_TOKEN=your_mercadolibre_access_token
ML_SELLER_ID=your_mercadolibre_seller_id

# Database (ya existe)
DATABASE_URL=mysql://user:pass@host:port/dbname

# JWT (ya existe)
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
```

### Obtener Credenciales MercadoLibre

1. Ve a [Aplicaciones de Mercado Libre](https://apps.mercadolibre.com/)
2. Crea una nueva aplicación (si no tienes)
3. En configuración, genera un **Access Token** con permisos:
   - `orders:read`
   - `shipments:read`
4. Obtén tu **Seller ID** (número que aparece en tu URL de vendedor)

---

## Flujo de Sincronización

```
┌─────────────────────────────────────────────┐
│  Usuario hace clic en "Sincronizar ventas"  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────┐
        │ POST /api/mercadolibre/sync │
        └────────────┬────────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │ MercadoLibreService          │
      │ 1. Fetch orders (ML API)     │
      │ 2. Fetch order details       │
      │ 3. Fetch shipments           │
      │ 4. Transform data            │
      │ 5. Get coordinates by city   │
      └────────────┬─────────────────┘
                   │
                   ▼
      ┌──────────────────────────────┐
      │ Save to sales_tracking table │
      │ (Insert if new, Update if    │
      │  exists by ml_order_id)      │
      └────────────┬─────────────────┘
                   │
                   ▼
      ┌──────────────────────────────┐
      │ Return success response      │
      │ with counts                  │
      └──────────────────────────────┘
```

---

## Uso Típico

### 1. Sincronizar ventas

```bash
# En el panel admin, hacer clic en "🔄 Sincronizar ventas"
# Esto dispara: POST /api/mercadolibre/sync
```

### 2. Ver tabla de ventas

- Ve a `/admin/`
- Desplázate hasta la sección "Ventas desde MercadoLibre"
- Filtra por ciudad, provincia, fechas
- Haz clic en "Ver" para expandir productos

### 3. Analizar con mapa de calor

- Ve a `/admin/sales-map`
- Observa la distribución de tus ventas geográficamente
- Haz clic en círculos para ver detalles
- Consulta el ranking de top 10 ciudades

---

## Estructura de Productos en BD

Los productos se guardan como JSON en el campo `products`:

```json
[
  {
    "id": "MLC123456789",
    "title": "Café Dobleyo - Tostado Medio 250g",
    "quantity": 2,
    "unit_price": 350.0,
    "full_price": 700.0
  },
  {
    "id": "MLC987654321",
    "title": "Café Dobleyo - Tostado Oscuro 500g",
    "quantity": 1,
    "unit_price": 600.0,
    "full_price": 600.0
  }
]
```

---

## Limitaciones y Consideraciones

### Coordinadas

- Las coordenadas se generan a partir de un diccionario pre-cargado de ciudades argentinas
- Para ciudades no reconocidas, se usa Buenos Aires como fallback
- En producción, considera usar una API de geocoding (Google Maps, Nominatim)

### Rate Limiting

- MercadoLibre tiene límites de API (típicamente 1000 requests/hora)
- La sincronización procesa órdenes en lotes (actualmente 100 por llamada)
- Para múltiples sincronizaciones frecuentes, considera implementar cola (Bull, Bee-Queue)

### Seguridad

- ✅ Autenticación requerida (usuario admin)
- ✅ HTTPS en producción (Vercel enforces)
- ✅ Access token almacenado en env vars
- ❌ Actualmente el access token se pasa directamente - considera usar refresh tokens

### Performance

- Tabla de ventas: índices en `ml_order_id`, `purchase_date`, `recipient_city`, `recipient_state`
- Mapa de calor: agregación de datos con GROUP BY
- Para >10k órdenes, considera agregar índices adicionales o particionamiento

---

## Posibles Mejoras Futuras

1. **Sincronización automática**: Cron job cada 6 horas
2. **Notificaciones**: Alertar cuando hay pedidos de regiones específicas
3. **Análisis avanzado**: Gráficos de tendencias, predicciones
4. **Integración con inventario**: Restar stock automáticamente al recibir orden
5. **Exportación**: CSV, PDF de ventas por período
6. **Webhook**: Recibir notificaciones de nuevas órdenes en tiempo real
7. **Geocoding real**: Integrar Google Maps o Nominatim para precisión
8. **Multi-canal**: Expandir a otros marketplaces (Amazon, Shopify, etc.)

---

## Troubleshooting

### Error: "MercadoLibre credentials not configured"

**Solución:** Verifica que `ML_ACCESS_TOKEN` y `ML_SELLER_ID` estén en `.env`

### Las coordenadas muestran Buenos Aires para todas las ciudades

**Solución:** La ciudad no está en la lista de diccionario. Agrégala en `getApproximateCoordinates()`

### Tabla vacía aunque sincronizaste

1. Verifica que `sales_tracking` tabla existe: `SHOW TABLES;`
2. Revisa logs del servidor para errores en transformación
3. Verifica que tienes al menos 1 orden en MercadoLibre

### Mapa no carga

1. Verifica que `leaflet` está en `node_modules`
2. Abre consola del navegador (F12) para ver errores
3. Asegúrate que hay datos de ventas (`GET /api/mercadolibre/heatmap-data`)

---

## Archivo de Implementación

- **Esquema SQL**: `db/schema.sql`
- **Servicio**: `server/services/mercadolibre.js`
- **Rutas**: `server/routes/mercadolibre.js`
- **Tabla React**: `src/components/SalesTable.jsx`
- **Mapa React**: `src/components/SalesHeatmap.jsx`
- **Página Admin**: `src/pages/admin/index.astro`
- **Página Mapa**: `src/pages/admin/sales-map.astro`
- **CSS Tabla**: `public/assets/css/sales-table.css`

---

## Contacto & Soporte

Para preguntas o problemas, revisa los logs del servidor y la consola del navegador para mensajes de error específicos.
