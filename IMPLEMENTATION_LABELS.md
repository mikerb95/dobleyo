# 🏷️ IMPLEMENTACIÓN: Sistema de Creación de Etiquetas

## 📋 Resumen

Se ha implementado un sistema completo para crear etiquetas de productos en DobleYo Café con dos opciones principales:

1. **Desde Lotes Preparados**: Genera etiquetas a partir de cafés ya procesados y listos para venta
2. **Crear de Cero**: Genera etiquetas personalizadas con un perfil de taza personalizado

## 📁 Archivos Creados

### Frontend

- ✅ **`src/pages/app/etiquetas.astro`** (766 líneas)
  - Página completa con dos tabs
  - Interfaz responsiva usando MobileLayout
  - Formularios con validación
  - Gestión de estado interactiva

### Backend

- ✅ **`server/routes/labels.js`** (Nueva ruta API completa)
  - `GET /prepared-lots` - Obtiene cafés preparados para venta
  - `POST /generate-from-lot` - Genera etiquetas desde lote
  - `POST /generate-from-scratch` - Genera etiquetas personalizadas
  - `GET /list` - Lista todas las etiquetas
  - `GET /:labelId` - Obtiene una etiqueta específica
  - `DELETE /:labelId` - Elimina una etiqueta

### Base de Datos

- ✅ **`db/schema.sql`** (Actualizado)

  - Tabla `generated_labels` - Almacena etiquetas generadas
  - Tabla `product_labels` - Vinculación con lotes (backup)
  - Índices para optimización

- ✅ **`server/migrations/add_labels_tables.js`**
  - Migración para crear tablas de etiquetas

### Documentación

- ✅ **`LABELS_SYSTEM.md`**
  - Guía completa del sistema
  - Endpoints API documentados
  - Flujos de proceso
  - Ejemplos de respuestas

## 🔧 Modificaciones a Archivos Existentes

### `server/index.js`

- ✅ Importado `labelsRouter` desde `./routes/labels.js`
- ✅ Registrado en rutas: `app.use('/api/labels', labelsRouter)`

### `db/schema.sql`

- ✅ Añadidas dos nuevas tablas con índices

## 📊 Estructura de Datos

### Tabla: `generated_labels`

```
- id: BIGINT (PK)
- label_code: VARCHAR UNIQUE
- lot_code: VARCHAR
- origin, variety, roast, process, altitude, farm: VARCHAR
- acidity, body, balance, score: Ratings
- flavor_notes: TEXT
- qr_data: JSON
- user_id: BIGINT (FK → users)
- printed, printed_at: Tracking
- sequence: INT
- created_at, updated_at: TIMESTAMP
```

### Tabla: `product_labels`

```
- id: BIGINT (PK)
- lot_id: BIGINT (FK → lots)
- label_code: VARCHAR UNIQUE
- sequence: INT
- qr_data: JSON
- printed, printed_at: Tracking
- created_at, updated_at: TIMESTAMP
```

## 🎯 Características Principales

### Tab 1: Desde Lotes Preparados

- ✅ Dropdown con cafés preparados para venta
- ✅ Información automática del lote cargada
- ✅ Perfil de taza mostrado en tarjeta informativa
- ✅ Cantidad de etiquetas configurable
- ✅ Opción de incluir QR
- ✅ Resumen antes de generar

### Tab 2: Crear de Cero

- ✅ Formulario completo para café personalizado
- ✅ Sliders interactivos para acidez, cuerpo, balance
- ✅ Puntuación calculada automáticamente
- ✅ Notas de sabor personalizable
- ✅ Cantidad de etiquetas configurable
- ✅ Resumen actualizado en tiempo real

### Característica General

- ✅ Interfaz de dos tabs limpia y moderna
- ✅ Responsiva (MobileLayout)
- ✅ Validación de formularios
- ✅ Alertas de error/éxito
- ✅ Cálculos automáticos
- ✅ Auditoría de acciones

## 🔌 Integración API

### Endpoints Disponibles

**GET** `/api/labels/prepared-lots`

- Retorna cafés preparados para venta
- Conecta con `packaged_coffee` + joins a `roasted_coffee`, `coffee_harvests`

**POST** `/api/labels/generate-from-lot`

- Genera etiquetas desde lote existente
- Guarda en `generated_labels`
- Registra auditoría

**POST** `/api/labels/generate-from-scratch`

- Genera etiquetas con perfil personalizado
- Crea código temporal único
- Guarda datos completos en BD

**GET** `/api/labels/list`

- Listado paginado de todas las etiquetas
- Filtrable por tipo

**GET** `/api/labels/:labelId`

- Obtiene una etiqueta específica

**DELETE** `/api/labels/:labelId`

- Elimina una etiqueta

## 🔐 Seguridad

- ✅ Autenticación JWT requerida
- ✅ Control de roles (solo admin/caficultor)
- ✅ Rate limiting aplicado
- ✅ Validación de entrada
- ✅ Log de auditoría completo
- ✅ Manejo seguro de errores

## 📍 Acceso

**Ruta interna**: `/app/etiquetas`

**Requisitos:**

- Usuario autenticado
- Rol: `admin` o `caficultor`
- Token JWT válido

## 🧪 Testing

Verificar:

1. ✅ Página carga correctamente
2. ✅ Dropdown muestra lotes preparados
3. ✅ Cambiar entre tabs funciona
4. ✅ Sliders actualizan valores
5. ✅ POST genera etiquetas correctamente
6. ✅ BD guarda registros
7. ✅ Auditoría registra acciones
8. ✅ Manejo de errores funciona

## 📈 Próximas Mejoras

- [ ] Exportar etiquetas a PDF
- [ ] Diseño personalizable de etiquetas
- [ ] Códigos de barras dinámicos
- [ ] Integración con impresoras
- [ ] Historial de impresiones
- [ ] Búsqueda y filtrado avanzado
- [ ] Plantillas guardadas
- [ ] Descarga masiva en lote

## 📝 Notas Técnicas

- La página usa `MobileLayout` para responsividad
- Todos los sliders usan rango 1-5 (estándar SCA)
- Puntuación se calcula como (acidez + cuerpo + balance) / 3
- QR se almacena como JSON en BD
- Auditoría se registra automáticamente
- Migraciones están en `server/migrations/`

## 🚀 Deployment

1. Ejecutar migración: `npm run migrate`
2. Reiniciar servidor
3. Acceder a `/app/etiquetas`
4. La página debería cargar sin errores

## 📞 Soporte

Para issues o preguntas, consultar:

- `LABELS_SYSTEM.md` - Documentación técnica completa
- `server/routes/labels.js` - Implementación API
- `src/pages/app/etiquetas.astro` - UI/UX

---

**Estado**: ✅ COMPLETO Y FUNCIONAL
**Fecha**: 13 de Enero de 2026
**Versión**: 1.0
