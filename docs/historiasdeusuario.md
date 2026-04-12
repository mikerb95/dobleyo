# Historias de Usuario — DobleYo Café

> **Documento vivo.** Cada historia tiene un ID único (HU-XXX) para trazabilidad con requisitos funcionales.  
> **Formato:** Como [rol], quiero [acción], para [beneficio].  
> **Última actualización:** 2026-04-12  
> **Estado:** En producción (Fases 0–12 completadas)

---

## Índice de Módulos

| Módulo | Historias |
|--------|-----------|
| [Tienda Online (Colombia)](#módulo-tienda-online-colombia) | HU-001 a HU-008 |
| [Tienda Internacional (USA)](#módulo-tienda-internacional-usa--inglés) | HU-009 a HU-010 |
| [Autenticación y Cuenta](#módulo-autenticación-y-cuenta) | HU-011 a HU-014 |
| [Trazabilidad y Cadena de Producción](#módulo-trazabilidad-y-cadena-de-producción) | HU-020 a HU-028 |
| [Control de Calidad (Cupping)](#módulo-control-de-calidad-cupping) | HU-030 a HU-031 |
| [Órdenes de Producción](#módulo-órdenes-de-producción) | HU-035 a HU-037 |
| [Gestión de Inventario](#módulo-gestión-de-inventario) | HU-040 a HU-043 |
| [Etiquetas y QR](#módulo-etiquetas-y-qr) | HU-045 a HU-047 |
| [Fincas y Caficultores](#módulo-fincas-y-caficultores) | HU-050 a HU-054 |
| [Integración MercadoLibre](#módulo-integración-mercadolibre) | HU-060 a HU-063 |
| [Finanzas de Producción](#módulo-finanzas-de-producción) | HU-070 a HU-075 |
| [Panel de Administración](#módulo-panel-de-administración) | HU-080 a HU-086 |
| [Mapa de Calor (Admin)](#módulo-mapa-de-calor-admin) | HU-090 a HU-091 |
| [Compliance Legal (Colombia)](#módulo-compliance-legal-colombia) | HU-095 a HU-098 |
| [SEO y Rendimiento](#módulo-seo-y-rendimiento) | HU-100 a HU-101 |
| [Seguridad](#módulo-seguridad) | HU-105 a HU-108 |
| [Funcionalidades Aspiracionales (Roadmap)](#funcionalidades-aspiracionales-roadmap) | HU-200+ |

---

## Módulo: Tienda Online (Colombia)

### HU-001: Navegar catálogo de productos
**Como** cliente,  
**Quiero** ver todos los cafés y accesorios disponibles con filtros por categoría, origen, proceso, tueste y precio,  
**Para** encontrar fácilmente el producto que busco.

**Criterios de aceptación:**
- Puedo filtrar por múltiples criterios simultáneamente
- Puedo ordenar por precio, nombre, novedad
- Veo foto, nombre, precio, origen y notas breves de cada producto
- La vista carga en menos de 3 segundos
- Funciona correctamente en móvil (320px+)

**Estado:** ✅ Implementado — `src/pages/tienda.astro`

---

### HU-002: Ver detalle de un producto
**Como** cliente,  
**Quiero** ver la página completa de un producto con fotos, descripción, perfil de sabor, datos de origen, método de preparación y precio,  
**Para** tomar una decisión de compra informada.

**Criterios de aceptación:**
- Galería de fotos del producto
- Datos de origen: finca, altitud, variedad, proceso, tueste
- Notas de cata (sabor, aroma, acidez, cuerpo)
- Botón "Agregar al carrito" con selector de cantidad y presentación (250g / 500g / 1kg)
- Productos relacionados de la misma finca o categoría
- Enlace a la landing de la finca de origen
- Datos de trazabilidad vinculados al lote más reciente

**Estado:** ✅ Implementado — `src/pages/producto/[slug].astro`

---

### HU-003: Agregar productos al carrito
**Como** cliente,  
**Quiero** agregar productos al carrito desde la tienda o la página de detalle,  
**Para** acumular los productos que deseo comprar.

**Criterios de aceptación:**
- El carrito persiste entre sesiones (localStorage)
- Puedo modificar cantidades desde el carrito
- Puedo eliminar ítems del carrito
- Veo un contador de ítems en el header
- El subtotal se actualiza en tiempo real
- Se muestra un resumen claro antes del checkout

**Estado:** ✅ Implementado — `src/pages/carrito.astro`, `public/assets/js/cart.js`

---

### HU-004: Completar una compra
**Como** cliente,  
**Quiero** ingresar mis datos de envío, seleccionar método de pago (Wompi) y completar la transacción,  
**Para** recibir mi café en casa.

**Criterios de aceptación:**
- Formulario de envío con validación (nombre, dirección, departamento, ciudad, barrio, teléfono, email)
- Puedo pagar con PSE, tarjeta crédito/débito, Nequi (vía Wompi)
- Recibo confirmación en pantalla y por email
- La orden queda registrada en la BD con estado `paid`
- El inventario se descuenta al confirmar el pago
- La dirección de envío se geocodifica para el mapa de calor
- Envío gratis a partir de $120.000 COP

**Estado:** ✅ Implementado — `src/pages/checkout.astro`, `server/routes/orders.js`

---

### HU-005: Ver confirmación de pedido
**Como** cliente que acaba de comprar,  
**Quiero** ver una página de confirmación con el número de pedido y un resumen de mi compra,  
**Para** tener certeza de que mi orden fue procesada correctamente.

**Criterios de aceptación:**
- Número de referencia de pedido visible
- Resumen de ítems, precios y total
- Dirección de envío confirmada
- Instrucciones de seguimiento
- Botón para ver historial de pedidos
- Email de confirmación enviado automáticamente

**Estado:** ✅ Implementado — `src/pages/confirmacion.astro`

---

### HU-006: Ver historial de pedidos
**Como** cliente registrado,  
**Quiero** ver mis pedidos anteriores con su estado actual,  
**Para** rastrear mis compras y saber cuándo llegarán.

**Criterios de aceptación:**
- Lista de pedidos con fecha, total y estado (pendiente, pagado, en proceso, enviado, entregado)
- Detalle de cada pedido con ítems, cantidades y precios
- Enlace de seguimiento de envío cuando aplique

**Estado:** ✅ Implementado — `src/pages/cuenta.astro`

---

### HU-007: Escanear QR del empaque
**Como** comprador de café DobleYo,  
**Quiero** escanear el código QR del empaque con mi teléfono,  
**Para** ver la trazabilidad completa de mi café: finca, altitud, variedad, fecha de cosecha, perfil de tueste, puntuación SCA.

**Criterios de aceptación:**
- El QR abre una URL tipo `dobleyo.cafe/t/DBY-2026-01-001`
- La página muestra timeline visual: Cosecha → Secado → Tostión → Empaque
- Veo datos de la finca con foto y mapa
- Puedo ver la puntuación SCA del cupping
- Funciona perfectamente en móvil (caso de uso principal)
- Carga sin necesidad de login

**Estado:** ✅ Implementado — `src/pages/t/[code].astro`, `src/pages/trazabilidad.astro`

---

### HU-008: Contactar a DobleYo
**Como** visitante o cliente,  
**Quiero** enviar un mensaje a través del formulario de contacto,  
**Para** resolver dudas, hacer sugerencias o reportar problemas.

**Criterios de aceptación:**
- Formulario con nombre, email, asunto y mensaje
- Mensaje se guarda en BD y envía notificación al admin por email
- El usuario recibe confirmación visual y por email
- Rate limiting para evitar spam

**Estado:** ✅ Implementado — `src/pages/contacto.astro`, `server/routes/contact.js`

---

## Módulo: Tienda Internacional (USA / Inglés)

### HU-009: Navegar tienda en inglés
**Como** cliente angloparlante (USA),  
**Quiero** navegar la tienda completa en inglés con precios en USD,  
**Para** comprar café colombiano de especialidad entendiendo toda la información.

**Criterios de aceptación:**
- Toda la navegación, productos, checkout y legales están en inglés
- Precios en USD con tipo de cambio actualizado
- Dominio `en.dobleyo.cafe`
- SEO optimizado para mercado USA (meta tags en inglés, hreflang)
- `<html lang="en">` correcto

**Estado:** ✅ Implementado — `src/pages/en/`

---

### HU-010: Ver información de envíos internacionales
**Como** cliente internacional,  
**Quiero** ver los tiempos de tránsito, costos estimados y proceso de envío a mi país,  
**Para** decidir si quiero comprar y saber cuándo recibiré mi pedido.

**Criterios de aceptación:**
- Tabla de tiempos por destino (USA, Europa, etc.)
- Explicación del proceso de exportación
- FAQ sobre aduanas e impuestos de importación
- Información sobre carriers (DHL, FedEx)

**Estado:** ✅ Implementado — `src/pages/envios-devoluciones.astro`

---

## Módulo: Autenticación y Cuenta

### HU-011: Registrarse como cliente
**Como** visitante,  
**Quiero** crear una cuenta con email y contraseña,  
**Para** comprar productos, guardar mis datos y ver mi historial.

**Criterios de aceptación:**
- Registro con email, nombre, apellido, contraseña (mínimo 8 chars, con número y símbolo)
- Verificación de email obligatoria (enlace con token de un solo uso)
- No se puede comprar sin verificar email
- Mensaje de error claro si el email ya existe

**Estado:** ✅ Implementado — `src/pages/registro.astro`, `server/routes/auth.js`

---

### HU-012: Iniciar sesión
**Como** cliente registrado,  
**Quiero** iniciar sesión con mi email y contraseña,  
**Para** acceder a mi cuenta, historial y configuración.

**Criterios de aceptación:**
- Login con email y contraseña
- Sesión persiste vía HttpOnly cookie (JWT, 15min) + refresh token (7 días)
- Mensaje de error claro en credenciales inválidas
- Redirección al destino original después del login
- Auto-refresh del token cada 12 minutos (background)

**Estado:** ✅ Implementado — `src/pages/login.astro`, `public/assets/js/auth-refresh.js`

---

### HU-013: Gestionar mi cuenta
**Como** cliente registrado,  
**Quiero** ver y editar mis datos personales (nombre, dirección, teléfono),  
**Para** mantener mi información actualizada para futuros envíos.

**Estado:** ✅ Implementado — `src/pages/cuenta.astro`

---

### HU-014: Solicitar acceso como caficultor
**Como** productor de café,  
**Quiero** solicitar acceso al sistema como caficultor vinculando mis datos de finca,  
**Para** registrar mis cosechas y seguir la cadena de trazabilidad de mi café.

**Criterios de aceptación:**
- Formulario de solicitud con datos de finca (nombre, región, altitud, variedades)
- El admin recibe notificación y puede aprobar o rechazar
- Al aprobar, el usuario recibe rol `caficultor` y acceso al módulo app
- El caficultor solo puede ver y gestionar sus propias fincas y cosechas

**Estado:** ✅ Implementado — `src/pages/solicitar-caficultor.astro`, `server/routes/caficultor.js`

---

## Módulo: Trazabilidad y Cadena de Producción

### HU-020: Registrar cosecha en finca
**Como** caficultor o admin,  
**Quiero** registrar una cosecha indicando finca, variedad, peso, fecha y altitud,  
**Para** iniciar la cadena de trazabilidad del lote.

**Criterios de aceptación:**
- Formulario con: finca, variedad, peso en kg, fecha de cosecha, método de procesamiento, notas
- Se crea un lote con código único `DBY-YYYY-MM-XXX`
- El lote queda en estado `cosechado`
- El caficultor solo puede registrar cosechas en sus propias fincas
- El código de lote es único y generado con `crypto.randomBytes()`

**Estado:** ✅ Implementado — `src/pages/app/harvest.astro`, `server/routes/coffee.js`

---

### HU-021: Procesar café verde (almacenamiento)
**Como** operador de producción,  
**Quiero** registrar el ingreso de café verde al almacén con datos de secado y procesamiento,  
**Para** continuar la trazabilidad y controlar el inventario verde.

**Criterios de aceptación:**
- Registrar peso de ingreso al almacén verde
- Tipo de proceso (lavado, natural, honey, anaeróbico)
- Fecha de inicio y fin de secado
- Humedad final
- El lote pasa a estado `almacenado_verde`

**Estado:** ✅ Implementado — `src/pages/app/inventory-storage.astro`

---

### HU-022: Enviar lote a tostión
**Como** operador de producción,  
**Quiero** seleccionar un lote de café verde y registrar su envío al tostador,  
**Para** iniciar el proceso de tostión con trazabilidad completa.

**Criterios de aceptación:**
- Seleccionar lote disponible en almacén verde
- Registrar peso enviado y fecha
- Notas especiales para el tostador
- El lote pasa a estado `en_tostión`

**Estado:** ✅ Implementado — `src/pages/app/send-roasting.astro`

---

### HU-023: Registrar resultado de tostión
**Como** tostador o admin,  
**Quiero** registrar los datos de la tostión (perfil, temperatura, duración, peso final, merma),  
**Para** documentar el proceso y calcular la pérdida de peso.

**Criterios de aceptación:**
- Datos: perfil de tueste (claro/medio/oscuro), temperatura máxima, duración, peso inicial vs final
- Cálculo automático de merma (%)
- Notas del tostador
- Fecha y hora exacta
- El lote pasa a estado `tostado`

**Estado:** ✅ Implementado — `src/pages/app/roast-retrieval.astro`, `src/components/RoastForm.jsx`

---

### HU-024: Gestionar almacén de café tostado
**Como** operador de producción,  
**Quiero** ver el inventario de café tostado disponible por lote, fecha de tostión y cantidad,  
**Para** saber qué hay disponible para empaquetar.

**Criterios de aceptación:**
- Lista de lotes tostados con cantidad disponible
- Ver detalle de cada lote (cosecha origen, perfil de tueste, merma)
- Alertas de lotes con más de 30 días sin empaquetar

**Estado:** ✅ Implementado — `src/pages/app/roasted-storage.astro`, `src/pages/app/roasted-storage-detail.astro`

---

### HU-025: Empaquetar café tostado
**Como** operador de empaque,  
**Quiero** registrar el empaquetado de un lote indicando peso por unidad, cantidad de bolsas y tipo de empaque,  
**Para** tener registro del producto final listo para venta.

**Criterios de aceptación:**
- Seleccionar lote tostado disponible
- Configurar: presentación (250g, 500g, 1kg), tipo de empaque (bolsa kraft, bolsa doypack, lata), cantidad de unidades
- Registro de fecha y operador
- Cálculo automático de peso total empaquetado
- El lote pasa a estado `empaquetado`

**Estado:** ✅ Implementado — `src/pages/app/packaging.astro`

---

### HU-026: Ver historial de lotes
**Como** admin u operador,  
**Quiero** ver todos los lotes con su estado actual y el historial de pasos por los que han pasado,  
**Para** rastrear la producción completa y detectar cuellos de botella.

**Criterios de aceptación:**
- Lista paginada de lotes con filtros por estado, finca, fecha
- Timeline detallado de cada lote (cosecha → verde → tostión → empaque → venta)
- Identificar lotes "atascados" en un estado por más tiempo del normal

**Estado:** ✅ Implementado — `src/pages/app/lotes.astro`, `src/pages/admin/lotes.astro`

---

### HU-027: Ver lotes entregados
**Como** admin,  
**Quiero** ver los lotes que ya fueron empaquetados y entregados a clientes,  
**Para** tener un registro histórico de la producción vendida.

**Estado:** ✅ Implementado — `src/pages/app/lotes-entregados.astro`

---

### HU-028: Buscar lote por código manualmente
**Como** operador o cliente,  
**Quiero** buscar un lote ingresando su código manualmente en la página de trazabilidad,  
**Para** obtener información cuando no tengo el código QR a mano.

**Criterios de aceptación:**
- Campo de búsqueda en `dobleyo.cafe/trazabilidad`
- Acepta código completo o parcial
- Muestra resultados con estado y datos básicos del lote

**Estado:** ✅ Implementado — `src/pages/trazabilidad.astro`

---

## Módulo: Control de Calidad (Cupping)

### HU-030: Registrar sesión de cupping SCA
**Como** catador o admin,  
**Quiero** registrar una sesión de cupping SCA con puntuaciones por atributo (aroma, sabor, retrogusto, acidez, cuerpo, uniformidad, taza limpia, dulzura, balance, overall),  
**Para** asignar una calificación oficial al lote y mostrarla en la página de trazabilidad.

**Criterios de aceptación:**
- Formulario con los 10 atributos del protocolo SCA (escala 6.00 – 10.00 con pasos de 0.25)
- Cálculo automático del puntaje total
- Clasificación automática (Specialty ≥ 80, Premium 70–79, Commodity < 70)
- Múltiples catadores por lote (promedio de sesiones)
- El puntaje aparece en la página pública de trazabilidad del lote

**Estado:** ✅ Implementado — `src/pages/app/cupping.astro`

---

### HU-031: Ver estadísticas de calidad
**Como** admin,  
**Quiero** ver el promedio de puntaje SCA por finca, variedad y período,  
**Para** identificar qué fincas y procesos producen cafés de mayor calidad.

**Estado:** ✅ Implementado — `src/pages/app/estadisticas.astro`

---

## Módulo: Órdenes de Producción

### HU-035: Crear orden de producción
**Como** admin u operador de producción,  
**Quiero** crear una orden de manufactura que vincule lotes de café verde con cantidades y fechas planificadas de tostión y empaque,  
**Para** planificar y controlar el flujo de producción.

**Criterios de aceptación:**
- Vincular uno o más lotes de café verde
- Definir cantidades, fechas de inicio/fin planificadas
- Estado inicial: `planificado`
- Asignar operario responsable

**Estado:** ✅ Implementado — `server/routes/production/`

---

### HU-036: Seguir el estado de una orden de producción
**Como** admin u operador,  
**Quiero** ver el progreso de las órdenes de producción en tiempo real,  
**Para** saber qué órdenes están pendientes, en proceso o completadas.

**Criterios de aceptación:**
- Dashboard con órdenes por estado (planificado, en_proceso, completado, cancelado)
- Alertas de órdenes atrasadas respecto a la fecha planificada
- Histórico de cambios de estado

**Estado:** ✅ Implementado — `src/pages/app/inventario.astro`

---

### HU-037: Registrar controles de calidad por orden
**Como** supervisor de calidad,  
**Quiero** registrar inspecciones de calidad vinculadas a órdenes de producción,  
**Para** documentar el cumplimiento de estándares en cada lote producido.

**Estado:** ✅ Implementado — `server/routes/production/quality.js`

---

## Módulo: Gestión de Inventario

### HU-040: Ver inventario de productos terminados
**Como** admin u operador,  
**Quiero** ver el stock actual de cada producto (café empaquetado y accesorios) con alertas de stock bajo,  
**Para** saber cuándo reponer y qué hay disponible para vender.

**Criterios de aceptación:**
- Lista de productos con stock actual, stock mínimo y stock máximo
- Indicador visual (verde/amarillo/rojo) según nivel de stock
- Historial de movimientos de inventario (entradas, salidas, ajustes)
- Alertas cuando un producto cae por debajo del stock mínimo

**Estado:** ✅ Implementado — `src/pages/admin/inventario.astro`, `src/pages/app/inventario.astro`

---

### HU-041: Registrar movimiento de inventario
**Como** admin u operador,  
**Quiero** registrar entradas (producción, compras a proveedor) y salidas (ventas, merma, ajustes) de inventario,  
**Para** mantener el stock actualizado.

**Criterios de aceptación:**
- Tipo de movimiento: entrada, salida, ajuste, merma, devolución
- Motivo/referencia obligatoria
- El movimiento queda auditado (usuario + timestamp)

**Estado:** ✅ Implementado — `server/routes/inventory.js`

---

### HU-042: Gestionar productos del catálogo
**Como** admin,  
**Quiero** crear, editar, activar/desactivar productos con fotos, precios, descripciones y clasificación,  
**Para** mantener el catálogo de la tienda actualizado.

**Criterios de aceptación:**
- CRUD completo de productos
- Campos: nombre, slug, descripción, categoría, origen, proceso, tueste, notas de cata, precio COP, precio USD, peso, imagen, activo/inactivo
- Los cambios se reflejan inmediatamente en la tienda
- Validación de slug único

**Estado:** ✅ Implementado — `src/pages/app/productos.astro`, `server/routes/products.js`

---

### HU-043: Gestionar proveedores
**Como** admin,  
**Quiero** registrar y gestionar proveedores de materiales (bolsas, cajas, insumos) y sus datos de contacto,  
**Para** tener un directorio centralizado de proveedores.

**Estado:** ✅ Implementado — `server/routes/inventory.js`

---

## Módulo: Etiquetas y QR

### HU-045: Generar etiqueta con código QR para un lote
**Como** operador o admin,  
**Quiero** generar una etiqueta imprimible con QR para un lote empaquetado,  
**Para** que el cliente final pueda escanear y ver la trazabilidad.

**Criterios de aceptación:**
- El QR apunta a `dobleyo.cafe/t/{código_lote}`
- La etiqueta incluye: nombre del producto, origen, tueste, fecha de tostión, peso neto, nombre de finca
- Formato imprimible (PDF o imagen de alta resolución)
- Se registra en BD qué etiquetas fueron generadas y por quién

**Estado:** ✅ Implementado — `src/pages/app/etiquetas.astro`, `server/routes/labels.js`

---

### HU-046: Ver historial de etiquetas generadas
**Como** admin,  
**Quiero** ver todas las etiquetas generadas con fecha, lote asociado y usuario que las generó,  
**Para** auditar la producción de etiquetas y prevenir duplicados.

**Estado:** ✅ Implementado — `server/routes/labels.js`

---

### HU-047: Asignar etiqueta a empaque específico
**Como** operador,  
**Quiero** vincular una etiqueta generada a un empaque individual (número de unidad dentro del lote),  
**Para** rastrear cada bolsa específica de café vendida.

**Estado:** ✅ Implementado — `server/routes/labels.js`

---

## Módulo: Fincas y Caficultores

### HU-050: Ver landing de una finca
**Como** visitante o cliente,  
**Quiero** ver una página atractiva de la finca con foto hero, datos del caficultor, altitud, región, variedades y galería,  
**Para** conocer el origen de mi café y conectar con la historia detrás del producto.

**Criterios de aceptación:**
- Hero full-width con foto de finca + nombre + altitud + región
- Sección del caficultor con foto y biografía
- Galería de fotos
- Cafés disponibles de esa finca vinculados a la tienda
- Mapa con ubicación geográfica
- Estilo coherente con el resto del sitio, mobile-first

**Estado:** ✅ Implementado — `src/pages/finca/[slug].astro`, `src/pages/fincas.astro`

---

### HU-051: Administrar fincas desde el panel admin
**Como** admin,  
**Quiero** crear, editar y gestionar las fincas proveedoras con todos sus datos (fotos, descripción, caficultor asociado, coordenadas),  
**Para** mantener actualizada la información de origen mostrada al público.

**Estado:** ✅ Implementado — `server/routes/farms.js`

---

### HU-052: Ver mis datos de finca (caficultor)
**Como** caficultor,  
**Quiero** ver y editar los datos de mi finca en la app,  
**Para** mantener actualizada la información que se muestra públicamente.

**Criterios de aceptación:**
- El caficultor solo puede editar su propia finca
- Puede actualizar: descripción, galería de fotos, variedades cultivadas, altitud
- Los cambios requieren aprobación del admin antes de publicarse

**Estado:** ✅ Implementado — `src/pages/app/mi-finca.astro`

---

### HU-053: Aprobar o rechazar solicitud de caficultor
**Como** admin,  
**Quiero** revisar las solicitudes de acceso de nuevos caficultores y aprobar o rechazar su registro,  
**Para** controlar quién tiene acceso al módulo de producción.

**Criterios de aceptación:**
- Lista de solicitudes pendientes con datos del solicitante
- Botones de aprobar / rechazar con comentario opcional
- Al aprobar: se asigna rol `caficultor`, se crea registro de finca, se envía email de bienvenida
- Al rechazar: se envía email con motivo

**Estado:** ✅ Implementado — `server/routes/caficultor.js`

---

### HU-054: Ver estadísticas por finca
**Como** admin,  
**Quiero** ver el histórico de producción de cada finca (kg cosechados, kg tostados, puntaje SCA promedio),  
**Para** evaluar el desempeño de cada proveedor.

**Estado:** ✅ Implementado — `src/pages/app/estadisticas.astro`

---

## Módulo: Integración MercadoLibre

### HU-060: Sincronizar órdenes de MercadoLibre
**Como** admin,  
**Quiero** sincronizar automáticamente las ventas de MercadoLibre con el sistema,  
**Para** tener un registro unificado de todas las ventas en un solo lugar.

**Criterios de aceptación:**
- Las órdenes de ML se importan con datos del comprador, artículos, monto, estado y fecha
- Las órdenes se geocodifican (ciudad/barrio del comprador) para el mapa de calor
- Sync manual disponible + sync automático vía webhook
- Indicador de última sincronización exitosa

**Estado:** ✅ Implementado — `src/pages/app/ventas.astro`, `server/routes/mercadolibre.js`, `server/services/mercadolibre.js`

---

### HU-061: Ver reporte de ventas MercadoLibre
**Como** admin,  
**Quiero** ver las ventas de MercadoLibre con filtros por período, producto y estado,  
**Para** analizar el rendimiento del canal de venta externo.

**Criterios de aceptación:**
- Tabla paginada con ventas ML
- Filtros: fecha, estado, producto
- Métricas: total vendido, unidades, ticket promedio
- Comparativo canal ML vs tienda directa

**Estado:** ✅ Implementado — `src/components/SalesTable.jsx`

---

### HU-062: Ver mapa de calor unificado (ML + Tienda)
**Como** admin,  
**Quiero** ver un mapa de calor que combine las ventas de MercadoLibre y de la tienda directa,  
**Para** identificar zonas geográficas de alta demanda.

**Estado:** ✅ Implementado — `src/pages/admin/sales-map.astro`, `src/components/SalesHeatmap.jsx`

---

### HU-063: Gestionar token de acceso ML
**Como** admin,  
**Quiero** actualizar el token de acceso de MercadoLibre cuando expire,  
**Para** mantener la sincronización funcionando sin interrupciones.

**Estado:** ✅ Implementado — `src/pages/app/ventas.astro`, `server/routes/mercadolibre.js`

---

## Módulo: Finanzas de Producción

### HU-070: Ver dashboard financiero
**Como** admin,  
**Quiero** ver un resumen financiero con ingresos, gastos, margen por producto y flujo de caja,  
**Para** tomar decisiones informadas sobre la operación.

**Criterios de aceptación:**
- P&L (Profit & Loss) por período seleccionable (semana, mes, trimestre, año)
- Costo por kg producido (verde → tostado → empaquetado)
- Margen bruto por producto
- Comparativo real vs presupuesto

**Estado:** ✅ Implementado — `src/pages/app/finanzas.astro`, `src/pages/admin/finanzas.astro`

---

### HU-071: Registrar gastos operativos
**Como** admin,  
**Quiero** registrar gastos (materia prima, mano de obra, servicios, transporte) con aprobación,  
**Para** tener visibilidad completa de los costos de producción.

**Criterios de aceptación:**
- Categorías de gasto: materia prima, mano de obra, packaging, logística, servicios, otros
- Adjuntar soporte (imagen de factura) — fase futura
- Flujo de aprobación para gastos mayores a un umbral
- Integración con asientos contables (doble partida)

**Estado:** ✅ Implementado — `server/routes/finance.js`

---

### HU-072: Gestionar presupuestos
**Como** admin,  
**Quiero** crear presupuestos mensuales/trimestrales y comparar con gastos reales,  
**Para** controlar la ejecución presupuestal.

**Estado:** ✅ Implementado — `server/routes/finance.js`

---

### HU-073: Ver asientos contables
**Como** admin con conocimientos de contabilidad,  
**Quiero** ver y gestionar el libro diario con asientos de doble partida,  
**Para** mantener la contabilidad formal de la operación.

**Criterios de aceptación:**
- Plan de cuentas configurable
- Asientos automáticos al registrar ventas, gastos y movimientos de inventario
- Balance de sumas y saldos
- Export a Excel

**Estado:** ✅ Implementado — `server/routes/finance.js` (tablas: `accounting_entries`, `accounting_entry_lines`)

---

### HU-074: Gestionar facturación
**Como** admin,  
**Quiero** crear facturas de venta y compra vinculadas a órdenes y gastos,  
**Para** cumplir con las obligaciones tributarias y llevar control de cuentas por cobrar/pagar.

**Estado:** ✅ Implementado — `server/routes/finance.js` (tablas: `sales_invoices`, `purchase_invoices`)

---

### HU-075: Registrar pagos
**Como** admin,  
**Quiero** registrar pagos parciales o totales contra facturas,  
**Para** controlar la cartera y las obligaciones pendientes.

**Estado:** ✅ Implementado — `server/routes/finance.js` (tablas: `payments`, `payment_allocations`)

---

## Módulo: Panel de Administración

### HU-080: Dashboard general del admin
**Como** admin,  
**Quiero** ver un dashboard con métricas clave: ventas del día/semana/mes, órdenes pendientes, stock bajo, cupping promedio,  
**Para** tener visibilidad rápida del estado del negocio al iniciar el día.

**Criterios de aceptación:**
- Tarjetas de métricas: ventas hoy, esta semana, este mes; órdenes pendientes; productos con stock bajo
- Gráfico de ventas de los últimos 30 días
- Accesos directos a las acciones más frecuentes

**Estado:** ✅ Implementado — `src/pages/admin/index.astro`

---

### HU-081: Gestionar usuarios
**Como** admin,  
**Quiero** ver la lista de usuarios, sus roles, estado de verificación y poder cambiar roles o desactivar cuentas,  
**Para** administrar el acceso al sistema.

**Criterios de aceptación:**
- Lista de usuarios con filtros por rol, estado, fecha de registro
- Cambiar rol (client, caficultor, admin, provider)
- Activar/desactivar cuenta
- Ver historial de actividad del usuario

**Estado:** ✅ Implementado — `src/pages/admin/usuarios.astro`, `src/pages/app/usuarios.astro`, `server/routes/users.js`

---

### HU-082: Gestionar órdenes
**Como** admin,  
**Quiero** ver, filtrar y actualizar el estado de las órdenes de compra,  
**Para** procesar envíos y resolver incidencias.

**Criterios de aceptación:**
- Lista con filtros por estado, fecha, canal (tienda web, ML)
- Cambiar estado manualmente (pendiente → procesando → enviado → entregado)
- Ver datos completos del comprador y envío
- Botón de reembolso (marcar como reembolsado)

**Estado:** ✅ Implementado — `src/pages/admin/pedidos.astro`, `server/routes/orders.js`

---

### HU-083: Ver log de auditoría
**Como** admin,  
**Quiero** ver un log de todas las acciones realizadas en el sistema (quién, qué, cuándo, desde qué IP),  
**Para** rastrear cambios y detectar actividad sospechosa.

**Criterios de aceptación:**
- Log paginado con filtros por usuario, tipo de acción, entidad, fecha
- Detalle de cada entrada con el antes y después del cambio (JSONB diff)
- Export a CSV para auditorías externas

**Estado:** ✅ Implementado — `src/pages/app/auditoria.astro`, `server/services/audit.js`, `server/routes/audit.js`

---

### HU-084: Gestionar inventario desde admin
**Como** admin,  
**Quiero** tener una vista de inventario completa con movimientos, alertas y posibilidad de ajustar stock,  
**Para** controlar el inventario de manera centralizada.

**Estado:** ✅ Implementado — `src/pages/admin/inventario.astro`

---

### HU-085: Acceder a herramientas de desarrollo (DevTools)
**Como** admin técnico,  
**Quiero** acceder a una sección de herramientas de diagnóstico (health check, logs, estado de BD),  
**Para** monitorear el sistema y depurar problemas en producción.

**Criterios de aceptación:**
- Estado de la conexión a BD
- Últimos errores del servidor
- Solo accesible para rol `admin`
- No indexado por buscadores

**Estado:** ✅ Implementado — `src/pages/app/devtools.astro`

---

### HU-086: Configurar base de datos inicial
**Como** admin técnico en primera instalación,  
**Quiero** ejecutar la inicialización de la BD desde una página protegida,  
**Para** desplegar el sistema en un nuevo entorno sin acceso directo a la terminal.

**Criterios de aceptación:**
- Protegido por `SETUP_SECRET_KEY` en header Authorization
- Solo ejecutable si las tablas no existen
- Muestra log de ejecución en pantalla

**Estado:** ✅ Implementado — `src/pages/setup-db.astro`, `server/routes/setup.js`

---

## Módulo: Mapa de Calor (Admin)

### HU-090: Ver mapa de calor de ventas
**Como** admin,  
**Quiero** ver un mapa de calor que muestre dónde se concentran las ventas (por barrio/zona),  
**Para** identificar oportunidades de expansión y analizar la demanda geográfica.

**Criterios de aceptación:**
- Datos combinados: ventas tienda web + MercadoLibre
- Filtros por período, canal de venta, producto
- Top 10 zonas de venta con conteo de órdenes
- Cluster por barrio
- Exportable a CSV

**Estado:** ✅ Implementado — `src/pages/admin/sales-map.astro`, `src/components/SalesHeatmap.jsx`, `server/routes/heatmap.js`

---

### HU-091: Geocodificar dirección de comprador
**Como** sistema,  
**Quiero** convertir automáticamente la dirección de envío en coordenadas geográficas al confirmar una orden,  
**Para** que la dirección aparezca correctamente en el mapa de calor.

**Criterios de aceptación:**
- Geocodificación automática al recibir pago confirmado
- Usar Nominatim (OSM) como servicio de geocoding (con fallback a ciudad)
- Las coordenadas se almacenan en la tabla `sales_tracking`
- Proceso asíncrono (no bloquea la confirmación de pago)

**Estado:** ✅ Implementado — `server/services/mercadolibre.js`

---

## Módulo: Compliance Legal (Colombia)

### HU-095: Ver política de privacidad
**Como** visitante,  
**Quiero** acceder a la política de tratamiento de datos personales de DobleYo,  
**Para** saber cómo se manejan mis datos conforme a la Ley 1581 de 2012.

**Estado:** ✅ Implementado — `src/pages/privacidad.astro`

---

### HU-096: Aceptar consentimiento de cookies
**Como** visitante,  
**Quiero** ver un banner de consentimiento de cookies y decidir si las acepto,  
**Para** que el sitio cumpla con la normativa de protección de datos.

**Criterios de aceptación:**
- Banner en primera visita con opción Aceptar / Rechazar / Personalizar
- La preferencia se guarda en cookie (`cookie_consent`)
- Sin cookies de analytics hasta que el usuario acepte

**Estado:** ✅ Implementado

---

### HU-097: Ver términos y condiciones
**Como** comprador,  
**Quiero** acceder a los términos y condiciones de compra,  
**Para** conocer mis derechos (retracto 5 días hábiles, garantía legal 12 meses) conforme a la Ley 1480 de 2011.

**Estado:** ✅ Implementado — `src/pages/terminos.astro`

---

### HU-098: Presentar PQR (Petición, Queja, Reclamo)
**Como** cliente,  
**Quiero** presentar Peticiones, Quejas, Reclamos o Sugerencias de forma oficial,  
**Para** ejercer mis derechos como consumidor colombiano según la Ley 1480.

**Criterios de aceptación:**
- Formulario con tipo (PQR/sugerencia), descripción y orden de referencia opcional
- Número de radicado generado automáticamente
- Respuesta en máximo 15 días hábiles (según normativa)
- Email de confirmación con número de radicado

**Estado:** ✅ Implementado — Vía formulario de contacto `src/pages/contacto.astro`

---

## Módulo: SEO y Rendimiento

### HU-100: Encontrar DobleYo en Google
**Como** posible cliente que busca "café de especialidad colombiano",  
**Quiero** que DobleYo aparezca en los resultados de Google con rich snippets,  
**Para** descubrir la marca y poder comprar.

**Criterios de aceptación:**
- Sitemap.xml generado automáticamente (`/sitemap.xml`)
- Robots.txt configurado
- Structured data JSON-LD en productos (`Product`), organización (`Organization`) y breadcrumbs
- Open Graph + Twitter Cards en todas las páginas
- Lighthouse SEO score ≥ 90
- `hreflang` en todas las páginas con versión ES/EN

**Estado:** ✅ Implementado — `src/pages/sitemap.xml.ts`, `src/components/Head.astro`

---

### HU-101: Navegar fluidamente en móvil
**Como** cliente que accede desde su teléfono,  
**Quiero** que el sitio se vea y funcione perfectamente en mi dispositivo,  
**Para** comprar sin frustración desde cualquier pantalla.

**Criterios de aceptación:**
- Sin scroll horizontal en ninguna página (320px+)
- Touch targets ≥ 44px
- Fuentes legibles sin necesidad de zoom (mínimo 16px)
- Menú hamburguesa funcional
- Formularios con input types correctos para teclado móvil (`type="email"`, `type="tel"`, `inputmode="numeric"`)
- Lighthouse Performance score ≥ 80 en mobile

**Estado:** ✅ Implementado — CSS mobile-first en `public/assets/css/styles.css`

---

## Módulo: Seguridad

### HU-105: Protección de datos de pago
**Como** cliente,  
**Quiero** que mis datos de pago sean procesados de forma segura por pasarelas certificadas,  
**Para** comprar con confianza sin que DobleYo almacene mis datos de tarjeta.

**Criterios de aceptación:**
- Ningún dato de tarjeta pasa por los servidores de DobleYo (Wompi Hosted Checkout)
- HTTPS obligatorio en toda la plataforma
- Headers de seguridad (CSP, HSTS, X-Frame-Options) configurados
- Deduplicación de transacciones para evitar cobros dobles

**Estado:** ✅ Implementado — Helmet.js en `server/index.js`, integración Wompi Hosted

---

### HU-106: Autenticación segura
**Como** usuario del sistema,  
**Quiero** que mis credenciales estén protegidas con estándares modernos de seguridad,  
**Para** que mi cuenta no pueda ser comprometida fácilmente.

**Criterios de aceptación:**
- Contraseñas hasheadas con bcrypt (salt rounds ≥ 12)
- JWT almacenado en HttpOnly cookies (no localStorage)
- Refresh token con rotación
- Rate limiting en endpoint de login (5 intentos / 15 min)
- Contraseñas con mínimo 8 caracteres, 1 número y 1 símbolo

**Estado:** ✅ Implementado — `server/routes/auth.js`, `server/middleware/`

---

### HU-107: Verificar integridad de webhooks
**Como** sistema,  
**Quiero** verificar la firma criptográfica de todos los webhooks entrantes (Wompi),  
**Para** asegurar que los eventos de pago son auténticos y no han sido manipulados.

**Criterios de aceptación:**
- Verificación HMAC-SHA256 obligatoria (rechazar si `WOMPI_INTEGRITY_SECRET` no está configurado)
- Deduplicación: el mismo `transaction_id` no puede procesarse dos veces
- Webhook rechazado si el evento tiene más de 5 minutos de antigüedad

**Estado:** ⚠️ Parcialmente implementado — ver `PLAN_MEJORAS.md` secciones S-02, S-03, S-04

---

### HU-108: Auditar acciones del sistema
**Como** admin,  
**Quiero** que todas las acciones críticas (crear, editar, eliminar) queden registradas automáticamente,  
**Para** tener trazabilidad completa de quién hizo qué y cuándo.

**Criterios de aceptación:**
- Registro automático en tabla `audit_logs` para toda acción CRUD
- Campos: usuario, acción, entidad, entidad_id, datos_anteriores (JSONB), datos_nuevos (JSONB), IP, timestamp
- Logs inmutables (no se pueden editar ni eliminar)
- Retención mínima de 1 año

**Estado:** ✅ Implementado — `server/services/audit.js`, `server/routes/audit.js`

---

## Funcionalidades Aspiracionales (Roadmap)

> Las siguientes historias están identificadas pero **no implementadas aún**. Son candidatas para fases futuras del proyecto.

---

### HU-200: Quiz "Encuentra tu café"
**Como** cliente indeciso,  
**Quiero** responder un quiz de 4–5 preguntas sobre mis preferencias (cuerpo, acidez, notas, método de preparación),  
**Para** recibir una recomendación personalizada de café.

**Complejidad estimada:** Media | **Impacto:** Alto (conversión)

---

### HU-201: Suscripción mensual de café
**Como** cliente frecuente,  
**Quiero** suscribirme a entregas mensuales con descuento del 10%,  
**Para** nunca quedarme sin café y ahorrar en cada pedido.

**Criterios clave:**
- Selección de café y frecuencia (quincenal / mensual)
- Pausa y cancelación en cualquier momento
- Cobro recurrente automático (Wompi / Stripe)

**Complejidad estimada:** Alta | **Impacto:** Alto (retención + LTV)

---

### HU-202: Guías de preparación con timer
**Como** amante del café,  
**Quiero** ver guías paso a paso de preparación (V60, prensa francesa, espresso, cold brew) con timer integrado,  
**Para** preparar el café de forma óptima siguiendo el protocolo correcto.

**Complejidad estimada:** Baja | **Impacto:** Medio (engagement, SEO)

---

### HU-203: Reviews y calificaciones de productos
**Como** comprador verificado,  
**Quiero** dejar una reseña y calificación (1–5 estrellas) de los cafés que he comprado,  
**Para** ayudar a otros compradores a decidir y darle feedback a DobleYo.

**Criterios clave:**
- Solo compradores verificados pueden dejar reviews
- Moderación por admin antes de publicar
- Rating promedio visible en la tienda y detalle de producto

**Complejidad estimada:** Media | **Impacto:** Alto (conversión, confianza)

---

### HU-204: Gift cards (Tarjetas de regalo)
**Como** persona que quiere regalar café,  
**Quiero** comprar una tarjeta de regalo digital para que otra persona elija su café,  
**Para** hacer un regalo original y significativo.

**Complejidad estimada:** Media | **Impacto:** Medio (ventas de temporada)

---

### HU-205: Programa de lealtad por puntos
**Como** cliente frecuente,  
**Quiero** acumular puntos por cada compra y canjearlos por descuentos,  
**Para** sentirme recompensado por mi fidelidad a DobleYo.

**Criterios clave:**
- 1 punto por cada $1.000 COP comprados
- Canje: 100 puntos = $5.000 descuento
- Puntos con vigencia de 12 meses

**Complejidad estimada:** Alta | **Impacto:** Alto (retención)

---

### HU-206: Facturación electrónica (DIAN)
**Como** admin,  
**Quiero** generar facturas electrónicas válidas para la DIAN automáticamente al confirmar una venta,  
**Para** cumplir con la obligación de facturación electrónica según la normativa colombiana.

**Criterios clave:**
- Integración con proveedor tecnológico autorizado (Alegra o Siigo)
- Generación automática al confirmar pago
- Envío al email del comprador
- Consulta de facturas desde el panel admin

**Complejidad estimada:** Alta | **Impacto:** Crítico (compliance fiscal)

---

### HU-207: Exportación a USA — Canal B2B
**Como** importador o distribuidora de café specialty en USA,  
**Quiero** hacer pedidos B2B de lotes enteros con documentación de exportación,  
**Para** importar café DobleYo y distribuirlo en el mercado americano.

**Criterios clave:**
- Formulario de contacto B2B en `en.dobleyo.cafe`
- Catálogo de lotes disponibles para exportación (kg mínimo)
- Cotización automatizada con cálculo de aranceles estimados

**Complejidad estimada:** Alta | **Impacto:** Alto (nuevo canal de ingresos)

---

### HU-208: Autenticación de dos factores (2FA) para admin
**Como** administrador del sistema,  
**Quiero** activar 2FA con aplicación TOTP (Google Authenticator / Authy) en mi cuenta,  
**Para** proteger el acceso al panel de administración ante una posible filtración de contraseña.

**Complejidad estimada:** Media | **Impacto:** Alto (seguridad)

---

### HU-209: Notificaciones push en la app móvil
**Como** caficultor o operador,  
**Quiero** recibir notificaciones push cuando haya una acción pendiente (cosecha a aprobar, lote atascado, stock bajo),  
**Para** actuar rápidamente sin necesidad de revisar la app manualmente.

**Complejidad estimada:** Alta | **Impacto:** Medio (UX operativo)

---

### HU-210: Blog y contenido editorial
**Como** amante del café,  
**Quiero** leer artículos sobre el proceso de producción, recetas, perfiles de finca y novedades de DobleYo,  
**Para** aprender más sobre el café de especialidad y conectar con la marca.

**Criterios clave:**
- CMS básico para crear y publicar artículos (migrar de localStorage a BD)
- Categorías: Trazabilidad, Recetas, Fincas, Eventos
- SEO optimizado por artículo

**Complejidad estimada:** Media | **Impacto:** Medio (SEO, engagement)

---

*Documento generado el 2026-04-12. Para agregar nuevas historias, usar el siguiente ID disponible según el módulo correspondiente.*
