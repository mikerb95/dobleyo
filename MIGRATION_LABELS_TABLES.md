# Migración: Crear Tablas de Etiquetas

Las tablas `product_labels` y `generated_labels` son necesarias para que funcione la funcionalidad de etiquetas (`/app/etiquetas`).

## ¿Por qué?
Estas tablas fueron agregadas al schema pero pueden no existir en la base de datos de producción.

## Cómo ejecutar

### Opción 1: Localmente (desarrollo)
```bash
node server/migrations/create_labels_tables.js
```

### Opción 2: En Vercel/Production
Si tienes acceso SSH a la base de datos:

```bash
# 1. Conéctate al servidor donde está la base de datos
# 2. Ejecuta desde el directorio del proyecto:
node server/migrations/create_labels_tables.js
```

O ejecuta directamente el SQL:

```sql
-- Tabla product_labels
CREATE TABLE IF NOT EXISTS product_labels (
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
CREATE INDEX IF NOT EXISTS idx_product_labels_lot ON product_labels(lot_id);
CREATE INDEX IF NOT EXISTS idx_product_labels_code ON product_labels(label_code);
CREATE INDEX IF NOT EXISTS idx_product_labels_printed ON product_labels(printed);

-- Tabla generated_labels
CREATE TABLE IF NOT EXISTS generated_labels (
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
CREATE INDEX IF NOT EXISTS idx_generated_labels_code ON generated_labels(label_code);
CREATE INDEX IF NOT EXISTS idx_generated_labels_lot_code ON generated_labels(lot_code);
CREATE INDEX IF NOT EXISTS idx_generated_labels_user ON generated_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_labels_printed ON generated_labels(printed);
CREATE INDEX IF NOT EXISTS idx_generated_labels_created ON generated_labels(created_at);
```

## Qué hace

✅ Crea la tabla `product_labels` con todas las columnas e índices necesarios
✅ Crea la tabla `generated_labels` con todas las columnas e índices necesarios
✅ Usa `CREATE TABLE IF NOT EXISTS` para no fallar si ya existen
✅ Establece las relaciones (FOREIGN KEYS) correctamente

## Después de ejecutar

Una vez ejecutada, estas tablas estarán disponibles y podrá usarse completamente:
- ✅ Página `/app/etiquetas` funcionará
- ✅ Crear etiquetas desde lotes
- ✅ Crear etiquetas personalizadas
- ✅ Guardar etiquetas generadas
