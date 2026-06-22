# Exposición — Módulo Python · DobleYo Café

## Qué es esto

El proyecto tiene **dos funciones escritas en Python** que corren en Vercel como serverless functions. Son independientes del backend Node.js pero comparten la misma base de datos (Turso/SQLite).

---

## Función 1 — Pronóstico de demanda (`api/ml/recompute.py`)

### Qué hace
Lee las ventas históricas de MercadoLibre y predice cuánto se va a vender en las **próximas 8 semanas**, por producto y en ingresos totales.

### Cómo funciona paso a paso
1. Lee la tabla `sales_tracking` (órdenes reales de MercadoLibre)
2. Agrupa las ventas por semana y por producto
3. Aplica un modelo matemático:
   - Si hay **6+ semanas** de historia → usa **Suavizado exponencial de Holt** (captura tendencia)
   - Si hay **menos de 6** → usa **Media móvil** de las últimas 4 semanas
4. Calcula una banda de confianza del ~95%
5. Guarda el resultado en la tabla `demand_forecasts`

### Cómo se invoca
- **Automáticamente** cada noche (Vercel Cron Job)
- **Manualmente** con el botón "Recalcular ahora" en `/admin/python`

### Qué muestra en pantalla
- KPIs: ingresos proyectados 4 semanas, SKUs con demanda, sugerencias de reorden
- Gráfico de barras con ingresos por semana (8 semanas)
- Tabla por producto: unidades proyectadas, stock actual, señal de reorden

---

## Función 2 — Registro manual de demanda (`api/ml/demand.py`)

### Qué hace
CRUD completo (Crear, Leer, Actualizar, Eliminar) de una tabla `demand_records` donde el operador registra demanda **a mano**.

### Para qué sirve
Capturar demanda que el sistema no ve automáticamente:
- Pedidos B2B por fuera de MercadoLibre
- Eventos especiales (ferias, lanzamientos)
- Estimaciones del equipo comercial

### Cómo se invoca
Con el formulario en la parte inferior de `/admin/python`:
- Seleccionar categoría, producto, período (semana o mes) y cantidad
- Botones Crear / Editar / Borrar
- Exportar a Excel con filtros

### Relación con el pronóstico
**Hoy: ninguna.** Los dos módulos son independientes — `recompute.py` no lee `demand_records`. Es la base para una siguiente fase donde el modelo combinaría ventas reales + registros manuales para mejorar la predicción.

---

## Los parámetros que se pueden cambiar en vivo

Están al inicio de `api/ml/recompute.py` (líneas 31–35):

```python
HORIZON_WEEKS = 8       # semanas a pronosticar → cambiar a 4 o 12
MIN_WEEKS_HOLT = 6      # historia mínima para Holt → bajar a 3 activa Holt antes
MOVING_AVG_WINDOW = 4   # ventana del promedio → 2 = más reactivo, 8 = más suavizado
Z_95 = 1.96             # ancho de la banda de confianza → 1.0 = banda más angosta
```

### Demo en clase
1. Cambiar el valor en el archivo
2. Hacer deploy (`vercel --prod`) o usar `vercel dev`
3. Presionar **"Recalcular ahora"** en la página
4. El gráfico se actualiza solo

---

## Arquitectura resumida

```
MercadoLibre
     │
     ▼
sales_tracking (BD)
     │
     ▼
recompute.py ──── modelo Holt / media móvil ──── demand_forecasts (BD)
                                                        │
                                                        ▼
                                               Gráfico + KPIs en /admin/python

demand_records (BD) ◄──── demand.py ◄──── Formulario admin
      │
      └── (desconectado hoy, integración = siguiente fase)
```

---

## Frase para cerrar la exposición

> *"Implementamos dos capas de inteligencia: una que aprende sola de las ventas históricas usando suavizado exponencial, y otra donde el equipo puede registrar señales de mercado que el algoritmo aún no captura. La integración de ambas fuentes es el siguiente paso de desarrollo."*
