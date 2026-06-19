# ✅ Checklist de Producción - Vercel + MercadoLibre

## Pre-Deploy Checklist

### 🗄️ Base de Datos

- [ ] Base de datos MySQL creada y accesible desde Vercel
- [ ] Tabla `sales_tracking` existe en la BD
- [ ] Todos los índices creados
- [ ] Backups automáticos configurados
- [ ] `DATABASE_URL` contiene credenciales correctas

**Verificar:**

```bash
mysql -u user -p -h host -e "SHOW TABLES LIKE 'sales_tracking';"
```

### 🔐 Variables de Entorno en Vercel

**Dashboard Vercel → Settings → Environment Variables**

```
DATABASE_URL=mysql://user:pass@host:port/dbname
JWT_SECRET=tu_secret_aqui
JWT_REFRESH_SECRET=tu_refresh_secret_aqui
ML_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxx
ML_SELLER_ID=123456789
SITE_BASE_URL=https://dobleyo.cafe
NODE_ENV=production
```

### 📦 Dependencias

- [ ] `npm install leaflet` ejecutado
- [ ] `package.json` contiene `leaflet@^1.9.4`
- [ ] `package-lock.json` actualizado
- [ ] Todas las dependencias están en `dependencies` (no en `devDependencies`)

**Verificar:**

```bash
npm list leaflet
grep "leaflet" package.json
```

### 🚀 Configuración de Vercel

#### `vercel.json`

- [ ] El archivo existe
- [ ] Contiene las rewrites para `/api/(.*)`
- [ ] Ruta `api/index.js` está presente

**Estado actual:**

```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/index.js" }]
}
```

#### `package.json`

- [ ] Script `build` existe: `astro build`
- [ ] Output directory: `dist/`
- [ ] Node.js version especificado (>=20)

### ✅ Código

#### `api/index.js`

- [ ] Importa todas las rutas necesarias
- [ ] ✅ Incluye `mercadolibreRouter`
- [ ] Exporta como default

#### `server/services/mercadolibre.js`

- [ ] Usa rutas absolutas para imports
- [ ] No depende de archivos locales (excepto db.js)
- [ ] Manejo de errores robusto

#### `server/routes/mercadolibre.js`

- [ ] Middleware de auth correcto
- [ ] Usa `db.query()` con estructura `.rows`
- [ ] Todas las respuestas en JSON

#### `server/auth.js`

- [ ] Exports `requireAuth` y `requireAdmin`
- [ ] Middleware exportado correctamente

### 📱 Frontend

#### Componentes React

- [ ] `SalesTable.jsx` usa `fetch()` con rutas relativas
- [ ] `SalesHeatmap.jsx` carga Leaflet correctamente
- [ ] No hay hardcoded URLs (usar rutas relativas)

#### Páginas Astro

- [ ] `src/pages/admin/index.astro` carga SalesTable
- [ ] `src/pages/admin/sales-map.astro` existe y carga mapa
- [ ] Componentes usan `client:load` o `client:only="react"`

#### CSS

- [ ] `public/assets/css/sales-table.css` importado
- [ ] No hay referencias a archivos locales no públicos

### 📊 Build

**En local, simular build de Vercel:**

```bash
npm run build
npm run preview
```

- [ ] Build completada sin errores
- [ ] Dist contiene archivos estáticos
- [ ] API endpoints accesibles

### 🧪 Testing en Producción

**Antes de hacer push a Vercel:**

1. Sincronización de ventas:

```bash
curl -X POST https://dobleyo.cafe/api/mercadolibre/sync \
  -H "Cookie: auth_token=your_token" \
  -H "Content-Type: application/json"
```

2. Obtener ventas:

```bash
curl https://dobleyo.cafe/api/mercadolibre/sales \
  -H "Cookie: auth_token=your_token"
```

3. Datos del mapa:

```bash
curl https://dobleyo.cafe/api/mercadolibre/heatmap-data \
  -H "Cookie: auth_token=your_token"
```

### 🚨 Posibles Problemas

| Problema          | Síntoma                | Solución                            |
| ----------------- | ---------------------- | ----------------------------------- |
| BD no conecta     | Error 500 en sync      | Verificar DATABASE_URL en Vercel    |
| Auth falla        | Error 401/403          | Verificar JWT_SECRET, cookies HTTPS |
| Leaflet no carga  | Mapa en blanco         | Verificar leaflet en package.json   |
| Datos no aparecen | Tabla vacía            | Sincronizar primero, verificar BD   |
| CORS error        | Error 403 en navegador | Verificar SITE_BASE_URL en Vercel   |

### 📋 Post-Deploy Verificación

**Después de hacer deploy a Vercel:**

1. **Acceso a admin:**

   - [ ] `/admin/` carga
   - [ ] Panel de admin visible
   - [ ] Tabla de ventas visible

2. **Sincronización:**

   - [ ] Botón "Sincronizar ventas" funciona
   - [ ] No hay errores de API
   - [ ] Datos se guardan en BD

3. **Visualización:**

   - [ ] Tabla muestra datos después de sincronizar
   - [ ] Paginación funciona
   - [ ] Filtros funcionan
   - [ ] Mapa en `/admin/sales-map` carga

4. **Monitoreo:**
   - [ ] Vercel logs sin errores críticos
   - [ ] BD responsive
   - [ ] No hay N+1 queries

---

## 🔧 Comandos Útiles

```bash
# Verificar dependencias
npm list leaflet

# Build local
npm run build

# Preview local (como Vercel)
npm run preview

# Check db en producción
mysql -u user -p -h host -e "SELECT COUNT(*) FROM sales_tracking;"

# Ver logs de Vercel
vercel logs --tail

# Redeploy en Vercel (sin cambios)
vercel --prod
```

---

## 📝 Notas Importantes

### Vercel Serverless Functions

- ✅ `api/index.js` es la función que maneja las rutas
- ✅ 10 segundo timeout por defecto (suficiente para sincronización)
- ✅ Sin estado entre invocaciones (stateless)

### Base de Datos

- ✅ Pool de conexiones MySQL (5 conexiones)
- ⚠️ Vercel puede tener latencia de red con BD remota
- ⚠️ Asegúrate que BD tiene suficiente capacidad

### Moneda y Localización

- ✅ Todas las fechas en UTC
- ✅ Formateo de COP en cliente (navegador)
- ✅ Sin problemas de zona horaria

---

## 🎯 Estado Final

**✅ Listo para producción cuando:**

- [ ] Todas las variables de entorno en Vercel
- [ ] BD creada y accesible
- [ ] `npm run build` sin errores
- [ ] Testing local en `npm run preview` exitoso
- [ ] Primer deploy de prueba sin errores
- [ ] Sincronización y datos funcionando en Vercel

---

## 📞 Troubleshooting Rápido

**Si algo falla después de deploy:**

1. **Verifica logs:**

   ```
   Vercel Dashboard → Deployments → Logs
   ```

2. **Revisa variables de entorno:**

   ```
   Vercel Dashboard → Settings → Environment Variables
   ```

3. **Prueba la BD:**

   ```bash
   mysql -u user -p -h host dbname -e "SELECT 1;"
   ```

4. **Rollback si es necesario:**
   ```
   Vercel Dashboard → Deployments → Clic en anterior → Promote
   ```

---

**Última actualización:** 6 de enero de 2026
