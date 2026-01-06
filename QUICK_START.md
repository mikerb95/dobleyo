# 🚀 GUÍA DE INICIO RÁPIDO - DobleYo Café API

## 5 Minutos para Empezar

---

## 📝 Paso 1: Inicializar la Base de Datos (1 minuto)

Ejecuta esto UNA SOLA VEZ para crear todas las tablas:

```bash
curl -X POST https://dobleyo.cafe/api/setup
```

**Deberías ver:**
```json
{
  "success": true,
  "message": "Setup completado",
  "tables_created": [...]
}
```

Si ya existe la tabla, ignora el error (es normal).

---

## 📱 Paso 2: Acceder desde iPhone (1 minuto)

Abre tu navegador en el iPhone y ve a:

```
https://dobleyo.cafe/app/harvest
```

O usa el menu principal de dobleyo.cafe → "Aplicación Móvil"

---

## ☕ Paso 3: Crear tu Primer Lote (2 minutos)

### En la página "Recoger Lote en Finca":

1. **Selecciona una Finca:**
   - "La Sierra - Huila" (1800m)
   - "Nariño Premium" (1900m)
   - "Cauca Estate" (1750m)

2. **Selecciona Variedad:**
   - Caturra (CAT)
   - Caturra (CAT)
   - Bourbon (BOB)
   - Geisha (GER)

3. **Selecciona Clima:**
   - 🌞 Seco
   - 🌧️ Lluvioso
   - 🌤️ Templado

4. **Selecciona Proceso:**
   - Natural (Secado en cereza)
   - Húmedo (Lavado)
   - Anaeróbico

5. **Aroma:** Escribe algo como "Chocolate, Frutal"

6. **Notas de Sabor:** "Notas de chocolate, cereza, avellana"

7. **Click en "Crear Lote"**

### ✅ Verás:
```
✅ Lote COL-HUI-1800-CAT-HUM-01 registrado correctamente en la base de datos
```

---

## 🔄 Paso 4: Seguir el Flujo Completo (1 minuto)

Después de crear el lote, ve a las siguientes páginas en orden:

### 1️⃣ Almacenar en Inventario
**URL:** `https://dobleyo.cafe/app/inventory-storage`
- Selecciona el lote que creaste
- Ingresa peso: **45.5** kg
- Selecciona ubicación: **A-01**
- Click: "Almacenar Lote"

### 2️⃣ Enviar a Tostión
**URL:** `https://dobleyo.cafe/app/send-roasting`
- Selecciona el lote
- Ingresa cantidad: **30** kg
- Ingresa temperatura: **210** °C
- Click: "Enviar a Tostión"

### 3️⃣ Recoger del Tueste
**URL:** `https://dobleyo.cafe/app/roast-retrieval`
- Selecciona el lote en tostión
- Selecciona nivel: **Tostión Media**
- Ingresa peso tostado: **25.5** kg
- Click: "Registrar Tueste"

### 4️⃣ Almacenar Tostado
**URL:** `https://dobleyo.cafe/app/roasted-storage`
- Selecciona café tostado
- Selecciona ubicación: **ROASTED-A-01**
- Selecciona contenedor: **Bolsas de 5 kg**
- Ingresa cantidad: **6** bolsas
- Click: "Almacenar"

### 5️⃣ Preparar para Venta
**URL:** `https://dobleyo.cafe/app/packaging`
- Selecciona café tostado
- Ajusta acidez: **4/5**
- Ajusta cuerpo: **3/5**
- Ajusta balance: **4/5**
- Selecciona presentación: **Molido**
- Selecciona molienda: **Media-Fina**
- Tamaño: **500g**
- Click: "Preparar para Venta"

---

## ✨ ¡Listo! Has completado el flujo

Tu café está ahora:
- ✅ Registrado desde recolección
- ✅ Almacenado en verde
- ✅ Tostado y registrado
- ✅ Almacenado tostado
- ✅ Listo para venta

**Los datos están permanentemente en la base de datos**

---

## 🔍 Verificar Datos en la BD

Para verificar que todo se guardó correctamente:

```bash
# Ver todos los lotes recolectados
SELECT * FROM coffee_harvests;

# Ver flujo completo de un lote específico
SELECT 
    h.lot_id,
    gi.weight_kg as peso_verde,
    rb.quantity_sent_kg as enviado,
    rc.weight_kg as tostado,
    pc.unit_count as unidades_venta
FROM coffee_harvests h
LEFT JOIN green_coffee_inventory gi ON h.id = gi.harvest_id
LEFT JOIN roasting_batches rb ON h.lot_id = rb.lot_id
LEFT JOIN roasted_coffee rc ON rb.id = rc.roasting_id
LEFT JOIN roasted_coffee_inventory rci ON rc.id = rci.roasted_id
LEFT JOIN packaged_coffee pc ON rci.id = pc.roasted_storage_id
LIMIT 10;
```

---

## 🎯 Puntos Clave

### ✅ Los datos SIEMPRE van a la Base de Datos
No importa si:
- Cierras el navegador
- Limpias el caché
- Cambias de dispositivo
- Pasas 1 año

Los datos seguirán ahí.

### ✅ Puedes Acceder desde Cualquier Dispositivo
Crea un lote desde tu iPhone, accede desde tu Mac y verás el mismo lote.

### ✅ Los Datos Están Protegidos
La base de datos está en Aiven (hosting seguro en la nube).

### ✅ Validaciones Automáticas
No puedes:
- Enviar más café del disponible
- Crear lotes duplicados
- Almacenar más peso del que fue tostado

El servidor lo valida automáticamente.

---

## 💡 Tips Útiles

### Crear múltiples lotes
Puedes crear cuantos lotes necesites. Cada uno tendrá:
- ID único generado automáticamente
- Historial completo de dónde vino

### Envíos parciales
Si recolectas 45.5 kg, puedes:
- Enviar 30 kg a tostión
- Enviar 15.5 kg después

### Diferentes puntuaciones
El mismo café tostado puede:
- Empacarse como "Grano Entero"
- Empacarse como "Molido - Media-Fina"
- Empacarse con diferentes puntuaciones de cata

---

## 📱 Optimizado para iPhone

- Pantalla completa
- Botones grandes para tocar
- Formularios simples y directos
- Validaciones mientras escribes

---

## ⚠️ Solución de Problemas

### "No veo datos en el dropdown"
✓ Asegúrate de haber completado el paso anterior
✓ Los datos necesitan estar en la BD primero
✓ Recarga la página (pull down)

### "Me da error al guardar"
✓ Verifica que llenaste todos los campos requeridos
✓ Revisa la consola del navegador (F12) para ver el error exacto
✓ Asegúrate que el servidor esté online

### "Pasé 1 hora y perdí los datos"
✓ No debería pasar (están en BD)
✓ Recarga la página
✓ Si persiste, contacta soporte

---

## 🆘 Soporte

Si algo no funciona:

1. Verifica que las tablas existan:
   ```bash
   curl -X POST https://dobleyo.cafe/api/setup
   ```

2. Revisa los errores en consola:
   - Abre DevTools (F12 en Chrome)
   - Ve a "Console"
   - Intenta crear un lote
   - Copia el error que ves

3. Verifica la BD:
   ```bash
   SELECT COUNT(*) FROM coffee_harvests;
   ```
   Deberías ver un número > 0

---

## 🎓 Siguiente: Documentación Completa

Cuando quieras saber más:

- **API Reference:** [API_COFFEE_ENDPOINTS.md](API_COFFEE_ENDPOINTS.md)
- **Testing Completo:** [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **Cambios Técnicos:** [API_MIGRATION_SUMMARY.md](API_MIGRATION_SUMMARY.md)
- **Resumen Ejecutivo:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## ✅ Checklist

- [ ] Ejecuté el setup (`/api/setup`)
- [ ] Accedí a `/app/harvest` desde iPhone
- [ ] Creé un lote
- [ ] Almacené en inventario
- [ ] Envié a tostión
- [ ] Recogí tostado
- [ ] Almacené tostado
- [ ] Preparé para venta
- [ ] Verifiqué en la BD
- [ ] ¡Todo funciona! 🎉

---

**¡Estás listo para empezar! Disfruta usando DobleYo Café API.**
