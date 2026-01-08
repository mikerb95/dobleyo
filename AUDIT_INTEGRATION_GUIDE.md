# Guía de Integración de Auditoría

## Acciones a Registrar

### 1. **Gestión de Usuarios**
- `create_user` - Cuando se crea un nuevo usuario
- `update_user` - Cuando se actualiza un usuario
- `delete_user` - Cuando se elimina un usuario

### 2. **Gestión de Productos**
- `create_product` - Cuando se crea un producto
- `update_product` - Cuando se actualiza un producto
- `delete_product` - Cuando se elimina un producto

### 3. **Trazabilidad de Finca**
- `harvest_collected` - Cuando se recoge café de la finca
- `harvest_stored` - Cuando se almacena en inventario

### 4. **Tostado**
- `roast_sent` - Cuando se envía a tostar
- `roast_received` - Cuando se recibe del tostador

### 5. **Lotes**
- `create_lot` - Cuando se crea un lote
- `update_lot` - Cuando se actualiza un lote
- `delete_lot` - Cuando se elimina un lote

## Cómo Integrar Logs

### Paso 1: Importar el servicio de auditoría

```javascript
import { logAudit } from '../services/audit.js';
```

### Paso 2: Registrar la acción después de completarla

```javascript
// Ejemplo: Crear un usuario
async function createUser(userData) {
  try {
    // ... crear usuario ...
    
    // Registrar en auditoría
    await logAudit(
      req.user.id,                    // ID del usuario que realiza la acción
      'create_user',                   // Tipo de acción
      'user',                          // Tipo de entidad
      newUser.id,                      // ID de la entidad
      { email: userData.email }        // Detalles adicionales
    );
    
    return newUser;
  } catch (err) {
    console.error(err);
  }
}
```

### Paso 3: Ejemplos por módulo

#### Usuarios (server/routes/users.js)
```javascript
// Al actualizar usuario
await logAudit(
  req.userId,  // Obtén del JWT
  'update_user',
  'user',
  id,
  { 
    fields_updated: Object.keys(userData),
    new_role: role 
  }
);

// Al eliminar usuario
await logAudit(
  req.userId,
  'delete_user',
  'user',
  id,
  { email: deletedUser.email }
);
```

#### Productos (server/routes/inventory.js)
```javascript
// Al crear producto
await logAudit(
  req.userId,
  'create_product',
  'product',
  newProduct.id,
  {
    name: newProduct.name,
    category: newProduct.category,
    price: newProduct.price
  }
);

// Al actualizar producto
await logAudit(
  req.userId,
  'update_product',
  'product',
  id,
  {
    fields_updated: Object.keys(updateData)
  }
);

// Al eliminar producto
await logAudit(
  req.userId,
  'delete_product',
  'product',
  id,
  { name: deletedProduct.name }
);
```

#### Inventario (server/routes/inventory.js)
```javascript
// Al almacenar producto
await logAudit(
  req.userId,
  'harvest_stored',
  'inventory',
  productId,
  {
    quantity: quantity,
    source: 'finca',
    location: warehouseLocation
  }
);
```

#### Lotes (server/routes/lots.js)
```javascript
// Al enviar a tostar
await logAudit(
  req.userId,
  'roast_sent',
  'lot',
  lotId,
  {
    lot_code: lot.code,
    weight: weight,
    roaster: roasterName
  }
);

// Al recibir del tostador
await logAudit(
  req.userId,
  'roast_received',
  'lot',
  lotId,
  {
    lot_code: lot.code,
    roast_level: roastLevel,
    roast_date: new Date()
  }
);
```

## Estructura de Detalles (JSON)

Los detalles pueden incluir cualquier información relevante:
```javascript
{
  "field_name": "previous_value",
  "new_field_name": "new_value",
  "quantity_changed": 100,
  "source": "warehouse_A",
  "notes": "Información adicional"
}
```

## Acceso a los Logs

- **Página web**: `/app/auditoria`
- **API**: `/api/audit/logs?action=create&entity_type=user&limit=100`
- **Estadísticas**: `/api/audit/stats`

## Nota Importante

El usuario actual se obtiene del JWT token (req.user.id o req.userId según tu implementación).
Asegúrate de que el middleware de autenticación lo incluya en el objeto request.
