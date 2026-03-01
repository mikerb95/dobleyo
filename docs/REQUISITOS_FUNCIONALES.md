# Requisitos Funcionales — DobleYo Café

> Cada requisito tiene ID `RF-XXX` trazable con historias de usuario (HU-XXX).  
> Prioridad: P1 (crítico), P2 (importante), P3 (deseable).

---

## 1. Catálogo y Tienda

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-001 | El sistema debe mostrar un catálogo de productos con imagen, nombre, precio, origen, proceso y tueste | HU-001 | P1 | 1 |
| RF-002 | El sistema debe permitir filtrar productos por: categoría (café, accesorio, merchandising), origen, proceso (lavado, honey, natural), nivel de tueste, rango de precio | HU-001 | P1 | 1 |
| RF-003 | El sistema debe permitir ordenar productos por: precio asc/desc, nombre A-Z/Z-A, más recientes | HU-001 | P1 | 1 |
| RF-004 | Los productos deben cargarse desde la base de datos PostgreSQL, no desde archivos estáticos | HU-001 | P1 | 1 |
| RF-005 | El sistema debe mostrar badge de "Nuevo", "Más vendido" o "Agotado" según corresponda | HU-001 | P2 | 2 |
| RF-006 | Cada producto debe tener una página de detalle con galería de imágenes, descripción extendida, notas de cata, y perfil visual de tueste | HU-001 | P2 | 2 |

---

## 2. Carrito de Compras

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-010 | El carrito debe persistir en localStorage con sincronización a BD si el usuario está autenticado | HU-002 | P1 | 4 |
| RF-011 | El carrito debe permitir agregar, eliminar y modificar cantidades de productos | HU-002 | P1 | 1 |
| RF-012 | El carrito debe mostrar subtotal actualizado en tiempo real | HU-002 | P1 | 1 |
| RF-013 | El header debe mostrar un contador de ítems en el carrito, visible en todas las páginas | HU-002 | P1 | 1 |
| RF-014 | El carrito debe validar stock disponible antes de permitir agregar un producto | HU-002 | P2 | 4 |
| RF-015 | El carrito debe mostrar imagen thumbnail, nombre, precio unitario, cantidad y total por ítem | HU-002 | P1 | 2 |

---

## 3. Checkout y Pagos

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-020 | El checkout debe requerir autenticación (login/registro) antes de proceder | HU-003 | P1 | 4 |
| RF-021 | El checkout debe recopilar datos de envío: nombre completo, documento, dirección (departamento, ciudad, barrio, dirección), teléfono, email, notas | HU-003 | P1 | 4 |
| RF-022 | El checkout debe geocodificar la dirección de envío para obtener coordenadas (lat/lng) y almacenarlas con la orden | HU-003, HU-023 | P1 | 4 |
| RF-023 | El sistema debe integrar Wompi como pasarela de pagos incluyendo: PSE, tarjeta crédito/débito, Nequi, Bancolombia QR | HU-003 | P1 | 4 |
| RF-024 | El sistema debe integrar MercadoPago como pasarela alternativa | HU-003 | P1 | 4 |
| RF-025 | El sistema debe calcular IVA (19%) sobre productos gravados | HU-003 | P1 | 4 |
| RF-026 | El sistema debe calcular costos de envío según ubicación del destinatario | HU-003 | P2 | 4 |
| RF-027 | Al completar el pago, el sistema debe crear un registro de orden en BD con: ítems, totales, dirección, método de pago, referencia de transacción, coordenadas | HU-003 | P1 | 4 |
| RF-028 | El sistema debe enviar email de confirmación al comprador con resumen de la orden | HU-003 | P1 | 4 |
| RF-029 | El sistema debe recibir webhooks de Wompi y MercadoPago para actualizar el estado del pago | HU-003 | P1 | 4 |
| RF-030 | El sistema debe mostrar una página de confirmación con número de referencia, resumen y datos de trazabilidad del lote | HU-003 | P1 | 4 |

---

## 4. Autenticación y Usuarios

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-040 | Registro con email, nombre, apellido, contraseña (min 8 caracteres, al menos 1 número y 1 mayúscula) | HU-006 | P1 | 1 |
| RF-041 | Verificación de email obligatoria con token JWT de propósito específico (no reutilizar access token) | HU-006 | P1 | 1 |
| RF-042 | Login con email y contraseña. JWT access token (15 min) en HttpOnly cookie + refresh token (7 días) | HU-006 | P1 | 1 |
| RF-043 | Auto-refresh del access token antes de expirar, transparente al usuario | HU-006 | P1 | 1 |
| RF-044 | Roles: admin, client, provider, caficultor. Middleware `requireRole()` en endpoints protegidos | HU-006 | P1 | 1 |
| RF-045 | Perfil editable: nombre, apellido, dirección, teléfono, ciudad, departamento | HU-007 | P2 | 4 |
| RF-046 | Historial de pedidos en la página de cuenta | HU-004 | P2 | 4 |

---

## 5. Trazabilidad

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-050 | El sistema debe mantener una cadena de trazabilidad completa: cosecha → almacenamiento → tostión → empaque → venta | HU-011-016 | P1 | 5 |
| RF-051 | Cada lote debe tener código único formato `DBY-YYYY-MM-XXX` | HU-011 | P1 | 5 |
| RF-052 | La página de trazabilidad (`/t/{code}`) debe mostrar timeline visual con todos los pasos del lote consultado | HU-005 | P1 | 5 |
| RF-053 | El scanner QR debe funcionar con la cámara del dispositivo móvil | HU-005 | P1 | 5 |
| RF-054 | El sistema debe generar códigos QR con URL `dobleyo.cafe/t/{LOT_CODE}` para impresión en etiquetas | HU-016 | P1 | 5 |
| RF-055 | La página de trazabilidad debe mostrar: finca, altitud, variedad, proceso, fecha cosecha, fecha tostión, perfil de tueste, puntuación SCA, empaquetador | HU-005 | P1 | 5 |
| RF-056 | La página de trazabilidad debe enlazar a la landing de la finca de origen | HU-005 | P2 | 7 |

---

## 6. Producción

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-060 | Registrar cosechas con: finca, variedad, peso, fecha, proceso, notas | HU-011 | P1 | 5 |
| RF-061 | Registrar almacenamiento de café verde con datos de humedad y secado | HU-012 | P1 | 5 |
| RF-062 | Registrar envío a tostión vinculado al lote verde original | HU-013 | P1 | 5 |
| RF-063 | Registrar resultado de tostión: perfil, temperatura, duración, peso final, merma %, first crack, second crack | HU-014 | P1 | 5 |
| RF-064 | Registrar empaquetado: peso por bolsa, cantidad bolsas, tipo empaque | HU-015 | P1 | 5 |
| RF-065 | Registrar sesión de cupping SCA: aroma, sabor, acidez, cuerpo, balance, uniformidad, limpieza, dulzura, aftertaste, overall + puntaje total | HU-017 | P1 | 5 |
| RF-066 | Dashboard de producción con métricas: lotes en proceso, producción del mes, merma promedio, cupping promedio | HU-024 | P2 | 5 |

---

## 7. Finanzas

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-070 | Plan de cuentas contable con estructura jerárquica (Colombian NIIF/IFRS) | HU-018 | P1 | 6 |
| RF-071 | Asientos contables de doble partida con validación débitos = créditos | HU-018 | P1 | 6 |
| RF-072 | Dashboard financiero: P&L por período, flujo de caja, margen por producto | HU-018 | P1 | 6 |
| RF-073 | Cálculo de costo por kg producido: materia prima + mano de obra + costos fijos + merma | HU-018 | P1 | 6 |
| RF-074 | Registro de gastos con categorización y aprobación | HU-019 | P1 | 6 |
| RF-075 | Presupuestos por período con comparativo vs ejecución real | HU-020 | P2 | 6 |
| RF-076 | Facturas de venta y compra con trazabilidad a asientos contables | HU-018 | P2 | 6 |
| RF-077 | Exportación de reportes financieros a CSV/PDF | HU-018 | P3 | 6 |

---

## 8. Fincas y Caficultores

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-080 | Tabla `farms` con: nombre, slug, región, departamento, altitud, coordenadas, descripción, historia, variedades, procesos, certificaciones, imágenes, datos del caficultor | HU-021 | P1 | 7 |
| RF-081 | Landing page dinámica `/finca/{slug}` con hero (foto + nombre + altitud + región), sección caficultor, galería, mapa, cafés de la finca | HU-021 | P1 | 7 |
| RF-082 | CRUD de fincas en panel admin con preview | HU-022 | P1 | 7 |
| RF-083 | Vinculación finca → lotes → productos en tienda con badge clickeable | HU-022 | P2 | 7 |

---

## 9. Mapa de Calor

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-090 | Mapa de calor Leaflet combinando ventas web directas + MercadoLibre | HU-023 | P1 | 8 |
| RF-091 | Filtros: período (7/30/90 días, custom), canal (web/ML), producto | HU-023 | P1 | 8 |
| RF-092 | Panel de análisis: Top 10 barrios, zonas sin cobertura, tendencia por zona | HU-023 | P2 | 8 |
| RF-093 | Geocodificación de direcciones de órdenes al momento de creación | HU-023 | P1 | 4 |
| RF-094 | Exportación de datos del mapa a CSV | HU-023 | P3 | 8 |

---

## 10. Panel de Administración

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-100 | Dashboard con KPIs: ventas día/semana/mes, órdenes pendientes, stock bajo, cupping promedio | HU-024 | P1 | 10 |
| RF-101 | CRUD de productos conectado a BD (eliminar versión localStorage) | HU-025 | P1 | 10 |
| RF-102 | Gestión de órdenes: lista filtrable, detalle, cambio de estado, timeline | HU-026 | P1 | 10 |
| RF-103 | Gestión de usuarios: lista, roles, verificación, activar/desactivar | HU-027 | P1 | 10 |
| RF-104 | Gestión de inventario conectado a BD | HU-024 | P1 | 10 |
| RF-105 | Blog con editor rich-text conectado a BD (eliminar versión localStorage) | HU-024 | P2 | 10 |
| RF-106 | Sidebar colapsable, breadcrumbs, notificaciones | HU-024 | P2 | 10 |
| RF-107 | Responsive para uso en tablet (768px+) | HU-024 | P2 | 10 |

---

## 11. Compliance Legal Colombia

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-110 | Página de política de privacidad y tratamiento de datos (Ley 1581 de 2012) | HU-028 | P1 | 3 |
| RF-111 | Página de términos y condiciones de compra con derecho de retracto 5 días (Ley 1480 de 2011) | HU-030 | P1 | 3 |
| RF-112 | Banner de consentimiento de cookies con aceptar/rechazar/personalizar | HU-029 | P1 | 3 |
| RF-113 | Checkbox de aceptación de términos obligatorio en registro y checkout | HU-030 | P1 | 3 |
| RF-114 | Información del vendedor visible: razón social, NIT, dirección, teléfono, email | HU-030 | P1 | 3 |
| RF-115 | Formulario de PQRS (Peticiones, Quejas, Reclamos, Sugerencias) | HU-031 | P1 | 3 |
| RF-116 | Enlace a la SIC (Superintendencia de Industria y Comercio) en el footer | HU-031 | P2 | 3 |

---

## 12. Internacionalización

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-120 | Sistema de i18n con archivos JSON de traducciones (es.json, en.json) | HU-032 | P1 | 9 |
| RF-121 | Todas las páginas públicas traducidas al inglés bajo `/en/` | HU-009 | P1 | 9 |
| RF-122 | Selector de idioma visible en header con persistencia | HU-032 | P1 | 9 |
| RF-123 | `<html lang>` dinámico según idioma | HU-032 | P1 | 9 |
| RF-124 | `hreflang` tags en todas las páginas con alternativa de idioma | HU-032 | P1 | 9 |
| RF-125 | Precios en USD para versión inglés/USA | HU-009 | P1 | 9 |
| RF-126 | Página de envíos internacionales con tabla de tiempos y costos por destino | HU-010 | P1 | 9 |

---

## 13. SEO

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-130 | Sitemap.xml dinámico generado automáticamente | HU-033 | P1 | 11 |
| RF-131 | robots.txt con reglas de crawling | HU-033 | P1 | 11 |
| RF-132 | JSON-LD structured data: Product, Organization, BreadcrumbList en páginas relevantes | HU-033 | P1 | 11 |
| RF-133 | Open Graph y Twitter Card meta tags en todas las páginas públicas | HU-033 | P1 | 11 |
| RF-134 | Canonical URLs en todas las páginas | HU-033 | P1 | 11 |
| RF-135 | Alt text descriptivo en todas las imágenes | HU-033 | P1 | 11 |
| RF-136 | Heading hierarchy correcta: un solo h1 por página, sin saltos (h1→h2→h3) | HU-033 | P1 | 11 |

---

## 14. Seguridad

| ID | Requisito | HU | Prioridad | Fase |
|---|---|---|---|---|
| RF-140 | Content Security Policy habilitado en Helmet | HU-035 | P1 | 11 |
| RF-141 | CSRF tokens en formularios de estado mutante | HU-035 | P1 | 11 |
| RF-142 | Auth tokens exclusivamente en HttpOnly cookies (eliminar patrón localStorage) | HU-035 | P1 | 1 |
| RF-143 | Rate limiting en endpoints de auth, webhooks y formularios públicos | HU-035 | P1 | 1 |
| RF-144 | `npm audit` sin vulnerabilidades críticas antes de cada release | HU-035 | P1 | 12 |
| RF-145 | Endpoint `/api/debug-env` eliminado en producción | HU-035 | P1 | 11 |
| RF-146 | Backups automáticos de BD con procedimiento de recovery documentado | HU-035 | P1 | 11 |
