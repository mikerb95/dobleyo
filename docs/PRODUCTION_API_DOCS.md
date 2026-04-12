# 🏭 APIs de Producción - Documentación Completa

## 📍 Base URL

```
http://localhost:3000/api/production
```

---

## 📋 ÍNDICE DE ENDPOINTS

### Órdenes de Producción

- [GET /orders](#get-ordenes)
- [GET /orders/:id](#get-orden-detalle)
- [POST /orders](#post-crear-orden)
- [PUT /orders/:id](#put-actualizar-orden)
- [DELETE /orders/:id](#delete-eliminar-orden)
- [POST /orders/:id/confirm](#post-confirmar-orden)
- [POST /orders/:id/start](#post-iniciar-orden)
- [POST /orders/:id/pause](#post-pausar-orden)
- [POST /orders/:id/resume](#post-reanudar-orden)
- [POST /orders/:id/complete](#post-completar-orden)
- [POST /orders/:id/cancel](#post-cancelar-orden)

### Batches de Tostado

- [GET /batches](#get-batches)
- [GET /batches/:id](#get-batch-detalle)
- [POST /batches](#post-crear-batch)
- [POST /batches/:id/first-crack](#post-primer-crack)
- [POST /batches/:id/second-crack](#post-segundo-crack)
- [POST /batches/:id/complete](#post-completar-batch)
- [POST /batches/:id/approve](#post-aprobar-batch)
- [POST /batches/:id/reject](#post-rechazar-batch)
- [GET /batches/:id/comparison](#get-comparacion-batch)

### Control de Calidad

- [GET /quality](#get-inspecciones)
- [GET /quality/:id](#get-inspeccion-detalle)
- [POST /quality](#post-crear-inspeccion)
- [POST /quality/cupping](#post-catacion)
- [PUT /quality/:id](#put-actualizar-inspeccion)
- [POST /quality/:id/approve](#post-aprobar-inspeccion)
- [GET /quality/stats/summary](#get-estadisticas-calidad)

### Dashboard

- [GET /dashboard](#get-dashboard-principal)
- [GET /dashboard/efficiency](#get-eficiencia)
- [GET /dashboard/operators](#get-operadores)
- [GET /dashboard/alerts](#get-alertas)

---

## 🔍 DOCUMENTACIÓN DE ENDPOINTS

---

### ÓRDENES DE PRODUCCIÓN

#### <a name="get-ordenes"></a> GET /orders

Lista órdenes de producción con filtros

**Query Parameters:**

```
- state: 'borrador' | 'confirmada' | 'en_progreso' | 'pausada' | 'completada' | 'cancelada'
- work_center_id: número
- date_from: YYYY-MM-DD
- date_to: YYYY-MM-DD
- limit: número (default: 50)
- offset: número (default: 0)
```

**Ejemplo:**

```bash
curl -X GET 'http://localhost:3000/api/production/orders?state=en_progreso&limit=10'
```

**Respuesta:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_number": "ORD-245670",
      "product_name": "Colombiano Huila 500g - Medio",
      "planned_quantity": 50,
      "produced_quantity": 0,
      "state": "en_progreso",
      "priority": "normal",
      "scheduled_date": "2026-01-23",
      "responsible_user": "José García",
      "equipment_name": "Tostadora Giratoria 1",
      "created_at": "2026-01-23T10:00:00Z"
    }
  ],
  "pagination": { "limit": 10, "offset": 0, "total": 1 }
}
```

---

#### <a name="get-orden-detalle"></a> GET /orders/:id

Obtiene detalle completo de una orden

**Ejemplo:**

```bash
curl -X GET 'http://localhost:3000/api/production/orders/1'
```

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_number": "ORD-245670",
    "product_name": "Colombiano Huila 500g - Medio",
    "planned_quantity": 50,
    "produced_quantity": 0,
    "quantity_unit": "kg",
    "state": "en_progreso",
    "priority": "normal",
    "scheduled_date": "2026-01-23",
    "start_date": "2026-01-23T10:30:00Z",
    "end_date": null,
    "expected_loss_percentage": 14.5,
    "actual_loss_percentage": null,
    "production_cost": 0,
    "components": [
      {
        "id": 1,
        "component_name": "Café Verde Colombiano Huila",
        "quantity": 1.2,
        "quantity_unit": "kg",
        "stock_quantity": 500,
        "component_type": "materia_prima"
      }
    ],
    "batches": [
      {
        "id": 1,
        "batch_number": "BATCH-356789",
        "green_coffee_weight_kg": 50,
        "roasted_coffee_weight_kg": 42.75,
        "weight_loss_percentage": 14.5,
        "roast_level_achieved": "medio",
        "is_approved": false
      }
    ]
  }
}
```

---

#### <a name="post-crear-orden"></a> POST /orders

Crea nueva orden de producción

**Body:**

```json
{
  "bom_id": 1,
  "product_id": "CAFE-TOSTADO-001",
  "planned_quantity": 50,
  "quantity_unit": "kg",
  "scheduled_date": "2026-01-24",
  "work_center_id": 1,
  "roasting_equipment_id": 1,
  "responsible_user_id": 4,
  "priority": "normal",
  "notes": "Pedido MercadoLibre urgente"
}
```

**Ejemplo:**

```bash
curl -X POST 'http://localhost:3000/api/production/orders' \
  -H 'Content-Type: application/json' \
  -d '{
    "bom_id": 1,
    "product_id": "CAFE-TOSTADO-001",
    "planned_quantity": 50,
    "quantity_unit": "kg",
    "scheduled_date": "2026-01-24",
    "priority": "normal"
  }'
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Production order created",
  "data": {
    "id": 5,
    "order_number": "ORD-456123",
    "state": "borrador"
  }
}
```

---

#### <a name="put-actualizar-orden"></a> PUT /orders/:id

Actualiza orden de producción

**Body:**

```json
{
  "planned_quantity": 60,
  "priority": "alta",
  "responsible_user_id": 5,
  "notes": "Cantidad aumentada por demanda"
}
```

---

#### <a name="delete-eliminar-orden"></a> DELETE /orders/:id

Elimina orden (solo si está en borrador)

---

#### <a name="post-confirmar-orden"></a> POST /orders/:id/confirm

Confirma orden: `borrador` → `confirmada`

**Respuesta:**

```json
{
  "success": true,
  "message": "Order confirmed",
  "state": "confirmada"
}
```

---

#### <a name="post-iniciar-orden"></a> POST /orders/:id/start

Inicia orden: `confirmada` → `en_progreso`

---

#### <a name="post-pausar-orden"></a> POST /orders/:id/pause

Pausa orden: `en_progreso` → `pausada`

---

#### <a name="post-reanudar-orden"></a> POST /orders/:id/resume

Reanuda orden: `pausada` → `en_progreso`

---

#### <a name="post-completar-orden"></a> POST /orders/:id/complete

Completa orden: `en_progreso` → `completada`

**Body:**

```json
{
  "produced_quantity": 48.5
}
```

---

#### <a name="post-cancelar-orden"></a> POST /orders/:id/cancel

Cancela orden desde cualquier estado

**Body:**

```json
{
  "reason": "Equipo averiado"
}
```

---

### BATCHES DE TOSTADO

#### <a name="get-batches"></a> GET /batches

Lista batches de tostado

**Query Parameters:**

```
- production_order_id: número
- operator_id: número
- date_from: YYYY-MM-DD
- date_to: YYYY-MM-DD
- is_approved: 'true' | 'false'
- limit: número (default: 50)
- offset: número (default: 0)
```

---

#### <a name="post-crear-batch"></a> POST /batches

Crea nuevo batch de tostado

**Body:**

```json
{
  "production_order_id": 1,
  "roast_profile_id": 2,
  "roasting_equipment_id": 1,
  "green_coffee_lot_id": 1,
  "green_coffee_weight_kg": 50,
  "operator_id": 4
}
```

**Ejemplo:**

```bash
curl -X POST 'http://localhost:3000/api/production/batches' \
  -H 'Content-Type: application/json' \
  -d '{
    "production_order_id": 1,
    "roasting_equipment_id": 1,
    "green_coffee_lot_id": 1,
    "green_coffee_weight_kg": 50,
    "operator_id": 4
  }'
```

---

#### <a name="post-primer-crack"></a> POST /batches/:id/first-crack

Registra primer crack

**Body:**

```json
{
  "time_minutes": 8,
  "temperature_celsius": 195
}
```

---

#### <a name="post-segundo-crack"></a> POST /batches/:id/second-crack

Registra segundo crack

**Body:**

```json
{
  "time_minutes": 11
}
```

---

#### <a name="post-completar-batch"></a> POST /batches/:id/complete

Finaliza tostado

**Body:**

```json
{
  "roasted_coffee_weight_kg": 42.75,
  "drop_temperature_celsius": 205,
  "color_agtron": 65,
  "quality_score": 8.5,
  "quality_notes": "Excelente desarrollo",
  "ambient_temperature_celsius": 24,
  "humidity_percentage": 55
}
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Roast completed",
  "data": {
    "roasted_weight": 42.75,
    "weight_loss_percentage": 14.5,
    "actual_duration_minutes": 15,
    "development_time_ratio": 28.57
  }
}
```

---

#### <a name="post-aprobar-batch"></a> POST /batches/:id/approve

Aprueba batch

**Body:**

```json
{
  "approved_by_user_id": 3
}
```

---

#### <a name="get-comparacion-batch"></a> GET /batches/:id/comparison

Compara batch con perfil objetivo

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "roast_level": {
      "target": "medio",
      "actual": "medio",
      "match": true
    },
    "duration": {
      "target": 14,
      "actual": 15,
      "variance": 1
    },
    "first_crack": {
      "target": 9,
      "actual": 8,
      "variance": -1
    },
    "dtr": {
      "target": 28,
      "actual": 28.57,
      "variance": 0.57
    },
    "color_agtron": {
      "target": 65,
      "actual": 65,
      "variance": 0
    }
  }
}
```

---

### CONTROL DE CALIDAD

#### <a name="post-catacion"></a> POST /quality/cupping

Registra catación (cupping)

**Body:**

```json
{
  "roast_batch_id": 1,
  "inspector_id": 3,
  "aroma_score": 8.5,
  "flavor_score": 8.75,
  "acidity_score": 8.5,
  "body_score": 8.25,
  "balance_score": 8.5,
  "aftertaste_score": 8.25,
  "sweetness_score": 8,
  "uniformity_score": 8.75,
  "clean_cup_score": 9,
  "moisture_percentage": 11.2,
  "observations": "Café de excelente calidad"
}
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Cupping recorded",
  "data": {
    "id": 1,
    "check_number": "CUP-456789",
    "overall_score": 8.56,
    "passed": true
  }
}
```

---

### DASHBOARD

#### <a name="get-dashboard-principal"></a> GET /dashboard

Dashboard operativo completo

**Respuesta:**

```json
{
  "success": true,
  "timestamp": "2026-01-23T14:30:00Z",
  "date": "2026-01-23",
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
      "pass_rate": 87,
      "avg_score": 8.45
    },
    "equipment": {
      "total": 3,
      "operational": 3,
      "maintenance": 0,
      "availability": 100
    },
    "active_operators": 3,
    "batches_today": 8,
    "alerts": [
      {
        "severity": "warning",
        "alert_type": "Equipos en Mantenimiento",
        "count": 0
      }
    ],
    "next_orders": [
      {
        "id": 1,
        "order_number": "ORD-245670",
        "product_name": "Colombiano Huila 500g - Medio",
        "priority": "normal",
        "state": "en_progreso"
      }
    ],
    "loss_analysis": {
      "batches_analyzed": 8,
      "avg_actual_loss": 14.2,
      "expected_loss": 15.0,
      "variance": -0.8,
      "status": "OK"
    }
  }
}
```

---

#### <a name="get-eficiencia"></a> GET /dashboard/efficiency

Análisis de eficiencia por período

**Query Parameters:**

```
- date_from: YYYY-MM-DD
- date_to: YYYY-MM-DD
```

**Ejemplo:**

```bash
curl -X GET 'http://localhost:3000/api/production/dashboard/efficiency?date_from=2026-01-15&date_to=2026-01-23'
```

---

#### <a name="get-operadores"></a> GET /dashboard/operators

Performance de operadores

---

#### <a name="get-alertas"></a> GET /dashboard/alerts

Alertas y anomalías del sistema

---

## 🔄 FLUJO DE PRODUCCIÓN TÍPICO

### 1. Crear Orden

```bash
POST /orders
{
  "bom_id": 1,
  "product_id": "CAFE-TOSTADO-001",
  "planned_quantity": 50,
  "scheduled_date": "2026-01-24"
}
→ Respuesta: id = 1, state = "borrador"
```

### 2. Confirmar Orden

```bash
POST /orders/1/confirm
→ state = "confirmada"
```

### 3. Iniciar Orden

```bash
POST /orders/1/start
→ state = "en_progreso"
```

### 4. Crear Batch de Tostado

```bash
POST /batches
{
  "production_order_id": 1,
  "roasting_equipment_id": 1,
  "green_coffee_lot_id": 1,
  "green_coffee_weight_kg": 50,
  "operator_id": 4
}
→ Respuesta: id = 1, batch_number = "BATCH-356789"
```

### 5. Registrar Primer Crack

```bash
POST /batches/1/first-crack
{
  "time_minutes": 8,
  "temperature_celsius": 195
}
```

### 6. Registrar Segundo Crack

```bash
POST /batches/1/second-crack
{
  "time_minutes": 11
}
```

### 7. Completar Tostado

```bash
POST /batches/1/complete
{
  "roasted_coffee_weight_kg": 42.75,
  "drop_temperature_celsius": 205,
  "color_agtron": 65,
  "quality_score": 8.5
}
```

### 8. Control de Calidad (Catación)

```bash
POST /quality/cupping
{
  "roast_batch_id": 1,
  "inspector_id": 3,
  "aroma_score": 8.5,
  "flavor_score": 8.75,
  ...scores...
}
```

### 9. Aprobar Batch

```bash
POST /batches/1/approve
{
  "approved_by_user_id": 3
}
```

### 10. Completar Orden

```bash
POST /orders/1/complete
{
  "produced_quantity": 42.75
}
→ state = "completada"
```

---

## 📊 RECORDATORIO

⚠️ **ANTES DE USAR ESTOS ENDPOINTS:**

Ejecuta el script de datos iniciales:

```bash
mysql -u root -p dobleyo < db/seed_data.sql
```

Esto insertará:

- Usuarios de prueba
- Equipos de tostado
- Productos y BOMs
- Lotes de café verde
- Plan de cuentas

---

## ✅ PRÓXIMOS PASOS

1. **Frontend:** Crear vistas en `/produccion/dashboard`, `/produccion/ordenes`, `/produccion/tostar`
2. **WebSockets:** Para actualizaciones en tiempo real
3. **APIs Financieras:** Facturación y pagos
4. **Reportes:** Exportar a Excel/PDF
