# 🚀 GUÍA RÁPIDA: Inicio de Módulo de Producción

## ⚡ Inicio en 5 Minutos

### 1️⃣ Preparar Base de Datos (2 minutos)

```bash
# Conectar a MySQL y ejecutar schema
mysql -u root -p

# Dentro de MySQL:
USE dobleyo;
SOURCE db/schema.sql;
SOURCE db/seed_data.sql;
SOURCE db/verify_production_module.sql;
```

### 2️⃣ Verificar Datos (1 minuto)

```bash
# Abrir navegador y verificar:
mysql -u root -p dobleyo < db/verify_production_module.sql
```

### 3️⃣ Iniciar Servidor (1 minuto)

```bash
# Terminal 1: Iniciar servidor Node.js
cd /home/mike/dev/work/github.com/dobleyo
node server/index.js

# Debería mostrar:
# 🏭 DobleYo Coffee ERP Server
# ✅ Servidor iniciado en puerto 3000
# 🏭 Producción: http://localhost:3000/api/production
```

### 4️⃣ Verificar API (1 minuto)

```bash
# Terminal 2: Probar endpoints
curl http://localhost:3000/api/production/orders | jq

# Debería retornar lista de órdenes (vacía o con datos de seed)
```

---

## 🧪 Testing

### Ejecutar Suite de Pruebas Completa

```bash
# Terminal 2
bash test_production_apis.sh

# Ejecutará 19 pruebas de todos los endpoints
# Creará orden, batch, inspecciones y verificará dashboard
```

### Probar Endpoint Individual

```bash
# Listar órdenes
curl http://localhost:3000/api/production/orders

# Ver dashboard
curl http://localhost:3000/api/production/dashboard | jq

# Crear orden
curl -X POST http://localhost:3000/api/production/orders \
  -H "Content-Type: application/json" \
  -d '{
    "bom_id": 1,
    "product_id": "CAFE-TOSTADO-001",
    "planned_quantity": 50,
    "scheduled_date": "2026-01-24"
  }' | jq
```

---

## 📊 Monitoreo

### Dashboard del Sistema

```bash
# Terminal 3: Monitorar logs
tail -f server.log

# Terminal 4: Monitorar base de datos
watch -n 2 "mysql -u root -p dobleyo -e 'SELECT COUNT(*) as orders FROM production_orders; SELECT COUNT(*) as batches FROM roast_batches;'"
```

### Estadísticas en Tiempo Real

```bash
# Ver órdenes activas
curl http://localhost:3000/api/production/orders?state=en_progreso

# Ver batches completados hoy
curl http://localhost:3000/api/production/batches?date_from=2026-01-23

# Ver calidad
curl http://localhost:3000/api/production/quality/stats/summary

# Ver KPIs
curl http://localhost:3000/api/production/dashboard | jq .data
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'express'"

```bash
# Instalar dependencias
npm install
npm install express mysql2 uuid cors
```

### Error: "Connection refused"

```bash
# Verificar MySQL está running
sudo systemctl status mysql

# O iniciar MySQL
sudo systemctl start mysql
```

### Error: "Table doesn't exist"

```bash
# Re-ejecutar schema
mysql -u root -p dobleyo < db/schema.sql
mysql -u root -p dobleyo < db/seed_data.sql
```

### Error: "Port 3000 in use"

```bash
# Cambiar puerto en server/index.js
# O matar proceso anterior
sudo lsof -i :3000
sudo kill -9 <PID>
```

---

## 📁 Estructura de Archivos Clave

```
/api/production/
├── orders.js          ← Gestión de órdenes
├── batches.js         ← Monitoreo de tostado
├── quality.js         ← Control de calidad
├── dashboard.js       ← KPIs y analytics
└── index.js           ← Router principal

/db/
├── schema.sql         ← Estructura de tablas (42 tablas)
├── seed_data.sql      ← Datos iniciales
└── verify_production_module.sql  ← Verificación

/
├── PRODUCTION_API_DOCS.md         ← Documentación endpoints
├── PRODUCTION_SUMMARY.md          ← Resumen ejecutivo
├── test_production_apis.sh        ← Suite de pruebas
└── QUICK_START.md                 ← Este archivo
```

---

## 🎯 Casos de Uso Principales

### Caso 1: Crear Orden y Ejecutarla

```bash
# 1. Crear
ORDER_ID=$(curl -s -X POST http://localhost:3000/api/production/orders \
  -H "Content-Type: application/json" \
  -d '{
    "bom_id": 1,
    "product_id": "CAFE-TOSTADO-001",
    "planned_quantity": 50
  }' | jq -r '.data.id')

# 2. Confirmar → Iniciar
curl -X POST http://localhost:3000/api/production/orders/$ORDER_ID/confirm
curl -X POST http://localhost:3000/api/production/orders/$ORDER_ID/start

# 3. Crear batch
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/production/batches \
  -H "Content-Type: application/json" \
  -d "{
    \"production_order_id\": $ORDER_ID,
    \"roasting_equipment_id\": 1,
    \"green_coffee_lot_id\": 1,
    \"green_coffee_weight_kg\": 50,
    \"operator_id\": 4
  }" | jq -r '.data.id')

# 4. Registrar tostado
curl -X POST http://localhost:3000/api/production/batches/$BATCH_ID/first-crack \
  -H "Content-Type: application/json" \
  -d '{"time_minutes": 8, "temperature_celsius": 195}'

curl -X POST http://localhost:3000/api/production/batches/$BATCH_ID/second-crack \
  -H "Content-Type: application/json" \
  -d '{"time_minutes": 11}'

# 5. Completar tostado
curl -X POST http://localhost:3000/api/production/batches/$BATCH_ID/complete \
  -H "Content-Type: application/json" \
  -d '{
    "roasted_coffee_weight_kg": 42.75,
    "drop_temperature_celsius": 205,
    "color_agtron": 65,
    "quality_score": 8.5
  }'

# 6. Catación
curl -X POST http://localhost:3000/api/production/quality/cupping \
  -H "Content-Type: application/json" \
  -d "{
    \"roast_batch_id\": $BATCH_ID,
    \"inspector_id\": 3,
    \"aroma_score\": 8.5,
    \"flavor_score\": 8.75,
    \"acidity_score\": 8.5,
    \"body_score\": 8.25,
    \"balance_score\": 8.5,
    \"aftertaste_score\": 8.25,
    \"sweetness_score\": 8,
    \"uniformity_score\": 8.75,
    \"clean_cup_score\": 9
  }"

# 7. Completar orden
curl -X POST http://localhost:3000/api/production/orders/$ORDER_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"produced_quantity": 42.75}'
```

### Caso 2: Pausar y Reanudar Orden

```bash
# Pausar
curl -X POST http://localhost:3000/api/production/orders/1/pause

# Después...
# Reanudar
curl -X POST http://localhost:3000/api/production/orders/1/resume
```

### Caso 3: Cancelar Orden

```bash
curl -X POST http://localhost:3000/api/production/orders/1/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Equipo averiado"}'
```

---

## 📊 Ejemplos de Respuestas

### GET /orders

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_number": "ORD-245670",
      "product_name": "Colombiano Huila 500g - Medio",
      "state": "en_progreso",
      "planned_quantity": 50,
      "produced_quantity": 0,
      "created_at": "2026-01-23T10:00:00Z"
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 1 }
}
```

### GET /dashboard

```json
{
  "success": true,
  "data": {
    "orders_today": {
      "total": 8,
      "completed": 5,
      "in_progress": 2,
      "pending": 1,
      "completion_percentage": 62
    },
    "production_today": {
      "total_kg": 125.5,
      "total_batches": 8,
      "avg_loss_percentage": 14.2
    },
    "quality_today": {
      "total_checks": 8,
      "passed": 7,
      "failed": 1,
      "pass_rate": 87
    }
  }
}
```

---

## ✨ Próximos Pasos

1. ✅ **Hoy**: Ejecutar seed_data.sql y probar endpoints
2. 📅 **Mañana**: Crear frontend para órdenes y batches
3. 📊 **Esta semana**: Implementar WebSockets para actualizaciones real-time
4. 💰 **Próxima semana**: Iniciar módulo financiero (facturas, pagos)
5. 🚀 **Mes**: Integración MercadoLibre

---

## 🆘 Soporte

### Documentación

- [PRODUCTION_API_DOCS.md](PRODUCTION_API_DOCS.md) - Referencia completa de endpoints
- [PRODUCTION_SUMMARY.md](PRODUCTION_SUMMARY.md) - Resumen ejecutivo

### Testing

- [test_production_apis.sh](test_production_apis.sh) - Suite de pruebas automáticas

### Verificación

- [verify_production_module.sql](verify_production_module.sql) - Queries de diagnóstico

### Logs

```bash
# Ver logs en tiempo real
tail -f server.log

# Buscar errores específicos
grep ERROR server.log
```

---

## ✅ Checklist Inicial

- [ ] Ejecutar `db/schema.sql`
- [ ] Ejecutar `db/seed_data.sql`
- [ ] Ejecutar `db/verify_production_module.sql` (ver resultados OK)
- [ ] Iniciar servidor: `node server/index.js`
- [ ] Probar: `curl http://localhost:3000/api/production/orders`
- [ ] Ejecutar suite de pruebas: `bash test_production_apis.sh`
- [ ] Ver dashboard: `curl http://localhost:3000/api/production/dashboard | jq`
- [ ] Revisar documentación: [PRODUCTION_API_DOCS.md](PRODUCTION_API_DOCS.md)

---

**¡Listo! El módulo de producción está listo para usar. 🎉**

Para documentación detallada: [PRODUCTION_API_DOCS.md](PRODUCTION_API_DOCS.md)
