# Reunión — 20 de julio de 2026
## Sustentación del sitio DobleYo Café y su panel de administración

> Documento de apoyo para la presentación al gerente de marca.
> Lenguaje funcional: qué hace, para quién y cómo se conecta con lo demás.

---

## 1. La idea en una frase

**DobleYo Café es una sola plataforma que acompaña el grano desde la finca hasta la taza del cliente, y que además vende ese café en dos mercados distintos: Colombia y Estados Unidos.**

Lo importante no es que sea "una tienda con panel". Lo importante es que **la venta y la producción son el mismo sistema**: cuando alguien compra una bolsa, esa bolsa ya tiene detrás un registro de qué finca vino, cuándo se cosechó, cómo se tostó y cuándo se empacó. Eso es lo que nos permite prometer trazabilidad y cumplirla.

---

## 2. Los tres públicos y cómo el sitio los atiende

| Público | Qué necesita | Dónde lo encuentra |
|---|---|---|
| **Consumidor colombiano** | Comprar café fresco, saber de dónde viene | Sitio en español (`dobleyo.cafe`) |
| **Comprador/importador en EE. UU.** | Confianza, volumen, origen verificable | Sitio en inglés (`en.dobleyo.cafe`) |
| **Equipo interno y caficultores** | Registrar la operación diaria y ver el negocio | Panel de administración (`/admin`) |

Los tres comparten **la misma información de fondo**. No hay tres bases de datos ni tres inventarios. Es uno solo, mostrado de tres maneras.

---

## 3. Recorrido del cliente en Colombia (español)

Esta es la historia que debe contarse de corrido, porque cada paso alimenta al siguiente.

1. **Llega a la página principal.** Video de marca, cafés destacados, promesa de origen.
2. **Explora la tienda.** Catálogo con filtros por tipo, origen, proceso y tueste. Cada café tiene su propia ficha.
3. **Ve la ficha del producto.** Notas de taza, finca de origen, perfil de tueste. Aquí es donde el relato de marca se vuelve concreto.
4. **Agrega al carrito.** El carrito vive en el navegador del cliente; no obliga a registrarse todavía.
5. **Va al pago.** Puede pagar como **invitado** o como **usuario registrado**. Bajar la fricción aquí es lo que sostiene la conversión.
6. **Recibe confirmación por correo.** Correo automático con el detalle del pedido.
7. **Sigue su pedido.** Desde su cuenta ve el estado y el envío.

**Páginas de apoyo alrededor de ese recorrido:**
Nosotros · Fincas (con ficha por finca) · Blog y Guías · Suscripción de café · Regalos · Accesorios · Mayoristas · Afiliados · Partners · Contacto · Envíos y devoluciones · Términos · Privacidad · Accesibilidad.

**Punto de venta para la reunión:** el recorrido no termina en el pago. Termina en el **QR de la bolsa**, que es el punto 8 y el que conecta con el módulo de producción.

---

## 4. Recorrido del comprador en Estados Unidos (inglés)

El sitio en inglés **no es una traducción literal**. Es una propuesta distinta, porque el comprador es distinto.

- Vive en su propio dominio: **`en.dobleyo.cafe`**. El sistema detecta el dominio y sirve la versión correcta automáticamente; el cliente nunca ve una mezcla de idiomas.
- El énfasis está en **origen trazable, frescura de tueste y volumen**, no en el impulso de compra.
- Tiene su propia estructura completa: Home, Shop, ficha de producto, Farms y ficha de finca, Traceability, Blog y Guides, Wholesale, Affiliates, Partners, About, Contact, Cart, Checkout, Account, y las páginas legales.

**Lo que hay que decir en la reunión:** tenemos **dos vitrinas con dos discursos comerciales distintos**, pero **un solo inventario y una sola operación detrás**. Si mañana cambia el stock de un café, cambia en ambas al mismo tiempo. Eso es lo que hace que el mercado de exportación no duplique el trabajo del equipo.

---

## 5. La trazabilidad: el puente entre la tienda y la fábrica

Esta es la pieza que le da coherencia a todo el discurso de marca.

**Cómo funciona para el cliente:**
1. La bolsa lleva un código QR impreso en la etiqueta.
2. El cliente lo escanea con su celular (o digita el código en la página de trazabilidad).
3. Ve el historial real de ese lote: finca, cosecha, tueste, empaque.

**Por qué importa comercialmente:**
- Es la prueba de la promesa. Cualquiera dice "café de origen"; nosotros lo mostramos con fecha y finca.
- En EE. UU. la trazabilidad no es un adorno de marketing, es un requisito de compra para importadores y tostadores serios.
- Le da visibilidad al caficultor, que es parte del relato de la marca.

**De dónde sale esa información:** no se escribe a mano para el marketing. Sale automáticamente de lo que el equipo registró en el panel durante la producción. Ese es el argumento fuerte: **la trazabilidad es un subproducto de trabajar ordenado, no una tarea adicional.**

---

## 6. El panel de administración

El panel es el "detrás de cámaras". Está organizado en **seis bloques** que corresponden a seis preguntas del negocio.

### Bloque 1 — Principal: "¿cómo va el negocio hoy?"
| Sección | Para qué sirve |
|---|---|
| **Dashboard** | Resumen ejecutivo: indicadores clave y actividad reciente |
| **Pedidos** | Todos los pedidos entrantes y su estado |
| **Envíos** | Despachos y seguimiento |
| **CRM** | Clientes, historial y relación comercial |
| **Producción** | Órdenes de producción en curso |

### Bloque 2 — Operación: "¿dónde está el café en este momento?"
Este bloque **es la cadena de producción en orden**, y conviene presentarlo así, como una línea de tiempo:

**Mi finca → Cosechas → Almacén verde → Enviar a tostión → Recibir tostado → Almacén tostado → Empaque → Etiquetas → Cupping → Lotes entregados**

| Paso | Qué registra el equipo |
|---|---|
| **Mi finca** | Datos de la finca del caficultor |
| **Cosechas** | Cuánto se recogió, cuándo y de qué lote |
| **Almacén verde** | Café pergamino/verde disponible antes de tostar |
| **Enviar a tostión** | Qué cantidad sale hacia el tostador |
| **Recibir tostado** | Qué volvió, con su merma real |
| **Almacén tostado** | Producto tostado listo para empacar |
| **Empaque** | Conversión a bolsas vendibles |
| **Etiquetas** | Generación de las etiquetas con su QR |
| **Cupping** | Control de calidad con puntaje de catación |
| **Lotes entregados** | Cierre del ciclo |

> **Frase para la reunión:** "Cada paso deja huella. Al final del recorrido, el QR de la bolsa ya está listo sin que nadie tenga que armarlo aparte."

### Bloque 3 — Catálogo: "¿qué estamos vendiendo?"
Productos · Inventario · Lotes · Blog.
Aquí se define lo que el cliente ve en la tienda y se publica el contenido editorial.

### Bloque 4 — Analítica: "¿qué está pasando y qué va a pasar?"
| Sección | Pregunta que responde |
|---|---|
| **Ventas** | Cuánto vendimos, qué productos y en qué ciudades |
| **Mapa de ventas** | Dónde están concentrados nuestros clientes (mapa de calor) |
| **MercadoLibre** | Ventas del canal externo, integradas al mismo tablero |
| **Finanzas** | Ingresos, costos y márgenes |
| **Estadísticas** | Comportamiento general del negocio |
| **Demanda / Módulo de pronóstico** | Proyección de demanda para planear producción |
| **Auditoría** | Quién hizo qué y cuándo dentro del sistema |

**Argumento clave:** el mapa de calor y el pronóstico de demanda no son adornos. Sirven para decidir **cuánto tostar el mes entrante y a qué ciudades vale la pena hacerles pauta**.

### Bloque 5 — Configuración
Usuarios · Sistema · Presupuesto · Herramientas de desarrollo.

### Bloque 6 — Perfil
Datos de la cuenta de quien está usando el panel.

---

## 7. Quién puede hacer qué

| Rol | Alcance |
|---|---|
| **Administrador** | Acceso total: ventas, producción, finanzas, usuarios |
| **Caficultor** | Solo su finca y sus registros de cosecha y producción |
| **Proveedor** | Su relación de suministro |
| **Cliente** | Su cuenta, sus pedidos, su historial |

Además, el sistema **registra en auditoría toda acción sensible**. Si alguien cambia un precio o edita un lote, queda constancia de quién, qué y cuándo. Esto es relevante para el control interno y para cualquier certificación futura.

---

## 8. El circuito completo, en una sola lectura

Esta es la diapositiva mental que el gerente debería llevarse:

```
FINCA          Cosecha registrada por el caficultor
  ↓
BODEGA         Café verde en inventario
  ↓
TOSTIÓN        Sale a tostar → vuelve tostado (con merma real)
  ↓
CALIDAD        Catación y puntaje
  ↓
EMPAQUE        Bolsas + etiqueta con QR único
  ↓
CATÁLOGO       El producto queda disponible en la tienda
  ↓
VENTA          Sitio en español · Sitio en inglés · MercadoLibre
  ↓
CLIENTE        Recibe, escanea el QR y ve el origen de SU bolsa
  ↓
ANALÍTICA      Esa venta alimenta ventas, mapa, finanzas y pronóstico
  ↓
DECISIÓN       Cuánto cosechar y tostar el próximo ciclo
```

**Es un círculo, no una línea.** Lo que se vende hoy define lo que se produce mañana.

---

## 9. Estado actual — qué mostrar y qué matizar

**Sólido y demostrable en vivo:**
- Sitio en español completo, con catálogo, carrito, pago y cuenta de usuario.
- Sitio en inglés independiente, con su propio dominio y discurso B2B.
- Panel de administración con la cadena de producción completa.
- Trazabilidad por QR funcionando de punta a punta.
- Ventas, mapa de calor e integración con MercadoLibre.
- Auditoría y control de roles.

**En consolidación (conviene mencionarlo antes de que lo pregunten):**
- Módulo financiero: la estructura está montada; falta afinar reportes de cierre.
- Pronóstico de demanda: funciona, y mejora su precisión a medida que acumula historia de ventas real.
- Migración progresiva de contenidos que aún viven fijos en el código hacia la administración desde el panel.

> Recomendación: mencione usted mismo estos tres puntos. Presentarlos como plan controlado da más confianza que dejar que aparezcan como hallazgo.

---

## 10. Preguntas probables y respuestas cortas

**"¿Por qué dos sitios y no un botón de idioma?"**
Porque no es el mismo comprador. En Colombia vendemos bolsa a bolsa por antojo y frescura; en EE. UU. vendemos confianza, origen y volumen. Un botón de traducción no cambia el argumento de venta; dos sitios sí. Y el costo operativo es el mismo, porque el inventario y la operación son compartidos.

**"¿El equipo tiene que registrar todo eso a mano? ¿No es mucho trabajo?"**
Es el trabajo que ya se hace, solo que ahora queda registrado. Y a cambio genera tres cosas gratis: la trazabilidad del QR, el costeo real de cada lote y los datos para pronosticar.

**"¿Qué pasa si un lote sale malo?"**
Se identifica exactamente qué cosecha, qué tostión y qué bolsas están involucradas. Podemos actuar sobre ese lote específico y no sobre todo el inventario.

**"¿Cómo sé que la trazabilidad es real y no un adorno?"**
Porque no se digita para el cliente. Se arma sola con los registros de producción. Nadie escribe el "cuento" de la bolsa: el sistema lo reconstruye.

**"¿Y MercadoLibre no compite con nuestra tienda?"**
Es un canal más, y sus ventas entran al mismo tablero. Nos sirve para captar demanda que no llega directo y para leer en qué ciudades hay mercado antes de invertir en pauta allá.

**"¿Esto crece si vendemos diez veces más?"**
Sí. La operación es la misma; lo que crece es el volumen de registros, y esa parte está diseñada para eso.

---

## 11. Guion sugerido de demostración (15 minutos)

| Min | Qué mostrar | Mensaje |
|---|---|---|
| 0–2 | Home en español | "Así entra el cliente colombiano" |
| 2–4 | Ficha de producto → carrito → pago | "El camino a la compra es corto a propósito" |
| 4–6 | Sitio en inglés | "Mismo café, otro argumento, otro mercado" |
| 6–9 | Panel: bloque Operación en orden | "Esta es la fábrica: cosecha, tostión, empaque" |
| 9–11 | Etiquetas → escanear un QR real | **El momento fuerte.** "Esto es lo que ve el cliente" |
| 11–13 | Ventas y mapa de calor | "Aquí se decide dónde invertir" |
| 13–15 | Pronóstico de demanda | "Y aquí, cuánto producir el próximo ciclo" |

**Cierre sugerido:**
> "No construimos una tienda con un panel al lado. Construimos un solo circuito: lo que el caficultor registra en la finca es exactamente lo que el cliente lee en su bolsa, y lo que el cliente compra es lo que le dice a la finca cuánto producir el próximo ciclo."

---

## 12. Logística: la integración con Mi Paquete

> Esta sección merece su propio espacio en la reunión. La logística es, después del producto, la variable que más define si el negocio en línea es rentable o no.

### 12.1 Qué es Mi Paquete y por qué lo elegimos

Mi Paquete **no es una transportadora**. Es un **intermediario que agrupa varias transportadoras** (Servientrega, Coordinadora, Envía, TCC, entre otras) y las ofrece bajo un solo contrato, un solo tablero y una sola factura.

La diferencia práctica es grande:

| Sin intermediario | Con Mi Paquete |
|---|---|
| Un contrato con cada transportadora | Un solo registro, sin papeleo |
| Tarifas de volumen que una marca pequeña no alcanza | Tarifas negociadas por el volumen agregado de miles de tiendas |
| Cotizar a mano en cada envío | El sistema compara y muestra opciones al instante |
| Manejar el dinero del contraentrega por su cuenta | Ellos recaudan y consignan a nuestra cuenta |
| Un tablero distinto por transportadora | Un solo lugar para todo el seguimiento |

**El argumento de fondo:** una marca de café de especialidad no tiene el volumen para negociar tarifas directas con Servientrega. A través de Mi Paquete accedemos a tarifas de gran cliente sin ser un gran cliente, y podemos elegir la transportadora **envío por envío** según cuál sea mejor para ese destino y ese precio.

### 12.2 La pieza clave: el pago contraentrega

Este es el punto más importante de toda la sección para un gerente de marca.

**Qué es:** el cliente **no paga al comprar**. Paga en efectivo cuando el mensajero le entrega el paquete. Mi Paquete recauda ese dinero y nos lo consigna a nuestra cuenta bancaria.

**Por qué importa comercialmente en Colombia:**
- Una parte grande del país **no compra en línea con tarjeta** — por no tenerla o por desconfianza.
- Es la forma más directa de vender a un cliente que nunca nos ha probado. El contraentrega elimina la pregunta "¿y si pago y no me llega?".
- Abre ciudades intermedias y pueblos donde la penetración de tarjeta es baja pero el consumo de café es alto.

**El riesgo, dicho con claridad:** en contraentrega el cliente puede **rechazar el paquete en la puerta**. Nosotros ya pagamos el flete de ida, y pagamos el de vuelta. Un pedido rechazado no es una venta perdida: es una venta perdida **con costo**.

**Cómo lo controlamos hoy** (esto ya está implementado, conviene mostrarlo):
- **Tope de monto:** el contraentrega solo se ofrece hasta cierto valor de pedido. Por encima de ese monto, el cliente debe pagar en línea. Hoy el tope está configurado y es ajustable sin tocar el código.
- **Bloqueo por pedidos abiertos:** un mismo cliente no puede acumular varios pedidos contraentrega sin haber recibido los anteriores.
- **Bloqueo por historial:** si un cliente ya rechazó un envío antes, no se le vuelve a ofrecer contraentrega.
- Cada rechazo queda registrado, para poder revisar si estamos siendo demasiado estrictos y bloqueando clientes buenos.

> **Frase para la reunión:** "El contraentrega es nuestra puerta de entrada al cliente que no compra en línea. Pero es una puerta con filtro: el sistema decide a quién se la abre."

### 12.3 Qué está integrado hoy — el flujo completo

Este recorrido ya funciona de punta a punta:

```
1. COTIZAR      El sistema calcula peso y volumen del pedido a partir
                de los productos, y pide opciones a Mi Paquete
                    ↓
2. ELEGIR       El equipo ve las transportadoras disponibles con precio
                y tiempo, y escoge
                    ↓
3. GENERAR      Se crea la guía. El sistema evita generar dos guías
                para el mismo pedido
                    ↓
4. RECOGER      Se solicita la recolección
                    ↓
5. SEGUIR       El estado se actualiza solo, de dos maneras:
                · Mi Paquete nos avisa cuando algo cambia
                · Además revisamos cada 30 minutos por nuestra cuenta,
                  como red de seguridad por si el aviso falla
                    ↓
6. INFORMAR     El cliente recibe correo cuando su pedido sale
                    ↓
7. CONCILIAR    En contraentrega, se controla qué dinero está pendiente
                de consignación y cuál ya llegó
```

**El panel de envíos (`/admin/envios`) tiene cuatro pestañas**, que corresponden a las cuatro preguntas diarias del equipo de operación:

| Pestaña | Pregunta |
|---|---|
| **Pendientes de despacho** | ¿Qué pedidos pagados están esperando guía? |
| **Envíos activos** | ¿Qué está en la calle y dónde va? |
| **Recaudos contraentrega** | ¿Qué plata nos deben y cuál ya entró? |
| **Estancados** | ¿Qué envío lleva demasiado tiempo sin moverse? |

La pestaña de **estancados** es la que evita el problema clásico: un pedido que se quedó quieto ocho días y nadie se dio cuenta hasta que el cliente reclamó. El sistema lo marca solo.

**Además está resuelto:**
- **Envío manual:** si un pedido debe salir por fuera de Mi Paquete (por ejemplo, entregas locales o pedidos a Estados Unidos), se puede registrar la guía a mano en el mismo tablero. No hay pedidos invisibles.
- **Recuperación ante fallas:** si algo se cae a mitad del proceso de crear una guía, el sistema lo detecta y lo repara o lo libera para reintentar. No quedan pedidos bloqueados.
- **Cancelación de guías** desde el panel.

### 12.4 Costos — cómo se compone el precio de un envío

> ⚠️ **Las cifras que siguen son referencias públicas de Mi Paquete y deben confirmarse contra nuestra cuenta y nuestro tarifario real antes de comprometerlas en una proyección.**

Un envío contraentrega tiene **dos componentes**:

| Componente | Cómo se calcula |
|---|---|
| **Flete** | Según peso, dimensiones, origen y destino. Varía por transportadora |
| **Comisión de recaudo** | Un porcentaje sobre el valor recaudado, del orden del **4% a 4,3%**, con un **mínimo** por envío (referencias públicas: alrededor de $4.300 en mensajería y $5.500 en paquetes) |

**Puntos importantes para el margen:**
- La cotización que ve el equipo **ya incluye ambos componentes**. No hay sorpresas después.
- El **valor declarado mínimo** es de $10.000 COP.
- Las transportadoras hacen **hasta tres intentos de entrega** sin costo adicional. Esto reduce bastante los rechazos por "no había nadie".
- Los recaudos se consignan **martes y jueves**. Eso define nuestro ciclo de caja: el dinero de una venta contraentrega **no entra el día de la venta**, entra en la consignación siguiente a la entrega.

**Implicación de negocio que conviene decir en voz alta:**
En un pedido de bajo valor, la comisión mínima de recaudo **pesa proporcionalmente mucho más**. Un pedido de $30.000 puede dejar un margen muy distinto al de uno de $120.000, aunque el flete sea el mismo. Esto sostiene dos decisiones comerciales:

1. **Definir un pedido mínimo** o un umbral de envío gratis que empuje el ticket hacia arriba.
2. **Priorizar los kits y las suscripciones** frente a la venta de una sola bolsa: mismo costo logístico, mucho mejor margen.

### 12.5 Qué habilita esto en marketing

Aquí es donde la logística deja de ser un tema operativo y se vuelve una herramienta de marca.

**1. "Envío gratis desde $X"**
Ahora podemos calcular el umbral con datos reales de flete, no a ojo. Es la palanca más eficaz para subir el ticket promedio.

**2. "Pague cuando lo reciba"**
Es un mensaje potente para el cliente nuevo que aún no confía en la marca. Se puede usar como gancho de primera compra, con el filtro antifraude protegiendo por detrás.

**3. Prometer tiempos que sí se cumplen**
Como cotizamos por destino, podemos mostrarle al cliente el tiempo estimado real de su ciudad en lugar de una promesa genérica. Menos reclamos, mejores reseñas.

**4. Decidir dónde hacer pauta con dos capas de datos**
Ya teníamos el mapa de calor de ventas. Ahora podemos cruzarlo con el costo y el tiempo de envío por zona. Una ciudad puede vender bien pero costar caro de atender — o al revés, ser barata de atender y estar sin explotar. **Eso cambia dónde se invierte el presupuesto de pauta.**

**5. Notificaciones que construyen marca**
El seguimiento del envío es uno de los pocos momentos en que el cliente **quiere** recibir nuestros correos. Es el mejor espacio para reforzar el relato de origen — y para recordarle que su bolsa trae un QR con la historia de su café.

**6. Cerrar el círculo con la trazabilidad**
Este es el remate: el cliente sigue su paquete, lo recibe, escanea el QR y ve de qué finca vino. Logística y trazabilidad son **el mismo momento de marca**, no dos cosas separadas.

### 12.6 Riesgos y cómo están cubiertos

| Riesgo | Cobertura actual |
|---|---|
| Rechazo en contraentrega | Tope de monto, bloqueo por pedidos abiertos y por historial de rechazo |
| Se cae el aviso de la transportadora | Revisión automática cada 30 minutos como respaldo |
| Un envío se queda quieto | Pestaña de estancados con alerta automática |
| Guía duplicada para un pedido | Bloqueo a nivel de base de datos |
| Pedido que no puede ir por Mi Paquete | Despacho manual registrado en el mismo tablero |
| Diferencias en el dinero recaudado | Pestaña de conciliación con el valor esperado por pedido |
| Dependencia de un solo proveedor | Al agrupar varias transportadoras, el riesgo está repartido. El despacho manual es la salida si el proveedor falla |

### 12.7 Decisiones que necesitamos del gerente

Estas son las preguntas concretas para llevarse de la reunión:

1. **¿Cuál es el tope del contraentrega?** Hoy está configurado en un valor de arranque. Subirlo vende más pero expone más. Es una decisión comercial, no técnica.
2. **¿Umbral de envío gratis?** Necesitamos definirlo con el margen real por producto.
3. **¿Ofrecemos contraentrega a todo el país o solo donde el costo lo justifica?** Se puede restringir por zona.
4. **¿Qué hacemos con los pedidos de Estados Unidos?** Mi Paquete opera en Colombia. Hoy esos pedidos se despachan manualmente; falta definir el operador de exportación.
5. **¿Comunicamos el contraentrega como gancho principal de primera compra?** Es una decisión de mensaje de marca.

### 12.8 Estado de la integración

**Funcionando:** cotización, generación de guía, recolección, seguimiento automático con doble respaldo, correos al cliente, conciliación de recaudos, alertas de estancados, despacho manual y cancelación.

**En afinamiento:** reportes de rentabilidad por envío (cuánto se cotizó contra cuánto se cobró realmente), y la operación de exportación para el canal en inglés.

**Fuentes consultadas sobre el modelo de Mi Paquete:**
[Mi Paquete — Soluciones ecommerce](https://www.mipaquete.com/soluciones-ecommerce) ·
[Envíos pago contraentrega](https://www.mipaquete.com/soluciones-ecommerce/envios-pago-contraentrega) ·
[Centro de ayuda — Primer envío](https://www.mipaquete.com/centro-de-ayuda/primer-envio)

---

## 13. Tres frases para no olvidar

1. **Una sola operación, dos mercados.** El sitio en inglés no duplica trabajo.
2. **La trazabilidad no es marketing, es el registro del trabajo diario.**
3. **Los datos de venta cierran el círculo:** deciden cuánto se cosecha y se tuesta después.
