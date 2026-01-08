# Cambios: Sumar Unidades al Inventario en Empaquetado

## Descripción
Se agregó la funcionalidad para que durante el proceso de empaquetado (/app/packaging) los usuarios puedan seleccionar si desean sumar las unidades empacadas al inventario disponible automáticamente.

## Cambios Realizados

### 1. Frontend - `src/pages/app/packaging.astro`

#### 1.1 Interfaz de Usuario
- Agregado **checkbox** después de "Cantidad de Unidades a Empacar"
- El checkbox permite marcar la opción "📦 Sumar unidades al inventario disponible"
- Incluye texto descriptivo que explica la función

#### 1.2 Estilos CSS
- Agregada clase `.checkbox-item` con estilos personalizados
- Cambio de color de fondo a `#fff8f3` (beige) cuando está marcado
- Borde se vuelve del color `var(--accent)` (café)
- Hover effect para mejor UX

#### 1.3 Lógica JavaScript
- Modificado el evento `submit` para enviar el flag `addToInventory`
- El valor se toma de `document.getElementById("addToInventory").checked`
- Actualizado el mensaje de confirmación para mostrar si se agregó al inventario
- Se envía el booleano `addToInventory` en el payload JSON a la API

### 2. Backend - `server/routes/coffee.js`

#### 2.1 Ruta POST `/api/coffee/packaging`
- Agregado parámetro `addToInventory` al destructuring de `req.body`
- Implementada lógica condicional cuando `addToInventory === true`:

#### 2.2 Creación de Producto
Cuando se marca la opción, se ejecutan las siguientes operaciones:

1. **Generación de SKU único**
   - Formato: `CAFE-{lot_id}-{packageSize}-{timestamp}`
   - Ejemplo: `CAFE-COL-HUI-1800-250-456789`
   - Máximo 50 caracteres

2. **Inserción en tabla `products`**
   - `id`: SKU generado
   - `name`: Nombre descriptivo del café empacado
   - `category`: 'cafe'
   - `origin`: Región del café
   - `process`: Proceso de beneficio
   - `roast`: Nivel de tueste
   - `stock_quantity`: Cantidad de unidades empacadas
   - `weight`: Tamaño de presentación (250g, 500g, 1kg, etc.)
   - `weight_unit`: 'unidad'

3. **Registración de Movimiento de Inventario**
   - Tabla: `inventory_movements`
   - `movement_type`: 'entrada' (entrada de stock)
   - `quantity`: Cantidad de unidades
   - `quantity_before`: 0
   - `quantity_after`: Cantidad de unidades
   - `reason`: 'Café empacado para venta'
   - `reference`: ID del lote de café

#### 2.3 Respuesta JSON
```json
{
  "success": true,
  "packagedId": "packaged_coffee_id",
  "productId": "SKU generado (si aplica)",
  "score": "X.XX",
  "inventoryUpdated": true/false,
  "message": "Mensaje descriptivo"
}
```

## Campos Utilizados de `roasted_coffee_inventory`

- `lot_id`: Identificador del lote
- `region`: Región/origen del café
- `process`: Proceso de beneficio
- `roast_level`: Nivel de tueste

## Flujo de Operación

```
1. Usuario completa formulario de empaquetado
2. Usuario marca checkbox "Sumar unidades al inventario disponible" (opcional)
3. Usuario hace submit
4. Frontend envía JSON con addToInventory: true/false
5. API recibe solicitud
6. API crea registro en packaged_coffee (siempre)
7. Si addToInventory === true:
   a. Genera SKU único para el producto
   b. Crea entrada en tabla products
   c. Registra movimiento de inventario
8. API retorna respuesta con inventoryUpdated indicando el resultado
9. Frontend muestra mensaje con confirmación de inventario (si aplica)
10. Formulario se resetea y se recarga la lista de cafés disponibles
```

## Consideraciones Importantes

- ✅ El checkbox es **opcional** (no es requerido)
- ✅ Si no se marca, solo se crea el registro de empaquetado sin afectar inventario
- ✅ La creación del producto y movimiento de inventario es **atómica** (ambas suceden o ninguna)
- ✅ Se generan SKUs únicos usando timestamp para evitar colisiones
- ✅ El inventario registra trazabilidad completa del movimiento
- ⚠️ El precio inicial se deja en 0 (debe configurarse manualmente si es necesario)

## Tablas Afectadas

- `packaged_coffee`: Siempre (insert)
- `roasted_coffee_inventory`: Siempre (update status)
- `products`: Solo si `addToInventory === true` (insert)
- `inventory_movements`: Solo si `addToInventory === true` (insert)

## Pruebas Recomendadas

1. Empacar café sin marcar checkbox → solo registra empaquetado
2. Empacar café marcando checkbox → crea producto y registra inventario
3. Verificar que el SKU es único en múltiples empaques
4. Verificar que `inventory_movements` registra correctamente
5. Verificar que `products.stock_quantity` tiene el valor correcto
