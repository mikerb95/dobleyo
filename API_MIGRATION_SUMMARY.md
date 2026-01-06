# 🔄 API Migration Summary - localStorage → Database

## 📋 Overview

Todas las 6 páginas del módulo móvil han sido actualizadas para usar **API directa a la base de datos** en lugar de `localStorage`.

**Fecha de Implementación:** 6 de Enero, 2026  
**Cambios:** Todas las operaciones CRUD ahora se realizan contra `/api/coffee/*` endpoints  
**Validación:** Data persiste en la base de datos MySQL (Aiven) y es accesible entre sesiones

---

## ✅ Módulos Actualizados

### 1. **Recoger Lote en Finca** (`src/pages/app/harvest.astro`)
- **Cambio:** Envío POST a `/api/coffee/harvest`
- **Anterior:** `localStorage.setItem("harvests", ...)`
- **Ahora:** Fetch con `await response.json()` que devuelve `lotId`
- **Validación:** Server genera automáticamente ID en formato `COL-REGION-HEIGHT-VARIETY-PROCESS-NUMBER`
- **Estados:** Loading feedback con texto "Registrando..." mientras se procesa

### 2. **Almacenar en Inventario** (`src/pages/app/inventory-storage.astro`)
- **Cambio:** POST a `/api/coffee/inventory-storage` + GET `/api/coffee/harvests`
- **Anterior:** Leía de localStorage para llenar dropdown de lotes
- **Ahora:** 
  - GET `/api/coffee/harvests` para lotes disponibles
  - GET `/api/coffee/green-inventory` para filtrar ya almacenados
  - POST envía weight, weightUnit, location, storageDate
- **Validación:** Server valida que el lote exista

### 3. **Enviar a Tostión** (`src/pages/app/send-roasting.astro`)
- **Cambio:** POST a `/api/coffee/send-roasting` + GET `/api/coffee/green-inventory`
- **Anterior:** Filtro manual basado en localStorage
- **Ahora:**
  - GET `/api/coffee/green-inventory` lista café verde disponible
  - POST valida cantidad contra peso disponible en servidor
  - Server maneja la lógica de validación de cantidad
- **Validación:** Cantidad no puede exceder peso disponible en BD

### 4. **Recoger del Tueste** (`src/pages/app/roast-retrieval.astro`)
- **Cambio:** POST a `/api/coffee/roast-retrieval` + GET `/api/coffee/roasting-batches`
- **Anterior:** Leía estado de tostión de localStorage
- **Ahora:**
  - GET `/api/coffee/roasting-batches` obtiene lotes en proceso
  - POST registra resultado con cálculo automático de `weight_loss_percent`
  - Server retorna `weightLossPercent` en respuesta
- **Cálculo Automático:** `(original - roasted) / original * 100` se hace en el servidor

### 5. **Almacenar Tostado** (`src/pages/app/roasted-storage.astro`)
- **Cambio:** POST a `/api/coffee/roasted-storage` + GET `/api/coffee/roasted-coffee`
- **Anterior:** Leía de localStorage
- **Ahora:**
  - GET `/api/coffee/roasted-coffee` lista café tostado listo para almacenar
  - POST registra ubicación, contenedor, condiciones
  - Distribución de peso se calcula en frontend, se envía al servidor
- **Validación:** Server valida que contenedores tengan capacidad suficiente

### 6. **Preparar para Venta** (`src/pages/app/packaging.astro`)
- **Cambio:** POST a `/api/coffee/packaging` + GET `/api/coffee/roasted-coffee`
- **Anterior:** Leía de localStorage para mostrar cafés disponibles
- **Ahora:**
  - GET `/api/coffee/roasted-coffee` obtiene café para empacar
  - POST envía propiedades de cata (acidity, body, balance)
  - Server calcula `score` automáticamente
  - Server retorna `score` en respuesta
- **Cálculo Automático:** `(acidity + body + balance) / 3` en el servidor

---

## 🔌 Endpoints Utilizados

| Módulo | GET Endpoints | POST Endpoints |
|--------|-------------|-------------|
| Harvest | — | `/api/coffee/harvest` |
| Inventory | `/api/coffee/harvests` | `/api/coffee/inventory-storage` |
| | `/api/coffee/green-inventory` | |
| Send Roasting | `/api/coffee/green-inventory` | `/api/coffee/send-roasting` |
| Roast Retrieval | `/api/coffee/roasting-batches` | `/api/coffee/roast-retrieval` |
| Roasted Storage | `/api/coffee/roasted-coffee` | `/api/coffee/roasted-storage` |
| Packaging | `/api/coffee/roasted-coffee` | `/api/coffee/packaging` |

---

## 🔐 Error Handling

Cada formulario ahora incluye:

```javascript
try {
  const response = await fetch("/api/coffee/endpoint", { /* ... */ });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error genérico");
  }
  
  // Success handling
} catch (error) {
  alert(`❌ Error: ${error.message}`);
} finally {
  // Re-enable button
}
```

**Mejoras:**
- Mensajes de error del servidor se muestran al usuario
- Botón de submit se deshabilita durante petición
- Texto del botón cambia a "Registrando..." durante carga
- Se restaura estado después de completar

---

## 🗄️ Tablas de Base de Datos

Todas las operaciones ahora persisten en:

```
coffee_harvests
├─ lot_id (UNIQUE)
├─ farm, variety, climate, process
└─ aroma, taste_notes

green_coffee_inventory
├─ harvest_id (FK)
├─ lot_id
├─ weight_kg, location
└─ storage_date

roasting_batches
├─ lot_id
├─ quantity_sent_kg
├─ target_temp
└─ status

roasted_coffee
├─ roasting_id (FK)
├─ roast_level
├─ weight_kg, weight_loss_percent
├─ actual_temp, roast_time_minutes
└─ status

roasted_coffee_inventory
├─ roasted_id (FK)
├─ location, container_type
├─ container_count
└─ storage_conditions

packaged_coffee
├─ roasted_storage_id (FK)
├─ acidity, body, balance, score
├─ presentation, grind_size
├─ package_size, unit_count
└─ status
```

---

## 📝 Cambios Técnicos

### Antes (localStorage)
```javascript
// Guardar
const harvests = JSON.parse(localStorage.getItem("harvests") || "[]");
harvests.push(formData);
localStorage.setItem("harvests", JSON.stringify(harvests));

// Cargar
const harvests = JSON.parse(localStorage.getItem("harvests") || "[]");
```

### Ahora (API)
```javascript
// Guardar
const response = await fetch("/api/coffee/harvest", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData)
});
const data = await response.json();

// Cargar
const response = await fetch("/api/coffee/harvests");
const harvests = await response.json();
```

---

## ⚙️ Cálculos Automáticos en Servidor

Ciertos cálculos se han movido al servidor para garantizar consistencia:

### 1. **Lot ID Generation** (Harvest)
```
COL-{REGION}-{HEIGHT}-{VARIETY}-{PROCESS}-{SEQUENCE}
COL-HUI-1800-CAT-HUM-01
```
- Generado automáticamente por el servidor
- Se retorna en la respuesta POST

### 2. **Weight Loss Percentage** (Roast Retrieval)
```
weight_loss_percent = ((original - roasted) / original) * 100
```
- Calculado por el servidor
- Se retorna en la respuesta POST

### 3. **Tasting Score** (Packaging)
```
score = (acidity + body + balance) / 3
score = (4 + 3 + 4) / 3 = 3.67
```
- Calculado por el servidor
- Se retorna en la respuesta POST

---

## 🚀 Inicialización

Para crear las tablas en BD:

```bash
curl -X POST https://dobleyo.cafe/api/setup
```

Esto crea automáticamente:
1. `coffee_harvests`
2. `green_coffee_inventory`
3. `roasting_batches`
4. `roasted_coffee`
5. `roasted_coffee_inventory`
6. `packaged_coffee`

---

## 📱 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────┐
│ USUARIO INTERACTÚA CON FORMULARIO MÓVIL                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ FETCH POST/GET A /api/coffee/*          │
        │ (Con validación en cliente)              │
        └────────┬─────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ EXPRESS SERVER ROUTER          │
    │ /api/coffee/endpoint           │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────────┐
    │ VALIDACIÓN EN SERVIDOR                 │
    │ - Parámetros requeridos                │
    │ - Relaciones FK                        │
    │ - Cálculos automáticos                 │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────────┐
    │ INSERCIÓN EN BASE DE DATOS             │
    │ mysql2/promise.query()                 │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────────┐
    │ RESPUESTA JSON AL CLIENTE              │
    │ { success: true, id, message }         │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────────┐
    │ MANEJO EN CLIENTE                        │
    │ - Alert de confirmación                  │
    │ - Reload de datos                        │
    │ - Reset de formulario                    │
    └──────────────────────────────────────────┘
```

---

## ✨ Beneficios

| Aspecto | localStorage | API/Database |
|---------|-------------|------------|
| **Persistencia** | Solo sesión actual | Permanente |
| **Multi-dispositivo** | No | Sí ✓ |
| **Backup** | Manual | Automático ✓ |
| **Compartir datos** | No | Sí ✓ |
| **Validación** | Frontend | Frontend + Server ✓ |
| **Escalabilidad** | Limitada | Ilimitada ✓ |
| **Seguridad** | Baja | Alta (BD protegida) ✓ |

---

## 🔧 Próximas Mejoras (Futura)

1. **Autenticación:**
   - JWT verification en endpoints
   - Aislar datos por usuario/empresa
   - Roles (admin, manager, worker)

2. **Relaciones Avanzadas:**
   - Cargar datos de origen al buscar café en packaging
   - Mostrar historial completo de cada lote

3. **Optimizaciones:**
   - Caching de GET endpoints (Redis)
   - Paginación para listas grandes
   - Índices optimizados

4. **Reportes:**
   - API de reportes por período
   - Estadísticas de rendimiento
   - Trazabilidad completa

---

**Estado:** ✅ COMPLETADO  
**Última Actualización:** 6 de Enero, 2026  
**Maintainer:** Sistema móvil DobleYo Café
