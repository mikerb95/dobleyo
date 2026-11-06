# Oportunidades de DobleYo: investigación de las webs de café en Colombia

**Corte:** 5 de noviembre de 2026. Las webs cambian: lo que se vaya a ejecutar debe volver a comprobarse.

**Conclusión:** antes de crecer, DobleYo debe cumplir lo que promete. Después puede ocupar vacíos que casi nadie cubre: fecha de tueste, costo y plazo de envío claros, y tiempo de respuesta medido.

## Para qué nos sirve este documento

| Si necesita... | Vaya a... |
|---|---|
| Saber qué hacer primero | Propuestas priorizadas: Ahora (P01 a P10) |
| Conocer qué muestra hoy DobleYo y qué no tiene respaldo | DobleYo frente al mercado |
| Decidir precio, formato o canal | Mapa del mercado y Despacho y logística |
| Definir qué lleva la ficha de cada café | Fincas y productores, Proceso, Calidad y Origen |
| Definir envíos, devoluciones y soporte | Atención al cliente y Despacho y logística |
| Comparar con una marca concreta | Comparativo por marca y su anexo |
| Saber qué tan fiable es un dato | Alcance y método, y Fuentes y vacíos de información |

Lo legal es informativo y debe validarlo un abogado. Las calificaciones de impacto y esfuerzo son juicio propio: no hay datos de conversión de ninguna marca.

## Resumen ejecutivo

DobleYo promete hoy más de lo que prueba: 0 reseñas reales, 0 envíos registrados y 3 fincas de demostración publicadas. Las tablas `product_reviews`, `shipments` y `farms` lo confirman, y [/fincas](https://dobleyo.cafe/fincas) lo muestra al público. Por eso las primeras 10 de las 20 propuestas corrigen honestidad, legalidad y compra, no crecimiento.

El mercado colombiano no se divide por calidad de web, sino por tres modelos de negocio. Las masivas venden por retail y usan la web como vitrina; solo [Juan Valdez](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminos) y [Tienda Nutresa en Casa](https://www.tiendanutresaencasa.com/terminos-y-condiciones) publican términos de venta directa. La especialidad urbana compite con ficha técnica, y las marcas de hacienda tienen el mejor relato, pero suelen mirar al exterior o al turismo.

Ninguna ficha revisada mostró fecha de tueste ni QR, ni en masivas ni en especialidad, como confirman [Juan Valdez](https://www.tiendajuanvaldez.com/cafe-premium-colina-454gr-8ad68615-a481-44c1-a250-c1fbf472f10e/p) y [Varietale](https://varietale.com/products/san-antonio). Solo [Azahar](https://azaharcoffee.com/producto/edicion-especial-huila/) publica precio pagado por carga, y pocas publican puntaje, como [Varietale](https://varietale.com/products/san-antonio) y [Café Quindío](https://www.cafequindio.com.co/products/geisha). Esa ausencia significa "no visto en lo rastreado", no "no existe".

En operación, el vacío más barato de ocupar es la claridad. [Libertario](https://www.libertariocoffee.com/policies/shipping-policy) y [Juan Valdez](https://juanvaldez.vtexassets.com/assets/vtex.file-manager-graphql/images/ad13e97d-e29a-4407-89da-e79a4943cda9___e56773f118aa18aca724d65d62a49379.pdf) publican costo y plazo en cifras, mientras varias marcas se contradicen entre páginas. Ninguna página revisada promete un tiempo general de respuesta en horas, salvo el formulario de [Hija Mía](https://www.hijamiacoffee.com/pages/contact).

DobleYo vende 2 cafés a $65.000 y $72.000 por 250 g, con [precios aún de referencia](https://dobleyo.cafe/tienda). Los cafés de casa de la muestra rondan $34.000 a $46.000 (cálculo propio), mientras los microlotes y Geisha llegan mucho más arriba. Su precio solo se defiende con prueba, y hoy la prueba pública real es corta.

La ruta recomendada tiene cuatro pasos. Primero, retirar lo que no tiene respaldo y validar lo legal con un abogado. Segundo, publicar una ficha real con fecha de tueste, sin QR ni la palabra trazabilidad.

Tercero y cuarto, medir los primeros envíos y decidir sobre puntaje y canales con datos propios.

La plataforma es una ventaja real, pero aún invisible. El código ya incluye tres integraciones de envío y costeo (`server/services/`, `server/routes/costs.js`), aunque sin credenciales ni datos reales. La brecha para operar es de configuración y validación, no de desarrollo.

## Alcance y método

La revisión cubre cerca de 40 marcas y canales el 5 de noviembre de 2026, solo con lectura de páginas públicas. Se usó Playwright para extraer texto, y curl en parte del grupo de hacienda. No se compró, no se creó cuenta, no se enviaron formularios ni mensajes.

| Bloque | Cobertura | Límite principal |
|---|---|---|
| Masivas | 11 marcas y Tienda Nutresa en Casa | 1 o 2 fichas por línea. Varias páginas renderizaron sin texto |
| Especialidad urbana | 12 marcas, cerca de 100 páginas contando también a San Alberto | 1 a 3 fichas por marca. Las primeras capturas no incluyeron todos los acordeones |
| Hacienda y origen | 17 marcas, cooperativas y referencias | Tope de 18 a 22 páginas por sitio |
| DobleYo | 42 URL rastreadas dos veces, código y base de datos solo con SELECT | No se vio el widget de Wompi ni se entró al admin |
| Legal, logística y mercado | Normas, tarifas, informes y prensa | Lo legal es informativo y debe validarse con un abogado |

### Reglas de lectura

Salvo rótulo "tercero", cada dato de una marca es lo que dice su propia web. "Cálculo propio" marca toda normalización o inferencia hecha para este informe. COP por 250 g equivale a precio publicado x 250 / gramos, sin envío.

"No visto" significa que el dato no apareció en lo rastreado. No demuestra que no exista, y puede estar en la bolsa, un acordeón, una imagen o el checkout. La revisión capturó texto, así que no evalúa foto, video ni formato visual.

Mejor práctica significa aquí más clara o verificable para el cliente. No hay datos de conversión de ninguna marca, así que ninguna práctica queda probada en ventas.

## Mapa del mercado

El mercado tiene tres grupos, y DobleYo compite en especialidad, no contra masivos de $11.000 a $16.000 por 250 g (cálculo propio). El dato de retail más defendible es cerca de $3 billones en 2025, según [Nielsen citado por la FNC](https://forbes.co/2026/04/22/red-forbes/el-cafe-que-no-nos-tomamos/). No hay medición pública sólida del segmento de especialidad.

### Los tres grupos

| Grupo | Marcas revisadas | Cómo usan la web | Comprador principal |
|---|---|---|---|
| **Masivas** | Juan Valdez, Colcafé, La Bastilla, Matiz, Sello Rojo, Oma, Águila Roja, Lukafe, Almendra Tropical, Nescafé. Buendía sin sitio verificable | Vitrina que remite a retail. Venta directa documentada solo en [Juan Valdez](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminos) y [Tienda Nutresa](https://www.tiendanutresaencasa.com/preguntas-frecuentes) | Hogar colombiano |
| **Especialidad urbana** | Pergamino, Devoción, Amor Perfecto, Azahar, Libertario, Varietale, Tropicalia, Catación Pública, Colo, Hija Mía, Café Cultor. Café Quindío con reservas por escala | Tienda propia con ficha técnica, suscripción y políticas de desigual calidad | Comprador urbano de bolsa |
| **Hacienda y origen** | San Alberto, La Palma y El Tucán, Granja La Esperanza, Venecia, Guayabal, Jesús Martín, El Ocaso, Paraíso 92, Forest, Comprocafé, Buencafé, Coocentral, Cadefihuila, Café del Huila, Cafenorte. Galavis como torrefactora histórica. La Guashira como referencia en euros | Relato de finca, turismo, venta B2B, exterior o cooperativa | Turista, tostador, exterior o asociado |

La lectura de cada grupo es propia. Hay marcas en el límite: [Café Quindío](https://www.cafequindio.com.co/pages/nosotros) tiene escala de marca grande, [San Alberto](https://cafesanalberto.com.co/) opera tiendas urbanas y [Galavis](https://cafegalavis.com.co/nuestra-historia/) no declara fincas.

### Datos de mercado con año

| Indicador | Dato | Año o corte | Fuente |
|---|---|---|---|
| Producción | 12,65 millones de sacos, -15% | Año cafetero 2025/26 | [Forbes con EFE](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/) |
| Exportaciones | 11,78 millones de sacos, -12% | Año cafetero 2025/26 | [Forbes con EFE](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/) |
| Consumo interno | 2,32 millones de sacos en 12 meses | Octubre de 2026 | [Forbes con EFE](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/) |
| Carga de 125 kg, promedio mensual | $2.966.133 a $2.069.100, -30,2% | Septiembre de 2025 a septiembre de 2026 | [FNC 2025](https://federaciondecafeteros.org/wp-content/uploads/2026/03/9.-Informe-mensual-Septiembre-2025-p-1.pdf), [FNC 2026](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf) |
| Carga, referencia diaria | $2.010.000. La URL se sobrescribe a diario | 4 de noviembre de 2026 | [FNC](https://federaciondecafeteros.org/wp-content/uploads/2026/03/precio_cafe.pdf) |
| IPC de café | +52,1% en 2025, -2,8% anual en septiembre de 2026 | 2025 y 2026 | [FNC diciembre](https://federaciondecafeteros.org/wp-content/uploads/2026/03/12.-Informe-mensual-Diciembre-p.pdf), [FNC septiembre](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf) |
| Retail, valor | $3,05 billones, +27,9%. Sin método publicado en la nota | 2025 | [Nielsen citado por Bahamón](https://forbes.co/2026/04/22/red-forbes/el-cafe-que-no-nos-tomamos/) |
| Retail por empresa | Colcafé y Nutresa 43%, Nestlé 14%, Águila Roja 9%, Procafecol 3,4%, Luker 2,3% | 2023 | [Euromonitor en La República](https://www.larepublica.co/empresas/lideres-del-mercado-retail-de-cafe-4005383) |
| Sello Rojo | Cerca de 35% de marca, declarado por la empresa y sin base publicada | 2026 | [La República](https://www.larepublica.co/empresas/sello-rojo-baja-sus-precios-hasta-17-en-diferentes-referencias-desde-septiembre-4475963) |
| Premium | Cerca de 10% del total, dicho por un directivo de Juan Valdez | 2026 | [Portafolio](https://www.portafolio.co/negocios/empresas/juan-valdez-apunta-cerrar-el-ano-con-700-tiendas-y-acelera-su-expansion-internacional-504524) |
| Especialidad y grano | Crecen 20% a 30% anual, dicho por Café Oma | 2026 | [Agronegocios](https://www.agronegocios.co/agricultura/cafe-de-oma-evalua-su-entrada-a-mercados-de-argentina-y-chile-4423631) |
| Alimentos y bebidas en línea | 1,22% del valor y 1,86% de las transacciones, datos preliminares | Primer trimestre de 2026 | [CCCE](https://ccce.org.co/wp-content/uploads/2017/06/Publico_V1-2026-IInforme-1er-trimestre-economico.pdf) |
| Compras desde móvil | 45,6% de bienes de consumo | Octubre de 2025 | [MinTIC](https://observatorioecommerce.mintic.gov.co/797/articles-438819_Article.pdf) |
| Mensajería expresa | 84,1 millones de envíos | Primer trimestre de 2026 | [Colombia TIC](https://colombiatic.mintic.gov.co/679/articles-438765_presentacion_cifras.pdf) |
| Público en inglés | 683.047 viajeros de EE. UU., -7,1% | Enero a julio de 2026 | [Vanguardia con Anato](https://www.vanguardia.com/colombia/2026/08/27/top-10-estados-unidos-encabeza-la-llegada-de-turistas-a-colombia/) |
| Residentes de EE. UU. | 6.693 entradas con actividad "residente". Son flujos, no población | Enero a septiembre de 2025 | [Migración Colombia](https://nexusmigracion.cancilleria.gov.co/sites/default/files/documentos/2026-03/Flujos_migratorios_extranjeros_Sept%20%282025%29%20Migracion_Colombia.pdf) |

### Qué implican estos datos

Sello Rojo bajó hasta 17% desde septiembre de 2026, mientras la carga cayó 30,2% y el consumidor apenas vio -2,8% ([La República](https://www.larepublica.co/empresas/sello-rojo-baja-sus-precios-hasta-17-en-diferentes-referencias-desde-septiembre-4475963), [FNC](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf)). Lectura propia: si el masivo sigue bajando y la especialidad no, la distancia de precio se verá mayor. Eso aumenta la carga de prueba sobre una bolsa de $65.000.

El sabor aparece como primer criterio de elección, según un [estudio CUAS citado por Valora Analitik](https://www.valoraanalitik.com/criterio-de-consumo-de-cafe-cambio-en-colombia/). Es una fuente débil: la nota no da autor, muestra ni fecha, y cita a un vocero de Oma. No se halló ninguna encuesta pública que mida el peso de finca, puntaje, frescura o precio al productor.

Las importaciones equivalen a cerca del 70% del consumo (cálculo propio con [1,63](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf) sobre [2,32 millones de sacos](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/)). La razón es solo orientativa, porque parte de lo importado puede reexportarse. Aun así, respalda comunicar origen colombiano frente al mercado masivo, dentro de los límites legales de la sección Origen.

### Contradicciones entre fuentes

| Tema | Versiones | Tratamiento |
|---|---|---|
| Consumo interno | [2,32 millones](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/), [2,6 millones](https://forbes.co/2026/04/22/red-forbes/el-cafe-que-no-nos-tomamos/), [2,2 millones](https://www.agronegocios.co/agricultura/cafe-de-oma-evalua-su-entrada-a-mercados-de-argentina-y-chile-4423631) | Se usa la más reciente con año cafetero cerrado |
| Importaciones | [1,61](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/), [1,63 preliminar](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf), [1,52](https://www.agronegocios.co/agricultura/los-colombianos-consumen-330-tazas-de-cafe-al-ano-equivalentes-a-2-5-kilos-4422908) y [1,3 millones](https://forbes.co/2026/04/22/red-forbes/el-cafe-que-no-nos-tomamos/) | Cortes y fuentes distintos, no se reconcilian |
| Per cápita | [2,2 kg, FNC](https://www.larepublica.co/economia/entrevista-con-el-gerente-de-fedecafe-german-bahamon-4254929) y [2,5 kg, Asoexport](https://www.agronegocios.co/agricultura/los-colombianos-consumen-330-tazas-de-cafe-al-ano-equivalentes-a-2-5-kilos-4422908) | Se informan ambos |
| Tazas | [3 a 4 al día](https://www.publimetro.co/estilo-vida/2025/11/13/el-despertar-de-una-nueva-cultura-cafetera-en-colombia-mas-origen-mas-sabor-y-mas-conciencia/) y [330 al año](https://www.agronegocios.co/agricultura/los-colombianos-consumen-330-tazas-de-cafe-al-ano-equivalentes-a-2-5-kilos-4422908) | Probablemente miden universos distintos, sin aclaración de las fuentes |
| Tamaño retail | [Euromonitor 2023: $3,7 billones](https://www.larepublica.co/empresas/lideres-del-mercado-retail-de-cafe-4005383) supera a [Nielsen 2025: $3,05 billones](https://forbes.co/2026/04/22/red-forbes/el-cafe-que-no-nos-tomamos/) | No comparables, no se detalla el universo |
| Euromonitor contra sí mismo | $3,7 billones con +24% implica cerca de $2,98 billones en 2022 (cálculo propio), no los [$2,47 billones publicados](https://www.larepublica.co/empresas/nutresa-aguila-roja-y-nestle-son-las-empresas-que-mas-venden-cafe-en-colombia-3724197) | Serie no comparable entre ediciones |
| Nielsen contra Nielsen | [US$550 millones](https://www.valoraanalitik.com/criterio-de-consumo-de-cafe-cambio-en-colombia/) equivalen a cerca de $1,9 a $2,2 billones (cálculo propio), lejos de $3,05 billones | Posibles universos distintos |
| E-commerce, primer trimestre de 2026 | [$39,37 billones y ticket de $211.292](https://www.itsitio.com/co/informes/colombia-ecommerce-record-transaccion/) frente a [$39,72 billones y ticket de $211.192](https://dplnews.com/?p=316434). DPL también da $39,4 billones | Serie preliminar y revisada |
| Alimentos en línea | [1,22% del valor](https://ccce.org.co/wp-content/uploads/2017/06/Publico_V1-2026-IInforme-1er-trimestre-economico.pdf) frente a ["segundo lugar"](https://www.contextoganadero.com/economia/compras-online-en-colombia-rompen-records-pero-miles-de-empresas-siguen-rezagadas), ambos atribuidos a CCCE | Posibles definiciones distintas, sin aclarar |
| Tiendas de Juan Valdez | [630, sin fecha](https://juanvaldez.com/quienes-somos/) frente a [688 en octubre de 2026](https://www.portafolio.co/negocios/empresas/juan-valdez-apunta-cerrar-el-ano-con-700-tiendas-y-acelera-su-expansion-internacional-504524) | Se usa el dato fechado |
| Cuota de Tostao' | [19% y 21% en el mismo texto](https://www.larepublica.co/empresas/las-marcas-juan-valdez-y-tostao-lideran-el-mercado-de-cafe-preparado-en-tiendas-3598418) | No se usa como cifra exacta |

La nota de [La República](https://www.larepublica.co/economia/en-cierre-de-ano-cafetero-2025-2026-produccion-cayo-en-2-21-millones-de-sacos-4499915) repite 14,87 millones para ambos años por error, y [Forbes](https://forbes.co/2026/10/09/economia-y-finanzas/produccion-anual-de-cafe-cayo-15-y-cerro-en-1265-millones-de-sacos/) sí cuadra con -15%. El informe de [junio de 2026 de la FNC](https://federaciondecafeteros.org/wp-content/uploads/2026/07/6.-Informe-mensual-Junio-2026-p.pdf) dice -20% mensual en el texto, pero su tabla da -2,5% mensual y -20% anual. Vale la tabla.

El premium no equivale a especialidad con 80 puntos o más. Por eso una estimación de cerca de $300.000 millones al año (cálculo propio: 10% de $3,05 billones) solo sirve como orden de magnitud. No debe citarse como tamaño del segmento.

### Datos para gráfico de precios

Valores en COP por 250 g, sin envío, consultados el 5 de noviembre de 2026 y escritos sin separador de miles. "Sí" indica cálculo propio; "No" indica que la presentación ya es de 250 g. No es una muestra representativa de cada catálogo.

| Grupo | Marca | Referencia mínima y máxima | Mínimo | Máximo | Cálculo propio | Fuente |
|---|---|---|---|---|---|---|
| Masivas | La Bastilla | Fuerte 390 g a Fuerte grano 500 g | 11154 | 15750 | Mín: sí. Máx: sí | [Tienda Nutresa](https://www.tiendanutresaencasa.com/bastilla) |
| Masivas | Sello Rojo | Institucional 1.000 g a Descafeinado 250 g | 11625 | 20071 | Mín: sí. Máx: no | [Tienda Nutresa](https://www.tiendanutresaencasa.com/Sello-Rojo) |
| Masivas | Águila Roja | Tostado y molido 2.500 g a Supremo grano 450 g | 12010 | 35556 | Mín: sí. Máx: sí | [Éxito, tercero](https://www.exito.com/aguila-roja) |
| Masivas | Buendía | Selecto 340 g a molido 340 g | 18309 | 22243 | Mín: sí. Máx: sí | [Comprocafé, tercero](https://comprocafedecolombia.com/), [Éxito, tercero](https://www.exito.com/kw/cafe-buendia) |
| Masivas | Matiz | Ámbar 340 g a Escarlata grano 500 g | 23603 | 25110 | Mín: sí. Máx: sí | [Tienda Nutresa](https://www.tiendanutresaencasa.com/matiz) |
| Masivas | Juan Valdez | Colina 454 g a Sierra Nevada 454 g | 27478 | 37390 | Mín: sí. Máx: sí | [Colina](https://www.tiendajuanvaldez.com/cafe-premium-colina-454gr-8ad68615-a481-44c1-a250-c1fbf472f10e/p), [Sierra Nevada](https://www.tiendajuanvaldez.com/cafe-origen-sierra-nevada-454-gr-2002ffb5-e47f-4dfa-837a-019219aaf276/p) |
| Hacienda y origen | Comprocafé | Monte Oscuro 250 g, con marca de oferta | 23000 | 23000 | No | [Comprocafé](https://comprocafedecolombia.com/) |
| Especialidad urbana | Varietale | Especial 500 g a San Antonio 300 g, agotado | 26000 | 60833 | Mín: sí. Máx: sí | [Suscripción](https://varietale.com/products/suscripcion-cafe-especial-500g), [San Antonio](https://varietale.com/products/san-antonio) |
| Especialidad urbana | Azahar | Fruta 1 kg a Decaf 340 g | 26925 | 48162 | Mín: sí. Máx: sí | [Comprar](https://azaharcoffee.com/comprar/) |
| Especialidad urbana | Libertario | Paz 454 g a Punk Papayo 340 g | 33370 | 61176 | Mín: sí. Máx: sí | [Paz](https://www.libertariocoffee.com/products/paz), [Punk Papayo](https://www.libertariocoffee.com/products/punk-typica-copy) |
| Especialidad urbana | Devoción | Toro 340 g a Villa Pastora 340 g | 34118 | 42279 | Mín: sí. Máx: sí | [Toro](https://devocion.com.co/products/cafe-toro), [Ediciones](https://devocion.com.co/collections/ediciones-limitadas) |
| Especialidad urbana | Amor Perfecto | Insignia 500 g a Wilton Benítez 350 g | 36450 | 60000 | Mín: sí. Máx: sí | [Insignia](https://cafeamorperfecto.com/products/cafe-insignia-500-gr), [Colección](https://cafeamorperfecto.com/collections/cafes-de-caficultor) |
| Especialidad urbana | Colo | Sumercé 340 g a Gesha Natural 250 g | 36765 | 80000 | Mín: sí. Máx: no | [Sumercé](https://colo.com.co/collections/diversos/products/sumerce-340g), [Gesha](https://colo.com.co/products/gesha-natural-250g) |
| Especialidad urbana | Pergamino | Buesaco 360 g a Borbón Rosado 360 g | 37431 | 55486 | Mín: sí. Máx: sí | [Buesaco](https://co.pergamino.co/products/buesaco), [Borbón Rosado](https://co.pergamino.co/products/borbon-rosado-san-jose-de-isnos-360g-edicion-especial) |
| Especialidad urbana | Catación Pública | Empresarial 3.000 g a Gesha Pitalito 340 g | 24917 | 95588 | Mín: sí. Máx: sí | [Esmeralda](https://catacionpublica.co/products/empresarial-esmeralda), [340 g](https://catacionpublica.co/collections/340-gr) |
| Especialidad urbana | Tropicalia | Resguardo Inga 340 g a Heirloom 250 g | 40441 | 120000 | Mín: sí. Máx: no | [Inga](https://www.tropicaliacoffee.com/products/alfredo-mogollon-cundinamarca-340g-copia), [Heirloom](https://www.tropicaliacoffee.com/products/cafe-de-temporada-heirloom-monica-alvarez-250g) |
| Especialidad urbana | Café Quindío | Cocora 250 g a Geisha 250 g | 56800 | 130800 | No | [Cocora](https://www.cafequindio.com.co/products/cafe-cocora), [Geisha](https://www.cafequindio.com.co/products/geisha) |
| Hacienda y origen | Jesús Martín | Peaberry 250 g, agotado, a Exótico 250 g | 28000 | 70000 | No | [Tienda](https://cafejesusmartin.co/shop/) |
| Hacienda y origen | El Ocaso | Salento 250 g a Gesha Honey Lactic 125 g | 28000 | 84000 | Mín: no. Máx: sí | [Tienda](https://cafe.fincaelocasosalento.com/tienda/) |
| Hacienda y origen | San Alberto | Premiado 340 g a Cisne Negro #2 de 250 g | 46324 | 122000 | Mín: sí. Máx: no | [Premiado](https://cafesanalberto.com.co/products/cafe-san-alberto-340-gr), [Cisne Negro](https://cafesanalberto.com.co/products/cafe-san-alberto-cisne-negro-2) |
| Referencia | DobleYo | Pitalito Sidra 250 g a Isnos Geisha 250 g, precios sin confirmar | 65000 | 72000 | No | [Tienda](https://dobleyo.cafe/tienda) |

Quedan fuera los solubles, porque rinden distinto, como [Colcafé y Buendía liofilizado](https://www.tiendanutresaencasa.com/colcafe). También quedan fuera [La Palma](https://lapalmayeltucan.com/en-us/products/roasted-geisha) y [Esperanza](https://cafegranjalaesperanza.com/products/geisha-natural-las-margaritas), en USD y sin TRM verificada, y [Hija Mía](https://www.hijamiacoffee.com/collections/coffee), con moneda sin confirmar. [Café Cultor](https://cafecultor.co/producto/borbon-rosado/) y [Galavis](https://cafegalavis.com.co/) no permiten asignar gramaje; Oma, Lukafe y Nescafé no tienen precio verificado.

Los precios de Nutresa dependen de la ubicación, según [la propia tienda](https://www.tiendanutresaencasa.com/Sello-Rojo). Las líneas masivas de Éxito y Comprocafé son precios de terceros, de un solo día. Una guía de tercero, [Colombia Move](https://colombiamove.com/blog/es/buying-specialty-coffee-beans-colombia-roasters-guide/), ubica bolsas de microlote de 250 a 340 g entre $30.000 y $65.000, sin metodología publicada.

### Para qué nos sirve

Este mapa habilita una decisión de posicionamiento: DobleYo compite en especialidad, con referencia de microlote, y no por precio contra masivas. Conduce a P16, que confirma precios con este comparativo, y a P11, que aporta la prueba que justifica ese precio. Los vacíos de consumidor conducen a P18, la encuesta propia; la forma de preparar en casa conduce a P19.

## Fincas y productores

Solo 1 marca, Azahar, publica el precio pagado al productor por lote; lo normal es hablar de "productores aliados" sin cifra verificable. En masivas domina la cifra agregada, y en especialidad el nombre solo aparece en ediciones especiales. La mayoría de los datos son autodeclarados y no se contrastaron con los productores.

| Marca | Grupo | Qué muestra | Formato | Fuente |
|---|---|---|---|---|
| Juan Valdez | Masivas | 9 asociaciones y 7 cooperativas de 11 departamentos, más de 270.000 kg desde 2017. Errata: "más de 1.00 mujeres". Sin finca en las fichas abiertas | Línea de tiempo en texto | [Mujeres Cafeteras](https://juanvaldez.com/mujeres-cafeteras/) |
| Nescafé | Masivas | "+19k Caficultores beneficiados" y "+10k Hectáreas renovadas", sin fincas | Tarjetas con cifras | [Plan Nescafé](https://www.nescafe.com/co/sostenibilidad/plannescafe) |
| Colcafé, Bastilla, Oma, Águila Roja | Masivas | Sin caficultores nombrados en lo capturado. Oma dice "Estamos trabajando" en comercio justo | Texto corporativo | [Colcafé](https://colcafe.com/sostenibilidad/), [Bastilla](https://cafelabastilla.com/productos/), [Oma](https://empacados.cafeoma.com/sostenibilidad/), [Águila Roja](https://cafeaguilaroja.com/quienesSomos) |
| Sello Rojo, Lukafe, Buendía | Masivas | No verificado. Páginas sin texto o sitio inaccesible | Sin evaluar | [Sello Rojo](https://cafesellorojo.com/nosotros/), [Lukafe](https://lukafe.com.co/lukafe), [Éxito, tercero](https://www.exito.com/t/cafe-buendia) |
| Azahar | Urbana | Productor, municipio y "PRECIO POR CARGA: $2'733.837", con referencia de Precio Digno | Ficha y relato | [Edición Especial Huila](https://azaharcoffee.com/producto/edicion-especial-huila/) |
| Varietale | Urbana | "Estampilla del lote", finca, productora y distancia a Bogotá. Palermo aparece como "Varios productores" | Bloque en tres pasos | [San Antonio](https://varietale.com/products/san-antonio), [Regiones](https://varietale.com/pages/regiones) |
| Tropicalia | Urbana | Productor bajo el campo "Héroe", finca, territorio e historia | Campos en ficha | [Resguardo Inga](https://www.tropicaliacoffee.com/products/alfredo-mogollon-cundinamarca-340g-copia) |
| Amor Perfecto | Urbana | Colección "Cafés de caficultor", 15 caficultores, pago "aproximadamente el doble" sin cifra por café | Colección y sostenibilidad | [Colección](https://cafeamorperfecto.com/collections/cafes-de-caficultor), [Sostenibilidad](https://cafeamorperfecto.com/pages/sostenibilidad-amor-perfecto) |
| Pergamino | Urbana | "Más de 1.500 productores aliados". Nombra a Esteban Bolaños en especial, y usa un campo genérico en Buesaco | Texto y ficha | [Quiénes somos](https://co.pergamino.co/pages/quienes-somos), [Borbón Rosado](https://co.pergamino.co/products/borbon-rosado-san-jose-de-isnos-360g-edicion-especial), [Buesaco](https://co.pergamino.co/products/buesaco) |
| Devoción | Urbana | Blends sin finca, pero tablero fechado: 69 caficultoras, 7 proyectos y USD 11.172 | Tablero con reportes | [Impacto](https://devocion.com.co/pages/impacto), [Toro](https://devocion.com.co/products/cafe-toro) |
| Café Quindío | Urbana | Edwin Noreña y Campo Hermoso en Geisha, sin finca en Cocora | Campos en ficha | [Geisha](https://www.cafequindio.com.co/products/geisha), [Cocora](https://www.cafequindio.com.co/products/cafe-cocora) |
| Libertario, Colo, Hija Mía, Catación, Cultor | Urbana | Sin productor en fichas revisadas. Libertario publica impacto de biochar; Cultor dice "más de 10.000 caficultores" | Texto general | [Libertario](https://www.libertariocoffee.com/pages/libertario-impact-core), [Colo](https://colo.com.co/pages/nuestro-proposito-test), [Hija Mía](https://www.hijamiacoffee.com/pages/about-us), [Catación](https://catacionpublica.co/products/cafe-black-edition), [Cultor](https://cafecultor.co/) |
| Granja La Esperanza | Hacienda | Por finca: lotes, área, árboles, altitud, lluvia y humedad. Las Margaritas: 13 lotes, 33,8 ha, 94.367 árboles | Ficha de datos e historia desde 1945 | [Farms](https://cafegranjalaesperanza.com/pages/farms), [History](https://cafegranjalaesperanza.com/pages/history) |
| La Palma y El Tucán | Hacienda | Fundadores, 18 hectáreas, línea de tiempo desde 2012 y lotes de vecinos declarados | Línea de tiempo | [Our Story](https://lapalmayeltucan.com/en-us/pages/our-story), [Envíos](https://lapalmayeltucan.com/en-us/policies/shipping-policy) |
| San Alberto | Hacienda | "Cultivado 100% en la Hacienda San Alberto". Sin página de finca en el menú | Línea en ficha | [Premiado](https://cafesanalberto.com.co/products/cafe-san-alberto-340-gr), [Home](https://cafesanalberto.com.co/) |
| Jesús Martín | Hacienda | Buenos Aires y El Porvenir con vereda, y "Orígenes de la casa" separados de "invitados" | Páginas de finca, fábrica y tienda | [Finca](https://cafejesusmartin.co/finca/), [Home](https://cafejesusmartin.co/) |
| El Ocaso, Venecia, Guayabal | Hacienda | Finca como visita: rutas, coordenadas, aves y tour con precio o reserva | Página turística | [El Ocaso](https://web.fincaelocasosalento.com/), [Venecia](https://haciendavenecia.com/about-us-2/), [Guayabal](https://haciendaguayabal.com/services/) |
| Forest | Hacienda, B2B | Línea de tiempo, personas nombradas, "250 coffee-growing families" y finca aliada | Página propia por finca | [About](https://coffeegreenbeans.com/pages/about-forest-coffee), [Inmaculada](https://coffeegreenbeans.com/pages/inmaculada-coffee-farms) |
| Paraíso 92, Galavis | Hacienda | Paraíso 92 describe terrazas y laboratorios con poca dirección. Galavis no declara fincas | Texto | [Paraíso 92](https://www.granjaparaiso92.com/), [Galavis](https://cafegalavis.com.co/nuestra-historia/) |
| Comprocafé | Marketplace FNC | El vendedor cuenta su origen, como Villa Celina en Toledo | Ficha de vendedor | [Villa Celina](https://comprocafedecolombia.com/product/cafe-villa-celina-origen-toledo-grano-500g/) |

### Qué es lo normal

Lo normal es una frase general de relación con caficultores, sin nombre ni dinero. La profundidad depende de la línea: las ediciones especiales nombran productor y los cafés de casa usan genéricos. Se ve en [Pergamino Buesaco](https://co.pergamino.co/products/buesaco), [Quindío Cocora](https://www.cafequindio.com.co/products/cafe-cocora) y [Amor Perfecto Insignia](https://cafeamorperfecto.com/products/cafe-insignia-500-gr).

### Quién lo hace mejor

Para el comprador colombiano, [Azahar](https://azaharcoffee.com/producto/edicion-especial-huila/) es el mejor ejemplo, porque nombra productores y publica cuánto pagó. Esa cifra supera en cerca de 36% la carga de $2.010.000 del 4 de noviembre (cálculo propio). La comparación es orientativa, porque Azahar no declara fecha.

Azahar también advierte que el pago no garantiza por sí solo el resultado para el productor.

En datos de finca lidera [Granja La Esperanza](https://cafegranjalaesperanza.com/pages/farms), con cifras como 33.879 árboles en Cerro Azul. En narración conectada a la ficha lidera [Varietale](https://varietale.com/products/san-antonio), con tres pasos y una productora con nombre. Ambos muestran que el detalle exacto convence más que el adjetivo, lectura propia sin medición de conversión.

### Qué casi nadie hace

Casi nadie permite verificar lo que dice sobre pago. Las frases ["doble de la tasa"](https://cafeamorperfecto.com/pages/sostenibilidad-amor-perfecto), ["por encima del precio justo"](https://devocion.com.co/pages/sostenibilidad-2) y ["económicamente sostenibles"](https://www.tropicaliacoffee.com/pages/nosotros) quedan sin cifra por café. Tampoco apareció un mapa de lotes en las páginas leídas, y las coordenadas de [Venecia](https://haciendavenecia.com/buy-coffee/) son lo más cercano.

### Qué significa para una tostadora pequeña

Una tostadora pequeña no puede igualar cifras como 1.500 productores, pero sí puede nombrar a pocos con precisión. Un productor real con municipio, altura y relación explicada vale más que tres fincas sin respaldo. Separar cafés propios de invitados, como [Jesús Martín](https://cafejesusmartin.co/), evita prometer finca propia cuando no existe.

Publicar precio pagado solo conviene si se sostiene en el tiempo y con una referencia. Si no existe esa cifra, la frase "mejor precio para el productor" debe salir. La importancia real de estos datos para el comprador sigue siendo una hipótesis, porque no hay encuesta pública.

### Para qué nos sirve

Este hallazgo obliga a decidir qué productores reales puede nombrar DobleYo y qué debe dejar de afirmar hoy. Conduce a P02, que retira fincas, caficultores, certificaciones y la frase de mejor precio sin respaldo. Después conduce a P11, ficha con datos de etiqueta, y a P17, productor real con precio pagado si el dueño lo aprueba.

## Proceso

Casi ninguna marca masiva explica el proceso por café, y solo 1, Águila Roja, muestra un esquema de 11 pasos. En especialidad, el proceso aparece como campo de ficha, con diferencias grandes de detalle. El dato de tueste más cercano al cliente es una promesa de frescura, no una fecha.

| Marca | Grupo | Qué muestra | Formato | Fuente |
|---|---|---|---|---|
| Águila Roja | Masivas | Recolección a despacho en 11 pasos. Sitio con pie de 2007 | Línea de tiempo con "Leer más" | [Proceso](https://cafeaguilaroja.com/proceso-de-produccion-del-cafe) |
| Juan Valdez | Masivas | "Seleccionamos a mano", sin beneficio ni tostión en fichas. Sí métodos de preparación | Frase y ficha | [Portada](https://juanvaldez.com/), [Sierra Nevada](https://www.tiendajuanvaldez.com/cafe-origen-sierra-nevada-454-gr-2002ffb5-e47f-4dfa-837a-019219aaf276/p) |
| Oma | Masivas | Proceso lavado y tostión media en Origen de mi Tierra | Bloque corto | [Origen de mi Tierra](https://empacados.cafeoma.com/origen-de-mi-tierra/) |
| Nescafé | Masivas | Cisco como combustible y fábrica de Bugalagrande con 30% de energía eléctrica | Tarjetas | [Plan Nescafé](https://www.nescafe.com/co/sostenibilidad/plannescafe) |
| Tropicalia | Urbana | Honey, control de temperatura y pH, secado 20 días, "TIEMPO TOTAL DE FERMENTACIÓN: 48 h" | Bloque de beneficio | [Resguardo Inga](https://www.tropicaliacoffee.com/products/alfredo-mogollon-cundinamarca-340g-copia) |
| Varietale | Urbana | Recolección selectiva, secado al sol y tueste en Bogotá. Etapas de planta y dos trilladoras | Bloque en ficha y página | [San Antonio](https://varietale.com/products/san-antonio), [Tostadora](https://varietale.com/pages/tostadora) |
| Pergamino | Urbana | Blog sobre lavado, honey, natural y trilla, más proceso en ficha | Contenido educativo | [Home](https://co.pergamino.co/), [Buesaco](https://co.pergamino.co/products/buesaco) |
| Devoción | Urbana | Preparar "dentro de los 30 días posteriores al tueste" y FAQ de tostado bajo pedido. Texto con posible herencia de EE. UU. | FAQ de ficha | [Toro](https://devocion.com.co/products/cafe-toro) |
| Azahar | Urbana | Recolección manual y tostión por perfil, con tostadora en Quindío | Texto | [Nosotros](https://azaharcoffee.com/nosotros/) |
| Colo | Urbana | "El 100% de nuestro café es tostado con energía obtenida por paneles solares" | Texto de propósito, URL con "-test" | [Propósito](https://colo.com.co/pages/nuestro-proposito-test) |
| Café Quindío | Urbana | Origen, sostenibilidad, maestros tostadores y empaque, sin cifras | Página por etapas | [Proceso](https://www.cafequindio.com.co/pages/nuestro-proceso) |
| Catación Pública | Urbana | Honey 48 h y "340 gr = 38 tazas" | Ficha | [Black Edition](https://catacionpublica.co/products/cafe-black-edition) |
| San Alberto | Hacienda | "Quíntuple Selección", beneficio lavado y secado solar y mecánico | Lista en ficha | [Premiado](https://cafesanalberto.com.co/products/cafe-san-alberto-340-gr) |
| La Palma | Hacienda | "We roast these coffees on the farm, and every bag carries its roast date" | Frase de portada, tienda aún cerrada | [Home](https://lapalmayeltucan.com/en-us) |
| Forest | Hacienda, B2B | "Over 240 experiments" y 12 protocolos. El cliente arma variedad, proceso y fermentación | Configurador | [About](https://coffeegreenbeans.com/pages/about-forest-coffee), [Create your coffee](https://coffeegreenbeans.com/products/create-your-coffee) |
| Venecia, El Ocaso | Hacienda | Proceso explicado como visita. Venecia avisa que la maquinaria no opera fines de semana | Tour | [Venecia](https://haciendavenecia.com/coffee-tour/), [El Ocaso](https://web.fincaelocasosalento.com/coffee-tour-tradicional/) |

### Qué es lo normal

La ficha típica de especialidad trae proceso, variedad, región, gramaje, molienda y precio. La altura es frecuente, pero no universal, y la fecha de tueste no apareció en la muestra de especialidad. Frescura significa casi siempre una frase como ["recién tostado"](https://colo.com.co/) o ["roast fresh for every order"](https://www.hijamiacoffee.com/).

### Quién lo hace mejor

[Tropicalia](https://www.tropicaliacoffee.com/products/alfredo-mogollon-cundinamarca-340g-copia) da el proceso más concreto de la muestra, con 48 horas de fermentación y 20 días de secado. [Varietale](https://varietale.com/products/san-antonio) lo conecta mejor con el producto, porque separa recolección, secado y tueste dentro de la ficha. [La Palma](https://lapalmayeltucan.com/en-us/policies/shipping-policy) es el mejor ejemplo de franqueza, aunque su tienda mira a EE. UU. y aún no está abierta.

### Qué casi nadie hace

Casi nadie convierte la frescura en un dato consultable antes de comprar. Solo [La Palma](https://lapalmayeltucan.com/en-us) promete fecha impresa en cada bolsa, y [Colombia Move](https://colombiamove.com/blog/es/buying-specialty-coffee-beans-colombia-roasters-guide/), tercero, aconseja buscarla. Los empaques no se revisaron, así que muchas marcas podrían imprimirla sin publicarla en la web.

### Qué significa para una tostadora pequeña

Publicar la fecha de tueste del café en venta es un diferenciador barato si el dato existe y es cierto. También hace verificable una promesa como ["menos de 15 días"](https://dobleyo.cafe/).

Un alimento no está obligado a informar lote y vencimiento en línea ([Ley 2439, art. 4, lit. b](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf)). Publicar la fecha sería voluntario.

Una tostadora pequeña puede narrar lo que está vendiendo hoy, no un lote pasado. Ese relato no exige tecnología nueva, solo cuidado con lo que se publica. La recomendación es hipótesis de diferenciación, porque no hay datos de conversión.

### Para qué nos sirve

Este hallazgo permite cambiar el relato de portada por el café que hoy se vende y publicar una fecha verificable. Conduce a P08, que corrige la portada y el lote narrado, y a P11, que agrega fecha de tueste a la ficha. También limita lo que se puede prometer sobre frescura hasta confirmar el dato real de las bolsas en stock.

## Calidad

Solo 5 marcas muestran puntaje por producto o banda: Varietale, Café Quindío, Esperanza, Forest y La Guashira, esta última en euros. El resto se apoya en adjetivos, sellos, premios o prensa. No se encontró quién puntúa en ninguna ficha revisada, salvo el "quality team" de Forest en una categoría.

| Marca | Grupo | Prueba que muestra | Verificabilidad | Fuente |
|---|---|---|---|---|
| Juan Valdez | Masivas | Empresa B desde febrero de 2021, Café Bosque y Clima, orgánico, Rainforest, Halal, Kosher, BASC y OEA | Informe descargable. Sin puntaje en fichas | [Certificaciones](https://juanvaldez.com/estrategia-y-certificaciones/) |
| Oma | Masivas | "Café de Colombia", denominación de origen e indicación geográfica | Sellos sin puntajes | [Calidad](https://empacados.cafeoma.com/calidad/) |
| Matiz | Masivas | Ficha sensorial: intensidad, tostión, aroma, acidez y cuerpo | Autodeclarada, sin puntaje | [Ámbar](https://cafematiz.com/productos/cafe-matiz-ambar/) |
| Águila Roja, Sello Rojo, Lukafe | Masivas | Certificaciones o páginas sin texto legible | No verificado | [Águila Roja](https://cafeaguilaroja.com/certificaciones), [Sello Rojo](https://cafesellorojo.com/nuestro-sabor-y-aroma/tradicional/), [Lukafe](https://lukafe.com.co/se-un-experto/cafe-paso-paso) |
| Varietale | Urbana | 87.75 en San Antonio, 88 en Borbón Papayo y distintivo de subasta | Autodeclarado, sin catador nombrado | [San Antonio](https://varietale.com/products/san-antonio), [Borbón Papayo](https://varietale.com/products/borbon-papayo) |
| Café Quindío | Urbana | "88 puntos SCA" junto al precio. Reseñas "Verificado" con fecha | Autodeclarado | [Geisha](https://www.cafequindio.com.co/products/geisha) |
| Catación Pública | Urbana | Laboratorio Q-Venue del CQI, según la marca. Colección de certificaciones con "0 productos" | Credencial técnica, sin puntaje por café | [Laboratorios](https://catacionpublica.co/pages/laboratorios), [Certificaciones](https://catacionpublica.co/collections/certificaciones-internacinales) |
| Amor Perfecto | Urbana | 51 reconocimientos, 9 campeones nacionales, 1 mundial, y Diego Campos WBC 2021 | Con nombres, sin contraste externo | [Historia](https://cafeamorperfecto.com/pages/historia), [Campeonatos](https://cafeamorperfecto.com/pages/campeonatos-internacionales) |
| Azahar | Urbana | Sello de prensa con enlaces a NYT, Washington Post, Eater y Sprudge | Enlaces externos vistos, no abiertos | [Home](https://azaharcoffee.com/) |
| Devoción | Urbana | Frescura y Empresa B en sellos de página | Sin puntaje | [Wholesale](https://devocion.com.co/pages/wholesale) |
| Café Cultor | Urbana | Rainforest Alliance y Bird Friendly para Bajo Ceiba. Valoraciones en 0 | Sello por producto | [Home](https://cafecultor.co/), [Borbón Rosado](https://cafecultor.co/producto/borbon-rosado/) |
| Libertario, Colo, Tropicalia, Hija Mía | Urbana | Sin puntaje en fichas revisadas | No visto | [Libertario](https://www.libertariocoffee.com/products/paz), [Colo](https://colo.com.co/products/gesha-natural-250g), [Tropicalia](https://www.tropicaliacoffee.com/pages/nosotros), [Hija Mía](https://www.hijamiacoffee.com/) |
| San Alberto | Hacienda | "El café más premiado de Colombia" | Sin lista, años ni enlaces en lo rastreado | [Home](https://cafesanalberto.com.co/) |
| La Palma | Hacienda | Jooyeon Jeon, WBC 2019, y "23 champions & finalists". Enlace "See the full record" | Registro no abierto ni contrastado | [Geisha](https://lapalmayeltucan.com/en-us/products/roasted-geisha) |
| Granja La Esperanza | Hacienda | "SCORE 86-87.75" y premios de 2008 a 2020 por año | Rango sin catador. Pestañas sin texto legible | [Ficha](https://cafegranjalaesperanza.com/products/geisha-natural-las-margaritas), [Awards](https://cafegranjalaesperanza.com/pages/awards) |
| Forest | Hacienda, B2B | Bandas 84 a 86, 86 a 87,5, sobre 88 y sobre 89. Admite que Innovation no tiene puntaje | Autodeclarado con franqueza | [Community](https://coffeegreenbeans.com/collections/community), [Innovation](https://coffeegreenbeans.com/collections/innovation-series) |
| Paraíso 92 | Hacienda | "Can be verified through the multiple awards obtained" | Sin lista ni enlaces | [About](https://www.granjaparaiso92.com/sobre-nosotros) |
| La Guashira | Referencia en euros | Puntaje SCA por producto, de 84 a 88, y media por pack | Autodeclarado | [Origen](https://laguashira.com/products/origen), [Packs](https://laguashira.com/collections/packs) |

La definición común de café especial es superar 80 puntos SCA, según un comercio local ([La Tienda del Café](https://latiendadelcafe.co/en/blogs/cafe-colombiano/crecimiento-del-cafe-de-especialidad-en-colombia)). Es una fuente de divulgación, no una norma revisada aquí.

### Qué es lo normal

Lo normal es prometer calidad sin una prueba enlazada. Los sellos son más comunes en masivas y los premios en marcas de finca. Los puntajes publicados son autodeclarados, y una reseña verificada es rara.

### Quién lo hace mejor

[Varietale](https://varietale.com/products/san-antonio) combina puntaje, distintivo y productora en una sola ficha, aunque no dice quién cató. [Forest](https://coffeegreenbeans.com/collections/innovation-series) gana en franqueza al admitir el puntaje que no tiene. [Café Quindío](https://www.cafequindio.com.co/products/geisha) muestra reseñas verificadas con fecha, y [Varietale](https://varietale.com/) deja ver una crítica en portada.

### Qué casi nadie hace

Casi nadie enlaza un premio a un registro externo que se pueda seguir. En la [Taza de la Excelencia 2023](https://allianceforcoffeeexcellence.org/colombia-2023/), tercero, no figura ninguna marca de hacienda revisada. Ojo con el homónimo: el puesto 8, "La Palma", es de Pedro Miguel Echavarria en Antioquia, no de La Palma y El Tucán.

Solo se revisó esa edición, y los premios de San Alberto, Esperanza y La Palma no se contrastaron con sus organizadores. Tampoco apareció nadie que nombre a su Q Grader en ficha; en [Catación Pública](https://catacionpublica.co/pages/laboratorios) el término aparece como formación.

### Qué significa para una tostadora pequeña

Una tostadora pequeña debe evitar superlativos sin evidencia, justo lo más débil de la muestra. Si publica puntaje, debe decir quién cató y cuándo; si no publica, debe ser una decisión clara y sostenida. Sin puntaje, las pruebas posibles son reseñas de compra verificada, fecha de tueste y datos de etiqueta.

En DobleYo, `SHOW_CUPPING=false` es decisión de negocio, no error. Por eso esta arista queda débil en una comparación, y se presenta como decisión del dueño en las propuestas. No es recomendable reemplazar el vacío con frases de calidad sin soporte.

### Para qué nos sirve

Este hallazgo define qué prueba de calidad puede usar DobleYo sin romper su decisión sobre el puntaje. Conduce a P01, que retira las reseñas de demostración, y a P15, que abre reseñas solo con compra verificada. La revisión de `SHOW_CUPPING` conduce a P18, con pros, contras y alternativas para el dueño.

## Origen

En 0 marcas rastreadas apareció un QR consultable; lo normal es declarar departamento o municipio, proceso y variedad. La altura es frecuente, no universal, y la fecha de cosecha no apareció en especialidad. Lo más cercano son frases como ["Nueva cosecha"](https://www.cafequindio.com.co/products/cafe-cocora) y ["cosecha activa"](https://devocion.com.co/products/cafe-toro).

| Marca | Grupo | Datos de origen en la ficha o página | No visto en lo rastreado | Fuente |
|---|---|---|---|---|
| Juan Valdez | Masivas | Región, perfil y sabor. Filtros por 10 orígenes y perfil de taza | Altura, variedad, finca, lote, QR | [Sierra Nevada](https://www.tiendajuanvaldez.com/cafe-origen-sierra-nevada-454-gr-2002ffb5-e47f-4dfa-837a-019219aaf276/p), [Catálogo](https://www.tiendajuanvaldez.com/cafe/molido-grano) |
| Oma | Masivas | "ORIGEN Pitalito, Huila", lavado, Castillo y Caturra, tostión media, 3 x 80 g | Altura, finca, productor, puntaje | [Origen de mi Tierra](https://empacados.cafeoma.com/origen-de-mi-tierra/) |
| Matiz | Masivas | "Farallones del Citará", "a mas de 1.700 msnm" y Santander, por región | Altura por producto, variedad | [Portada](https://cafematiz.com/), [Ámbar](https://cafematiz.com/productos/cafe-matiz-ambar/) |
| Nescafé | Masivas | Arábica y robusta de Colombia, Brasil, Honduras, Vietnam e Indonesia. Artesano "100 % de origen" | Finca | [FAQ](https://www.nescafe.com/co/preguntas-frecuentes) |
| Bastilla, Colcafé, Almendra Tropical | Masivas | Presentaciones y tueste, sin origen en lo capturado | Región | [Bastilla](https://cafelabastilla.com/productos/), [Colcafé](https://colcafe.com/sostenibilidad/), [Almendra](https://www.casaluker.com/marca/almendra-tropical/) |
| Pergamino | Urbana | Municipio, proceso, variedad y altitud: 2.050 m en Buesaco, 1.870 m en Borbón Rosado | QR | [Buesaco](https://co.pergamino.co/products/buesaco), [Borbón Rosado](https://co.pergamino.co/products/borbon-rosado-san-jose-de-isnos-360g-edicion-especial) |
| Devoción | Urbana | Región, altura y proceso: Toro 1600-1700 m, Wild Forest 1750-1900 m | Finca en blends. Lugar de tueste no verificado | [Toro](https://devocion.com.co/products/cafe-toro), [Wild Forest](https://devocion.com.co/products/wild-forest) |
| Azahar | Urbana | Municipios, productores, 1.550-1.750 m, variedades y notas | QR | [Edición Especial Huila](https://azaharcoffee.com/producto/edicion-especial-huila/) |
| Varietale | Urbana | Mapa por departamento con altura, municipios y lotes. "Municipio y departamento con nombre propio" | QR | [Regiones](https://varietale.com/pages/regiones) |
| Tropicalia | Urbana | Variedad, territorio, finca, perfil e historia | Altura | [Resguardo Inga](https://www.tropicaliacoffee.com/products/alfredo-mogollon-cundinamarca-340g-copia) |
| Amor Perfecto | Urbana | Caficultor, región, variedad y beneficio. Insignia solo dice "Región: Colombia" | Altura | [Elías Roa](https://cafeamorperfecto.com/products/elias-roa-castillo-colombia-caturra-350gr), [Insignia](https://cafeamorperfecto.com/products/cafe-insignia-500-gr) |
| Catación Pública | Urbana | Origen en el nombre, 1750 msnm y proceso | Productor, finca | [Black Edition](https://catacionpublica.co/products/cafe-black-edition) |
| Colo | Urbana | Gesha, Calarcá, Quindío, natural y notas | Altura, productor | [Gesha Natural](https://colo.com.co/products/gesha-natural-250g) |
| Libertario | Urbana | "Escala de Sabor" y perfil de marca | Región, altura, variedad | [Paz](https://www.libertariocoffee.com/products/paz) |
| Hija Mía | Urbana | Huila, Geisha anaeróbico y tueste medio | Finca, altura | [Mellow Yellow](https://www.hijamiacoffee.com/collections/coffee/products/hija-mia-pink-bourbon-250g) |
| Café Cultor | Urbana | Huila, 1.750 m.s.n.m., lavado, Castillo y Caturra | Productor, finca | [Agustino Forest](https://cafecultor.co/producto/agustino-forest/) |
| Café Quindío | Urbana | Variedad, proceso, caficultor, finca y 1.500 m.s.n.m. en Geisha | Finca en Cocora | [Geisha](https://www.cafequindio.com.co/products/geisha), [Cocora](https://www.cafequindio.com.co/products/cafe-cocora) |
| San Alberto | Hacienda | 1.500-1.800 m, 16 a 25 °C, beneficio, secado y notas | Premios enlazados | [Premiado](https://cafesanalberto.com.co/products/cafe-san-alberto-340-gr) |
| La Palma | Hacienda | "Geisha from lot #4, at 1,763 metres". "Every figure here is our own measurement" | QR | [Geisha](https://lapalmayeltucan.com/en-us/products/roasted-geisha) |
| Granja La Esperanza | Hacienda | Finca, altitud del lote de 1571 a 1852, variedad y proceso | QR | [Ficha](https://cafegranjalaesperanza.com/products/geisha-natural-las-margaritas) |
| Jesús Martín | Hacienda | Bourbon Rosado, gesha, tabi y otras variedades. Casa e invitados separados | Altitud, QR | [Finca](https://cafejesusmartin.co/finca/), [Home](https://cafejesusmartin.co/) |
| El Ocaso | Hacienda | Variedad en el nombre y perfil de taza | Altitud, lote, QR | [Tienda](https://cafe.fincaelocasosalento.com/tienda/), [Black Honey](https://cafe.fincaelocasosalento.com/producto/cafe-black-honey-250gr/) |
| Forest | Hacienda, B2B | Proyectos en Tolima, Huila y Nariño | QR | [Community](https://coffeegreenbeans.com/collections/community) |
| Paraíso 92 | Hacienda | Java, Geisha, Pacamara, Tabi, Sidra. "REAL TRACEABILITY" sin datos consultables | Lote, altura | [Home](https://www.granjaparaiso92.com/) |
| Galavis | Hacienda | Sin región, altitud ni variedad en la ficha revisada | Origen | [Gourmet](https://cafegalavis.com.co/product/cafe-gourmet/) |
| Comprocafé | Marketplace | Villa Celina, 1.650 msnm. Aromallanos, 1.600 a 1.800 msnm | Depende del vendedor | [Villa Celina](https://comprocafedecolombia.com/product/cafe-villa-celina-origen-toledo-grano-500g/), [Aromallanos](https://comprocafedecolombia.com/product/cafe-aromallanos-500g/) |

### Qué es lo normal

En especialidad, lo normal es un bloque de municipio, proceso, variedad y notas. En masivas, lo normal es región y perfil de taza, o ningún origen en la ficha. El dato llega por café, no por lote, salvo excepciones como [La Palma](https://lapalmayeltucan.com/en-us/products/roasted-geisha) y [Varietale](https://varietale.com/products/san-antonio).

### Quién lo hace mejor

Para quien compra en Colombia, [Varietale](https://varietale.com/pages/regiones) lidera porque conecta el mapa con los cafés en venta. [Granja La Esperanza](https://cafegranjalaesperanza.com/products/geisha-natural-las-margaritas) da el dato de altitud por lote más exacto, aunque vende en USD. Entre masivas, [Oma](https://empacados.cafeoma.com/origen-de-mi-tierra/) resume mejor origen, proceso, variedades y tostión en poco espacio.

### Qué casi nadie hace

Casi nadie muestra QR, fecha de cosecha o mapa de lotes en la web. "Trazabilidad" suele quedar en palabra, como en [Paraíso 92](https://www.granjaparaiso92.com/), o en bloque de ficha, como en [Varietale](https://varietale.com/products/san-antonio). Los empaques no se revisaron, así que este vacío se limita a lo publicado en línea.

### Qué significa para una tostadora pequeña

Una ficha del café resuelve casi toda la arista sin QR ni la palabra trazabilidad. La mayoría de los recursos se adapta sin finca propia si se atribuye el dato al productor. Lo que sí exige finca o alianza formal es el tour, el hospedaje y las cifras de hectáreas.

Conviene distinguir origen descriptivo de sello. El logo [100% Café de Colombia](https://cafedecolombia.com/en/100-colombian-coffee/) exige licencia, contrato anual, reportes trimestrales y pago administrativo, con cuantía en un anexo no abierto. El límite entre mención descriptiva y uso de la denominación debe validarlo un abogado de propiedad intelectual.

### Para qué nos sirve

Este hallazgo permite alinear el discurso con la oferta: hoy son 2 cafés del Huila, no tres regiones. Conduce a P02, que corrige Nariño y Sierra Nevada en textos sin respaldo, y a P11, que muestra origen real en la ficha. La decisión sobre QR queda en P18, y los límites del sello en P13.

## Atención al cliente

Casi ninguna marca publica un tiempo general de respuesta: de las revisadas, solo [Hija Mía](https://www.hijamiacoffee.com/pages/contact) dice "within 48hrs". WhatsApp y correo son la base, y el horario solo aparece en parte de la muestra. El tiempo real de respuesta no se midió, porque no se enviaron mensajes.

| Marca | Canales publicados | Horario o plazo | Reseñas, PQR y novedades | Fuente |
|---|---|---|---|---|
| Juan Valdez | (601) 482 41 51, 01 8000 517711, correo. Los términos mencionan chat, sin confirmar que opere | L-S 8am a 8pm. D y festivos 8am a 6pm. Aviso de agotado en 18 horas | Estado y cambios por correo. Módulo de opiniones sin conteo verificado | [Contáctenos](https://www.tiendajuanvaldez.com/servicio-al-cliente#Contactenos), [FAQ](https://www.tiendajuanvaldez.com/servicio-al-cliente#faqs), [Colina](https://www.tiendajuanvaldez.com/cafe-premium-colina-454gr-8ad68615-a481-44c1-a250-c1fbf472f10e/p) |
| Tienda Nutresa | 018000521155, correo, botón de WhatsApp para devoluciones | Sin horario en lo revisado | Notificaciones de estado por correo | [Contacto](https://www.tiendanutresaencasa.com/contacto), [Términos](https://www.tiendanutresaencasa.com/terminos-y-condiciones), [FAQ](https://www.tiendanutresaencasa.com/preguntas-frecuentes) |
| Sello Rojo | 01 8000 51 07 77 | Sin horario ni plazo en lo capturado | PQRS del grupo sin abrir | [Contáctanos](https://cafesellorojo.com/contactanos/) |
| Colcafé, Bastilla | PQRS en CRM de Nutresa | No verificado | CRM no abierto | [Colcafé](https://colcafe.com/), [Bastilla](https://cafelabastilla.com/) |
| Oma | PBX 318 271 1126, formulario, wa.link no abierto | Sin plazo | La página PQR dice "no es un medio de quejas y reclamos", y debajo trae formulario | [Contáctenos](https://www.cafeoma.com/contactenos/), [PQR](https://www.cafeoma.com/quejas-y-reclamos-pqr/), [Empacados](https://empacados.cafeoma.com/) |
| Águila Roja | 018000-934777, correo, formulario | L-V 8:00 am a 5:00 pm. Respuesta "lo antes posible" | Motivos de queja en el formulario | [Contacto](https://cafeaguilaroja.com/contacto) |
| Casa Luker, Lukafe | 01 8000 112131, (601) 4473737, chat, correo de Lukafe | No verificado | PQRS en Lukafe | [Casa Luker](https://www.casaluker.com/), [Lukafe](https://lukafe.com.co/) |
| Nescafé | Formulario y redes | "A la brevedad posible" | FAQ con respuestas plegadas | [Contáctanos](https://www.nescafe.com/co/contactanos), [FAQ](https://www.nescafe.com/co/preguntas-frecuentes) |
| Pergamino | WhatsApp +57 3188211303, correo, PQRS | Retiro listo normalmente en 1 hora | 21 reseñas en Buesaco, 3 en Borbón Rosado | [Buesaco](https://co.pergamino.co/products/buesaco) |
| Devoción | Centro de ayuda, WhatsApp, correos, formulario anónimo | Horarios no verificados | 166 reseñas en Toro | [Home](https://devocion.com.co/), [Reembolso](https://devocion.com.co/pages/politica-de-reembolso) |
| Amor Perfecto | Teléfonos por ciudad, correo, línea (571) 2485796 | "En horario hábil". Direcciones y teléfonos difieren entre páginas | Formato de PQR | [Contacto](https://cafeamorperfecto.com/policies/contact-information), [Términos](https://cafeamorperfecto.com/policies/terms-of-service) |
| Azahar | Tel. +57 601 712 9740, correos, WhatsApp +57 317 7205538 | L-V 8am a 5pm, términos de 2024. Corrección de dirección en 5 horas | Quejas por línea o correo | [Tiendas](https://azaharcoffee.com/tiendas/), [Términos 2024](https://azaharcoffee.com/wp-content/uploads/2024/08/Terminos-y-condiciones-azaharcoffee.com-20240715.pdf) |
| Libertario | +57 322 511 2476, correo, widget con chatbot | B2B "en menos de 24 horas". Horario general no verificado | Testimonio "Hotel Boutique XYZ", con apariencia de relleno | [Contacto](https://www.libertariocoffee.com/pages/contactanos), [Hospitality](https://www.libertariocoffee.com/pages/hospitality) |
| Varietale | Correo, WhatsApp +57 324 255 0397, línea de suscripciones | "Te respondemos", sin plazo | Reseñas en portada, con una crítica. Molienda por cafetera | [Contacto](https://varietale.com/pages/contact), [Suscripción](https://varietale.com/products/suscripcion-cafe-especial-500g), [Home](https://varietale.com/) |
| Tropicalia | Formulario, correos, 601 621 3415, +57 322 680 2553 | L-V 8 AM a 5 PM | Reseñas no vistas | [Envíos](https://www.tropicaliacoffee.com/pages/politica-de-envios), [Home](https://www.tropicaliacoffee.com/) |
| Catación Pública | Correo, tel. y WhatsApp +57 321 938 4156 | Horarios no verificados | Asesorías por WhatsApp. Devoluciones con fotos | [Contacto](https://catacionpublica.co/pages/contact), [Reembolso](https://catacionpublica.co/policies/refund-policy) |
| Colo | Tel. 325 2315269, correo, wa.me con otro número, PQR a correo personal | Horario por tienda | Caja de preguntas en ficha | [Gesha](https://colo.com.co/products/gesha-natural-250g), [Sumercé](https://colo.com.co/collections/diversos/products/sumerce-340g), [Términos](https://colo.com.co/policies/terms-of-service) |
| Hija Mía | Formulario, Gmail | "Within 48hrs". Café 7 a. m. a 9 p. m. | No visto | [Contacto](https://www.hijamiacoffee.com/pages/contact), [Home](https://www.hijamiacoffee.com/) |
| Café Cultor | +57 315 543 1596, correo | Sin horario web general | Valoraciones en 0. Equipo con fotos y textos | [Home](https://cafecultor.co/), [Equipo](https://cafecultor.co/nuestro-equipo/) |
| Café Quindío | Línea y WhatsApp 310 897 5776, correo, formulario | L-V 7:30 a.m. a 5 p.m. | Reseñas "Verificado", con fecha y filtros | [Política](https://www.cafequindio.com.co/policies/refund-policy), [Solicitud](https://www.cafequindio.com.co/pages/solicitud-servicio-al-cliente), [Geisha](https://www.cafequindio.com.co/products/geisha) |
| San Alberto | 601 21323 90, WhatsApp 317 5026246, correos, formulario | Horario por tienda | Correo de la política con otro dominio | [Home](https://cafesanalberto.com.co/), [Reembolso](https://cafesanalberto.com.co/policies/refund-policy) |
| La Palma | Correo y formulario | Sin plazo | Sin WhatsApp ni FAQ en lo rastreado | [Contacto](https://lapalmayeltucan.com/en-us/pages/contact) |
| Esperanza | WhatsApp prellenado por producto, correo | Sin plazo | Sin FAQ en lo rastreado | [Contact](https://cafegranjalaesperanza.com/pages/contact), [Ficha](https://cafegranjalaesperanza.com/products/geisha-natural-las-margaritas) |
| Venecia | WhatsApp +57 320 6365719 | 8:00 am a 6:00 pm todos los días | Enlaces a TripAdvisor, no abiertos | [Home](https://haciendavenecia.com/), [Buy Coffee](https://haciendavenecia.com/buy-coffee/) |
| Guayabal | Correo, tel. +57 314 772 4856, WhatsApp 317 280 4899 | Sin plazo | Formulario bilingüe | [Contacto](https://haciendaguayabal.com/contact/) |
| Jesús Martín | Dos teléfonos, correo, tienda en Salento | Sin plazo | Sin FAQ ni PQRS en lo rastreado | [Contacto](https://cafejesusmartin.co/contacto/) |
| El Ocaso | +57 313 425 3669 con WhatsApp | Todos los días 9:00 am a 5:00 pm | Enlace a TripAdvisor, no abierto | [Contacto](https://web.fincaelocasosalento.com/contacto/) |
| Paraíso 92 | WhatsApp +57 313 6776593, Gmail | Sin plazo | Muestras por formulario | [Contacto](https://www.granjaparaiso92.com/contacto) |
| Galavis | +57 317 638 9374, Gmail, botón Comprar a WhatsApp | Sin plazo | Mensaje prellenado | [Contacto](https://cafegalavis.com.co/contacto/), [Productos](https://cafegalavis.com.co/productos/) |
| Forest | Correos por persona, "Book a call" | Sin plazo | Muestras por formulario | [Home](https://coffeegreenbeans.com/), [Muestras](https://coffeegreenbeans.com/pages/samplerequestcopy-vtvhf) |
| Comprocafé | WhatsApp 320 838 3003, correo, FAQ | Cambios por correo | FAQ con respuesta directa sobre contraentrega | [FAQ](https://comprocafedecolombia.com/preguntas-frecuentes-2/) |

### Devoluciones y retracto publicados

| Marca | Lo que publica | Fuente |
|---|---|---|
| Juan Valdez | Retracto de 5 días hábiles, "no aplica" a café empacado. Dinero en 15 días calendario tras la recogida. Garantía de perecederos hasta vencimiento | [Términos](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminos) |
| Tienda Nutresa | 5 días hábiles, producto sin usar, transporte a cargo del usuario | [Términos](https://www.tiendanutresaencasa.com/terminos-y-condiciones) |
| Pergamino | 8 días en bolsas de café y 30 días en merch, con factura | [Cambios](https://co.pergamino.co/pages/politica-de-cambios) |
| Devoción | Café sin devolución por perecedero, merch 30 días | [Reembolso](https://devocion.com.co/pages/politica-de-reembolso) |
| Amor Perfecto | Reclamo el día hábil siguiente, reembolso a tarjeta hasta 30 días hábiles, reversión en 5 días hábiles | [Reembolso](https://cafeamorperfecto.com/policies/refund-policy) |
| Azahar | 5 días hábiles con excepción de perecederos, dinero máximo 15 días hábiles. Términos de 2024 | [Términos 2024](https://azaharcoffee.com/wp-content/uploads/2024/08/Terminos-y-condiciones-azaharcoffee.com-20240715.pdf) |
| Libertario | Solo merch, 15 días, y en la misma política "10 días hábiles" | [Reembolso](https://www.libertariocoffee.com/policies/refund-policy) |
| Varietale | Producto incorrecto en 24 horas, reembolso en 8 días hábiles | [Reembolso](https://varietale.com/policies/refund-policy) |
| Tropicalia | Reclamo 5 días hábiles, cambio máximo 3 días hábiles, con fotos | [Envíos](https://www.tropicaliacoffee.com/pages/politica-de-envios) |
| Catación Pública | 15 días hábiles, reembolso 7 a 10 días hábiles | [Reembolso](https://catacionpublica.co/policies/refund-policy) |
| Colo | "No aplica el derecho de retracto" por perecedero | [Términos](https://colo.com.co/policies/terms-of-service) |
| Hija Mía | Plantilla de 30 días que cita "CD, DVD, VHS tape" | [Refund](https://www.hijamiacoffee.com/policies/refund-policy) |
| Café Quindío | Retracto 5 días hábiles, incidencias en 3 días calendario, evidencia fílmica | [Política](https://www.cafequindio.com.co/policies/refund-policy) |
| San Alberto | [10 días posteriores a la compra](https://cafesanalberto.com.co/policies/refund-policy), y en otra lectura de sus políticas [10 días hábiles desde la entrega](https://cafesanalberto.com.co/policies/terms-of-service) | Ambas páginas |
| La Palma | Foto en 14 días, sin devolver el café, reembolso en 5 días hábiles. Choca con su "30-Day Satisfaction Guarantee" | [Reembolso](https://lapalmayeltucan.com/en-us/policies/refund-policy), [Geisha](https://lapalmayeltucan.com/en-us/products/roasted-geisha) |
| Esperanza | Café como perecedero y garantía hasta vencimiento, con cita a Ley 1480 | [Reembolso](https://cafegranjalaesperanza.com/policies/refund-policy) |

### Marco legal informativo

Este bloque es informativo y debe validarlo un abogado. La norma base es la [Ley 1480 de 2011](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306), reformada para comercio electrónico por la [Ley 2439 de 2024](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf).

| Tema | Lo que dicen las fuentes | Cautela |
|---|---|---|
| Plazo para devolver dinero del retracto | La [compilación de Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306) conserva 30 días calendario. El [Diario Oficial](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf) fija 15, y la [Sentencia C-192 de 2026](https://www.corteconstitucional.gov.co/relatoria/2026/C-192-26.htm) los aplica a todas las modalidades del art. 47 | Prevalece el texto del Diario Oficial con la sentencia. No conviene copiar el plazo de la compilación |
| Retracto en alimentos | El [concepto SIC 16-062808 de 2016](https://cdn.actualicese.com/normatividad/2016/Conceptos/C16062808-16.pdf) dice que no procede en alimentos | Concepto antiguo y no obligatorio, que no menciona café. El cliente puede discutirlo por la vida útil larga |
| Información sobre retracto | El art. 50, lit. c, exige informar retracto y procedimiento ([Ley 1480](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306)) | Debe publicarse aunque se excluya |
| Identidad y compra | Razón social, NIT, dirección, teléfono, correo, precio total, gastos de envío, resumen y acuse al día siguiente ([art. 50](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306)) | No se auditó ese cumplimiento artículo por artículo en DobleYo |
| PQR | Canal en el mismo medio con radicado, fecha, hora y seguimiento ([Ley 2439, art. 4, lit. g](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf)) | Lectura propia: un WhatsApp informal no parece bastar. El plazo legal de respuesta no se halló |
| Reversión de pago | 5 días hábiles para quejarse y notificar, 15 días hábiles para hacerla efectiva ([art. 51](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306), [Decreto 587](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Decreto_587_2016.pdf)) | Aplica con los supuestos de la norma |
| Datos personales | La inscripción RNBD aparece en una [guía de Holland & Knight](https://www.hklaw.com/es/insights/publications/2025/01/obligaciones-del-registro-nacional-de-bases-de-datos-personales) | No verificado en la norma |
| Rotulado | [Resolución 2492 de 2022](https://normograma.invima.gov.co/compilacion/docs/resolucion_minsaludps_2492_2022.htm) y [circular Invima 2026](https://www.invima.gov.co/biblioteca/preview/145444). Un [proyecto de Minsalud](https://www.minsalud.gov.co/Normatividad_Nuevo/PR%20Etiquetado%20Frontal.pdf) no nombra el molido | Revisar su estado antes de imprimir empaques |
| Notificación sanitaria | Café tostado o molido por NSA, según [Colombia Move](https://colombiamove.com/blog/es/registro-invima-cafe-tostado-molido-notificacion-sanitaria-colombia/) | Fuente secundaria, no verificada en la norma |

### Qué es lo normal

Lo normal es WhatsApp o correo, sin plazo de respuesta, y una política de devoluciones con excepción de perecederos. La evidencia sobre WhatsApp viene de proveedores: [Tiendanube](https://www.portafolio.co/tecnologia/whatsapp-se-consolida-como-aliado-clave-del-comercio-electronico-en-colombia-segun-informe-de-e-commerce-489757) reporta 84,1% de tiendas, sin muestra en la nota. [Infobip](https://www.enter.co/?p=577653) dice que es favorito de tres de cada cuatro, también sin método publicado.

### Quién lo hace mejor

[Juan Valdez](https://www.tiendajuanvaldez.com/servicio-al-cliente#Contactenos) tiene el horario más amplio, aunque el estado del pedido pasa por correo. [Café Quindío](https://www.cafequindio.com.co/products/geisha) es la mejor referencia de reseña, con "Verificado", fecha y filtros. [Éxito](https://www.exito.com/s?q=cafe+especialidad&sort=score_desc&page=0), tercero en este análisis, separa WhatsApp de ventas y servicio, con enlaces a PQRS, retracto y SIC en su pie.

### Qué casi nadie hace

Casi nadie publica plazo de respuesta, seguimiento autoservicio o radicado de PQR. Tampoco resuelve el reclamo sin hacer devolver el café, salvo [La Palma](https://lapalmayeltucan.com/en-us/policies/refund-policy). Las plantillas sin revisar son comunes, como en [Catación Pública](https://catacionpublica.co/policies/shipping-policy), [Hija Mía](https://www.hijamiacoffee.com/policies/refund-policy) y [Libertario](https://www.libertariocoffee.com/pages/hospitality).

### Qué significa para una tostadora pequeña

La atención es donde una tostadora pequeña puede superar a una grande, porque hablar con quien tuesta no cuesta escala. Solo debe publicarse un plazo que se pueda cumplir y medir. Una foto en vez de devolución es copiable, si el dueño acepta el costo.

### Para qué nos sirve

Este hallazgo permite corregir los canales y unificar la política antes de vender más. Conduce a P05, número y correos correctos; P06, devoluciones, retracto e IVA con abogado; y P13, PQR con radicado y tiempo de respuesta medido. Las reseñas con fecha y compra real conducen a P15.

## Despacho y logística

Pocas marcas publican plazo y costo juntos, y la promesa más corta es 24 horas en Bogotá de [Azahar](https://azaharcoffee.com/wp-content/uploads/2024/08/Terminos-y-condiciones-azaharcoffee.com-20240715.pdf), con términos de 2024. El checkout de las marcas externas no se abrió, así que costo final y medios allí quedan como No verificado. Varias marcas se contradicen entre su ficha y su política.

| Marca | Ciudad base | Nacional | Costo o umbral | Transportadora y rastreo | Fuente |
|---|---|---|---|---|---|
| Juan Valdez | Bogotá 2 a 3 días hábiles | 3 a 8 días hábiles | Tabla por municipio: Bogotá $10.400 hasta 3,9 kg, Leticia $29.250, Caloto $35.700. PDF del 26/06/2025. Gratis para suscriptores desde $40.000 | Servientrega en zona rural. Guía por correo | [Términos](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminos), [PDF](https://juanvaldez.vtexassets.com/assets/vtex.file-manager-graphql/images/ad13e97d-e29a-4407-89da-e79a4943cda9___e56773f118aa18aca724d65d62a49379.pdf), [Suscripciones](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminosycondicionessuscripciones) |
| Tienda Nutresa | 25 municipios listados, sin Bucaramanga. 1 a 2 días hábiles tras el pago | No aplica fuera de esa lista | Gratis desde $70.000, sin compra mínima | Vehículos propios o Quick and Tasty. Dos intentos | [FAQ](https://www.tiendanutresaencasa.com/preguntas-frecuentes), [Términos](https://www.tiendanutresaencasa.com/terminos-y-condiciones) |
| Pergamino | Área metropolitana: despacho en menos de 36 horas, L-V. Retiro normalmente en 1 hora | Principales 2 a 3 días. Otras 2 a 5 | Calculado al pagar | Coordinadora | [Envío](https://co.pergamino.co/pages/politica-de-envio), [Buesaco](https://co.pergamino.co/products/buesaco) |
| Devoción | Bogotá 2 a 4 días hábiles | 3 a 5 días hábiles | Gratis en Bogotá, $9.000 otros departamentos. Ficha y suscripción difieren | Número de seguimiento | [Reembolso](https://devocion.com.co/pages/politica-de-reembolso), [Suscripción](https://devocion.com.co/pages/suscripcion) |
| Amor Perfecto | Bogotá 3 días hábiles | Principales 5, resto hasta 15 | No verificado | Hasta tres intentos adicionales. `/policies/shipping-policy` da 404 | [Reembolso](https://cafeamorperfecto.com/policies/refund-policy) |
| Azahar | Bogotá 24 horas | 5 a 8 días hábiles | No verificado | Empresa certificada con enlace | [Términos 2024](https://azaharcoffee.com/wp-content/uploads/2024/08/Terminos-y-condiciones-azaharcoffee.com-20240715.pdf) |
| Libertario | Bogotá máximo 48 horas hábiles | 3 a 5 días hábiles, "es un estimado" | Gratis desde $120.000. $8.000 Bogotá y $11.000 resto. Barra en carrito | Guía por correo. Sin envíos en fines de semana o festivos | [Envío](https://www.libertariocoffee.com/policies/shipping-policy), [Carrito](https://www.libertariocoffee.com/policies/refund-policy) |
| Varietale | Domiciliario propio | "Hasta dos" o "entre 2 y 4" días, según página | Gratis desde $70.000 Bogotá y $100.000 resto | Mensajería sin nombre. Reemplazo por pérdida | [Envío](https://varietale.com/policies/shipping-policy), [San Antonio](https://varietale.com/products/san-antonio) |
| Tropicalia | Máximo 3 días hábiles | 2 a 4 o 3 a 5, según página | No publicado | FedEx. Guía por correo | [Envíos](https://www.tropicaliacoffee.com/pages/politica-de-envios), [Ficha](https://www.tropicaliacoffee.com/products/alfredo-mogollon-cundinamarca-340g-copia) |
| Catación Pública | Retiro normalmente en 24 horas | Principales [1-3], rurales [3-7], con corchetes de plantilla | Por peso, volumen y destino | Novedades por WhatsApp | [Envío](https://catacionpublica.co/policies/shipping-policy), [Black Edition](https://catacionpublica.co/products/cafe-black-edition) |
| Colo | Máximo 2 días hábiles, corte 3:00 p. m. | 2 a 15 días hábiles | No verificado | Portada dice "express, nacionales e internacionales" | [Términos](https://colo.com.co/policies/terms-of-service), [Home](https://colo.com.co/) |
| Café Quindío | No verificado | No verificado | Gratis sobre $250.000 | `/policies/shipping-policy` da 404 | [Geisha](https://www.cafequindio.com.co/products/geisha) |
| Hija Mía | No verificado | No verificado | USD 30 a EE. UU. y Canadá | Política sin contenido propio | [Home](https://www.hijamiacoffee.com/), [Envío](https://www.hijamiacoffee.com/policies/shipping-policy) |
| Café Cultor | No verificado | No verificado | No verificado | Rutas probadas dan 404. Hay checkout propio | [Compra](https://cafecultor.co/compra-en-linea/) |
| Comprocafé | L-V, corte 12:00 p.m. | Principales 3 a 5. Intermedias 5 a 8 | "Calcular envío" | Enlace de rastreo, sin nombrar transportadora | [FAQ](https://comprocafedecolombia.com/preguntas-frecuentes-2/), [Ficha](https://comprocafedecolombia.com/product/cafe-villa-celina-origen-toledo-grano-500g/) |
| San Alberto | Sin plazo | "Envíos a toda Colombia" | Suscripción con envío incluido | `/policies/shipping-policy` da 404 | [Home](https://cafesanalberto.com.co/), [Suscripción](https://cafesanalberto.com.co/products/1-bolsa-al-mes-durante-3-meses) |
| Esperanza | Sin plazo publicado | "Orientativos" | "Free worldwide shipping" frente a "calculated at checkout" | Operador sin nombre | [Home](https://cafegranjalaesperanza.com/), [Política](https://cafegranjalaesperanza.com/policies/shipping-policy) |
| La Palma | No despacha a Colombia | Solo EE. UU. | USD 9,95, gratis desde USD 75 | "We would rather say nothing than promise a date we have not measured" | [Envíos](https://lapalmayeltucan.com/en-us/policies/shipping-policy) |
| Jesús Martín, El Ocaso | Sin política en lo rastreado | Sin política en lo rastreado | No verificado | La ficha de Jesús Martín conserva "a partir de mayo 11" | [Exótico](https://cafejesusmartin.co/product/cafe-exotico-250-gramos/), [El Ocaso](https://cafe.fincaelocasosalento.com/tienda/) |
| Galavis, Paraíso 92, Venecia, Guayabal | Sin política en lo rastreado | Sin política en lo rastreado | Venecia remite a Amazon en EE. UU. | Galavis compra por WhatsApp. Paraíso 92 por muestras | [Galavis](https://cafegalavis.com.co/productos/), [Paraíso 92](https://www.granjaparaiso92.com/), [Venecia](https://haciendavenecia.com/buy-coffee/), [Guayabal](https://haciendaguayabal.com/services/) |
| Forest | No aplica | 7 a 15 días hábiles para procesar y despachar | En el checkout. Cajas de 3 a 24 kg | B2B con bodegas en el exterior | [Envíos](https://coffeegreenbeans.com/policies/shipping-policy), [Home](https://coffeegreenbeans.com/) |

### Contraentrega y medios de pago en lo publicado

Contraentrega no apareció en especialidad, y [Comprocafé](https://comprocafedecolombia.com/preguntas-frecuentes-2/) responde "No" de forma expresa. [Tienda Nutresa](https://www.tiendanutresaencasa.com/terminos-y-condiciones) ofrece "transferencia al momento de recibir el producto", lo más cercano hallado. Como no se abrieron checkouts, esto no prueba ausencia en las demás.

| Marca | Medios publicados | Fuente |
|---|---|---|
| Juan Valdez | Tarjetas, PSE, transferencias, wallet, vía MercadoPago | [Términos](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminos), [FAQ](https://www.tiendajuanvaldez.com/servicio-al-cliente#faqs) |
| Pergamino | Wompi, tarjetas y PSE | [Método de pago](https://co.pergamino.co/pages/metodo-de-pago) |
| Amor Perfecto | PSE y efectivo vía Mercado Pago | [Reembolso](https://cafeamorperfecto.com/policies/refund-policy) |
| Varietale | PSE y tarjeta. Suscripción con tarjeta de crédito en Treli | [Envío](https://varietale.com/policies/shipping-policy), [Suscripción](https://varietale.com/products/suscripcion-cafe-especial-500g) |
| Tropicalia | PayU con tarjeta y PSE | [Envíos](https://www.tropicaliacoffee.com/pages/politica-de-envios) |
| Comprocafé | ePayco, tarjetas, PSE, PayPal, Daviplata, Nequi | [FAQ](https://comprocafedecolombia.com/preguntas-frecuentes-2/) |
| Esperanza | PayPal y tarjetas | [Home](https://cafegranjalaesperanza.com/) |

### Costos de referencia para decidir

| Concepto | Dato | Fuente y cautela |
|---|---|---|
| Coordinadora, 1 kg | Local $7.785, regional $9.410, nacional $17.190, zonal $21.785, otros $25.650, especiales $40.880 | [Tarifas 2026-2027](https://coordinadora.com/tarifas/documentos-y-paquetes/). Lista, no costo real de DobleYo |
| Coordinadora, 3 kg | Local $12.825, nacional $25.425, especiales $61.430 | [Tarifas 2026-2027](https://coordinadora.com/tarifas/documentos-y-paquetes/). [Colombia Move](https://colombiamove.com/blog/es/domestic-couriers-colombia-servientrega-interrapidisimo-shipping/) difiere, y se usa la oficial |
| Flete variable | 1% del valor declarado, mínimo $650. Especiales 2%, mínimo $970 | [Coordinadora](https://coordinadora.com/tarifas/documentos-y-paquetes/) |
| Restricción | "No transportamos alimentos perecederos" y cobertura con nomenclatura identificable | [Condiciones](https://coordinadora.com/tarifas/condiciones-generales/). Pergamino dice usar Coordinadora, pero DobleYo debe confirmarlo por escrito |
| Otros operadores | [Inter Rapidísimo](https://www.interrapidisimo.com/), 1.104 municipios. [Envía](https://envia.co/), más de 1.400 destinos. [Mipaquete](https://www.mipaquete.com/), agregador. [TCC](https://www.tcc.com.co/) y [99minutos](https://99minutos.com/co) sin tabla | Tarifas oficiales no verificadas. Deprisa devolvió 403 |
| Recaudo | [Pago en casa](https://www.interrapidisimo.com/pago-en-casa/) y [Servientrega](https://www.servientrega.com/wps/portal/colombia/personas/tarifas) lo ofrecen | Ninguna fuente oficial abierta publica la comisión |
| Peso del efectivo | 2,7%, incluida contra entrega, en el [CCCE del 2T 2025](https://www.valoraanalitik.com/?p=499270) | Dato desactualizado que quizá no capta bien la contraentrega |
| Pasarelas | [Wompi](https://wompi.com/es/co/planes-tarifas/) 2,65% + $700. [Bold](https://bold.co/tarifas) 2,99% + $900. [Mercado Pago](https://www.mercadopago.com.co/ayuda/costos-recibir-pagos-checkout_33399) 2,79% a 3,29% + $800 | Antes de IVA. Sin fecha de vigencia |
| Marketplaces | [Mercado Libre](https://www.mercadolibre.com.co/ayuda/Costos-de-vender-un-producto_870): 8% a 22%, umbral $60.000. [Falabella](https://www.falabella.com.co/falabella-co/search?Ntt=cafe+de+especialidad): seleccionados desde $99.000 y "Llega mañana" | Comisión exacta de café no verificada |
| Full de Mercado Libre | [Cargo por stock antiguo tras 120 días](https://vendedores.mercadolibre.com.co/nota/cuanto-cuesta-operar-en-full) y [entrega el mismo día o al siguiente](https://envios.mercadolibre.com.co/vender-con-full) | Lectura propia: limita Full a alta rotación por frescura |
| Promesa de referencia | [Mercado Libre](https://www.valoraanalitik.com/?p=564972): mismo día en Bogotá hasta 3:00 p.m. y hasta 48 horas en el país | Cifra de la empresa |

Cálculo propio para DobleYo, con lista de Coordinadora en un pedido de $120.000: local $8.985 (7,5%) y nacional $18.390 (15,3%). Wompi agrega $3.880 (3,2%) antes de IVA. No se confirmó si la tarifa incluye IVA ni la zona de cada ruta, porque la tabla de zonas no cargó.

Abandono de carrito: el [74% de Kapital Colombia](https://www.minuto60.com/economia/ventas-fantasma-linea-soluciones-tendencias-2026/3488) no trae muestra ni periodo, y se marca como fuente débil. [ClearSale 2023-2024](https://lanotaeconomica.com.co/movidas-empresarial/el-19-de-los-usuarios-colombianos-de-e-commerce-experimentaron-fraude-en-el-ultimo-ano/) señala el envío costoso como causa más común, sin porcentaje y con datos antiguos. Ninguna de las dos sustenta por sí sola una propuesta.

### Qué es lo normal

Lo normal es 2 a 5 días hábiles en ciudades principales, con plazos más largos en el resto. El costo se calcula al pagar en muchas tiendas. Pocas nombran su transportadora, y la guía llega por correo.

### Quién lo hace mejor

[Juan Valdez](https://juanvaldez.vtexassets.com/assets/vtex.file-manager-graphql/images/ad13e97d-e29a-4407-89da-e79a4943cda9___e56773f118aa18aca724d65d62a49379.pdf) es el más transparente en tarifa, con tabla por municipio y peso. [Libertario](https://www.libertariocoffee.com/policies/shipping-policy) es el más copiable, con plazo, costo, umbral y barra de progreso. [Pergamino](https://co.pergamino.co/pages/politica-de-envio) nombra transportadora y plazo por zona, y [Varietale](https://varietale.com/products/san-antonio) pone el bloque de entrega dentro de la ficha.

### Qué casi nadie hace

Casi nadie mantiene la misma cifra en ficha y política, ni publica cumplimiento real. El rastreo autoservicio no se vio como promesa clara, y en Juan Valdez los cambios pasan por correo. La franqueza de [La Palma](https://lapalmayeltucan.com/en-us/policies/shipping-policy) sobre no prometer lo no medido es casi única.

### Qué significa para una tostadora pequeña

No necesita igualar las promesas de un marketplace, necesita informar plazos reales por zona. Una tabla con costo, umbral, plazo y transportadora ya la pondría por delante de buena parte de la muestra, lectura propia. La promesa debe nacer de los primeros envíos medidos, no de la plantilla.

### Para qué nos sirve

Este hallazgo permite decidir tarifa, umbral y promesa con costos reales. Conduce a P03, contraentrega suspendida o en piloto, y a P04, promesas de seguimiento y plazos.

También a P12: tabla pública, cotización real, confirmación escrita de la transportadora y primer envío. La revisión de canales de marketplace conduce a P20.

## Comparativo por marca

Ninguna de las 34 marcas externas de la matriz llega a Fuerte en las seis aristas publicadas. El checkout queda No verificado en todas, porque no se abrió ninguno. La calificación es juicio propio sobre lo rastreado el 5 de noviembre de 2026, no una medición de desempeño.

### Escala

| Valor | Significado |
|---|---|
| **Fuerte** | Dato concreto y consultable: cifra, nombre propio o credencial. En atención, dos o más canales con horario o plazo. En despacho, plazo y costo o umbral sin contradicción |
| **Parcial** | Dato genérico, solo en parte del catálogo, autodeclarado sin detalle o con contradicción entre páginas |
| **Débil** | Páginas leídas y solo afirmaciones, o el dato no se vio en lo rastreado. No significa que no exista |
| **No verificado** | La página no renderizó, no respondió, no se abrió o exige checkout |

### Matriz marca por arista

| Marca | Grupo | Fincas | Proceso | Calidad | Origen | Atención | Despacho publicado | Checkout |
|---|---|---|---|---|---|---|---|---|
| Juan Valdez | Masivas | Parcial | Débil | Parcial | Parcial | Fuerte | Fuerte | No verificado |
| Sello Rojo | Masivas | No verificado | No verificado | No verificado | No verificado | Parcial | Fuerte, vía Tienda Nutresa | No verificado |
| Colcafé | Masivas | Débil | Débil | Débil | Débil | No verificado | Fuerte, vía Tienda Nutresa | No verificado |
| La Bastilla | Masivas | Débil | Débil | Débil | Débil | No verificado | Fuerte, vía Tienda Nutresa | No verificado |
| Matiz | Masivas | Débil | Débil | Parcial | Parcial | No verificado | Fuerte, vía Tienda Nutresa | No verificado |
| Oma | Masivas | Débil | Parcial | Parcial | Parcial | Parcial | Débil | No verificado |
| Águila Roja | Masivas | Débil | Parcial | No verificado | No verificado | Fuerte | Débil | No verificado |
| Lukafe | Masivas | No verificado | No verificado | No verificado | No verificado | Parcial | No verificado | No verificado |
| Almendra Tropical | Masivas | Débil | Débil | Débil | Débil | Parcial | Débil | No verificado |
| Nescafé | Masivas | Parcial | Parcial | No verificado | Parcial | Parcial | No verificado | No verificado |
| Buendía | Masivas | No verificado | No verificado | No verificado | No verificado | No verificado | No verificado | No verificado |
| Pergamino | Urbana | Parcial | Parcial | Débil | Fuerte | Parcial | Parcial | No verificado |
| Devoción | Urbana | Parcial | Parcial | Parcial | Parcial | Parcial | Parcial | No verificado |
| Amor Perfecto | Urbana | Fuerte | Parcial | Fuerte | Parcial | Parcial | Parcial | No verificado |
| Azahar | Urbana | Fuerte | Parcial | Parcial | Fuerte | Fuerte | Parcial | No verificado |
| Libertario | Urbana | Débil | No verificado | Débil | Débil | Parcial | Fuerte | No verificado |
| Varietale | Urbana | Fuerte | Fuerte | Fuerte | Fuerte | Parcial | Parcial | No verificado |
| Tropicalia | Urbana | Fuerte | Fuerte | Débil | Parcial | Fuerte | Parcial | No verificado |
| Catación Pública | Urbana | Débil | Parcial | Parcial | Parcial | Parcial | Parcial | No verificado |
| Colo | Urbana | Débil | Parcial | Débil | Parcial | Parcial | Parcial | No verificado |
| Hija Mía | Urbana | Débil | No verificado | Débil | Parcial | Parcial | No verificado | No verificado |
| Café Cultor | Urbana | Débil | No verificado | Parcial | Parcial | Parcial | No verificado | No verificado |
| Café Quindío | Urbana | Parcial | Parcial | Fuerte | Fuerte | Fuerte | Parcial | No verificado |
| San Alberto | Hacienda | Parcial | Parcial | Débil | Fuerte | Parcial | Débil | No verificado |
| La Palma y El Tucán | Hacienda | Fuerte | Parcial | Fuerte | Fuerte | Parcial | Débil para Colombia | No verificado |
| Granja La Esperanza | Hacienda | Fuerte | Parcial | Fuerte | Fuerte | Parcial | Débil | No verificado |
| Hacienda Venecia | Hacienda | Parcial | Parcial | Débil | Débil | Parcial | Débil | No verificado |
| Granja Paraíso 92 | Hacienda | Parcial | Parcial | Débil | Parcial | Parcial | Débil | No verificado |
| Hacienda Guayabal | Hacienda | Parcial | No verificado | Débil | Débil | Parcial | Débil | No verificado |
| Jesús Martín | Hacienda | Fuerte | Parcial | Débil | Parcial | Parcial | Débil | No verificado |
| El Ocaso | Hacienda | Parcial | Parcial | Débil | Parcial | Parcial | Débil | No verificado |
| Galavis | Hacienda | Débil | Débil | Débil | Débil | Parcial | Débil | No verificado |
| Forest | Hacienda, B2B | Fuerte | Fuerte | Fuerte | Parcial | Parcial | Parcial | No verificado |
| Comprocafé | Marketplace FNC | Parcial | No verificado | Débil | Parcial | Parcial | Parcial | No verificado |
| **DobleYo** (a modo de comparación) | Tostadora pequeña | Débil | Parcial | Débil | Parcial | Parcial | Parcial, sin envíos reales | Parcial: abierto sin pagar |

### Lectura de la matriz

[Varietale](https://varietale.com/products/san-antonio) es la referencia más completa para el comprador colombiano, seguida por [Azahar](https://azaharcoffee.com/producto/edicion-especial-huila/). Las marcas con mejor finca, como [La Palma](https://lapalmayeltucan.com/en-us/policies/shipping-policy) y [Esperanza](https://cafegranjalaesperanza.com/policies/shipping-policy), son débiles en despacho colombiano. Pocas marcas combinan relato y operación clara para 250 g en COP.

Una marca Débil no es necesariamente mala. [Libertario](https://www.libertariocoffee.com/products/paz) es débil en origen y fuerte en despacho, porque vende estilo de vida con el origen en segundo plano. Las masivas priorizan retail y no parecen ver la web como canal, inferencia apoyada en sitios como [Águila Roja](https://cafeaguilaroja.com/).

### Anexo por marca

Este anexo conserva lo que no cabe en las tablas anteriores. Precios y presentaciones adicionales aparecen aquí; los precios normalizados están en la sección Mapa del mercado.

#### Masivas

| Marca | Sitio e identidad | Precio y presentaciones | Suscripción, fidelización y formación | Empresas, idiomas y otros hallazgos |
|---|---|---|---|---|
| Juan Valdez (Procafecol) | [Corporativo](https://juanvaldez.com/), pie 2025, y [tienda](https://www.tiendajuanvaldez.com/), pie 2026 en portada y 2023 en internas | Colina y [Volcán](https://www.tiendajuanvaldez.com/) 454 g a $49.900, Sierra Nevada 454 g a $67.900. Ficha con precio por gramo y molienda. Catálogo de $44.900 a $67.900 ([catálogo](https://www.tiendajuanvaldez.com/cafe/molido-grano)) | [Suscripción](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminosycondicionessuscripciones): 10%, tarjeta de crédito, requiere ser Amigo, sin cambio de referencia sin cancelar, máximo 3 cancelaciones al año. [28 cafés](https://www.tiendajuanvaldez.com/suscripciones). [Amigos Juan Valdez](https://juanvaldez.com/amigosjuanvaldez/sobre-amigos/) por puntos | [Canal institucional y franquiciados](https://juanvaldez.com/quienes-somos/), página no abierta. Español e inglés corporativo. Sin envíos internacionales. [Cosecha Especial Castillo](https://www.tiendajuanvaldez.com/servicio-al-cliente#promociones) sin abrir. [Garantías físicas](https://juanvaldez.com/tampc/politica-de-garantias-y-devoluciones-2/) aparte. [Empresa B](https://juanvaldez.com/certificacion-empresa-b/) con página propia |
| Colcafé (Nutresa) | [Vitrina](https://colcafe.com/), copyright 2025 | Clásico soluble 250 g, $158,71 por g ([tienda](https://www.tiendanutresaencasa.com/colcafe)) | No vista | Compra en Éxito, Carulla, Jumbo, Novaventa, Lopido, La Rebaja y Tienda Nutresa |
| La Bastilla (Nutresa) | [Portada](https://cafelabastilla.com/), blog hasta agosto de 2022 | [Medio y Fuerte](https://cafelabastilla.com/productos/) de 125 a 2.500 g, grano 500 g. Fuerte 390 g $17.400 y grano 500 g $31.500 ([tienda](https://www.tiendanutresaencasa.com/bastilla)) | No vista | Compra en Éxito, La Rebaja, Lopido y Carulla |
| Matiz (Nutresa) | [Portada](https://cafematiz.com/), copyright 2024 | Molido 120 y 340 g, grano 500 g, cápsulas. Perfiles Marfil, Ámbar, Escarlata y Ébano | No vista | [Dónde comprar](https://cafematiz.com/): Tienda Nutresa, Novaventa, D1, Éxito, Carulla, Euro, Jumbo y Rappi |
| Sello Rojo (Nutresa) | [Vitrina](https://cafesellorojo.com/), copyright 2023 | [Precios](https://www.tiendanutresaencasa.com/Sello-Rojo): 1.000 g $46.500, 500 g $25.500, 425 g $22.200, 212 g $12.500, 110 g $6.850, descafeinado 250 g $20.071, Vive corazón 450 g $29.936. Muestra precio por gramo | [15% de bienvenida y 25% en mes de cumpleaños](https://www.tiendanutresaencasa.com/Sello-Rojo), al registrarse | Tienda aparte en EE. UU., no abierta. Bajó [hasta 17%](https://www.larepublica.co/empresas/sello-rojo-baja-sus-precios-hasta-17-en-diferentes-referencias-desde-septiembre-4475963) desde septiembre, sin publicar precios antes y después |
| Oma (Restcafe) | [Barras](https://www.cafeoma.com/), pie 2024, y [empacados](https://empacados.cafeoma.com/), pie 2021 | [Tradicional](https://empacados.cafeoma.com/tienda/cafe-oma-tradicional/) de 125 a 500 g, sin precio ni carrito. [Líneas](https://empacados.cafeoma.com/categoria-producto/premium/) tradicional, selecta, premium, instantánea y no láctea | No vista | Portada "Exportadores de café", retail, institucional y tradicional. [Términos](https://www.cafeoma.com/terminosycondiciones/) solo de promociones de barras. [Huevo libre de jaula](https://www.cafeoma.com/sontenibilidad/) desde 2024 |
| Águila Roja (Torrecafé) | [Institucional](https://cafeaguilaroja.com/), pie 2007, enlace a Google+ | [Catálogo](https://cafeaguilaroja.com/productos-cafe-aguila-roja/) sin precio. [Éxito, tercero](https://www.exito.com/aguila-roja): 250 g $13.400, 340 g $44.000, 450 g $64.000, 2.500 g $120.100 | Club Granino en portada | [Contacto](https://cafeaguilaroja.com/contacto) con opción Comercio Exterior. Fundada en 1930 en Cali, según la marca |
| Lukafe y Casa Luker | [Lukafe](https://lukafe.com.co/) con registro y login. [Casa Luker](https://www.casaluker.com/), Empresa B | Sin precios en portada. En el [filtro de café](https://www.casaluker.com/marcas/?valor=cafe) no aparece Lukafe como marca | Métodos, paso a paso, recetas y videos, sin texto verificable | [Formulario de distribuidor o tendero](https://www.casaluker.com/eres-distribuidor-o-tendero/) |
| Almendra Tropical (Casa Luker) | [Página de marca](https://www.casaluker.com/marca/almendra-tropical/) | Instantáneo y tostado molido, sin precio ni compra | No vista | Sin origen |
| Nescafé | [Sitio global adaptado](https://www.nescafe.com/co/) | Sin precios en portada | Buscador de café con preguntas | Contenido sobre mujeres de Ruanda y meta "Para el 2025". [dolce-gusto.com.co](https://www.nescafe.com/co/preguntas-frecuentes) devolvió 403 |
| Buendía | cafebuendia.com no respondió y el .com.co no resuelve | [Éxito, tercero](https://www.exito.com/kw/cafe-buendia): molido 340 g $30.250, liofilizado 85 g $21.250 | No verificado | [Contexto Ganadero, tercero](https://www.contextoganadero.com/economia/buen-balance-de-buencafe-en-2024-y-espera-crecer-entre-8-y-10-en-2025): vende en cinco países y produce saborizados para Juan Valdez |
| Tienda Nutresa en Casa | [Comercial Nutresa](https://www.tiendanutresaencasa.com/contacto), canal común de cuatro marcas | Sin compra mínima. Disponibilidad y precio dependen de la ubicación | Puntos Pideky para colaboradores ([términos](https://www.tiendanutresaencasa.com/terminos-y-condiciones)) | Umbral visible en barra superior |

#### Especialidad urbana

| Marca | Sitio e identidad | Precio y presentaciones | Suscripción y formación | Empresas, idiomas y otros hallazgos |
|---|---|---|---|---|
| Pergamino (Café de Santa Bárbara) | [co.pergamino.co](https://co.pergamino.co/). pergamino.co es un selector | Buesaco 360 g $53.900, Borbón Rosado 360 g $79.900, [9 productos](https://co.pergamino.co/collections/cafe-fresco). Lomaverde "desde $45.900", gramaje sin confirmar | [Suscripciones.co](https://go.suscripciones.co/o/pergamino): frecuencia y molienda, desde $45.900. [PDF de puntos](https://cdn.shopify.com/s/files/1/0828/2655/9799/files/FAQ_PUNTOS_PERGAMINO.pdf?v=1743700701) visto, no leído | "Quiénes somos" dice despachar a EE. UU. y Canadá. La [política CO](https://co.pergamino.co/policies/shipping-policy) solo a Colombia y remite al pago. [Reembolso](https://co.pergamino.co/policies/refund-policy) sin plazo en esa versión |
| Devoción | [devocion.com.co](https://devocion.com.co/) y [web de EE. UU.](https://www.devocion.com/) | Toro 340 g $46.400, también 1 kg y 2,5 kg. [Holiday $52.500, Villa Pastora $57.500, Barril Rojo $55.000](https://devocion.com.co/collections/ediciones-limitadas) | [Suscripción](https://devocion.com.co/pages/suscripcion): 5%, cada 1 a 8 semanas, editar, pausar o cancelar. [Lealtad](https://devocion.com.co/pages/programa-de-lealtad) | [Wholesale](https://devocion.com.co/pages/wholesale): mantenimiento gratuito, soporte 7 días, capacitación y portal. FAQ con FedEx y Brooklyn en la [tienda colombiana](https://devocion.com.co/products/cafe-toro). Factura electrónica solo si se pide en 24 horas |
| Amor Perfecto (Vive Café) | [cafeamorperfecto.com](https://cafeamorperfecto.com/collections/cafes-de-caficultor) | Elías Roa 350 g $54.900, Astrid Medina $78.000, Wilton Benítez $84.000, Insignia 500 g $72.900 | Suscripción no vista. [Academia](https://cafeamorperfecto.com/pages/academia-del-cafe-amor-perfecto) desde 2000 con instructores SCA | [1.500 distribuidores y 50 franquicias](https://cafeamorperfecto.com/pages/historia). ["Tostadora más premiada por la AVPA"](https://cafeamorperfecto.com/pages/avpa), afirmación propia |
| Azahar (Azahar Retail) | [azaharcoffee.com](https://azaharcoffee.com/). azahar.co está en venta | [Fruta 340 g $49.100, 500 g $63.300, 1 kg $107.700, Huila $61.500, Decaf $65.500](https://azaharcoffee.com/comprar/). Precio por gramo en ficha | [Suscripción](https://azaharcoffee.com/producto/suscripciones-de-cafe-340g/): dos bolsas a selección, 3 o 6 meses, desde $198.900. Taller de Filtrados por WhatsApp | Español e inglés. [Café verde B2B](https://azaharcoffee.com/cafe-verde/) y [aliados](https://azaharcoffee.com/nosotros/). Vigencia de términos a 2026 no confirmada |
| Libertario | [libertariocoffee.com](https://www.libertariocoffee.com/). libertario.co estacionado. Pie 2025 | Paz 454 g $60.600, [desde $32.300](https://www.libertariocoffee.com/collections/all). Punk Papayo 340 g $83.200. Drips y kits | Suscripción no vista, kit club desde $130.000. [Experiencias](https://www.libertariocoffee.com/pages/experiencias) de 40 a 90 minutos | [Hospitality](https://www.libertariocoffee.com/pages/hospitality) y "más de 20 tiendas propias". EE. UU. y Canadá USD 25. [Soil Fund](https://www.libertariocoffee.com/pages/libertario-impact-core): 3%, 2.722 t CO2e, 140 familias, con nota de método |
| Varietale | [varietale.com](https://varietale.com/) | San Antonio 300 g $73.000, agotado. Especial 500 g $52.000, con suscripción $44.200 | [Suscripción](https://varietale.com/products/suscripcion-cafe-especial-500g): hasta 15%, sin permanencia, Treli. [Blog](https://varietale.com/blogs/el-cafetero), índice no leído | [Maquila y bolsas con logo en 7 días hábiles](https://varietale.com/pages/tostadora), institucional de 125 g a 2,5 kg. También tés. Solo español visto |
| Tropicalia | [tropicaliacoffee.com](https://www.tropicaliacoffee.com/) | Resguardo Inga 340 g $55.000, Heirloom 250 g $120.000 | Suscripción no vista. [Catación en el Lab](https://www.tropicaliacoffee.com/products/catacion-personalizada-en-el-lab): 5 a 7 cafés, 1 a 2 horas | Línea de jóvenes productores. Textos de sistema en inglés. Empresas no vistas |
| Catación Pública | [catacionpublica.co](https://catacionpublica.co/). El .com estacionado | [340 g $52.000, Black Edition $95.000, Gesha $130.000](https://catacionpublica.co/collections/340-gr). [3 kg $299.000](https://catacionpublica.co/products/empresarial-esmeralda) | Suscripción no vista. Educación como marca: talleres, consultorías y laboratorios | Análisis sensorial $180.000 y secuencial $250.000. Banner "Envíos a todo el mundo" |
| Colo Coffee | [colo.com.co](https://colo.com.co/). colo.coffee redirige. colocoffee.co estacionado, colocoffee.com no respondió | Sumercé 340 g $50.000, Gesha 250 g $80.000, Bourbon Rosado 250 g $70.000, cápsulas x10 $34.900 | Suscripción no vista. [Colo Academy](https://colo.com.co/products/gesha-natural-250g): cata $150.000, tostando $130.000, métodos $190.000 | [Aliados](https://colo.com.co/pages/aliados-colo). Selector USD, EUR, GBP. Bosquenible desde 2021. [Portafolio, tercero](https://www.portafolio.co/negocios/empresas/colo-coffee-presenta-cold-brew-su-bebida-en-lata-553247), artículo antiguo |
| Hija Mía | [hijamiacoffee.com](https://www.hijamiacoffee.com/), Medellín, solo inglés | [Rebelde 340 g 15.00 y otro 250 g 21.00](https://www.hijamiacoffee.com/collections/coffee), moneda sin confirmar | Suscripción no vista. [Barista Workshop](https://www.hijamiacoffee.com/pages/barista-workshops) de 4 niveles | Orientada a visitantes y exportación |
| Café Cultor | [cafecultor.co](https://cafecultor.co/), pie 2018. cafecultor.com estacionado. Homónima según [Caras, tercero](https://caras.perfil.com/noticias/caras-like/cafe-cultor-una-experiencia-organica-saludable-y-consciente.phtml) | [Borbón Rosado $55.000 a $88.000](https://cafecultor.co/producto/borbon-rosado/), sin asignar gramaje | [Siempre en casa $206.000](https://cafecultor.co/producto/cafe-siempre-en-casa/), [Barista en casa desde $545.700](https://cafecultor.co/producto/barista-en-casa/). Club no respondió | ES y [EN](https://cafecultor.co/en/). Minicarrito con productos ajenos en caché, sin datos personales ([ficha](https://cafecultor.co/producto/agustino-forest/)) |
| Café Quindío | [cafequindio.com.co](https://www.cafequindio.com.co/). Escala mayor | Geisha 250 g $130.800, Cocora 250 g $56.800 | Suscripción no vista. [FAQ](https://www.cafequindio.com.co/pages/preguntas-frecuentes-cafe-quindio) centrada en cápsulas | [Distribuidores por país](https://www.cafequindio.com.co/pages/exportaciones). [Tienda en Dammam](https://www.cafequindio.com.co/pages/nosotros). Tienda EE. UU. aparte |

#### Hacienda y origen

| Marca | Sitio e identidad | Precio y presentaciones | Tours, suscripción y formación | Empresas, idiomas y otros hallazgos |
|---|---|---|---|---|
| San Alberto | [cafesanalberto.com.co](https://cafesanalberto.com.co/). El .com redirige | Premiado 340 g $63.000. [Cisne Negro #2](https://cafesanalberto.com.co/products/cafe-san-alberto-cisne-negro-2) y [Corazón Gesha](https://cafesanalberto.com.co/products/cafe-san-alberto-340-gr) 250 g $122.000 | [Tour $180.000](https://cafesanalberto.com.co/products/cafe-premium-tour-con-catacion) con diploma. [Bautizo $170.000, catación molecular $280.000](https://cafesanalberto.com.co/collections/experiencias). [Prepago](https://cafesanalberto.com.co/products/1-bolsa-al-mes-durante-3-meses) de $209.000 a $731.000 | Ocho templos de café. [Términos](https://cafesanalberto.com.co/policies/terms-of-service) con transferencia de 5 o 7 días. Empresas no verificado |
| La Palma y El Tucán | [Sitio en-us](https://lapalmayeltucan.com/en-us), `/es-co` da 404 | Geisha 340 g USD 75, sin convertir | Hotel con "The Coffee Trail". Pistas de sonido con cada bolsa | [Café verde](https://lapalmayeltucan.com/en-us/pages/green_coffee-connect). Productos "Coming soon" y tienda cerrada |
| Granja La Esperanza | [cafegranjalaesperanza.com](https://cafegranjalaesperanza.com/). granjalaesperanza.com es otra empresa, de Costa Rica | En libras y USD, desde USD 81 hasta USD 300. Geisha USD 90 por libra | Tours no vistos | [Exportación](https://cafegranjalaesperanza.com/pages/shipping-and-delivery-policy-for-green-coffee-exports) e "Auction 2026". Tienda en inglés y políticas en español |
| Hacienda Venecia | [haciendavenecia.com](https://haciendavenecia.com/). curl recibe 406 | Precio no verificado | [Tours](https://haciendavenecia.com/coffee-tour/) y [alojamiento](https://haciendavenecia.com/). Desde 2009 ([About](https://haciendavenecia.com/about-us-2/)) | Inglés y [español](https://haciendavenecia.com/es/tour-de-cafe/). [Lonely Planet, tercero](https://www.lonelyplanet.com/points-of-interest/hacienda-venecia/1167846), fragmento sin abrir |
| Granja Paraíso 92 | [Wix](https://www.granjaparaiso92.com/), pie 2021 | Sin precios en lo rastreado | [Procesos](https://www.granjaparaiso92.com/copia-de-green-coffee-products) anaeróbico, térmico, Koji y barril | B2B. [Blog](https://www.granjaparaiso92.com/blog) con entradas de plantilla. Nombre parecido al de "Finca El Paraíso" del seed de DobleYo: las notas no establecen relación alguna |
| Hacienda Guayabal | [haciendaguayabal.com](https://haciendaguayabal.com/), pie 2024 | Sin precios de tour | [Coffee tour y alojamiento](https://haciendaguayabal.com/services/) | Inglés, referencias a WooCommerce en HTML |
| Jesús Martín | [cafejesusmartin.co](https://cafejesusmartin.co/). El .com lleva a "/lander". Pie 2021 | [250 g: Natural $40.000, Diamante $38.000, Exótico $70.000, Peaberry $28.000](https://cafejesusmartin.co/shop/) | [Experiencias](https://cafejesusmartin.co/experiencias/) y [formación en 5 módulos](https://cafejesusmartin.co/formacion/), sin precio | [Café verde](https://cafejesusmartin.co/tienda/) sin condiciones. [Ficha](https://cafejesusmartin.co/product/cafe-exotico-250-gramos/) describe el Exótico de dos formas. [Fábrica](https://cafejesusmartin.co/fabrica/) en Salento |
| El Ocaso | [Sitio web](https://web.fincaelocasosalento.com/) y [tienda](https://cafe.fincaelocasosalento.com/tienda/) en subdominios | 250 g: Salento $28.000, Black Honey y otros $38.000, Passion $45.000. 125 g: Bourbon $40.000, Gesha $42.000 | [Tradicional $60.000](https://web.fincaelocasosalento.com/coffee-tour-tradicional/), [Premium $120.000](https://web.fincaelocasosalento.com/coffee-tour-premium/), [calendario](https://web.fincaelocasosalento.com/producto/coffee-tour-tradicional-espanol/), [afiliados](https://web.fincaelocasosalento.com/affiliate-registration/), [hotel](https://web.fincaelocasosalento.com/hotel/) | Premium con edad mínima de 12 y 15 años en la misma página |
| Galavis | [cafegalavis.com.co](https://cafegalavis.com.co/), pie 2025 | Gourmet $53.000, Supremo $24.000, Intenso y Tradición $22.500, sin gramaje | Tienda física, sin tours | [Español e inglés](https://cafegalavis.com.co/en/). Fundación en 1918 según la marca; [CLADEA, tercero](https://cladea.org/wp-content/uploads/2022/01/paper-70.pdf), 1916 en fragmento |
| Forest | [coffeegreenbeans.com](https://coffeegreenbeans.com/). forestcoffee.co redirige | Café verde por caja, 250 g no aplica | Sin tours | Modelo B2B, inglés. [Microlots](https://coffeegreenbeans.com/collections/microlots), [Reserve](https://coffeegreenbeans.com/collections/reserve-series), [Competition](https://coffeegreenbeans.com/collections/competition-series). Texto fechado en 2025 |
| Comprocafé | [Marketplace](https://comprocafedecolombia.com/), pie FNC 2021 | Monte Oscuro 250 g $23.000 con oferta. Buendía Selecto 340 g $24.900 | No vista | Aromallanos afirma premios [sin enlace](https://comprocafedecolombia.com/product/cafe-aromallanos-500g/) |
| Buencafé | [B2B de liofilizado](https://www.buencafe.com/) | [Extractos y marca propia](https://www.buencafe.com/products/), sin precios | No aplica | Enlace "Buy Buendia" |
| Coocentral | [Institucional](https://coocentral.com/tiendas-khave/), pie 2022 | Sin carrito en lo rastreado | Tiendas Kahvé en Garzón y Neiva | [Portafolio, tercero](https://www.portafolio.co/economia/cafe-coocentral-de-talla-mundial-para-el-consumo-local-533486), fragmento sin abrir |
| Cadefihuila | [Compra de verde, trilla y exportación](https://cadefihuila.co/), 45 puntos | [Tienda de insumos](https://cadefihuila.co/TiendaPortafolio), no café al consumidor | No aplica | Modelo de asociados |
| Café del Huila | [Página única](https://cafedelhuila.com/) | Sin tienda | No vista | Solo "Contact Us" |
| Cafenorte | [Servicios de catación y trilla](https://www.cafenorte.com.co/) | "Ir a tienda" lleva a cafebahareque.com, no legible | No vista | No verificado |
| La Guashira | [Referencia en euros](https://laguashira.com/products/origen), Risaralda, venta a Europa | Origen 250 g 14,90 €, sin convertir | [Blog de finca](https://laguashira.com/blogs/origen/finca-las-acacias-cultivo-cafe-guatica-risaralda) | [Tabla de envíos](https://laguashira.com/pages/envios) por zona, que choca con su [FAQ](https://laguashira.com/pages/faq) |
| Tayrona Café | [tayronacafe.com](https://tayronacafe.com/), cafetería en Fusagasugá | Sin tienda en línea | Menú y blog | No confundir con una marca de origen de la Sierra Nevada |

### Para qué nos sirve

Esta matriz fija el referente por arista y evita copiar marcas completas. Sirve para P11, con la ficha de Varietale y Azahar, sin QR ni la palabra trazabilidad. También para P12, con la tabla de Libertario y Juan Valdez.

El anexo aporta precedentes para P14, suscripción, P19, muestras y molienda, y P20, canales.

## DobleYo frente al mercado

Lo visible con respaldo es corto: 7 productos, 2 productores nombrados en etiqueta y 0 reseñas reales. Finca Rengifo solo aparece en texto de producto y queda como pregunta abierta. El problema central no es de tecnología, sino de distancia entre lo que se afirma y lo que se puede probar.

### Ficha de DobleYo por arista

| Arista | Se muestra con respaldo | Se muestra sin respaldo | Existe en código sin mostrarse |
|---|---|---|---|
| **Fincas y productores** | Etiqueta: Finca Rengifo, Jaime Morales en [Isnos](https://dobleyo.cafe/producto/cf-isnos-geisha) y Fabián Muñoz en [Pitalito](https://dobleyo.cafe/producto/cf-pitalito-sidra). No tienen página ni fila en `farms` | [3 fincas del seed](https://dobleyo.cafe/fincas), también en [/en/farms](https://dobleyo.cafe/en/farms). ["Nuestros caficultores"](https://dobleyo.cafe/nosotros) y su cita, del seed. Certificaciones FLO, Orgánico y Rainforest, [sin número ni enlace](https://dobleyo.cafe/finca/finca-el-paraiso). ["Sin intermediarios: mejor precio"](https://dobleyo.cafe/) y ["precio justo"](https://dobleyo.cafe/nosotros), sin cifras | Tabla `farms` y flujo de caficultor en admin. `seed_demo.js`, líneas 341-369 |
| **Proceso** | [Lavado con fermentación anaeróbica por 40 horas, tostión media](https://dobleyo.cafe/producto/cf-isnos-geisha). [Guías con 4 métodos](https://dobleyo.cafe/guias). [Calculadora EN](https://dobleyo.cafe/en) y [recetas](https://dobleyo.cafe/en/guides). [Blog de 8 artículos](https://dobleyo.cafe/blog) | ["Datos reales de Finca El Paraíso"](https://dobleyo.cafe/), lote del seed y no comprable. Tueste del 31 de mayo junto a "Nunca café de bodega". ["15 días"](https://dobleyo.cafe/nosotros) no verificable sin fecha en ficha | Flujo "Qué sigue" en `/admin/produccion`, cosecha, almacén, tostión y empaque |
| **Calidad** | Nada público real. Sin puntaje ni notas por decisión de negocio ([ficha](https://dobleyo.cafe/producto/cf-isnos-geisha)) | ["Reseñas verificadas"](https://dobleyo.cafe/): 6 del seed sobre productos retirados. Filtros ["Mejor calificados" y "Más vendidos"](https://dobleyo.cafe/tienda). "Calidad de especialidad" sin prueba | `/admin/cupping` con 0 controles reales. `lots` con puntajes de demostración. 22 etiquetas en `generated_labels` |
| **Origen** | [2 cafés de Huila](https://dobleyo.cafe/tienda), con municipio y altura de 1.620 y 1.700 msnm | ["Huila, Nariño y la Sierra Nevada"](https://dobleyo.cafe/nosotros), sin esos cafés en venta. [Cacao "ecológico"](https://dobleyo.cafe/cacao), con `origin` nulo. Foto de cacao con otra marca legible, "ZOE..." | `/trazabilidad`, `/t/[code]` y `/en/traceability`, apagados por `SHOW_TRACEABILITY`. Siguen por decisión de negocio |
| **Atención** | WhatsApp +57 320 498 1580 en [footer](https://dobleyo.cafe/) y [EN](https://dobleyo.cafe/en/contact), con mensaje prellenado. Formulario, cuenta e invitado | [Número de ejemplo +57 300 123 4567](https://dobleyo.cafe/contacto). ["Respuesta en 24-48 horas"](https://dobleyo.cafe/envios-devoluciones), sin medición. [30 días de devolución](https://dobleyo.cafe/envios-devoluciones) frente a "5 días" | Seguimiento en `/confirmacion` e historial, útil solo con envío creado. No hay chat con IA |
| **Despacho** | [Costo en carrito: $12.000, gratis desde $120.000](https://dobleyo.cafe/cart), con cálculo en `orders.js:395`. [33 departamentos en checkout](https://dobleyo.cafe/checkout) | [Plazos 2-3, 3-5 y 4-7 días](https://dobleyo.cafe/envios-devoluciones) con 0 envíos. ["Seguimiento en vivo" y "tiempo real"](https://dobleyo.cafe/envios-devoluciones). [Contraentrega](https://dobleyo.cafe/checkout) sin recaudo validado. [Retiro en punto de venta](https://dobleyo.cafe/envios-devoluciones), sin dirección | Mipaquete, Interrapidísimo y Envia en `server/services/`, sin credenciales ni validación (DEBT-009, 014 y 019). `dispatch-manual`. Crons de GitHub Actions, gratuitos, sin secretos del servidor |

### Oferta y otras páginas

| Elemento | Lo que dice el sitio | Lo que hay detrás | Fuente |
|---|---|---|---|
| Catálogo | 2 cafés en grano de 250 g, a $72.000 y $65.000. Cacao: Chocolate de Mesa 500 g $26.000, Polvo 250 g $22.000, Forma de Café 150 g $16.000, Barras 100 g $12.000, Manteca 250 g $38.000 | 7 activos, 20 unidades de stock cada uno. Precios "de referencia" sin confirmar | [Tienda](https://dobleyo.cafe/tienda), [EN](https://dobleyo.cafe/en/shop) |
| Costo normalizado de cacao | $13.000, $22.000, $26.667, $30.000 y $38.000 por 250 g (cálculo propio) | No comparable con café | [Tienda](https://dobleyo.cafe/tienda) |
| Una bolsa con envío | $84.000 Isnos y $77.000 Pitalito (cálculo propio) | Con 2 bolsas se alcanza envío gratis | [Carrito](https://dobleyo.cafe/cart) |
| Suscripción | Cada 15 o 30 días, 10%, envío incluido, "Pause o cancele" | Pausa no existe. `SUBSCRIPTIONS_CRON_SECRET` no figura en Vercel, y `run-billing` respondería 503. 0 suscripciones | [Suscripción](https://dobleyo.cafe/suscripcion), [EN](https://dobleyo.cafe/en/subscription) |
| Cupón | 10% en primera compra por boletín | `PRIMERA10` activo, 0 usos. 6 suscriptores de boletín, todos demo | [Portada](https://dobleyo.cafe/) |
| Regalos | "Kits curados", "Caja de regalo incluida" y "Próximamente" | 0 kits activos, en el menú ES | [Regalos](https://dobleyo.cafe/regalos) |
| Accesorios | "Pronto encontrará aquí". Tienda y carrito sí los mencionan | Sin producto | [Accesorios](https://dobleyo.cafe/accesorios) |
| Afiliados | "Comisión competitiva", cookie de 30 días, panel propio | Sin código ni captura de `?ref=` | [Afiliados](https://dobleyo.cafe/afiliados), [EN](https://dobleyo.cafe/en/affiliates) |
| Mayoristas, solo ES | Desde 20, 50 y 100 kg al mes, y "Facturación formal" | Stock de 10 kg entre ambos cafés | [Mayoristas](https://dobleyo.cafe/mayoristas), [Partners](https://dobleyo.cafe/partners) |
| Medios de pago | Wompi con Visa, Mastercard, PSE, Nequi, Daviplata y contraentrega | Tope de contraentrega de $300.000 y otros límites sin anunciar. Widget no probado | [Checkout](https://dobleyo.cafe/checkout), `orders.js:26` |

### Conteos reales

| Concepto | Visible | Real con evidencia | Demostración o sin confirmar |
|---|---|---|---|
| Productos | 7 activos | 7 | 9 inactivos |
| Fincas | 3 en /fincas | 0 en /fincas. Finca Rengifo solo en texto | 3 del seed |
| Caficultores | 3 | 0 en /nosotros, 2 en fichas | 3 del seed |
| Reseñas | 3 en portada, 6 en BD | 0 | 6 del seed |
| Pedidos | No aplica | 0 no cancelados y no demo, entre 31 | 12 demo y 19 cancelados, al parecer pruebas |
| Envíos, suscripciones, controles de calidad | No aplica | 0 | No aplica |
| Mercado Libre | Sin enlace público | `ml_oauth`=0 y `ml_listings`=0 | `sales_tracking` y `external_sales` del seed |

La auditoría asume que la base del `.env` local es la de producción, porque coincide con lo publicado. No comparó el valor con Vercel. Ventas por fuera de la web podrían existir, aunque no hay registro real que lo muestre.

### Contradicciones confirmadas

| Tema | Versión 1 | Versión 2 |
|---|---|---|
| Plazo de devolución | "30 días" en [envíos](https://dobleyo.cafe/envios-devoluciones), [contacto](https://dobleyo.cafe/contacto) y [EN](https://dobleyo.cafe/en/shipping) | "5 días" en [carrito](https://dobleyo.cafe/cart), [checkout](https://dobleyo.cafe/checkout) y [checkout EN](https://dobleyo.cafe/en/checkout) |
| WhatsApp | +57 300 123 4567 en [/contacto](https://dobleyo.cafe/contacto) | +57 320 498 1580 en el footer de esa misma página |
| Entrega | "2-5 días hábiles" en [/contacto](https://dobleyo.cafe/contacto) | Hasta 4-7 días en [envíos](https://dobleyo.cafe/envios-devoluciones) |
| Correo | hola@ en [/contacto](https://dobleyo.cafe/contacto) | soporte@ en [envíos](https://dobleyo.cafe/envios-devoluciones) y hello@ en [EN](https://dobleyo.cafe/en/shipping) |
| Horario de WhatsApp | Incluye sábado en [/contacto](https://dobleyo.cafe/contacto) y [EN](https://dobleyo.cafe/en/contact) | Lunes a viernes en [envíos](https://dobleyo.cafe/envios-devoluciones) y [EN](https://dobleyo.cafe/en/shipping) |
| Impuestos | "IVA incluido" y "Tax included" | "No Responsable de IVA" en el mismo resumen de [checkout](https://dobleyo.cafe/checkout) y [EN](https://dobleyo.cafe/en/checkout) |
| Tueste del Geisha | Claro en [portada](https://dobleyo.cafe/) | Medio en [ficha](https://dobleyo.cafe/producto/cf-isnos-geisha) |
| Reembolso | 5-7 días hábiles en [envíos](https://dobleyo.cafe/envios-devoluciones) | 30 días calendario en retracto, en [términos](https://dobleyo.cafe/terminos). Pueden coexistir, sin explicación en ES |
| Riesgo de transporte | Pasa al comprador al entregar a la transportadora, en [términos](https://dobleyo.cafe/terminos) | La misma página dice "repondrá el producto" |
| Tarifa de envío | [EN](https://dobleyo.cafe/en/shipping) publica $12.000 | La [política ES](https://dobleyo.cafe/envios-devoluciones) no la dice; solo aparece en [carrito](https://dobleyo.cafe/cart) |
| Oferta | ["Cafés y accesorios"](https://dobleyo.cafe/tienda) | [Accesorios sin producto](https://dobleyo.cafe/accesorios) |

Los 30 días de retracto en [/terminos](https://dobleyo.cafe/terminos) merecen revisión especial. Coinciden con la compilación de Función Pública, no con los 15 días del [Diario Oficial](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf) y la [Sentencia C-192](https://www.corteconstitucional.gov.co/relatoria/2026/C-192-26.htm). Es una lectura propia, que debe validar un abogado.

### Diferencias ES, EN y producción

| Tema | Hallazgo | Fuente |
|---|---|---|
| Compra EN | "Add to cart" de la ficha no agrega nada en producción. "Add" en /en/shop sí funciona | [Ficha EN](https://dobleyo.cafe/en/product/cf-isnos-geisha), [/en/shop](https://dobleyo.cafe/en/shop) |
| Causa | Scripts en línea bloqueados por CSP. El CHANGELOG del 2026-11-05 la describe corregida en local, sin reflejarse aún | Consola de producción |
| Pasaporte | Existe en código local, y producción solo ofrece CC, CE, NIT y TI | [Checkout](https://dobleyo.cafe/checkout), [EN](https://dobleyo.cafe/en/checkout), `CheckoutView.astro:76` |
| Prosa de fincas | Descripciones y "Orgánico" en español dentro de EN | [/en/farms](https://dobleyo.cafe/en/farms) |
| Afiliados | "Panel propio" en ES y "Monthly report" en EN | [ES](https://dobleyo.cafe/afiliados), [EN](https://dobleyo.cafe/en/affiliates) |
| Google | CSS bloqueado y error de `callback` en consola. Login no probado | Consola de producción |
| Redirección | [/en/traceability](https://dobleyo.cafe/en/traceability) lleva a `/shop`, que da 404. No hay enlace público hacia allí | Rastreo |

La ausencia de `/en/wholesale`, `/en/partners` y `/en/blog` no es un vacío: el sitio EN no tiene B2B por decisión de negocio. Tampoco lo es que EN omita los envíos al exterior.

### Residuos frente a decisiones de negocio

`SHOW_TRACEABILITY=false` está aplicado a medias. ES conserva "trazabilidad" en una reseña y 3 veces en [/nosotros](https://dobleyo.cafe/nosotros).

La [portada](https://dobleyo.cafe/) mantiene "LOTE-HUI-2026-01", "LOTE DESTACADO", "Seguir un lote" y "El viaje de un lote". No es un error de la decisión, sino de su ejecución.

### Experiencia móvil

La prueba emuló un iPhone 13 en Chromium, sin Safari real ni Android físico. No hay desborde horizontal en ficha, carrito ni checkout, y la compra como invitado funciona hasta antes de pagar. Las fricciones son el banner de cookies, cerca de 27% de la pantalla, y el botón de WhatsApp sobre "Solo esenciales".

"Agregar al carrito" queda a 1.049 px en ES y 949 px en EN, fuera de la primera pantalla de 844 px. No se detectó barra fija de compra. El "+" del carrito se ve recortado en captura, y el botón de confirmar queda a unos 1.505 px.

Pedir documento agrega fricción, aunque la explicación es buena y encaja con la exigencia de las transportadoras. Los campos y el teclado móvil están bien configurados.

### Lo que juega a favor

Suscripción, invitado, WhatsApp, inglés y guías con calculadora son fortalezas reales de diseño. Sobre el papel, 10% más envío incluido supera a [Devoción, con 5%](https://devocion.com.co/products/cafe-toro), e iguala el descuento de [Juan Valdez](https://www.tiendajuanvaldez.com/servicio-al-cliente#terminosycondicionessuscripciones). Falta probar el cobro y el margen: el envío de lista nacional sería cerca de 27,5% de una entrega de $64.800 (cálculo propio).

El Geisha a $72.000 no está caro frente a [Quindío, $130.800](https://www.cafequindio.com.co/products/geisha), [Colo, $80.000](https://colo.com.co/products/gesha-natural-250g), o [El Ocaso, unos $84.000](https://cafe.fincaelocasosalento.com/tienda/). Eso sí, esas marcas tienen más trayectoria visible, y la comparación no mide calidad. Sin costo unitario revisado, tampoco se puede evaluar margen.

### Preguntas abiertas al dueño

| Tema | Pregunta | Por qué importa |
|---|---|---|
| Finca Rengifo | ¿Es una finca, dos predios, un nombre comercial o un error de etiqueta? Aparece en Isnos y Pitalito, con dos productores | No se puede publicar perfil hasta aclararlo |
| Finca El Paraíso | ¿Existe, y hay relación comercial y evidencia? Las notas no lo establecen, y sus datos están en el seed | Define si el texto "datos reales" se retira o se reemplaza |
| Jaime Morales y Fabián Muñoz | ¿Autorizan aparecer con nombre, y qué relación de compra existe? | Respaldo y uso de datos personales |
| Certificaciones | ¿Existe algún certificado real, con número y titular? | Riesgo de publicidad engañosa |
| Precio pagado | ¿Existe un registro por carga y quiere publicarse? | "Mejor precio" no tiene cifra |
| Fecha de tueste | ¿Cuál es la fecha real de las bolsas en stock, y la imprime la bolsa? | La promesa de 15 días depende de esto |
| Cacao | ¿Cuál es su origen, y qué relación tiene con la marca legible en la foto? | Identidad del producto |
| Costos y ventas | ¿Cuál es el costo unitario, y hay ventas fuera de la web? | Precio, margen y reseñas |

### Para qué nos sirve

Esta ficha ordena el trabajo: primero P01 a P10, que corrigen lo publicado sin respaldo, lo legal y la compra rota. Lo que existe sin mostrarse se activa con P11, P12, P14 y P15, solo cuando haya dato real. Las preguntas al dueño desbloquean P02 y P17, y las decisiones sobre interruptores quedan en P18.

## Propuestas priorizadas

Son 20 propuestas, y las 10 primeras corrigen honestidad, legalidad, seguridad y compra antes de cualquier crecimiento. Impacto y esfuerzo son juicio propio, sin datos de conversión. Lo legal debe validarlo un abogado, y ninguna propuesta exige funciones de pago de Vercel.

### Ahora

Horizonte: esta semana o la siguiente. Casi todo consiste en quitar o corregir texto y datos publicados.

| Propuesta | Hallazgo que la sustenta | Impacto | Esfuerzo | Cómo medirla | Decisión del dueño |
|---|---|---|---|---|---|
| **P01.** Retirar las reseñas de demostración y el bloque "Reseñas verificadas". Retirar filtros "Mejor calificados" y "Más vendidos" mientras no haya datos | [Portada](https://dobleyo.cafe/) con 3 reseñas del seed, 0 de productos activos, y [filtros sin datos](https://dobleyo.cafe/tienda) | Alto | Bajo | 0 reseñas `@demo` visibles en rastreo de portada y ficha | Autorizar el retiro, aunque la portada pierda prueba social temporal |
| **P02.** Retirar fincas, caficultores, citas y certificaciones del seed. Corregir Nariño, Sierra Nevada y "mejor precio" si no hay evidencia | [/fincas](https://dobleyo.cafe/fincas), [/en/farms](https://dobleyo.cafe/en/farms), [/nosotros](https://dobleyo.cafe/nosotros) y [certificaciones sin número](https://dobleyo.cafe/finca/finca-el-paraiso). Fincas con `caficultor_id` demo | Alto | Bajo | 0 fincas y certificaciones demo públicas. Toda afirmación de origen con evidencia archivada | Responder qué es Finca Rengifo y si existe Finca El Paraíso. Decidir qué hacer con /fincas mientras tanto |
| **P03.** Suspender contraentrega en checkout, footer y barra EN hasta validar el recaudo, o limitarla a un piloto anunciado | Recaudo sin validar en 3 proveedores, 0 envíos, `dispatch-manual` guarda `prepaid` ([checkout](https://dobleyo.cafe/checkout), [EN](https://dobleyo.cafe/en)). Comisión oficial no hallada | Alto | Bajo | 0 menciones hasta validar. En piloto: recaudo conciliado por pedido y tasa de devolución | Suspender o pilotear. Pro: evita pedidos sin cobro. Contra: pierde un rasgo poco común y clave en la portada EN |
| **P04.** Cambiar "Seguimiento en vivo" y "tiempo real" por lo que existe: guía por correo. Marcar plazos como estimados y retirar el retiro en punto de venta si no hay dirección | [Envíos](https://dobleyo.cafe/envios-devoluciones), [EN](https://dobleyo.cafe/en/shipping), `shipments`=0. Franqueza de [La Palma](https://lapalmayeltucan.com/en-us/policies/shipping-policy) | Alto | Bajo | 0 promesas de tiempo real. Texto igual en todas las páginas | Definir si existe un punto de retiro y su dirección |
| **P05.** Corregir el número de ejemplo en /contacto y unificar WhatsApp, correo, horario y plazo ES y EN | [/contacto](https://dobleyo.cafe/contacto) enlaza `wa.me/573001234567`. Correos y horarios difieren | Alto | Bajo | Rastreo sin "300 123 4567". Una sola tabla de canales | Elegir correo oficial, horario real y si se atiende el sábado |
| **P06.** Unificar devolución, retracto, reembolso e IVA con un texto validado por un abogado | ["5 días" frente a "30 días"](https://dobleyo.cafe/cart), [30 días en términos](https://dobleyo.cafe/terminos) frente a [15 días legales](https://www.corteconstitucional.gov.co/relatoria/2026/C-192-26.htm), [concepto SIC no obligatorio](https://cdn.actualicese.com/normatividad/2016/Conceptos/C16062808-16.pdf), ["IVA incluido" y "No Responsable"](https://dobleyo.cafe/checkout) | Alto | Medio | Una sola política en carrito, checkout, términos y EN, con visto bueno escrito | Contratar la revisión. Decidir si ofrece una política voluntaria más amplia que la ley. Confirmar la condición tributaria real |
| **P07.** Quitar promesas de funciones que no existen: pausa, panel y cookie de afiliados, kits, caja de regalo y accesorios. Sacar Regalos del menú si sigue vacío | [Suscripción](https://dobleyo.cafe/suscripcion), [Afiliados](https://dobleyo.cafe/afiliados), [Regalos](https://dobleyo.cafe/regalos), [Accesorios](https://dobleyo.cafe/accesorios). Sin código de afiliados ni pausa | Medio | Bajo | Cada promesa pública con función o producto asociado | Decidir qué páginas se ocultan y cuáles quedan como lista de espera |
| **P08.** Rehacer el relato de portada con el café en venta y aplicar `SHOW_TRACEABILITY` a textos residuales. Corregir Claro y Medio | [Portada](https://dobleyo.cafe/) y [/nosotros](https://dobleyo.cafe/nosotros), lote de mayo no comprable junto a "Nunca café de bodega" | Medio | Medio | 0 apariciones públicas de trazabilidad, QR y lote. Relato coherente con la ficha | Confirmar la decisión vigente. Aportar datos reales del café en venta |
| **P09.** Revisar accesos de prueba, datos demo y páginas internas accesibles | Detalle fuera de este archivo, porque el repositorio es público. [/showcase](https://dobleyo.cafe/showcase), [/iteraciones](https://dobleyo.cafe/iteraciones) y [/desarrollo-ia](https://dobleyo.cafe/desarrollo-ia) abren sin sesión | Alto | Bajo | 0 accesos de prueba activos en producción | Autorizar revisión y limpieza |
| **P10.** Desplegar la corrección de CSP y el pasaporte, y comprobar compra EN en producción | ["Add to cart" sin efecto](https://dobleyo.cafe/en/product/cf-isnos-geisha), [pasaporte ausente](https://dobleyo.cafe/en/checkout). El CHANGELOG lo da por corregido en local | Alto | Bajo | Prueba en móvil y escritorio: ítem en carrito desde ficha EN, sin errores CSP en consola | Autorizar el despliegue, que queda a cargo del dueño |

### 30 días

Horizonte: cuando lo anterior esté publicado. Aquí se pasa de quitar a mostrar y operar datos reales.

| Propuesta | Hallazgo que la sustenta | Impacto | Esfuerzo | Cómo medirla | Decisión del dueño |
|---|---|---|---|---|---|
| **P11.** Publicar una ficha del café, sin QR ni la palabra trazabilidad: productor si se confirma, municipio, altura, variedad, proceso, fecha de tueste, receta y molienda sugerida. Íconos solo con el set propio y sin emojis | Fecha de tueste no vista en la [muestra](https://varietale.com/products/san-antonio). Referencias: [Varietale](https://varietale.com/products/san-antonio), [Oma](https://empacados.cafeoma.com/origen-de-mi-tierra/) y [Catación](https://catacionpublica.co/products/cafe-black-edition). La [ficha actual](https://dobleyo.cafe/producto/cf-isnos-geisha) oculta estos datos en un párrafo | Alto | Medio | Campos completos en 2 de 2 cafés. Tasa de adición al carrito con medición gratuita propia | Aprobar publicar fecha de tueste por café y mantenerla al día |
| **P12.** Publicar tabla de envío ES con costo, umbral, plazo y transportadora. Cotizar costo real, pedir confirmación escrita sobre café tostado y hacer el primer envío medido | [$12.000 solo visible en carrito ES](https://dobleyo.cafe/cart). [Coordinadora excluye perecederos](https://coordinadora.com/tarifas/condiciones-generales/). Referente: [Libertario](https://www.libertariocoffee.com/policies/shipping-policy). Credenciales sin configurar | Alto | Medio | Costo real frente a $12.000 por zona. Días reales por zona. Guía y correo emitidos | Elegir transportadora o agregador. Decidir si mantiene tarifa plana y el umbral de $120.000. EN sigue en COP y sin mención al exterior |
| **P13.** Crear PQR con radicado, fecha, hora y seguimiento. Auditar art. 50, datos personales, rotulado y uso del origen con asesoría. Medir tiempo de respuesta antes de publicarlo | [Ley 2439, lit. g](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf), [art. 50](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306), [proyecto de etiquetado](https://www.minsalud.gov.co/Normatividad_Nuevo/PR%20Etiquetado%20Frontal.pdf), [licencia de origen](https://cafedecolombia.com/en/100-colombian-coffee/). Casi nadie publica plazo | Alto | Medio | Radicado generado en cada PQR. Lista legal cerrada. Horas de respuesta por canal | Contratar asesoría. Decidir quién responde y qué plazo está dispuesto a cumplir |
| **P14.** Probar el cobro real de la suscripción con compra autorizada. Configurar el secreto del workflow gratuito de GitHub Actions. Construir pausa o dejar solo "cancele" y revisar margen | [Suscripción](https://dobleyo.cafe/suscripcion), `SUBSCRIPTIONS_CRON_SECRET` ausente, 0 suscripciones. Envío de lista cerca de 27,5% de la entrega (cálculo propio). Referentes: [Devoción](https://devocion.com.co/pages/suscripcion) y [Varietale](https://varietale.com/products/suscripcion-cafe-especial-500g) | Alto | Medio | Cobro exitoso, correo y cancelación probados. Margen por entrega y zona | Autorizar el cobro de prueba. Decidir envío incluido en todo el país o por zona |
| **P15.** Abrir reseñas solo con compra verificada, con fecha, límite de largo y sin filtrar críticas | [Formulario sin compra](https://dobleyo.cafe/producto/cf-isnos-geisha), `products.js:272`, DEBT-023. Referentes: [Quindío](https://www.cafequindio.com.co/products/geisha) y [Varietale](https://varietale.com/) | Medio | Medio | 100% de reseñas ligadas a pedido real. Número de reseñas por café | Aceptar que el bloque quede vacío al inicio y publicar también críticas |
| **P16.** Confirmar precios y costo unitario con el comparativo. Evaluar si conviene una referencia de entrada | [Precios de referencia](https://dobleyo.cafe/tienda). Casa de $34.000 a $46.000 (cálculo propio) y microlote más arriba. [Caída de carga](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf) | Alto | Bajo | Margen por café después de envío y Wompi. Ventas por referencia | Fijar precios. Decidir si DobleYo se mantiene solo en microlote o agrega un café de casa |

### 90 días

Horizonte: con los primeros pedidos reales. Estas propuestas dependen de evidencia previa.

| Propuesta | Hallazgo que la sustenta | Impacto | Esfuerzo | Cómo medirla | Decisión del dueño |
|---|---|---|---|---|---|
| **P17.** Publicar perfil del productor real con relación de compra. Si hay registro sostenible, publicar precio pagado con referencia y su salvedad. Separar cafés de la casa e invitados | [Azahar](https://azaharcoffee.com/producto/edicion-especial-huila/) y [Jesús Martín](https://cafejesusmartin.co/). Frases de pago sin cifra en la muestra. `/admin/precio-fnc` ya existe | Medio | Medio | Productores con autorización y dato archivado. Clics a perfil y ventas del café | Autorizar publicar el precio pagado y sostenerlo en el tiempo |
| **P18.** Hacer una encuesta propia a compradores y decidir con datos sobre `SHOW_CUPPING` y `SHOW_TRACEABILITY` | Sin encuesta pública sobre finca, puntaje o frescura. [Sabor como primer criterio](https://www.valoraanalitik.com/criterio-de-consumo-de-cafe-cambio-en-colombia/), fuente débil. Puntaje visible en [Varietale](https://varietale.com/products/san-antonio) | Medio | Bajo | Respuestas válidas, peso de cada dato y decisión escrita | Mantener o revisar cada interruptor. Ver la tabla siguiente |
| **P19.** Probar molienda, un formato de prueba y una guía para olla y colador | Solo [grano de 250 g](https://dobleyo.cafe/producto/cf-isnos-geisha). [Método tradicional predominante](https://www.valoraanalitik.com/criterio-de-consumo-de-cafe-cambio-en-colombia/), sin cifras. [Kit 3 x 80 g de Oma](https://empacados.cafeoma.com/origen-de-mi-tierra/). [Molienda en Juan Valdez](https://www.tiendajuanvaldez.com/cafe-premium-colina-454gr-8ad68615-a481-44c1-a250-c1fbf472f10e/p) | Medio | Medio | Ventas por formato. Lectura de la guía. Devoluciones por molienda | Aprobar operación de molienda y bolsas pequeñas según frescura y costo |

### Después

Horizonte: con stock, operación y márgenes demostrados.

| Propuesta | Hallazgo que la sustenta | Impacto | Esfuerzo | Cómo medirla | Decisión del dueño |
|---|---|---|---|---|---|
| **P20.** Reabrir canales uno a la vez: Mercado Libre, mayoristas ES, afiliados y regalos, solo con sistema, stock y margen. Mercado Libre empieza sin Full | [8% a 22% de comisión](https://www.mercadolibre.com.co/ayuda/Costos-de-vender-un-producto_870), [cargo de stock antiguo](https://vendedores.mercadolibre.com.co/nota/cuanto-cuesta-operar-en-full), `ml_oauth`=0. [Mínimo de 20 kg](https://dobleyo.cafe/mayoristas) frente a 10 kg en stock. [Hospitality](https://www.libertariocoffee.com/pages/hospitality) y [Varietale](https://varietale.com/pages/tostadora) como referentes | Medio | Alto | Margen neto por canal. Cumplimiento y rotación de stock | Elegir canal, mínimos y comisión de afiliado. EN sigue sin B2B |

### Decisiones del dueño sobre interruptores

Estas decisiones no son errores por corregir. Se presentan con pros y contras, y con una alternativa compatible con el estado actual.

| Decisión | A favor de revisarla | En contra | Alternativa sin cambiar el interruptor |
|---|---|---|---|
| `SHOW_TRACEABILITY` | Casi nadie muestra QR, así que sería un vacío libre. El código ya existe | Exige datos reales por lote, hoy casi inexistentes. Un error destruye confianza. No hay evidencia de demanda | Ficha del café con productor, municipio, altura y fecha de tueste, sin QR, lotes ni la palabra trazabilidad |
| `SHOW_CUPPING`, puntaje SCA | [Varietale](https://varietale.com/products/san-antonio) y [Quindío](https://www.cafequindio.com.co/products/geisha) lo muestran. El precio de $65.000 a $72.000 ganaría una prueba | Hoy hay 0 controles reales. Exige catador y costo, y el puntaje autodeclarado convence poco sin autor | Publicar reseñas reales, fecha de tueste y receta. Obtener una catación externa solo para uso interno y decidir después |
| `SHOW_CUPPING`, notas de cata | El sabor aparece como primer criterio, con [fuente débil](https://www.valoraanalitik.com/criterio-de-consumo-de-cafe-cambio-en-colombia/). Casi toda la muestra publica notas | Las notas necesitan respaldo real de cata, y pueden no coincidir con la experiencia del cliente | Recomendación de método, rendimiento en tazas y temperatura, como [Catación](https://catacionpublica.co/products/cafe-black-edition) y [Varietale](https://varietale.com/products/san-antonio) |

Cualquier medición debe usar datos propios del sitio, Wompi y la base. Vercel Analytics, crons de Vercel o firewall quedan fuera de esta lista; incluirlos exigiría autorización expresa del dueño. Los crons ya previstos corren en GitHub Actions, sin costo.

### Datos para matriz

- P01, impacto Alto, esfuerzo Bajo, Reseñas de demostración
- P02, impacto Alto, esfuerzo Bajo, Fincas y certificaciones del seed
- P03, impacto Alto, esfuerzo Bajo, Contraentrega no validada
- P04, impacto Alto, esfuerzo Bajo, Seguimiento y plazos
- P05, impacto Alto, esfuerzo Bajo, Contacto y canales
- P06, impacto Alto, esfuerzo Medio, Devolución, retracto e IVA
- P07, impacto Medio, esfuerzo Bajo, Promesas sin sistema
- P08, impacto Medio, esfuerzo Medio, Portada y textos residuales
- P09, impacto Alto, esfuerzo Bajo, Accesos de prueba y páginas internas
- P10, impacto Alto, esfuerzo Bajo, Compra EN y pasaporte
- P11, impacto Alto, esfuerzo Medio, Ficha del café
- P12, impacto Alto, esfuerzo Medio, Tabla de envío y primer envío
- P13, impacto Alto, esfuerzo Medio, PQR y auditoría legal
- P14, impacto Alto, esfuerzo Medio, Suscripción probada
- P15, impacto Medio, esfuerzo Medio, Reseñas con compra verificada
- P16, impacto Alto, esfuerzo Bajo, Precios y costo unitario
- P17, impacto Medio, esfuerzo Medio, Productor y precio pagado
- P18, impacto Medio, esfuerzo Bajo, Encuesta e interruptores
- P19, impacto Medio, esfuerzo Medio, Molienda, muestra y guía
- P20, impacto Medio, esfuerzo Alto, Reapertura de canales

## Fuentes y vacíos de información

La evidencia es sólida en lo publicado por cada web el 5 de noviembre de 2026, y débil en desempeño real. No hay datos de conversión, cumplimiento de entrega ni tiempo de respuesta de ninguna marca. Cada dato conserva su enlace junto a la tabla o frase donde se usa.

### Tipos de fuente

| Tipo | Ejemplos | Uso y confianza |
|---|---|---|
| Webs de marca | Fichas y políticas de cada marca | Lo que la marca dice, no verificado de forma independiente |
| Norma o autoridad | [Ley 2439](https://sidn.ramajudicial.gov.co/SIDN//NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202024/Ley%202439%20de%202024.pdf), [Sentencia C-192](https://www.corteconstitucional.gov.co/relatoria/2026/C-192-26.htm), [Resolución 2492](https://normograma.invima.gov.co/compilacion/docs/resolucion_minsaludps_2492_2022.htm) | Alta, con lectura no profesional. Requiere abogado |
| Datos sectoriales | [FNC](https://federaciondecafeteros.org/wp-content/uploads/2026/10/9.-Informe-mensual-Septiembre-2026-p.pdf), [CCCE](https://ccce.org.co/wp-content/uploads/2017/06/Publico_V1-2026-IInforme-1er-trimestre-economico.pdf), [Colombia TIC](https://colombiatic.mintic.gov.co/679/articles-438765_presentacion_cifras.pdf), [Migración Colombia](https://www.migracioncolombia.gov.co/fileadmin/user_upload/107077_flujos-migratorios-de-extranjeros-en-colombia-2024-2.pdf) | Alta en su universo, con datos a veces preliminares |
| Prensa con firma de datos | [Euromonitor](https://www.larepublica.co/empresas/lideres-del-mercado-retail-de-cafe-4005383) y [Nielsen](https://forbes.co/2026/04/22/red-forbes/el-cafe-que-no-nos-tomamos/) citados | Media: la metodología no aparece en la nota |
| Declaraciones de empresa | [Juan Valdez](https://www.portafolio.co/negocios/empresas/juan-valdez-apunta-cerrar-el-ano-con-700-tiendas-y-acelera-su-expansion-internacional-504524), [Oma](https://www.agronegocios.co/agricultura/cafe-de-oma-evalua-su-entrada-a-mercados-de-argentina-y-chile-4423631), [Mercado Libre](https://www.valoraanalitik.com/?p=564972), [Rappi](https://www.elpais.com.co/economia/las-ciudades-colombianas-que-mas-toman-cafe-aumentan-los-pedidos-a-traves-de-aplicaciones-0147.html) | Media o baja: tienen interés comercial |
| Auditoría interna | Código, base con SELECT y rastreo de [DobleYo](https://dobleyo.cafe/) | Alta en lo público, con la salvedad de la base usada |

### Fuentes débiles, marcadas

| Fuente | Debilidad | Uso aquí |
|---|---|---|
| [Tiendanube](https://www.portafolio.co/tecnologia/whatsapp-se-consolida-como-aliado-clave-del-comercio-electronico-en-colombia-segun-informe-de-e-commerce-489757) e [Infobip](https://www.enter.co/?p=577653) | Proveedores sin muestra publicada. Infobip varía entre ["casi 90%"](https://www.enter.co/?p=577653) y [83%](https://www.portafolio.co/tecnologia/como-viene-la-atencion-al-cliente-en-colombia-que-sectores-usan-mas-chatbots-639678) | Contexto, no sustentan por sí solos una propuesta |
| [Estudio CUAS](https://www.valoraanalitik.com/criterio-de-consumo-de-cafe-cambio-en-colombia/) | Sin autor, muestra ni fecha, y con vocero de Oma | Hipótesis para P18 y P19, rotulada |
| [Kapital Colombia, 74%](https://www.minuto60.com/economia/ventas-fantasma-linea-soluciones-tendencias-2026/3488) | Sin muestra ni periodo | Contexto rotulado |
| [ClearSale](https://lanotaeconomica.com.co/movidas-empresarial/el-19-de-los-usuarios-colombianos-de-e-commerce-experimentaron-fraude-en-el-ultimo-ano/) | 2023-2024, sin desglose claro para Colombia | Contexto rotulado |
| [Colombia Move](https://colombiamove.com/blog/es/registro-invima-cafe-tostado-molido-notificacion-sanitaria-colombia/) | Blog secundario sobre tarifas, precios y NSA | No reemplaza norma ni tarifa oficial |
| [Mipaquete](https://www.mipaquete.com/) | Testimonio de recaudo con pie de 2022 | No se usa como cifra |
| [Andrey Business](https://www.andreybusiness.com/blog/interrapidisimo-tarifas-precio-envio-2026) | Blog sin fuente oficial, posiblemente desactualizado | No se usan sus tarifas ni su comisión |
| [El Día](https://eldia.com.do/medellin-es-una-meca-de-nomadas-digitales-y-ahora-los-contara/) | Nómadas sin metodología, admite no conocer la cifra | No se usa para dimensionar el sitio EN |
| [La Tienda del Café](https://latiendadelcafe.co/en/blogs/cafe-colombiano/crecimiento-del-cafe-de-especialidad-en-colombia) | Comercio local con cifras sin documento enlazado | Solo la definición de 80 puntos |

### Cifras que no se usan

Se descartan las cifras de [Informes de Expertos](https://www.informesdeexpertos.com/informes/mercado-de-cafe-en-colombia), incompatibles por más de un orden de magnitud y sin modelo descrito. [Mordor Intelligence](https://www.mordorintelligence.com/es/industry-reports/colombia-coffee-market) dio 404, así que no hay cifra suya verificada. Tampoco se usan datos vistos solo en fragmentos de buscador, como total de cafeterías, número de tostadoras o cuota independiente del segmento.

El dato de un programa de Juan Valdez en su [informe 2025](https://juanvaldez.com/wp-content/uploads/2026/03/Informe-de-Sostenibilidad-2025-Procafecol-S.A.pdf) queda fuera hasta contrastarlo con el original. El PDF se leyó a columnas y las notas piden confirmarlo. Tampoco se usan tiempos de respuesta "esperados" publicados por blogs de proveedores.

### Trampas de identidad

| Nombre | Trampa | Correcto o estado |
|---|---|---|
| Colo | colocoffee.co estacionado y colocoffee.com sin respuesta | [colo.com.co](https://colo.com.co/) |
| Pergamino | pergamino.co es un selector | [co.pergamino.co](https://co.pergamino.co/) |
| Catación Pública | El .com está estacionado | [catacionpublica.co](https://catacionpublica.co/) |
| Libertario | libertario.co está estacionado | [libertariocoffee.com](https://www.libertariocoffee.com/) |
| Azahar | azahar.co está en venta | [azaharcoffee.com](https://azaharcoffee.com/) |
| Café Cultor | cafecultor.com estacionado y homónima según [Caras](https://caras.perfil.com/noticias/caras-like/cafe-cultor-una-experiencia-organica-saludable-y-consciente.phtml) | [cafecultor.co](https://cafecultor.co/) |
| Granja La Esperanza | granjalaesperanza.com es otra empresa, de Costa Rica. La "La Esperanza" del seed de DobleYo está en Nariño, y las notas no las relacionan | [cafegranjalaesperanza.com](https://cafegranjalaesperanza.com/) |
| Las Margaritas | Es una finca de Esperanza, no una marca | [Farms](https://cafegranjalaesperanza.com/pages/farms) |
| La Palma | Homónimo en Taza de la Excelencia 2023, de otro productor | [ACE](https://allianceforcoffeeexcellence.org/colombia-2023/) |
| Café Tairona | Sin marca de finca verificada. [tayronacafe.com](https://tayronacafe.com/) es una cafetería en Fusagasugá. cafetayrona.com está vencido | No verificado |
| Jesús Martín | cafejesusmartin.com lleva a "/lander" | [cafejesusmartin.co](https://cafejesusmartin.co/) |
| Forest | forestcoffee.co redirige a un sitio B2B | [coffeegreenbeans.com](https://coffeegreenbeans.com/) |
| Paraíso 92 y Finca El Paraíso | Nombres parecidos. Las notas no establecen relación | Pregunta abierta al dueño |

### Marcas no verificadas

| Marca o sitio | Estado | Qué haría falta |
|---|---|---|
| Café Inconfundible | Seis dominios sin respuesta y dos búsquedas sin resultado | Enlace o perfil de red aportado por quien la mencionó |
| Café Tairona | Sin sitio de marca de origen | Confirmar la marca o el dominio |
| Buendía, sitio propio | cafebuendia.com inaccesible y .com.co sin resolver | Otro intento, o canal oficial por [Buencafé](https://www.buencafe.com/) |
| Tienda de cooperativa de Nariño | Tres búsquedas sin resultado | Contacto directo con cooperativas |
| cafebahareque.com | No legible desde [Cafenorte](https://www.cafenorte.com.co/) | Nueva lectura con navegador |
| Aroma y Luker café | Sin revisar | Ampliar la muestra de [Casa Luker](https://www.casaluker.com/marcas/?valor=cafe) |
| Dolce Gusto, shop.cafesellorojo.us y capsulasexpressnutresa.com | 403 o sin abrir | Revisión con navegador real |
| Café Quindío | Una nota dice que no respondió y otra sí lo abrió. Se usa la lectura que [sí abrió](https://www.cafequindio.com.co/) | Sin acción, salvo repetir la lectura si se actualiza |

### Vacíos y cómo cerrarlos

| Vacío | Por qué importa | Cómo cerrarlo |
|---|---|---|
| Checkouts de la competencia: costo final, medios y contraentrega | La columna Checkout es No verificado | Compra de prueba autorizada en 5 a 8 marcas, con presupuesto del dueño |
| Fecha de tueste y QR en bolsas | La web no agota el dato | Comprar y fotografiar empaques, junto con la prueba anterior |
| Cumplimiento real de plazos | Las promesas no son desempeño | Las mismas compras, con registro de días por ciudad |
| Tiempo real de respuesta | Nadie lo publica | Mensajes de prueba autorizados, por canal y hora |
| Formato visual: foto, video y mapas | La revisión solo capturó texto | Revisión con capturas, sobre todo Sello Rojo, Lukafe y Esperanza |
| Peso de finca, puntaje, frescura y precio al productor | Sin encuesta pública | Encuesta propia a compradores y seguidores (P18) |
| Costo real de envío, tarifas oficiales y comisión de recaudo | Define tarifa, umbral y contraentrega | Cotización con cuenta en Mipaquete, Envia, Inter y Coordinadora (P12) |
| Tiempos y zonas de Coordinadora | La tabla de zonas no cargó | Cotizador con cuenta |
| Comisiones de Mercado Libre, Addi y marketplaces | Definen P20 | Simulador o cuenta de vendedor |
| Premios de San Alberto, Esperanza y La Palma | Autodeclarados | Contraste con organizadores |
| Vigencia de políticas | Azahar 2024, Juan Valdez tarifas 2025, varias sin fecha | Repetir lectura antes de citar públicamente |
| [Política de envíos de Juan Valdez](https://www.tiendajuanvaldez.com/politicas-de-envio) | Existe y no se leyó. Se usaron términos y PDF | Lectura directa |
| Reportes de Devoción y Amor Perfecto, y blog de productores de Pergamino | Enlaces vistos, cifras internas no revisadas | Lectura de los PDF y entradas |
| Reseñas en Google, Instagram y TripAdvisor | No se revisaron de forma sistemática | Muestra por marca |
| Mercado: canales, tostadoras, suscripciones, métodos y extranjeros residentes | Sin cifra pública verificada | Fuentes de pago o estudio propio, según presupuesto |
| Plazo legal de PQR, RNBD, NSA, FNC y estado del proyecto de etiquetado | No abiertos en norma primaria o sin confirmar | Revisión de abogado (P06 y P13) |
| DobleYo: cobro real, widget de Wompi, Safari y Android reales, Core Web Vitals, admin, redes | No se probaron | Prueba autorizada tras P10 y P14 |

### Corte

Toda lectura de páginas corresponde al 5 de noviembre de 2026, salvo fecha propia indicada en la fuente. Los precios y políticas pueden cambiar sin aviso. Este informe no modifica el repositorio ni constituye asesoría legal.
