# 🐛 Troubleshooting - Integración MercadoLibre

## Problemas Comunes y Soluciones

### 1. Error: "MercadoLibre credentials not configured"

**Síntoma:**

```
{
  "error": "MercadoLibre credentials not configured",
  "details": "Please set ML_ACCESS_TOKEN and ML_SELLER_ID environment variables"
}
```

**Causas:**

- Faltan variables de entorno
- Variables mal escritas
- Servidor no ha sido reiniciado después de agregar .env

**Soluciones:**

1. Verifica tu archivo `.env`:

   ```bash
   grep -E "ML_ACCESS_TOKEN|ML_SELLER_ID" .env
   ```

2. Si no están, agrégalas:

   ```env
   ML_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxx
   ML_SELLER_ID=123456789
   ```

3. **Reinicia el servidor:**

   ```bash
   npm run dev
   # o
   npm run server
   ```

4. Si sigue sin funcionar, verifica en Node.js:
   ```bash
   node -e "console.log(process.env.ML_ACCESS_TOKEN)"
   # Debe mostrar tu token, no "undefined"
   ```

---

### 2. Error 401/403 en API de MercadoLibre

**Síntoma:**

```
Error: MercadoLibre API error: 401
# o
Error: MercadoLibre API error: 403
```

**Causas:**

- Access Token inválido o expirado
- Access Token con scopes insuficientes
- Usando un token de test en producción

**Soluciones:**

1. Verifica que el token sea válido:

   - No debe tener espacios antes/después
   - Debe empezar con `APP_USR-`

2. Regenera el token en MercadoLibre:

   - Ve a https://apps.mercadolibre.com/
   - Selecciona tu app
   - Revoca el antiguo token
   - Genera uno nuevo

3. Verifica los scopes:

   - `orders:read` - ✅ Requerido
   - `shipments:read` - ✅ Requerido
   - Otros pueden ser opcionales

4. Asegúrate de estar usando producción, no sandbox:

   ```javascript
   // ❌ SANDBOX (para tests)
   this.baseUrl = "https://api.sandbox.mercadolibre.com";

   // ✅ PRODUCCIÓN (lo correcto)
   this.baseUrl = "https://api.mercadolibre.com";
   ```

---

### 3. Tabla `sales_tracking` no existe

**Síntoma:**

```
SQL Error: Table 'dobleyo_db.sales_tracking' doesn't exist
# o
ER_NO_SUCH_TABLE
```

**Soluciones:**

1. Verifica que la tabla existe:

   ```sql
   SHOW TABLES LIKE 'sales_tracking';
   ```

2. Si no existe, créala:

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

3. Verifica que la conexión a BD es correcta:
   ```bash
   mysql -h localhost -u usuario -p base_datos -e "SHOW TABLES;"
   ```

---

### 4. Módulo 'leaflet' no encontrado

**Síntoma:**

```
Cannot find module 'leaflet'
# o
Module not found: Can't resolve 'leaflet'
```

**Soluciones:**

1. Instala Leaflet:

   ```bash
   npm install leaflet
   ```

2. Verifica que está en package.json:

   ```bash
   grep "leaflet" package.json
   ```

3. Limpia node_modules y reinstala:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. Reinicia el servidor:
   ```bash
   npm run dev
   ```

---

### 5. Página del mapa en blanco (sin datos)

**Síntoma:**

- Mapa carga pero está en blanco
- No hay círculos de datos
- Console muestra datos = []

**Causas:**

- No hay órdenes sincronizadas
- Las órdenes no tienen coordenadas
- Error al traer datos del endpoint

**Soluciones:**

1. Verifica que hay datos sincronizados:

   ```bash
   # En navegador, consola
   fetch('/api/mercadolibre/sales').then(r => r.json()).then(d => console.log(d))
   ```

2. Si está vacío, sincroniza primero:

   - Ve a `/admin/`
   - Haz clic en "🔄 Sincronizar ventas"
   - Espera a que termine

3. Si sigue vacío, verifica el endpoint:

   ```bash
   curl -H "Authorization: Bearer token" \
        http://localhost:4000/api/mercadolibre/heatmap-data
   ```

4. Revisa los logs del servidor (busca "heatmap-data" o errores)

---

### 6. Tabla de ventas vacía después de sincronizar

**Síntoma:**

- Sincronización dice "success"
- Pero la tabla no muestra datos

**Causas:**

- Errores silenciosos en transformación
- Órdenes sin detalles completos
- Errores en inserción a BD

**Soluciones:**

1. Revisa la consola del navegador (F12):

   ```
   Busca cualquier error en rojo
   ```

2. Revisa los logs del servidor:

   ```
   Busca "Error processing order" o similares
   ```

3. Verifica que tienes órdenes en MercadoLibre:

   ```bash
   # Llamada manual a API
   curl -H "Authorization: Bearer $ML_ACCESS_TOKEN" \
        "https://api.mercadolibre.com/orders/search?seller_id=$ML_SELLER_ID&limit=5"
   ```

4. Verifica la BD directamente:
   ```sql
   SELECT COUNT(*) FROM sales_tracking;
   SELECT * FROM sales_tracking LIMIT 5;
   ```

---

### 7. Error 403 en endpoints (Permisos insuficientes)

**Síntoma:**

```
{
  "error": "Permisos insuficientes"
}
```

**Causas:**

- Usuario no es admin
- Token expirado
- Cookie de sesión no activa

**Soluciones:**

1. Verifica que estás logueado como admin:

   - Abre `/login`
   - Usa credenciales de admin
   - Verifica el rol en BD

2. Verifica en la BD:

   ```sql
   SELECT id, email, role FROM users WHERE email='tu_email@example.com';
   ```

3. Cambia el rol si es necesario:

   ```sql
   UPDATE users SET role='admin' WHERE email='tu_email@example.com';
   ```

4. Cierra sesión y vuelve a loguear

---

### 8. Mapa muestra toda las ciudades en Buenos Aires

**Síntoma:**

- Todos los círculos están en Buenos Aires
- Incluso aunque dice "Córdoba", "Mendoza", etc.

**Causas:**

- La ciudad no está en el diccionario de coordenadas
- Fallback a Buenos Aires se activa

**Soluciones:**

1. Revisa qué ciudades hay en el diccionario:

   ```javascript
   // Ver: server/services/mercadolibre.js
   // Método: getApproximateCoordinates()
   ```

2. Agrega la ciudad faltante:

   ```javascript
   const cityCoordinates = {
     // ...
     "mi-ciudad": { lat: -32.123, lng: -64.456 },
     // ...
   };
   ```

3. Para una solución permanente, integra geocoding real:
   - Google Maps API
   - OpenStreetMap Nominatim
   - Mapbox

---

### 9. Performance lento en tabla de ventas

**Síntoma:**

- Tabla tarda mucho en cargar
- Filtros son lentos
- Muchas órdenes (>5000)

**Soluciones:**

1. Aumenta el límite de paginación:

   - Cambiar en SalesTable.jsx: `limit = 20` → `limit = 50`

2. Agrega más índices si es necesario:

   ```sql
   CREATE INDEX idx_sales_date_range ON sales_tracking(purchase_date, recipient_city);
   CREATE INDEX idx_sales_status ON sales_tracking(order_status);
   ```

3. Archiva órdenes antiguas en tabla separada

4. Implementa caché en Redis (avanzado)

---

### 10. CORS Error desde navegador

**Síntoma:**

```
Access to XMLHttpRequest at 'http://localhost:4000/api/mercadolibre/...'
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Causas:**

- CORS no configurado correctamente
- Dominio no está en la lista blanca

**Soluciones:**

1. Verifica CORS en server/index.js:

   ```javascript
   app.use(
     cors({
       origin: process.env.SITE_BASE_URL || "https://dobleyo.cafe",
       credentials: true,
     })
   );
   ```

2. Para desarrollo local, agrega:

   ```javascript
   const corsOptions = {
     origin:
       process.env.NODE_ENV === "development" ? "*" : process.env.SITE_BASE_URL,
     credentials: true,
   };
   app.use(cors(corsOptions));
   ```

3. Reinicia el servidor después de cambios

---

### 11. "Unauthorized" en sincronización

**Síntoma:**

```
{
  "error": "Acceso denegado"
}
# o
{
  "error": "Permisos insuficientes"
}
```

**Soluciones:**

1. Asegúrate de estar logueado
2. Verifica que eres admin
3. Verifica que el token JWT no está expirado
4. Intenta cerrar sesión y volver a loguear

---

### 12. Errores en consola del navegador

**Síntoma:**

```
Failed to load resource: the server responded with a status of 404
# o
TypeError: Cannot read property '...' of undefined
```

**Soluciones:**

1. Abre F12 (Developer Tools)
2. Ve a la pestaña "Network"
3. Identifica la solicitud fallida
4. Verifica que el endpoint existe
5. Revisa los logs del servidor

---

## 🔍 Cómo Debuggear

### 1. Verificar credenciales

```bash
echo $ML_ACCESS_TOKEN
echo $ML_SELLER_ID
```

### 2. Probar endpoint directamente

```bash
curl -H "Cookie: auth_token=tu_token" \
     http://localhost:4000/api/mercadolibre/stats
```

### 3. Ver logs del servidor

```bash
# Si está en background
tail -f logs/app.log

# O mirar console mientras corre
npm run dev
```

### 4. Verificar BD

```bash
mysql -u user -p database
SELECT * FROM sales_tracking LIMIT 1;
```

### 5. Test en navegador

```javascript
// Console de navegador (F12)
fetch("/api/mercadolibre/sales")
  .then((r) => r.json())
  .then((d) => console.table(d.data))
  .catch((e) => console.error(e));
```

---

## 📞 Próximos Pasos

Si ninguna solución funciona:

1. **Revisa el código:**

   - `server/services/mercadolibre.js`
   - `server/routes/mercadolibre.js`
   - `src/components/SalesTable.jsx`

2. **Busca mensajes de error:**

   - Consola del navegador (F12)
   - Logs del servidor (console.log)
   - Logs de BD (MySQL)

3. **Haz preguntas específicas:**
   - Qué endpoint falla
   - Qué código de error devuelve
   - Qué logs muestran

---

**Última actualización:** 6 de enero de 2026
