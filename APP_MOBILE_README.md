# 📱 DobleYo Café - App Mobile

Sistema de gestión completo de cafés desde la recolección en la finca hasta la preparación para venta. Diseñado para ser usado en iPhone y dispositivos móviles.

## 🎯 Características Principales

### ✅ 6 Módulos Integrados

1. **🌱 Recoger Lote en Finca** (`/app/harvest`)
   - Registra datos de recolección
   - Selecciona finca (carga automáticamente altura y tipo de suelo)
   - Especifica variedad, clima, proceso
   - Registra aroma y notas de sabor
   - **Genera automáticamente ID de lote** en formato: `COL-HUI-1800-CAT-HN-01`

2. **📦 Almacenar en Inventario Verde** (`/app/inventory-storage`)
   - Registra peso neto del café verde
   - Especifica ubicación de almacenamiento en bodega
   - Fecha automática (hoy)
   - Notas adicionales
   - Estado: Listo para tostión

3. **🔥 Enviar a Tostión** (`/app/send-roasting`)
   - Selecciona café verde disponible
   - Permite enviar cantidad parcial o total
   - Especifica temperatura target
   - Notas para el tostador
   - Rastreo automático de inventario

4. **☕ Recoger del Tueste** (`/app/roast-retrieval`)
   - Registra café tostado
   - Especifica nivel de tueste (clara, media, oscura)
   - Nuevo peso neto (con cálculo automático de pérdida)
   - Temperatura alcanzada y tiempo de tueste
   - Observaciones del proceso

5. **🏠 Almacenar Café Tostado** (`/app/roasted-storage`)
   - Ubicación en bodega (secciones especializadas)
   - Tipo de contenedor (bolsas, cubetas, sacos)
   - Cantidad de contenedores
   - Condiciones de almacenamiento
   - Cálculo automático de distribución

6. **🛍️ Preparar para Venta** (`/app/packaging`)
   - Selecciona café tostado disponible
   - **Propiedades de Cata:**
     - Acidez (1-5)
     - Cuerpo (1-5)
     - Balance (1-5)
     - Puntuación automática
   - Presentación: Grano o Molido
   - Tipo de molienda (si aplica)
   - Tamaño de presentación (250g, 500g, 1kg, 100g)
   - Genera información de origen automáticamente

## 🔑 Sistema de ID de Lote

Formato estándar: `COL-REGION-ALTURA-VARIEDAD-PROCESO-NUMERO`

**Ejemplo:** `COL-HUI-1800-CAT-HN-01`

| Parte | Significado | Ejemplo |
|-------|-------------|---------|
| COL | País (Colombia) | COL |
| HUI | Región | HUI, NAR, CAU |
| 1800 | Altura en metros | 1800, 1900, 1750 |
| CAT | Variedad (3 letras) | CAT, TIP, BOB, GER, PAC |
| HN | Proceso (2 letras) | NAT, HUM, ANH |
| 01 | Número de lote | 01-99 |

## 📊 Flujo del Proceso

```
1. 🌱 Recoger en Finca
   ↓
2. 📦 Almacenar Verde
   ↓
3. 🔥 Enviar a Tostión
   ↓
4. ☕ Recoger del Tueste
   ↓
5. 🏠 Almacenar Tostado
   ↓
6. 🛍️ Preparar para Venta
```

## 🎨 Diseño y UX

- **Optimizado 100% para iPhone** - Interfaz touch-friendly
- **Responsive** - Funciona en tablets y escritorio
- **Layout vertical** - Mejor para móvil
- **Estilos consistentes** - Colores corporativos DobleYo
- **Scroll fluido** - Preserva posición entre páginas
- **Formularios intuitivos** - Validación en tiempo real

## 💾 Almacenamiento

Los datos se guardan en **localStorage del navegador**:
- `harvests` - Lotes recolectados
- `inventory` - Café verde almacenado
- `roasting` - Lotes en tostión
- `roasted` - Café tostado
- `roasted_inventory` - Café tostado en bodega
- `packaged` - Café listo para venta

## 🔄 Relaciones de Datos

### Flujo de Datos:
```
Harvest → Inventory → Roasting → Roasted → Roasted Inventory → Packaged
```

### Validaciones Automáticas:
- No permite enviar más café a tostión del disponible
- No permite almacenar más peso del que fue tostado
- Calcula automáticamente pérdida de peso en tostión
- Valida cantidades contra inventario disponible

## 📱 Acceso

### URLs:
- Dashboard: `/app`
- Recoger lote: `/app/harvest`
- Almacenar verde: `/app/inventory-storage`
- Enviar a tostión: `/app/send-roasting`
- Recoger tueste: `/app/roast-retrieval`
- Almacenar tostado: `/app/roasted-storage`
- Preparar venta: `/app/packaging`

### Mejor En:
- ✅ iPhone 12+ (recomendado)
- ✅ Android (navegadores modernos)
- ✅ iPad (versión tableta)
- ✅ Navegadores: Chrome, Safari, Firefox

## 🚀 Desarrollo

### Stack:
- **Framework:** Astro
- **Layout Mobile:** MobileLayout.astro
- **Estilos:** CSS inline + componentes
- **Datos:** localStorage (cliente)
- **Lenguaje:** JavaScript vanilla

### Estructura:
```
src/
├── layouts/
│   ├── Layout.astro (web)
│   └── MobileLayout.astro (app)
├── pages/
│   ├── app/
│   │   ├── index.astro (dashboard)
│   │   ├── harvest.astro
│   │   ├── inventory-storage.astro
│   │   ├── send-roasting.astro
│   │   ├── roast-retrieval.astro
│   │   ├── roasted-storage.astro
│   │   └── packaging.astro
```

## 📋 Próximas Mejoras

- [ ] Sincronización con servidor (API)
- [ ] Reportes y análisis
- [ ] Exportar datos (CSV/PDF)
- [ ] Gráficos de inventario
- [ ] Historial de lotes
- [ ] QR para rápido acceso
- [ ] Notificaciones
- [ ] Modo offline completo
- [ ] Búsqueda de lotes
- [ ] Filtros avanzados

## 💡 Notas Importantes

1. **Datos Locales:** Todos los datos se guardan en el navegador. Al limpiar caché, se pierden.
2. **Seguridad:** Para producción, implementar autenticación y servidor backend.
3. **Respaldos:** Exportar datos regularmente antes de limpiar navegador.
4. **Compatibilidad:** Requiere navegador moderno con soporte localStorage.

## 📞 Soporte

Para dudas o problemas:
- Email: soporte@dobleyocafe.com
- WhatsApp: +57 300 123 4567

---

**Versión:** 1.0  
**Última actualización:** Enero 2026  
**Desarrollado para:** DobleYo Café
