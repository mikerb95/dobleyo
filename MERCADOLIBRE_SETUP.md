## Guía de Configuración Rápida - Integración MercadoLibre

### 1. Instalar dependencias nuevas

```bash
npm install leaflet
```

### 2. Actualizar base de datos

Ejecuta la nueva tabla SQL:

```bash
# Opción 1: Ejecutar manualmente en tu BD
mysql -u user -p database < db/schema.sql

# Opción 2: Copiar y ejecutar el comando SQL:
```

```sql
CREATE TABLE IF NOT EXISTS sales_tracking (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ml_order_id BIGINT NOT NULL UNIQUE,
    purchase_date DATETIME NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    order_status VARCHAR(80),
    shipping_method VARCHAR(120),
    recipient_city VARCHAR(160),
    recipient_state VARCHAR(160),
    recipient_country VARCHAR(120),
    recipient_zip_code VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(10,8),
    products JSON NOT NULL,
    sync_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_ml_order_id ON sales_tracking(ml_order_id);
CREATE INDEX idx_sales_purchase_date ON sales_tracking(purchase_date);
CREATE INDEX idx_sales_city ON sales_tracking(recipient_city);
CREATE INDEX idx_sales_state ON sales_tracking(recipient_state);
```

### 3. Configurar variables de entorno

Añade a tu archivo `.env`:

```env
# MercadoLibre API
ML_ACCESS_TOKEN=tu_token_aqui
ML_SELLER_ID=tu_seller_id_aqui
```

### 4. Obtener credenciales de MercadoLibre

Sigue estos pasos:

1. **Ir a https://apps.mercadolibre.com/**

2. **Inicia sesión con tu cuenta de vendedor**

3. **Crea una aplicación nueva (o usa una existente):**

   - Nombre: "DobleYo Sales Integration"
   - Tipo: "Web application"

4. **En la sección "Settings" o "OAuth":**

   - Autoriza los scopes:
     - `orders:read` (para leer órdenes)
     - `shipments:read` (para leer envíos)

5. **Genera Access Token:**

   - Haz click en "Generate tokens" o similar
   - Copia el Access Token
   - Úsalo en `.env` como `ML_ACCESS_TOKEN`

6. **Obtén tu Seller ID:**
   - Ve a tu perfil de vendedor
   - Tu ID está en la URL: `https://www.mercadolibre.com.ar/p/seller_id_here`
   - O en "Cuenta" > "Información de Vendedor"
   - Úsalo en `.env` como `ML_SELLER_ID`

### 5. Reiniciar servidor

```bash
# Si estás en desarrollo
npm run dev

# O para servidor productivo
npm run server
```

### 6. Acceder a la interfaz

1. **Panel admin:**

   - Ve a `http://localhost:3000/admin` (o tu URL)
   - Debe mostrarse la sección "Ventas MercadoLibre"

2. **Primera sincronización:**

   - Haz clic en el botón "🔄 Sincronizar ventas"
   - Espera a que finalice
   - Verás el resultado en pantalla

3. **Visualizar datos:**
   - Tabla de ventas en `/admin/`
   - Mapa de calor en `/admin/sales-map`

---

## Verificación Post-Instalación

### ✅ Checklist

- [ ] `npm install leaflet` ejecutado
- [ ] Nueva tabla `sales_tracking` creada
- [ ] `.env` contiene `ML_ACCESS_TOKEN`
- [ ] `.env` contiene `ML_SELLER_ID`
- [ ] Servidor reiniciado
- [ ] Puedes acceder a `/admin/`
- [ ] Botón "Sincronizar ventas" existe
- [ ] Primera sincronización completada
- [ ] Datos aparecen en tabla
- [ ] Mapa carga en `/admin/sales-map`

### 🐛 Si algo falla

1. **Error en sincronización:**

   ```
   "MercadoLibre credentials not configured"
   ```

   → Verifica `ML_ACCESS_TOKEN` y `ML_SELLER_ID` en `.env`

2. **Tabla no existe:**

   ```
   SQL Error: Table 'sales_tracking' doesn't exist
   ```

   → Ejecuta el comando SQL de la sección 2

3. **Módulo 'leaflet' no encontrado:**

   ```
   npm ERR! Can't find module 'leaflet'
   ```

   → Ejecuta `npm install leaflet`

4. **Mapa en blanco sin datos:**
   → Verifica que tienes órdenes sincronizadas: `GET /api/mercadolibre/sales`

---

## Próximos Pasos (Opcionales)

1. **Sincronización automática:**

   - Implementar cron job cada 6 horas
   - O usar servidor de colas (Bull, Bee-Queue)

2. **Notificaciones:**

   - Email cuando llega orden de región específica
   - Webhook a Slack/Discord

3. **Análisis avanzado:**

   - Gráficos de tendencias temporales
   - Predicción de demanda

4. **Integración con inventario:**
   - Restar automáticamente stock de productos

Ver documentación completa en: `MERCADOLIBRE_INTEGRATION.md`
