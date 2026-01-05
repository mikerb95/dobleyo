# Implementación de Sistema de Tostado de Café

## Resumen

Se ha implementado un nuevo flujo para tostar café que permite crear sublotes tostados a partir de lotes verdes, manteniendo la trazabilidad y controlando el inventario.

## Cambios Realizados

### 1. Base de Datos (`db/schema.sql`)

- ✅ Agregados campos a tabla `lots`:
  - `estado` (ENUM: 'verde', 'tostado') - Estado del café
  - `fecha_tostado` (DATE) - Fecha cuando se tostó el café
  - `parent_lot_id` (BIGINT FK) - Referencia al lote verde original
  - `weight_kg` (DECIMAL) - Peso en kilogramos
  - Índices para `estado` y `parent_lot_id`

### 2. API Routes (`server/routes/lots.js`)

#### Rutas nuevas:

- **POST `/api/lots/roast/:lotId`** - Tostar café

  - Body: `{ weight_kg: number, fecha_tostado: date }`
  - Crea lote tostado
  - Resta peso del lote verde
  - Retorna lote tostado y peso restante

- **GET `/api/lots/status/verde`** - Obtener lotes verdes disponibles
  - Retorna lista de lotes con estado='verde'
  - Incluye: código, nombre, finca, variedad, peso, altura

#### Rutas modificadas:

- **GET `/api/lots/:identifier`** - Ahora obtiene por ID o código
- **POST `/api/lots`** - Ahora acepta `weight_kg` y establece `estado='verde'`

### 3. Componentes React (`src/components/`)

#### `RoastLotSelector.jsx`

- Selector visual de lotes verdes disponibles
- Muestra: Código, Finca, Variedad, Altura, Peso
- Valida antes de permitir seleccionar

#### `RoastForm.jsx`

- Formulario para ingresar:
  - Peso a tostar (con validación de máximo)
  - Fecha de tostado
- Valida contra el peso disponible
- Muestra mensajes de error/éxito

### 4. Página Astro (`src/pages/tostar.astro`)

- Nueva página para tostar café
- Integra los dos componentes React
- URL: `/tostar`
- Requiere autenticación de admin

### 5. Migración (`server/migrations/add_roast_fields.js`)

- Script para agregar campos a BD en Aiven
- **Ejecutar:** `npm run migrate` (requiere variables de ambiente DB\_\* configuradas)
- Script maneja campos/índices duplicados con gracia
- Debe ejecutarse una sola vez después del deploy

## Flujo de Uso

1. **Admin ingresa lote verde:**

   ```
   POST /api/lots
   {
     "code": "LOTE-001",
     "name": "Café Verde - Finca X",
     "farm": "Finca La Esperanza",
     "variety": "Bourbon",
     "weight_kg": 100,
     ...
   }
   ```

2. **Admin accede a página `/tostar`:**

   - Selecciona un lote verde
   - Ingresa cantidad a tostar (ej: 30kg)
   - Ingresa fecha de tostado

3. **Sistema crea lote tostado:**

   ```
   Lote Tostado creado:
   - ID: nuevo
   - Código: LOTE-001-ROAST-[timestamp]
   - Estado: tostado
   - Peso: 30kg
   - Parent: LOTE-001
   - Hereda: finca, variedad, altura, origen, proceso

   Lote Verde actualizado:
   - Peso: 70kg (100 - 30)
   ```

4. **Trazabilidad para QR (consumidor):**
   - Ver lote tostado por código
   - Mostrar: Finca, Variedad, Altura, Proceso, Fecha tostado
   - No expone relación con verde (solo para admin)

## Próximos Pasos

- [ ] Crear página de empaquetado para generar bolsas/QR del lote tostado
- [ ] Agregar validaciones de peso en página de inventario
- [ ] Crear reporte de trazabilidad para admin
- [ ] Agregar animaciones con Framer Motion en página `/tostar`
