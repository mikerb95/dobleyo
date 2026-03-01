# Historias de Usuario — DobleYo Café

> Documento vivo. Cada historia tiene un ID único (HU-XXX) para trazabilidad con requisitos funcionales.  
> Formato: Como [rol], quiero [acción], para [beneficio].

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

---

### HU-002: Agregar productos al carrito
**Como** cliente,  
**Quiero** agregar productos al carrito desde la tienda o la página de detalle,  
**Para** acumular los productos que deseo comprar.

**Criterios de aceptación:**
- El carrito persiste entre sesiones (localStorage sincronizado con servidor si el usuario está logueado)
- Puedo modificar cantidades desde el carrito
- Veo un contador de ítems en el header
- El subtotal se actualiza en tiempo real

---

### HU-003: Completar una compra
**Como** cliente,  
**Quiero** ingresar mis datos de envío, seleccionar método de pago (Wompi o MercadoPago) y completar la transacción,  
**Para** recibir mi café en casa.

**Criterios de aceptación:**
- Formulario de envío con validación (nombre, dirección completa con departamento/ciudad/barrio, teléfono, email)
- Puedo pagar con PSE, tarjeta crédito/débito, Nequi (vía Wompi)
- Puedo pagar con MercadoPago
- Recibo confirmación en pantalla y por email
- La orden queda registrada en la base de datos con estado "paid"
- La dirección de envío incluye coordenadas para el mapa de calor

---

### HU-004: Ver historial de pedidos
**Como** cliente registrado,  
**Quiero** ver mis pedidos anteriores con su estado actual,  
**Para** rastrear mis compras y saber cuándo llegarán.

**Criterios de aceptación:**
- Lista de pedidos con fecha, total, estado (pendiente, pagado, en proceso, enviado, entregado)
- Detalle de cada pedido con ítems, cantidades, precios
- Enlace de seguimiento de envío cuando aplique

---

### HU-005: Escanear QR del empaque
**Como** comprador de café DobleYo,  
**Quiero** escanear el código QR del empaque con mi teléfono,  
**Para** ver la trazabilidad completa de mi café: finca, altitud, variedad, fecha de cosecha, perfil de tueste, puntuación SCA.

**Criterios de aceptación:**
- El QR abre una URL tipo `dobleyo.cafe/t/DBY-2026-01-001`
- La página muestra timeline visual: Cosecha → Secado → Tostión → Empaque
- Veo datos de la finca con foto y mapa
- Puedo ver la puntuación SCA del cupping
- Funciona perfectamente en móvil (es el caso de uso principal)

---

### HU-006: Registrarse y autenticarse
**Como** visitante,  
**Quiero** crear una cuenta con email y contraseña,  
**Para** comprar productos, guardar mis datos y ver mi historial.

**Criterios de aceptación:**
- Registro con email, nombre, apellido, contraseña (min 8 chars)
- Verificación de email obligatoria
- Login con email y contraseña
- Sesión persiste via HttpOnly cookie (JWT)
- Puedo cerrar sesión

---

### HU-007: Gestionar mi cuenta
**Como** cliente registrado,  
**Quiero** ver y editar mis datos personales (nombre, dirección, teléfono),  
**Para** mantener mi información actualizada para futuros envíos.

---

### HU-008: Contactar a DobleYo
**Como** visitante o cliente,  
**Quiero** enviar un mensaje a través del formulario de contacto,  
**Para** resolver dudas, hacer sugerencias o reportar problemas.

**Criterios de aceptación:**
- Formulario con nombre, email, asunto, mensaje
- Mensaje se guarda en BD y envía notificación al admin
- El usuario recibe confirmación visual y por email

---

## Módulo: Tienda Internacional (USA / Inglés)

### HU-009: Navegar tienda en inglés
**Como** cliente angloparlante (USA),  
**Quiero** navegar la tienda completa en inglés con precios en USD,  
**Para** comprar café colombiano de especialidad entendiendo toda la información.

**Criterios de aceptación:**
- Toda la navegación, productos, checkout, legales están en inglés
- Precios en USD
- Dominio `en.dobleyo.cafe`
- SEO optimizado para mercado USA (meta tags en inglés)

---

### HU-010: Ver información de envíos internacionales
**Como** cliente internacional,  
**Quiero** ver los tiempos de tránsito, costos estimados y proceso de envío a mi país,  
**Para** decidir si quiero comprar y saber cuándo recibiré mi pedido.

**Criterios de aceptación:**
- Tabla de tiempos por destino (USA costa este/oeste, Europa, etc.)
- Explicación del proceso de exportación
- FAQ sobre aduanas e impuestos
- Información sobre carriers (DHL, FedEx)

---

## Módulo: Trazabilidad y Producción

### HU-011: Registrar cosecha en finca
**Como** caficultor o admin,  
**Quiero** registrar una cosecha indicando finca, variedad, peso, fecha, altitud,  
**Para** iniciar la cadena de trazabilidad del lote.

**Criterios de aceptación:**
- Formulario con: finca, variedad, peso en kg, fecha de cosecha, notas
- Se crea un lote con código único `DBY-YYYY-MM-XXX`
- Queda en estado "cosechado"

---

### HU-012: Procesar café verde (almacenamiento)
**Como** operador de producción,  
**Quiero** registrar el ingreso de café verde al almacén con datos de secado/procesamiento,  
**Para** continuar la trazabilidad y controlar el inventario verde.

---

### HU-013: Enviar a tostión
**Como** operador de producción,  
**Quiero** seleccionar un lote de café verde y registrar su envío al tostador,  
**Para** iniciar el proceso de tostión con trazabilidad completa.

---

### HU-014: Registrar resultado de tostión
**Como** tostador o admin,  
**Quiero** registrar los datos de la tostión (perfil, temperatura, duración, peso final, merma),  
**Para** documentar el proceso y calcular la pérdida de peso.

---

### HU-015: Empaquetar café tostado
**Como** operador de empaque,  
**Quiero** registrar el empaquetado de un lote indicando peso por bolsa, cantidad de bolsas, tipo de empaque,  
**Para** tener registro del producto final listo para venta.

---

### HU-016: Generar etiqueta con QR
**Como** operador o admin,  
**Quiero** generar una etiqueta con código QR para un lote empaquetado,  
**Para** que el cliente final pueda escanear y ver la trazabilidad.

---

### HU-017: Registrar control de calidad (cupping)
**Como** catador o admin,  
**Quiero** registrar una sesión de cupping SCA con puntuaciones (aroma, sabor, acidez, cuerpo, etc.),  
**Para** asignar una calificación al lote y mostrarla al cliente.

---

## Módulo: Finanzas de Producción

### HU-018: Ver dashboard financiero
**Como** admin,  
**Quiero** ver un resumen financiero con ingresos, gastos, margen por producto y flujo de caja,  
**Para** tomar decisiones informadas sobre la operación.

**Criterios de aceptación:**
- P&L por período seleccionable
- Costo por kg producido (verde → tostado → empaquetado)
- Margen bruto por producto
- Comparativo vs presupuesto

---

### HU-019: Registrar gastos
**Como** admin,  
**Quiero** registrar gastos operativos (materia prima, mano de obra, servicios, transporte),  
**Para** tener visibilidad completa de los costos de producción.

---

### HU-020: Gestionar presupuestos
**Como** admin,  
**Quiero** crear presupuestos mensuales/trimestrales y comparar con gastos reales,  
**Para** controlar la ejecución presupuestal.

---

## Módulo: Fincas y Caficultores

### HU-021: Ver landing de una finca
**Como** visitante o cliente,  
**Quiero** ver una página atractiva de la finca con foto hero, datos del caficultor, altitud, región, variedades y galería,  
**Para** conocer el origen de mi café y conectar con la historia detrás del producto.

**Criterios de aceptación:**
- Hero full-width con foto de finca + nombre + altitud + región
- Sección del caficultor con foto y biografía
- Galería de fotos
- Cafés disponibles de esa finca
- Mapa con ubicación
- Estilo coherente con el resto del sitio

---

### HU-022: Administrar fincas
**Como** admin,  
**Quiero** crear, editar y gestionar las fincas proveedoras,  
**Para** mantener actualizada la información de origen mostrada al público.

---

## Módulo: Mapa de Calor (Admin)

### HU-023: Ver mapa de calor de ventas
**Como** admin,  
**Quiero** ver un mapa de calor que muestre dónde se concentran las ventas (por barrio/zona),  
**Para** identificar oportunidades de expansión y analizar la demanda geográfica.

**Criterios de aceptación:**
- Datos combinados de ventas web directas + MercadoLibre
- Filtros por período, canal de venta, producto
- Top 10 zonas de venta
- Cluster por barrio con conteo
- Exportable a CSV

---

## Módulo: Panel de Administración

### HU-024: Dashboard general del admin
**Como** admin,  
**Quiero** ver un dashboard con métricas clave: ventas del día/semana/mes, órdenes pendientes, stock bajo, cupping promedio,  
**Para** tener visibilidad rápida del estado del negocio.

---

### HU-025: Gestionar productos
**Como** admin,  
**Quiero** crear, editar, activar/desactivar productos con fotos, precios, descripciones y clasificación,  
**Para** mantener el catálogo de la tienda actualizado.

---

### HU-026: Gestionar órdenes
**Como** admin,  
**Quiero** ver, filtrar y actualizar el estado de las órdenes de compra,  
**Para** procesar envíos y resolver incidencias.

---

### HU-027: Gestionar usuarios
**Como** admin,  
**Quiero** ver la lista de usuarios, sus roles, estado de verificación, y poder cambiar roles o desactivar cuentas,  
**Para** administrar el acceso al sistema.

---

## Módulo: Compliance Legal (Colombia)

### HU-028: Ver política de privacidad
**Como** visitante,  
**Quiero** acceder a la política de tratamiento de datos personales de DobleYo,  
**Para** saber cómo se manejan mis datos conforme a la Ley 1581 de 2012.

---

### HU-029: Aceptar cookies
**Como** visitante,  
**Quiero** ver un banner de consentimiento de cookies y decidir si las acepto,  
**Para** que el sitio cumpla con la normativa de protección de datos.

---

### HU-030: Ver términos y condiciones
**Como** comprador,  
**Quiero** acceder a los términos y condiciones de compra,  
**Para** conocer mis derechos (retracto 5 días, garantía) conforme a la Ley 1480 de 2011.

---

### HU-031: Presentar PQR
**Como** cliente,  
**Quiero** presentar Peticiones, Quejas, Reclamos o Sugerencias,  
**Para** ejercer mis derechos como consumidor colombiano.

---

## Módulo: Internacionalización

### HU-032: Cambiar idioma del sitio
**Como** visitante,  
**Quiero** ver el sitio en español o inglés,  
**Para** navegar en mi idioma preferido.

**Criterios de aceptación:**
- Selector de idioma visible
- URLs limpias: `/tienda` (ES) → `/en/shop` (EN)
- Persistencia de preferencia
- `<html lang>` correcto
- `hreflang` tags para SEO

---

## Módulo: SEO y Rendimiento

### HU-033: Encontrar DobleYo en Google
**Como** posible cliente que busca "café de especialidad colombiano",  
**Quiero** que DobleYo aparezca en los resultados de Google,  
**Para** descubrir la marca y poder comprar.

**Criterios de aceptación:**
- Sitemap.xml generado automáticamente
- Robots.txt configurado
- Structured data JSON-LD en productos y organización
- Open Graph tags en todas las páginas
- Lighthouse SEO score ≥ 90

---

### HU-034: Navegar fluidamente en móvil
**Como** cliente que accede desde su teléfono,  
**Quiero** que el sitio se vea y funcione perfectamente en mi dispositivo,  
**Para** comprar sin frustración desde cualquier pantalla.

**Criterios de aceptación:**
- Sin scroll horizontal en ninguna página (320px+)
- Touch targets ≥ 44px
- Fuentes legibles sin necesidad de zoom
- Menú hamburguesa funcional
- Formularios con input types correctos para teclado móvil
- Lighthouse Performance score ≥ 80 en mobile

---

## Módulo: Seguridad

### HU-035: Protección de datos de pago
**Como** cliente,  
**Quiero** que mis datos de pago sean procesados de forma segura por pasarelas certificadas (Wompi/MercadoPago),  
**Para** comprar con confianza.

---

### HU-036: Monitoreo de auditoría
**Como** admin,  
**Quiero** ver un log de todas las acciones realizadas en el sistema (quién, qué, cuándo),  
**Para** rastrear cambios y detectar actividad sospechosa.

---

## Funcionalidades Aspiracionales (Roadmap Futuro)

### HU-100: Quiz "Encuentra tu café"
**Como** cliente indeciso,  
**Quiero** responder un quiz de 4-5 preguntas sobre mis preferencias (cuerpo, acidez, notas, método de preparación),  
**Para** recibir una recomendación personalizada de café.

### HU-101: Suscripción mensual de café
**Como** cliente frecuente,  
**Quiero** suscribirme a entregas mensuales con descuento,  
**Para** nunca quedarme sin café y ahorrar.

### HU-102: Guías de preparación
**Como** amante del café,  
**Quiero** ver guías paso a paso de preparación (V60, prensa francesa, espresso, cold brew) con timer,  
**Para** preparar el café de forma óptima.

### HU-103: Reviews y calificaciones
**Como** comprador,  
**Quiero** dejar una reseña y calificación de los cafés que he comprado,  
**Para** ayudar a otros compradores a decidir.

### HU-104: Gift cards
**Como** persona que quiere regalar café,  
**Quiero** comprar una tarjeta de regalo para que otra persona elija su café,  
**Para** hacer un regalo original.

### HU-105: Programa de lealtad
**Como** cliente frecuente,  
**Quiero** acumular puntos por cada compra y canjearlos por descuentos,  
**Para** sentirme recompensado por mi fidelidad.
