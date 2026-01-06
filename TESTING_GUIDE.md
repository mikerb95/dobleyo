# 🧪 Testing & Verificación - API Coffee Workflow

## ✅ Checklist de Verificación

Complete estos pasos para verificar que el flujo completo funciona correctamente.

---

## 🚀 Inicio Rápido

### 1. Asegúrate que las tablas existan

```bash
# En tu terminal, llama al endpoint de setup
curl -X POST https://dobleyo.cafe/api/setup
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Setup completado",
  "tables_created": [
    "coffee_harvests",
    "green_coffee_inventory",
    "roasting_batches",
    "roasted_coffee",
    "roasted_coffee_inventory",
    "packaged_coffee"
  ]
}
```

---

## 📝 Test Completo del Flujo

### Paso 1️⃣: Recoger Lote en Finca (harvest.astro)

**URL:** `https://dobleyo.cafe/app/harvest`

**Pasos:**
1. Selecciona una finca (ej: "La Sierra - Huila")
2. Selecciona variedad (ej: "CAT" - Caturra)
3. Selecciona clima (ej: "SECO")
4. Selecciona proceso (ej: "HUM" - Húmedo)
5. Ingresa aroma (ej: "Chocolate, Frutal")
6. Ingresa notas de sabor (ej: "Notas de chocolate amargo, cereza")
7. Click en "Crear Lote"

**Verificación:**
- ✓ Se muestra alerta: `✅ Lote COL-HUI-1800-CAT-HUM-01 registrado correctamente en la base de datos`
- ✓ Revisa la BD: `SELECT * FROM coffee_harvests;`
- ✓ Debe estar el registro con el lote_id generado

**Respuesta esperada en BD:**
```
id | lot_id              | farm           | variety | climate | process
1  | COL-HUI-1800-CAT-HUM-01 | finca-la-sierra | CAT   | SECO    | HUM
```

---

### Paso 2️⃣: Almacenar en Inventario (inventory-storage.astro)

**URL:** `https://dobleyo.cafe/app/inventory-storage`

**Pasos:**
1. El dropdown debe mostrar el lote que creaste: "COL-HUI-1800-CAT-HUM-01 (CAT)"
2. Selecciona el lote
3. Ingresa peso: "45.5"
4. Selecciona ubicación: "Sección A - Estante 01"
5. Click en "Almacenar Lote"

**Verificación:**
- ✓ Se muestra alerta: `✅ Lote COL-HUI-1800-CAT-HUM-01 almacenado correctamente en la base de datos`
- ✓ Revisa la BD: `SELECT * FROM green_coffee_inventory;`
- ✓ Debe estar el registro con weight_kg = 45.5 y location = "A-01"

**Respuesta esperada en BD:**
```
id | harvest_id | lot_id              | weight_kg | location | storage_date
1  | 1          | COL-HUI-1800-CAT-HUM-01 | 45.5      | A-01     | 2026-01-06
```

---

### Paso 3️⃣: Enviar a Tostión (send-roasting.astro)

**URL:** `https://dobleyo.cafe/app/send-roasting`

**Pasos:**
1. El dropdown debe mostrar: "COL-HUI-1800-CAT-HUM-01 (45.5 kg disponible)"
2. Selecciona el lote
3. Ingresa cantidad: "30" (puede ser parcial)
4. Ingresa temperatura target: "210"
5. Click en "Enviar a Tostión"

**Verificación:**
- ✓ Se muestra alerta: `✅ Lote COL-HUI-1800-CAT-HUM-01 enviado a tostión correctamente\n30 kg en proceso`
- ✓ Revisa la BD: `SELECT * FROM roasting_batches;`
- ✓ Debe estar el registro con lot_id y quantity_sent_kg = 30, status = "in_roasting"

**Respuesta esperada en BD:**
```
id | lot_id              | quantity_sent_kg | target_temp | status
1  | COL-HUI-1800-CAT-HUM-01 | 30               | 210         | in_roasting
```

---

### Paso 4️⃣: Recoger del Tueste (roast-retrieval.astro)

**URL:** `https://dobleyo.cafe/app/roast-retrieval`

**Pasos:**
1. El dropdown debe mostrar: "COL-HUI-1800-CAT-HUM-01 (30 kg)"
2. Selecciona el lote
3. Selecciona nivel de tueste: "Tostión Media (Medium)"
4. Ingresa peso tostado: "25.5" (muestra pérdida automáticamente)
5. Ingresa temperatura alcanzada: "208"
6. Ingresa tiempo de tueste: "12"
7. Click en "Registrar Tueste"

**Verificación:**
- ✓ Se muestra alerta con pérdida de peso: `✅ Tueste registrado correctamente...`
- ✓ Revisa la BD: `SELECT * FROM roasted_coffee;`
- ✓ Debe calcular automáticamente: weight_loss_percent = (30 - 25.5) / 30 * 100 = 15%

**Respuesta esperada en BD:**
```
id | roasting_id | roast_level | weight_kg | weight_loss_percent | actual_temp | roast_time_minutes | status
1  | 1           | MEDIUM      | 25.5      | 15.00               | 208         | 12                 | ready_for_storage
```

---

### Paso 5️⃣: Almacenar Tostado (roasted-storage.astro)

**URL:** `https://dobleyo.cafe/app/roasted-storage`

**Pasos:**
1. El dropdown debe mostrar: "COL-HUI-1800-CAT-HUM-01 - Media (25.5 kg)"
2. Selecciona el café
3. Selecciona ubicación: "Sección A - Estante 01 (Tostado)"
4. Selecciona contenedor: "Bolsas de 5 kg (almacenamiento)"
5. Ingresa cantidad de contenedores: "6"
6. La distribución calcula automáticamente: 25.5 / 6 = 4.25 kg por contenedor
7. Marca condiciones: "Sellado hermético", "Lugar fresco y seco"
8. Click en "Almacenar"

**Verificación:**
- ✓ Se muestra alerta: `✅ Café tostado almacenado correctamente`
- ✓ Revisa la BD: `SELECT * FROM roasted_coffee_inventory;`
- ✓ Debe estar el registro con location, container_type, container_count

**Respuesta esperada en BD:**
```
id | roasted_id | location     | container_type | container_count | storage_conditions | status
1  | 1          | ROASTED-A-01 | BAG-5KG        | 6               | sealed,cool,dark   | ready_for_packaging
```

---

### Paso 6️⃣: Preparar para Venta (packaging.astro)

**URL:** `https://dobleyo.cafe/app/packaging`

**Pasos:**
1. El dropdown debe mostrar: "COL-HUI-1800-CAT-HUM-01 - Media (25.5 kg)"
2. Selecciona el café
3. Ajusta Acidez: "4/5"
4. Ajusta Cuerpo: "3/5"
5. Ajusta Balance: "4/5"
6. Selecciona presentación: "Molido"
7. Selecciona tipo de molienda: "Media-Fina (V60, Chemex)"
8. Ingresa cantidad para empacar: "25.5"
9. Selecciona tamaño: "500g - Bolsa regular"
10. Automáticamente calcula: 25.5 kg / 0.5 kg = 51 unidades
11. Click en "Preparar para Venta"

**Verificación:**
- ✓ Se muestra alerta con puntuación: `✅ Café preparado para venta\nPuntuación: 3.67/5`
- ✓ La puntuación debe ser: (4 + 3 + 4) / 3 = 3.67
- ✓ Revisa la BD: `SELECT * FROM packaged_coffee;`
- ✓ Debe estar el registro con acidity=4, body=3, balance=4, score=3.67

**Respuesta esperada en BD:**
```
id | roasted_storage_id | acidity | body | balance | score | presentation | grind_size    | package_size | unit_count | status
1  | 1                  | 4       | 3    | 4       | 3.67  | MOLIDO       | MEDIUM-FINE   | 500g         | 51         | ready_for_sale
```

---

## 🔍 Verificaciones de Integridad

### Validación de Relaciones FK

```sql
-- Verifica que cada registro está vinculado correctamente
SELECT 
    h.lot_id,
    gi.weight_kg as verde_weight,
    rb.quantity_sent_kg as sent_for_roasting,
    rc.weight_kg as roasted_weight,
    rc.weight_loss_percent,
    rci.container_count,
    pc.unit_count
FROM coffee_harvests h
LEFT JOIN green_coffee_inventory gi ON h.id = gi.harvest_id
LEFT JOIN roasting_batches rb ON h.lot_id = rb.lot_id
LEFT JOIN roasted_coffee rc ON rb.id = rc.roasting_id
LEFT JOIN roasted_coffee_inventory rci ON rc.id = rci.roasted_id
LEFT JOIN packaged_coffee pc ON rci.id = pc.roasted_storage_id
WHERE h.lot_id = 'COL-HUI-1800-CAT-HUM-01';
```

**Resultado esperado:** Una fila con todos los valores conectados en cadena

---

## 🧨 Test de Errores

### Error: Cantidad mayor a disponible (send-roasting)

**Intenta:**
1. Ir a send-roasting
2. Selecciona el lote
3. Intenta ingresar cantidad: "50" (cuando solo hay 45.5 kg)
4. Click en "Enviar a Tostión"

**Verificación:**
- ✓ Se muestra alerta: `⚠️ La cantidad excede el peso disponible`
- ✓ NO se crea registro en `roasting_batches`

---

### Error: Lote duplicado (harvest)

**Intenta:**
1. Crea un lote
2. En la BD, nota el lot_id generado (ej: COL-HUI-1800-CAT-HUM-01)
3. Intenta insertar directamente otro lote con el mismo lot_id

```sql
INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes)
VALUES ('COL-HUI-1800-CAT-HUM-01', 'finca-test', 'CAT', 'SECO', 'HUM', 'test', 'test');
```

**Verificación:**
- ✓ Error de BD: `Duplicate entry 'COL-HUI-1800-CAT-HUM-01' for key 'lot_id'`
- ✓ El constraint UNIQUE está funcionando

---

## 📊 Consultas de Monitoreo

### Total de cafés por estado

```sql
SELECT 
    'Lotes recolectados' as estado, COUNT(*) as cantidad FROM coffee_harvests
UNION ALL
SELECT 'En inventario verde', COUNT(*) FROM green_coffee_inventory
UNION ALL
SELECT 'En proceso de tostión', COUNT(*) FROM roasting_batches WHERE status = 'in_roasting'
UNION ALL
SELECT 'Tostados listos', COUNT(*) FROM roasted_coffee WHERE status = 'ready_for_storage'
UNION ALL
SELECT 'En bodega tostada', COUNT(*) FROM roasted_coffee_inventory WHERE status = 'ready_for_packaging'
UNION ALL
SELECT 'Listos para venta', COUNT(*) FROM packaged_coffee WHERE status = 'ready_for_sale';
```

### Pérdida de peso por lote

```sql
SELECT 
    h.lot_id,
    gi.weight_kg as peso_verde,
    rc.weight_kg as peso_tostado,
    rc.weight_loss_percent as perdida_porcentaje
FROM coffee_harvests h
LEFT JOIN green_coffee_inventory gi ON h.id = gi.harvest_id
LEFT JOIN roasting_batches rb ON h.lot_id = rb.lot_id
LEFT JOIN roasted_coffee rc ON rb.id = rc.roasting_id
ORDER BY h.created_at DESC;
```

### Puntuaciones de cata

```sql
SELECT 
    pc.id,
    h.lot_id,
    pc.acidity,
    pc.body,
    pc.balance,
    pc.score,
    pc.package_size,
    pc.unit_count
FROM packaged_coffee pc
LEFT JOIN roasted_coffee_inventory rci ON pc.roasted_storage_id = rci.id
LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id
LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
LEFT JOIN coffee_harvests h ON rb.lot_id = h.lot_id
ORDER BY pc.created_at DESC;
```

---

## 🎯 Casos de Uso Avanzados

### Envío Parcial

1. Crea un lote de 45.5 kg
2. Almacenalo
3. Envía 30 kg a tostión (quedan 15.5 kg en inventario)
4. **Verificación:** `green_coffee_inventory` sigue mostrando 45.5 kg (no se modificó)
5. Puedes enviar de nuevo 15.5 kg a otra tanda de tostión

---

### Múltiples Contenedores

1. Tuesta 25.5 kg
2. Almacenalo usando 6 contenedores de 5kg
3. **Verificación:** La distribución es: 5 + 5 + 5 + 5 + 5 + 0.5 kg

---

### Diferentes Puntuaciones

1. Empaca el mismo café tostado con diferentes puntuaciones
2. **Verificación:** Crea múltiples filas en `packaged_coffee` con diferentes scores

---

## 📱 Testing desde Dispositivo Móvil

1. Accede con iPhone a: `https://dobleyo.cafe/app/harvest`
2. Completa el formulario táctil
3. Verifica que funcione sin problemas en pantalla pequeña
4. Comprueba que los datos aparezcan en `packaged_coffee` en la BD

---

## ✨ Checklist Final

- [ ] `coffee_harvests` tiene datos
- [ ] `green_coffee_inventory` está vinculado a `coffee_harvests`
- [ ] `roasting_batches` está vinculado a `coffee_harvests` por lot_id
- [ ] `roasted_coffee` está vinculado a `roasting_batches`
- [ ] `roasted_coffee_inventory` está vinculado a `roasted_coffee`
- [ ] `packaged_coffee` está vinculado a `roasted_coffee_inventory`
- [ ] Todos los botones muestran "Registrando..." durante la petición
- [ ] Los errores se muestran con alertas descriptivas
- [ ] Los cálculos automáticos funcionan (lot_id, weight_loss, score)
- [ ] La BD calcula correctamente los valores
- [ ] Los datos persisten entre sesiones

---

**Estado:** ✅ LISTA PARA TESTING  
**Última Actualización:** 6 de Enero, 2026
