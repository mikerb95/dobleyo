# 📱 DobleYo Café - API Coffee Management

Endpoints de API para gestionar el flujo completo de cafés desde la recolección hasta la venta.

## 🔑 Base URL

```
https://dobleyo.cafe/api/coffee
```

## 📊 Endpoints

### 1. CREAR LOTE (Recolección en Finca)

**POST** `/api/coffee/harvest`

Registra un nuevo lote de café recolectado en la finca.

**Body:**

```json
{
  "farm": "finca-la-sierra",
  "variety": "CAT",
  "climate": "SECO",
  "process": "HUM",
  "aroma": "Chocolate, Frutal",
  "tasteNotes": "Notas de chocolate amargo, cereza, avellana..."
}
```

**Response (201):**

```json
{
  "success": true,
  "lotId": "COL-HUI-1800-CAT-HUM-01",
  "harvestId": 1,
  "message": "Lote registrado correctamente"
}
```

---

### 2. ALMACENAR EN INVENTARIO (Café Verde)

**POST** `/api/coffee/inventory-storage`

Registra café verde en el inventario.

**Body:**

```json
{
  "lotId": "COL-HUI-1800-CAT-HUM-01",
  "weight": 45.5,
  "weightUnit": "kg",
  "location": "A-01",
  "storageDate": "2026-01-06",
  "notes": "Empaques en buen estado"
}
```

**Response (201):**

```json
{
  "success": true,
  "storageId": 1,
  "message": "Café verde almacenado correctamente"
}
```

---

### 3. ENVIAR A TOSTIÓN

**POST** `/api/coffee/send-roasting`

Envía café verde a proceso de tostión.

**Body:**

```json
{
  "lotId": "COL-HUI-1800-CAT-HUM-01",
  "quantitySent": 30,
  "targetTemp": 210,
  "notes": "Tueste medio, desarrollo lento"
}
```

**Response (201):**

```json
{
  "success": true,
  "roastingId": 1,
  "message": "Lote enviado a tostión correctamente"
}
```

---

### 4. RECOGER DEL TUESTE

**POST** `/api/coffee/roast-retrieval`

Registra café tostado después del proceso.

**Body:**

```json
{
  "roastingId": 1,
  "roastLevel": "MEDIUM",
  "roastedWeight": 25.5,
  "actualTemp": 208,
  "roastTime": 12,
  "observations": "Desarrollo uniforme, crackle completo"
}
```

**Response (201):**

```json
{
  "success": true,
  "roastedId": 1,
  "weightLossPercent": "15.00",
  "message": "Café tostado registrado correctamente"
}
```

---

### 5. ALMACENAR CAFÉ TOSTADO

**POST** `/api/coffee/roasted-storage`

Almacena café tostado en bodega.

**Body:**

```json
{
  "roastedId": 1,
  "location": "ROASTED-A-01",
  "container": "BAG-5KG",
  "containerCount": 5,
  "conditions": ["sealed", "cool", "dark"],
  "notes": "Almacenado en clima controlado"
}
```

**Response (201):**

```json
{
  "success": true,
  "storageId": 1,
  "message": "Café tostado almacenado correctamente"
}
```

---

### 6. PREPARAR PARA VENTA

**POST** `/api/coffee/packaging`

Configura propiedades de cata y prepara para empaque.

**Body:**

```json
{
  "roastedStorageId": 1,
  "acidity": 4,
  "body": 3,
  "balance": 4,
  "presentation": "MOLIDO",
  "grindSize": "MEDIUM-FINE",
  "packageSize": "500g",
  "unitCount": 50,
  "notes": "Empaque premium"
}
```

**Response (201):**

```json
{
  "success": true,
  "packagedId": 1,
  "score": "3.67",
  "message": "Café preparado para venta correctamente"
}
```

---

## 📋 GET Endpoints (Listar)

### Obtener Lotes Recolectados

**GET** `/api/coffee/harvests`

Lista todos los lotes recolectados.

**Response (200):**

```json
[
  {
    "id": 1,
    "lot_id": "COL-HUI-1800-CAT-HUM-01",
    "farm": "finca-la-sierra",
    "variety": "CAT",
    "climate": "SECO",
    "process": "HUM",
    "aroma": "Chocolate, Frutal",
    "taste_notes": "...",
    "created_at": "2026-01-06T10:30:00Z"
  }
]
```

---

### Obtener Inventario Verde

**GET** `/api/coffee/green-inventory`

Lista café verde almacenado.

**Response (200):**

```json
[
  {
    "id": 1,
    "harvest_id": 1,
    "lot_id": "COL-HUI-1800-CAT-HUM-01",
    "weight_kg": 45.5,
    "location": "A-01",
    "storage_date": "2026-01-06",
    "created_at": "2026-01-06T10:30:00Z"
  }
]
```

---

### Obtener Lotes en Tostión

**GET** `/api/coffee/roasting-batches`

Lista lotes actualmente en proceso de tostión.

**Response (200):**

```json
[
  {
    "id": 1,
    "lot_id": "COL-HUI-1800-CAT-HUM-01",
    "quantity_sent_kg": 30,
    "target_temp": 210,
    "status": "in_roasting",
    "created_at": "2026-01-06T10:30:00Z"
  }
]
```

---

### Obtener Café Tostado

**GET** `/api/coffee/roasted-coffee`

Lista café tostado listo para almacenar.

**Response (200):**

```json
[
  {
    "id": 1,
    "roasting_id": 1,
    "roast_level": "MEDIUM",
    "weight_kg": 25.5,
    "weight_loss_percent": 15.0,
    "actual_temp": 208,
    "roast_time_minutes": 12,
    "status": "ready_for_storage",
    "created_at": "2026-01-06T10:30:00Z"
  }
]
```

---

### Obtener Café Empacado

**GET** `/api/coffee/packaged`

Lista café listo para venta.

**Response (200):**

```json
[
  {
    "id": 1,
    "roasted_storage_id": 1,
    "acidity": 4,
    "body": 3,
    "balance": 4,
    "score": 3.67,
    "presentation": "MOLIDO",
    "grind_size": "MEDIUM-FINE",
    "package_size": "500g",
    "unit_count": 50,
    "status": "ready_for_sale",
    "created_at": "2026-01-06T10:30:00Z"
  }
]
```

---

## 🔄 Flujo de Relaciones

```
POST /harvest
    ↓
POST /inventory-storage
    ↓
POST /send-roasting
    ↓
POST /roast-retrieval
    ↓
POST /roasted-storage
    ↓
POST /packaging
```

## ✅ Validaciones

- **Lote único**: No se puede crear dos lotes con el mismo ID
- **Inventario**: No se puede enviar a tostión más del disponible
- **Cantidad**: No se puede almacenar más peso del que fue tostado
- **Requeridos**: Todos los campos marcados como requeridos deben estar presentes

## 🗄️ Estructura de Tablas

### coffee_harvests

```sql
- id (PK)
- lot_id (UNIQUE)
- farm
- variety
- climate
- process
- aroma
- taste_notes
- created_at
```

### green_coffee_inventory

```sql
- id (PK)
- harvest_id (FK)
- lot_id
- weight_kg
- location
- storage_date
- notes
- created_at
```

### roasting_batches

```sql
- id (PK)
- lot_id
- quantity_sent_kg
- target_temp
- notes
- status
- created_at
```

### roasted_coffee

```sql
- id (PK)
- roasting_id (FK)
- roast_level
- weight_kg
- weight_loss_percent
- actual_temp
- roast_time_minutes
- observations
- status
- created_at
```

### roasted_coffee_inventory

```sql
- id (PK)
- roasted_id (FK)
- location
- container_type
- container_count
- storage_conditions
- notes
- status
- created_at
```

### packaged_coffee

```sql
- id (PK)
- roasted_storage_id (FK)
- acidity
- body
- balance
- score
- presentation
- grind_size
- package_size
- unit_count
- notes
- status
- created_at
```

---

## 🚀 Inicializar Tablas

Llamar a:

```bash
POST /api/setup
```

Esto creará todas las tablas de café automáticamente.

---

**Versión:** 1.0  
**Fecha:** Enero 2026
