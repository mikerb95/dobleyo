# 🏷️ Sistema de Creación de Etiquetas - DobleYo Café

## Descripción General

Página de aplicación para crear etiquetas de productos con dos opciones:

1. **Desde Lotes Preparados**: Generar etiquetas a partir de cafés que ya han sido procesados y preparados para venta
2. **Crear de Cero**: Generar etiquetas personalizadas con un perfil de taza personalizado

## Ubicación

- **Página**: `/app/etiquetas`
- **Archivo**: `src/pages/app/etiquetas.astro`

## Características

### 1. Tab: Desde Lotes Preparados

**Flujo:**
1. Selecciona un lote que ya ha pasado por el proceso de packaging
2. Se cargan automáticamente:
   - Información del café (origen, variedad, tueste)
   - Propiedades de cata (acidez, cuerpo, balance, puntuación)
   - Peso disponible y presentación
3. Especifica cantidad de etiquetas a generar
4. Opción de incluir Código QR de trazabilidad

**Datos que se generan:**
- Código único de etiqueta
- Información completa del lote
- Perfil de taza
- QR opcional para trazabilidad

### 2. Tab: Crear de Cero

**Flujo:**
1. Ingresa información del café:
   - Origen (requerido)
   - Finca (opcional)
   - Variedad (requerido)
   - Nivel de Tueste (requerido)
   - Proceso (opcional)
   - Altitud (opcional)

2. Define el Perfil de Taza:
   - Acidez (1-5)
   - Cuerpo (1-5)
   - Balance (1-5)
   - La puntuación se calcula automáticamente

3. Notas de sabor (opcional)
4. Cantidad de etiquetas

**Datos que se generan:**
- Código temporal único para el lote
- Etiquetas con información personalizada
- QR con perfil completo

## API Endpoints

### GET `/api/labels/prepared-lots`
Obtiene lista de cafés preparados para venta (packaging completado)

**Respuesta:**
```json
[
  {
    "id": 1,
    "code": "COL-HUI-1800-CAT-HUM-01",
    "origin": "Huila",
    "farm": "Finca La Sierra",
    "variety": "Caturra",
    "roast": "Medio",
    "process": "Lavado",
    "presentation": "Molido",
    "grind": "Media-Fina",
    "acidity": 4,
    "body": 3,
    "balance": 4,
    "score": 3.67,
    "flavorNotes": "Chocolate, Caramelo, Nueces",
    "weight": 25.5,
    "packageSize": "500g",
    "unitCount": 51
  }
]
```

### POST `/api/labels/generate-from-lot`
Genera etiquetas desde un lote preparado

**Body:**
```json
{
  "lotId": 1,
  "quantity": 50,
  "includeQR": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "50 etiquetas generadas exitosamente",
  "labels": [
    {
      "id": "LBL-COL-HUI-1800-CAT-HUM-01-0001",
      "packagedCoffeeId": 1,
      "lotCode": "COL-HUI-1800-CAT-HUM-01",
      "origin": "Huila",
      "variety": "Caturra",
      "roast": "Medio",
      "presentation": "Molido",
      "acidity": 4,
      "body": 3,
      "balance": 4,
      "score": 3.67,
      "flavorNotes": "Chocolate, Caramelo, Nueces",
      "qrCode": "{...}",
      "sequence": 1
    }
  ]
}
```

### POST `/api/labels/generate-from-scratch`
Genera etiquetas con un perfil personalizado

**Body:**
```json
{
  "origin": "Sierra Nevada",
  "farm": "Finca La Aurora",
  "variety": "Caturra",
  "roast": "Medio",
  "process": "Lavado",
  "altitude": "1800 m",
  "acidity": 4,
  "body": 3,
  "balance": 4,
  "flavorNotes": "Chocolate, Nueces, Caramelo",
  "quantity": 25
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "25 etiquetas generadas exitosamente",
  "labels": [
    {
      "id": "LBL-TMP-SIE-CAT-1234567890-0001",
      "lotCode": "TMP-SIE-CAT-1234567890",
      "origin": "Sierra Nevada",
      "farm": "Finca La Aurora",
      "variety": "Caturra",
      "roast": "Medio",
      "process": "Lavado",
      "altitude": "1800 m",
      "acidity": 4,
      "body": 3,
      "balance": 4,
      "score": 3.67,
      "flavorNotes": "Chocolate, Nueces, Caramelo",
      "qrCode": "{...}",
      "sequence": 1
    }
  ]
}
```

### GET `/api/labels/list`
Obtiene todas las etiquetas generadas

**Query params:**
- `type`: 'all' | 'lots' | 'custom'
- `limit`: número de resultados (default: 100)
- `offset`: número de registros a saltar (default: 0)

**Respuesta:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "pages": 2
  }
}
```

### GET `/api/labels/:labelId`
Obtiene una etiqueta específica

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "label_code": "LBL-COL-HUI-1800-CAT-HUM-01-0001",
    "lot_code": "COL-HUI-1800-CAT-HUM-01",
    "origin": "Huila",
    "variety": "Caturra",
    "roast": "Medio",
    "acidity": 4,
    "body": 3,
    "balance": 4,
    "score": 3.67,
    "flavor_notes": "Chocolate, Caramelo, Nueces",
    "qr_data": "{...}",
    "created_at": "2026-01-13T10:30:00Z"
  }
}
```

### DELETE `/api/labels/:labelId`
Elimina una etiqueta

## Tablas de Base de Datos

### `generated_labels`
Almacena todas las etiquetas generadas

```sql
CREATE TABLE generated_labels (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    label_code VARCHAR(100) NOT NULL UNIQUE,
    lot_code VARCHAR(100),
    origin VARCHAR(160),
    variety VARCHAR(120),
    roast VARCHAR(80),
    process VARCHAR(80),
    altitude VARCHAR(60),
    farm VARCHAR(160),
    acidity INT,
    body INT,
    balance INT,
    score DECIMAL(4,1),
    flavor_notes TEXT,
    qr_data JSON,
    user_id BIGINT,
    printed BOOLEAN DEFAULT FALSE,
    printed_at TIMESTAMP NULL,
    sequence INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### `product_labels`
Etiquetas vinculadas a lotes específicos (backup/historial)

```sql
CREATE TABLE product_labels (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    lot_id BIGINT,
    label_code VARCHAR(100) NOT NULL UNIQUE,
    sequence INT,
    qr_data JSON,
    printed BOOLEAN DEFAULT FALSE,
    printed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
);
```

## Flujo Completo del Proceso

### Opción 1: Desde Lotes Preparados

```
Café Verde (Harvest)
    ↓
Enviar a Tostión (send-roasting)
    ↓
Recoger del Tueste (roast-retrieval)
    ↓
Almacenar Café Tostado (roasted-storage)
    ↓
Preparar para Venta (packaging) ← Aquí se guarda en packaged_coffee
    ↓
Crear Etiquetas (etiquetas) ← Desde lotes preparados
    ↓
Etiquetas generadas y listas para imprimir
```

### Opción 2: Crear de Cero

```
Perfil personalizado sin vinculación a lote
    ↓
Definir características (origen, variedad, tueste, perfil)
    ↓
Crear Etiquetas (etiquetas) ← De cero
    ↓
Etiquetas generadas con información personalizada
```

## Características de Seguridad

- ✅ Autenticación requerida (token JWT)
- ✅ Solo admin y caficultor pueden acceder
- ✅ Rate limiting en API
- ✅ Log de auditoría en cada generación
- ✅ Validación de campos requeridos
- ✅ Índices en BD para rendimiento

## Próximos Pasos

1. **Impresión de Etiquetas**
   - Generador PDF para etiquetas
   - Plantillas de diseño personalizable
   - Códigos de barras y QR

2. **Gestión Avanzada**
   - Historial de etiquetas generadas
   - Edición de etiquetas antes de imprimir
   - Descarga masiva en lote

3. **Integración**
   - Vinculación con MercadoLibre
   - Código QR dinámico con URL de trazabilidad
   - Etiquetas inteligentes (NFC)

## Notas Técnicas

- La página utiliza `MobileLayout` para responsividad
- Los sliders de perfil (acidez, cuerpo, balance) tienen rango 1-5
- La puntuación se calcula automáticamente como promedio
- Los códigos QR se generan en formato JSON
- Se registra auditoría de cada generación en `audit_logs`

## Archivos Relacionados

- **Página**: `src/pages/app/etiquetas.astro`
- **API Router**: `server/routes/labels.js`
- **Schema**: `db/schema.sql` (tablas `generated_labels`, `product_labels`)
- **Migración**: `server/migrations/add_labels_tables.js`
- **Servidor**: `server/index.js` (router registrado)

## Testing

Verificar que:
1. ✅ Endpoint GET `/api/labels/prepared-lots` retorna lotes correctamente
2. ✅ POST genera etiquetas desde lote existente
3. ✅ POST genera etiquetas de cero con perfil personalizado
4. ✅ Etiquetas se guardan en BD con información completa
5. ✅ Se registra auditoría
6. ✅ QR se genera correctamente (si está habilitado)
