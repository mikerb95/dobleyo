# 🏷️ Guía de Uso: Crear Etiquetas

## Acceso a la Página

1. Entra a `/app/etiquetas`
2. Requiere estar autenticado como admin o caficultor
3. Si no tienes acceso, verás un mensaje de error

## Opción 1: Desde Lotes Preparados

### Pasos:

1. **Haz clic en el tab "📦 Desde Lotes Preparados"**

   - Este es el tab por defecto

2. **Selecciona un lote del dropdown**

   - Se mostrará: "Lote - Variedad (Peso kg)"
   - Ejemplo: "COL-HUI-1800-CAT-HUM-01 - Caturra (25.5kg)"

3. **Revisa la información del café**

   - Se cargará automáticamente:
     - Lote ID
     - Origen (región)
     - Variedad
     - Nivel de tueste
     - Presentación (Grano/Molido)
     - Peso disponible
     - Propiedades de taza (Acidez, Cuerpo, Balance, Puntuación)

4. **Ingresa la cantidad de etiquetas**

   - ¿Cuántas etiquetas quieres imprimir?
   - Ejemplo: 25, 50, 100

5. **(Opcional) Incluir Código QR**

   - Marca la casilla si deseas incluir código QR
   - Los clientes podrán escanear para información de trazabilidad

6. **Revisa el resumen**

   - Se mostrará información de cuántas etiquetas se generarán
   - Qué perfil de taza incluirán

7. **Haz clic en "Generar Etiquetas"**
   - Se mostará confirmación: "✅ 25 etiquetas generadas exitosamente"

## Opción 2: Crear de Cero

### Pasos:

1. **Haz clic en el tab "✏️ Crear de Cero"**

   - Este tab es para etiquetas personalizadas

2. **Ingresa información del café:**

   **Requeridos:**

   - **Origen del Café**: Ejemplo "Sierra Nevada" o "Huila"
   - **Variedad**: Ejemplo "Caturra" o "Bourbon"
   - **Nivel de Tueste**: Selecciona "Claro", "Medio" u "Oscuro"

   **Opcionales:**

   - **Finca**: Ejemplo "Finca La Aurora"
   - **Proceso**: Selecciona "Lavado", "Natural", "Honey" o "Anaeróbico"
   - **Altitud**: Ejemplo "1800 m"

3. **Define el Perfil de Taza:**

   - Usa los sliders para cada propiedad
   - **Acidez**: De baja (1) a alta (5)
   - **Cuerpo**: De ligero (1) a pesado (5)
   - **Balance**: De desbalanceado (1) a muy balanceado (5)
   - La **Puntuación** se calcula automáticamente

4. **(Opcional) Notas de Sabor:**

   - Describe los sabores principales
   - Ejemplo: "Chocolate, Nueces, Caramelo, Frutas tropicales"

5. **Ingresa cantidad de etiquetas:**

   - ¿Cuántas etiquetas deseas?

6. **Revisa el resumen:**

   - Se mostrará el café, variedad, tueste y cantidad

7. **Haz clic en "Generar Etiquetas"**
   - Confirmación: "✅ 25 etiquetas generadas exitosamente"

## Información Generada

Cada etiqueta incluye:

### Desde Lotes Preparados:

- ✅ Código único (LBL-LOT-XXXX-NNNN)
- ✅ Lote original
- ✅ Origen exacto del café
- ✅ Variedad
- ✅ Tueste
- ✅ Presentación (Grano/Molido)
- ✅ Perfil de taza completo
- ✅ QR de trazabilidad (si está habilitado)

### Crear de Cero:

- ✅ Código único (LBL-TMP-XXX-NNNNN)
- ✅ Información personalizada
- ✅ Perfil de taza personalizado
- ✅ Notas de sabor

## Errores Comunes

### "No hay lotes preparados"

- Significa que no has terminado el proceso de packaging
- Ve a `/app/packaging` primero
- Prepara un café para venta
- Luego vuelve aquí

### "Faltan campos requeridos"

- Verifica que completes todos los campos marcados con \*
- En "Crear de Cero" necesitas: Origen, Variedad, Tueste
- En "Desde Lotes" necesitas: Seleccionar lote, cantidad

### "Error al cargar lotes"

- Recarga la página
- Verifica tu conexión
- Si persiste, contacta a administración

## Tips y Trucos

1. **Cambiar de tab**: Haz clic en los botones azules/grises en la parte superior

2. **Sliders**: Arrástralos para cambiar el valor (o haz clic donde desees)

3. **Resumen**: Se actualiza automáticamente mientras completas datos

4. **Múltiples generaciones**: Puedes generar varias tandas de etiquetas

   - Cada una tendrá códigos únicos

5. **QR**: Si incluyes QR, los clientes pueden escanear para:
   - Información de trazabilidad
   - Origen exacto del café
   - Perfil de taza

## Después de Generar

1. Las etiquetas se guardan en la base de datos
2. Se registra quién generó la etiqueta y cuándo
3. Puedes generar más etiquetas cuando lo necesites
4. En el futuro habrá opción de exportar a PDF para imprimir

## Preguntas Frecuentes

**P: ¿Puedo generar etiquetas desde lotes que ya tienen perfil?**

- R: Sí, si el café fue preparado para venta (packaging completado)

**P: ¿Qué significa "Crear de Cero"?**

- R: Etiquetas personalizadas sin vinculación a un lote específico, solo con tu perfil

**P: ¿Se pueden cambiar las etiquetas después?**

- R: Actualmente no, pero próximamente habrá edición y borrado

**P: ¿Para qué sirve el QR?**

- R: Para que los clientes puedan escanear y ver información del café (trazabilidad)

**P: ¿Cuál es la cantidad máxima de etiquetas?**

- R: Hasta 1000 en una sola generación

**P: ¿En qué formato se exportan?**

- R: Actualmente se guardan en BD. Próximamente habrá exportación a PDF

## Contacto

Para problemas o sugerencias:

- Contacta al administrador
- Reporta bugs en el sistema
- Sugiere mejoras

---

**Última actualización**: 13 de Enero de 2026
