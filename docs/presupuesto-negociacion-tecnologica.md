# Apéndices: Presupuesto de Elaboración y Marco de Negociación Tecnológica
## Proyecto: DobleYo Café — Plataforma de Comercio Electrónico de Café de Especialidad

---

## Plantilla 1. Datos Generales del Proyecto

| Campo | Respuesta |
|---|---|
| **Nombre del proyecto** | DobleYo Café |
| **Problema o necesidad que atiende** | Los productores y comercializadores de café de especialidad colombiano carecen de una plataforma digital integrada que unifique la venta directa (B2C Colombia y B2B/B2C USA), la trazabilidad completa del grano (finca → cosecha → tostión → empaque → venta mediante código QR), la gestión de producción y el control financiero en un único sistema. |
| **Producto de software a construir** | Aplicación web SSR con cinco módulos: (1) Tienda online con carrito, checkout y pasarelas de pago; (2) Pipeline de producción (cosecha, almacenamiento verde, tostión, recibo tostado, empaque, etiquetado); (3) Trazabilidad con QR en empaque; (4) Módulo financiero con contabilidad de doble partida; (5) Panel Admin/ERP con inventario, lotes, usuarios, ventas y mapa de calor. |
| **Duración total del proyecto** | 24 semanas (12 sprints de 2 semanas cada uno) |
| **Número de sprints** | 12 |
| **Duración de cada sprint** | 2 semanas |
| **Moneda utilizada** | Peso colombiano (COP). Tasa de referencia: $4.150 COP/USD |
| **Supuestos principales del presupuesto** | (1) Un solo desarrollador full-stack (Mike Rodríguez) asume todos los roles funcionales a $80.000/hora. (2) Promedio de 22,5 horas de trabajo por semana. (3) La inteligencia artificial (Claude Pro) se registra como herramienta tecnológica, no como rol de personal. (4) Los costos tecnológicos se calculan para 6 meses continuos de operación. (5) No se incluyen costos de oficina ni equipos de cómputo (ya disponibles). (6) La contingencia del 15 % cubre cambios de alcance, integraciones de pago y variaciones en precios de servicios cloud. |

---

## Plantilla 2. Cronograma de Sprints y Entregables

| Sprint | Fase | Fechas | Historias / Módulos | Entregable verificable | Responsables | Dependencia tecnológica |
|---|---|---|---|---|---|---|
| S1 | F0 — Documentación base | 25 ago – 05 sep 2025 | Arquitectura del sistema, convenciones de código, schema SQL, estructura de carpetas, CLAUDE.md, AGENTS.md | Repositorio inicializado, schema completo (35+ tablas), documentación técnica aprobada | Mike Rodríguez (PO/Dev) | Node.js 20, Git/GitHub, VS Code, Turso (cuenta), Vercel (proyecto enlazado) |
| S2 | F1 — Tienda online | 08 sep – 19 sep 2025 | Catálogo de productos, carrito (localStorage), homepage con hero video, página de productos, layout público | Homepage publicada, catálogo funcional, carrito operativo, deploy en Vercel con dominio dobleyo.cafe | Mike Rodríguez (PO/Dev) | Astro 5, React 19, Express 4, Vercel Pro, dominio .cafe, CSS variables |
| S3 | F2 — App móvil / Pipeline de producción | 22 sep – 03 oct 2025 | Cosecha, almacenamiento verde, envío a tostión, recibo tostado, almacén tostado, empaque, generación de etiquetas QR | Pipeline completo funcionando: 7 etapas de producción con formularios y endpoints API validados | Mike Rodríguez (PO/Dev) | Turso (libSQL), Express routes, AdminLayout, AppLayout, JWT auth |
| S4 | F3 — Legal y PQRS | 06 oct – 17 oct 2025 | Términos y condiciones, política de privacidad, formulario de contacto PQRS, aviso de cookies | Páginas legales publicadas con SEO, formulario de contacto con envío por Resend | Mike Rodríguez (PO/Dev) | Resend (email), Astro SSR, Head component con canonical URLs |
| S5 | F4 — Pagos | 20 oct – 31 oct 2025 | Checkout con Wompi (Colombia), integración MercadoPago (futuro USA), flujo de confirmación de orden, emails de confirmación | Pago exitoso end-to-end en ambiente de pruebas, email de confirmación enviado, orden registrada en BD | Mike Rodríguez (PO/Dev) | Wompi SDK, MercadoPago API, Resend, Turso (tabla orders), HTTPS/SSL |
| S6 | F5 — Trazabilidad QR | 03 nov – 14 nov 2025 | Scanner QR en empaque, búsqueda manual de lotes, página /t/[code], historial completo del lote | QR imprimible enlazado a URL pública de trazabilidad, datos reales desde BD por código de lote | Mike Rodríguez (PO/Dev) | Turso (lots + pipeline tables), Astro SSR, generated_labels table, QR library |
| S7 | F6 — Finanzas / Contabilidad | 17 nov – 28 nov 2025 | Plan de cuentas (doble partida), asientos contables, facturación (ventas y compras), pagos multi-factura, presupuestos | Dashboard financiero con KPIs reales, asientos automáticos al registrar ventas, exportación de informes | Mike Rodríguez (PO/Dev) | Turso (accounting_accounts, accounting_entries, invoices, budgets), AdminLayout |
| S8 | F7 — Fincas / Caficultores | 01 dic – 12 dic 2025 | Landing pages de fincas con slug, galería de imágenes, datos del caficultor, certificaciones, mapa de ubicación | Páginas /finca/[slug] publicadas con SEO individual por finca, datos desde BD | Mike Rodríguez (PO/Dev) | Astro SSR, Turso (farms table), Leaflet (mapa), schema.sql fincas |
| S9 | F8 — Heatmap de ventas | 15 dic – 26 dic 2025 | Integración MercadoLibre (sync órdenes), geocodificación de ventas, mapa de calor interactivo en panel admin | Mapa de calor funcional con datos reales de ML, KPIs de ventas en tiempo real | Mike Rodríguez (PO/Dev) | MercadoLibre API, Leaflet + leaflet.heat, Turso (sales_tracking), React component |
| S10 | F9 — Internacionalización / USA | 05 ene – 16 ene 2026 | Versión en inglés (en.dobleyo.cafe), landing B2B para USA, i18n con archivos es.json/en.json, subdomain routing | Sitio en inglés publicado en en.dobleyo.cafe con SEO en inglés, hreflang configurado | Mike Rodríguez (PO/Dev) | Vercel subdomain routing, i18n JSON, Astro `lang` dinámico, vercel.json rewrites |
| S11 | F10 — Admin / ERP completo | 19 ene – 30 ene 2026 | Panel admin rediseñado: inventario (verde/tostado/empaque/etiquetas), lotes, usuarios, ventas, auditoría, estadísticas, producción | Panel admin 100 % operativo con sistema de diseño unificado, todos los CRUD funcionales y con datos reales | Mike Rodríguez (PO/Dev) | Todos los endpoints API, Turso, React components (InventarioApp, SalesTable, RoastForm), CSS design system |
| S12 | F11+F12 — SEO/Seguridad/CI/CD | 02 feb – 13 feb 2026 | Hardening de seguridad (OWASP), optimización Core Web Vitals, structured data JSON-LD, pipelines CI/CD con GitHub Actions, monitoreo | Lighthouse score ≥ 90, tests automatizados en CI, deploy automático a producción en merge a main | Mike Rodríguez (PO/Dev) | GitHub Actions, Playwright (E2E), Vitest (unitarias), Vercel CLI, helmet, rate-limit |

---

## Plantilla 3. Presupuesto por Rol y Sprint

> **Nota metodológica:** Mike Rodríguez ejerce todos los roles funcionales en este proyecto. Las horas se distribuyen por área funcional para reflejar el esfuerzo real en cada dimensión del trabajo. Tarifa única: **$80.000 / hora** para todos los roles.

### Parte A — Sprints 1 a 6

| Rol | Tarifa/h | H S1 | Costo S1 | H S2 | Costo S2 | H S3 | Costo S3 | H S4 | Costo S4 | H S5 | Costo S5 | H S6 | Costo S6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Product Owner / Analista | $80.000 | 3 | $240.000 | 6 | $480.000 | 6 | $480.000 | 2 | $160.000 | 5 | $400.000 | 5 | $400.000 |
| Desarrollador Backend | $80.000 | 10 | $800.000 | 24 | $1.920.000 | 24 | $1.920.000 | 8 | $640.000 | 20 | $1.600.000 | 20 | $1.600.000 |
| Desarrollador Frontend | $80.000 | 9 | $720.000 | 21 | $1.680.000 | 21 | $1.680.000 | 7 | $560.000 | 18 | $1.440.000 | 18 | $1.440.000 |
| Tester QA | $80.000 | 2 | $160.000 | 6 | $480.000 | 6 | $480.000 | 2 | $160.000 | 5 | $400.000 | 5 | $400.000 |
| DevOps / Infraestructura | $80.000 | 1 | $80.000 | 3 | $240.000 | 3 | $240.000 | 1 | $80.000 | 2 | $160.000 | 2 | $160.000 |
| **Subtotal sprint** | | **25** | **$2.000.000** | **60** | **$4.800.000** | **60** | **$4.800.000** | **20** | **$1.600.000** | **50** | **$4.000.000** | **50** | **$4.000.000** |

### Parte B — Sprints 7 a 12

| Rol | Tarifa/h | H S7 | Costo S7 | H S8 | Costo S8 | H S9 | Costo S9 | H S10 | Costo S10 | H S11 | Costo S11 | H S12 | Costo S12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Product Owner / Analista | $80.000 | 5 | $400.000 | 4 | $320.000 | 3 | $240.000 | 4 | $320.000 | 6 | $480.000 | 4 | $320.000 |
| Desarrollador Backend | $80.000 | 22 | $1.760.000 | 16 | $1.280.000 | 14 | $1.120.000 | 16 | $1.280.000 | 24 | $1.920.000 | 18 | $1.440.000 |
| Desarrollador Frontend | $80.000 | 20 | $1.600.000 | 14 | $1.120.000 | 13 | $1.040.000 | 14 | $1.120.000 | 21 | $1.680.000 | 16 | $1.280.000 |
| Tester QA | $80.000 | 5 | $400.000 | 4 | $320.000 | 3 | $240.000 | 4 | $320.000 | 6 | $480.000 | 4 | $320.000 |
| DevOps / Infraestructura | $80.000 | 3 | $240.000 | 2 | $160.000 | 2 | $160.000 | 2 | $160.000 | 3 | $240.000 | 3 | $240.000 |
| **Subtotal sprint** | | **55** | **$4.400.000** | **40** | **$3.200.000** | **35** | **$2.800.000** | **40** | **$3.200.000** | **60** | **$4.800.000** | **45** | **$3.600.000** |

### Parte C — Totales por Rol (todos los sprints)

| Rol | Tarifa/h | Total Horas | Total Costo |
|---|---|---|---|
| Product Owner / Analista | $80.000 | 53 h | $4.240.000 |
| Desarrollador Backend | $80.000 | 216 h | $17.280.000 |
| Desarrollador Frontend | $80.000 | 192 h | $15.360.000 |
| Tester QA | $80.000 | 52 h | $4.160.000 |
| DevOps / Infraestructura | $80.000 | 27 h | $2.160.000 |
| **TOTAL TALENTO HUMANO** | | **540 h** | **$43.200.000** |

---

## Plantilla 4. Costos Tecnológicos y Licencias

| Concepto | Proveedor / Herramienta | Sprint asociado | Cantidad | Costo unitario | Subtotal | Justificación |
|---|---|---|---|---|---|---|
| Vercel Pro (hosting, deploy, CDN) | Vercel | S1 – S12 | 6 meses | $83.000 / mes | $498.000 | Alojamiento del frontend Astro y funciones serverless. Incluye dominios custom (dobleyo.cafe, en.dobleyo.cafe), analytics básico, preview deployments por PR y SLA de disponibilidad. |
| Turso Scaler (base de datos libSQL) | Turso.io | S1 – S12 | 6 meses | $120.000 / mes | $720.000 | Base de datos SQLite distribuida para todos los módulos del sistema (35+ tablas). Plan Scaler: hasta 500 DBs, 30 GB storage, réplicas edge, soporte vía Discord y tickets. |
| Claude Pro (IA de desarrollo) | Anthropic | S1 – S12 | 6 meses | $83.000 / mes | $498.000 | Herramienta de asistencia en generación de código, revisión de arquitectura, escritura de queries SQL y resolución de bugs. Reduce significativamente el tiempo de desarrollo individual. |
| GitHub Pro (repositorio privado + CI) | GitHub | S1 – S12 | 6 meses | $17.000 / mes | $102.000 | Repositorio privado, historial ilimitado (1.585+ commits), GitHub Actions para CI/CD en Fase 12, code review con pull requests. |
| Resend (correo transaccional) | Resend | S1 – S12 | 6 meses | $0 / mes | $0 | Plan gratuito: hasta 3.000 emails/mes. Cubre verificación de correo, confirmaciones de orden y contacto PQRS en el volumen actual del MVP. |
| Dominio dobleyo.cafe | Cloudflare Registrar | S12 | 1 año | $80.000 | $80.000 | Dominio premium .cafe para posicionamiento de marca en el sector cafetero. SSL/TLS gestionado automáticamente por Vercel. |
| **SUBTOTAL TECNOLÓGICO** | | | | | **$1.898.000** | |

---

## Plantilla 5. Resumen Financiero del Proyecto

| Concepto | Valor |
|---|---|
| Subtotal talento humano (540 h × $80.000/h) | $43.200.000 |
| Subtotal herramientas, licencias e infraestructura | $1.898.000 |
| Subtotal pruebas, capacitación y documentación | $0 *(incluido en las horas de talento humano de QA y PO)* |
| **Subtotal general antes de contingencia** | **$45.098.000** |
| Porcentaje de contingencia aplicado | 15 % |
| Valor de contingencia | $6.764.700 |
| **Total estimado del proyecto** | **$51.862.700** |

> **Lectura del presupuesto:** El talento humano representa el 83,3 % del presupuesto ($43.200.000), lo que es esperado en proyectos de software con un único desarrollador senior. Los costos tecnológicos son contenidos ($1.898.000 = 3,7 %) gracias a la selección de servicios con planes escalables de bajo costo inicial. La contingencia del 15 % ($6.764.700) está dimensionada para absorber los riesgos de las integraciones con plataformas externas (Wompi, MercadoPago, MercadoLibre) y la complejidad del módulo financiero de doble partida.

---

## Plantilla 6. Matriz de Negociación Tecnológica

> **Situación de negociación:** Para la capa de base de datos del sistema se evaluaron dos alternativas: **Turso (libSQL/SQLite distribuido)** vs **Supabase (PostgreSQL + auth + storage)**.

| Aspecto | Condición requerida | Turso — Scaler ($29 USD/mes) | Supabase — Pro ($25 USD/mes) | Decisión o acuerdo |
|---|---|---|---|---|
| **Alcance tecnológico** | Base de datos relacional compatible con Vercel, sin cold starts, multi-región | Base de datos SQLite distribuida con réplicas edge automáticas. Compatible con cualquier framework JS vía `@libsql/client`. | PostgreSQL completo + Auth integrado + Storage de archivos + Realtime + Edge Functions incluidas en el plan. | Turso ofrece el alcance exacto requerido (BD relacional). Supabase incluye más funciones no requeridas actualmente. |
| **Licenciamiento** | Pago mensual, cancelable, sin contrato mínimo | $29 USD/mes (~$120.000 COP). Sin contrato mínimo. Cancelación inmediata. | $25 USD/mes (~$104.000 COP). Sin contrato mínimo. Cancelación inmediata. | Supabase es ligeramente más económico; Turso es aceptable dado el diferencial de $4 USD. |
| **Soporte** | Documentación completa + canal de soporte activo | Documentación oficial, Discord activo, tickets vía panel. Tiempo de respuesta: 24-48 h. | Documentación extensa, foro GitHub Discussions, tickets (respuesta en horas en Pro). | Ambos tienen soporte equivalente. Turso tiene comunidad más pequeña pero respuestas técnicas directas. |
| **Disponibilidad / SLA** | ≥ 99,9 % uptime documentado | 99,9 % SLA documentado. Mantenimiento programado con aviso previo. | 99,9 % SLA en plan Pro. Estado en status.supabase.com. | Equivalente. Ambos cumplen el requisito mínimo del proyecto. |
| **Seguridad y datos** | TLS en tránsito, autenticación, datos en región controlada | TLS obligatorio, tokens de autenticación por base de datos, datos alojados en Fly.io (USA/EU). | TLS, Row Level Security (RLS) nativo en PostgreSQL, MFA, cumplimiento SOC 2, datos en AWS. | Supabase es más robusto en seguridad y cumplimiento normativo. Turso es suficiente para el alcance actual. |
| **Escalabilidad** | Crecer en usuarios, storage y transacciones sin reconfiguración | Réplicas edge automáticas, sin límite de lecturas, escala horizontal sin cambio de código. | Compute adicional desde +$10 USD/mes, read replicas disponibles, branching para preview envs. | Turso escala mejor en lectura distribuida. Supabase escala mejor en compute y workloads complejos. |
| **Pagos y renovación** | Facturación predecible, sin costos ocultos por uso moderado | Factura mensual fija en plan Scaler. Ancho de banda y storage incluidos hasta el límite del plan. | Factura mensual base + cargos variables por compute excedente y egress. | Turso tiene costo más predecible. Supabase puede generar cargos variables si crece el tráfico. |
| **Propiedad intelectual y datos** | Exportación completa de datos en cualquier momento | Exportación vía SQL dump estándar, compatible con cualquier SQLite. Sin lock-in. | Exportación vía pg_dump estándar de PostgreSQL. Sin lock-in de proveedor. | Ambos permiten exportación total. Sin restricciones contractuales sobre los datos del usuario. |

### Conclusión de negociación

**Se seleccionó Turso** como proveedor de base de datos por las siguientes razones: (1) compatibilidad nativa con el entorno de Vercel edge, eliminando cold starts en las funciones serverless; (2) uso del driver `@libsql/client` ya integrado en el proyecto; (3) sintaxis SQL compatible con SQLite (`?` posicional, `datetime('now')`) que simplifica las queries frente a PostgreSQL; (4) costo predecible sin cargos variables. Supabase sería la alternativa recomendada si el proyecto requiriera autenticación OAuth nativa, almacenamiento de archivos multimedia o workloads transaccionales muy intensivos en el futuro.

**Condiciones mínimas negociadas:** precio mensual fijo de $29 USD, cancelación sin penalidad, exportación de datos en cualquier momento, soporte vía Discord y tickets, SLA 99,9 %, cifrado TLS en tránsito.

---

## Plantilla 7. Riesgos Económicos y Contingencia

| Riesgo | Impacto en costo | Probabilidad | Medida de control | Reserva sugerida |
|---|---|---|---|---|
| Cambio de alcance en módulos de pago (Wompi/MercadoPago) por cambios en API del proveedor o requisitos regulatorios | Alto | Media | Usar SDKs oficiales y ambientes de sandbox. Mantener contrato API versionado. Sprint de pagos con margen de pruebas ampliado. | $2.000.000 |
| Aumento de horas en módulo financiero (contabilidad de doble partida) por mayor complejidad contable de la que se estimó | Alto | Baja | Estimación conservadora ya aplicada (+10 h vs promedio). Revisar alcance con contador antes del sprint 7. | $1.500.000 |
| Incremento de precios en servicios cloud (Vercel, Turso) o cambio de planes | Bajo | Baja | Monitoreo mensual de costos. Alertas de consumo configuradas. Alternativas documentadas (Supabase, Railway). | $400.000 |
| Problemas de compatibilidad entre Astro 5 y el adaptador de Vercel en actualizaciones de versión | Medio | Baja | Fijar versiones en package.json. Revisar changelogs antes de actualizar. Preview deployments para validar antes de producción. | $500.000 |
| Más defectos de calidad de los previstos en integración con MercadoLibre (geocodificación, sync de órdenes) | Medio | Media | Pruebas con datos reales en ambiente de staging. Suite de tests con Vitest + Playwright implementada en sprint 12. | $1.500.000 |
| Sobrecosto en dominio .cafe o necesidad de dominios adicionales (.co, .com) | Bajo | Baja | Presupuestar solo dobleyo.cafe inicialmente. Evaluar dominios adicionales según crecimiento. | $160.000 |
| **Total de reservas por riesgo** | | | | **$6.060.000** |

> La contingencia del 15 % calculada ($6.764.700) cubre holgadamente el total de reservas por riesgo identificadas ($6.060.000), confirmando que el porcentaje es adecuado para el perfil de riesgo del proyecto.

---

## Plantilla 8. Conclusión de Viabilidad Económica

El proyecto **DobleYo Café** es económicamente viable con un costo total estimado de **$51.862.700 COP** para doce sprints de desarrollo ejecutados en veinticuatro semanas. El mayor costo se concentra en el talento humano, que representa el 83,3 % del presupuesto total ($43.200.000), ejecutado íntegramente por un desarrollador full-stack senior con tarifa de $80.000 por hora, quien asume los roles de Product Owner, desarrollador backend y frontend, tester QA y DevOps. Los sprints de mayor inversión son S2 (Tienda online), S3 (App móvil de producción), S7 (Finanzas/contabilidad) y S11 (Admin/ERP), con costos individuales de $4.400.000 a $4.800.000, por tratarse de los módulos más complejos en lógica de negocio e integración. Los costos tecnológicos son moderados ($1.898.000, equivalente al 3,7 % del presupuesto), gracias a la selección de servicios cloud con planes escalables de bajo costo: Vercel Pro para despliegue, Turso Scaler para la base de datos, Claude Pro como herramienta de desarrollo asistido por IA y GitHub Pro para el repositorio y CI/CD, con Resend en plan gratuito para correo transaccional. La contingencia del 15 % ($6.764.700) está bien dimensionada para cubrir los principales riesgos identificados: cambios en las APIs de pasarelas de pago (Wompi, MercadoPago), mayor complejidad en el módulo contable de doble partida y posibles variaciones en costos de servicios cloud. A la fecha de elaboración de este documento (junio 2026), el proyecto cuenta con ocho de doce fases completamente entregadas y en producción (F0, F1, F2, F4, F5, F6, F8 y F10), lo que valida tanto la viabilidad técnica como la disciplina de ejecución. La decisión de utilizar Turso sobre Supabase como motor de base de datos garantiza escalabilidad controlada sin costos variables impredecibles. En conclusión, el software es viable económicamente con el presupuesto estimado, el equipo disponible y la arquitectura tecnológica seleccionada.

---

## Evidencias de Precios Consultados

| Herramienta / Servicio | Fuente de verificación de precio |
|---|---|
| Vercel Pro ($20 USD/mes) | https://vercel.com/pricing |
| Turso Scaler ($29 USD/mes) | https://turso.tech/pricing |
| Claude Pro ($20 USD/mes) | https://anthropic.com/claude/pricing |
| GitHub Pro ($4 USD/mes) | https://github.com/pricing |
| Resend (plan gratuito) | https://resend.com/pricing |
| Dominio .cafe (precio anual) | https://www.cloudflare.com/products/registrar/ |

---

## Lista de Verificación

| Criterio de revisión | Cumple | Observaciones |
|---|---|---|
| El presupuesto está alineado con el Cronograma de Sprints | Sí | Cada sprint tiene horas, costos y dependencias tecnológicas específicas |
| Cada costo tiene justificación y sprint asociado | Sí | Plantillas 3 y 4 cruzan sprint, rol y justificación para cada ítem |
| Las tarifas u horas usadas son coherentes con el alcance | Sí | $80.000/h corresponde al mercado colombiano para full-stack senior. 540 h totales = 22,5 h/sem × 24 semanas |
| Se incluyen costos de herramientas, licencias o infraestructura | Sí | Plantilla 4 detalla 6 conceptos tecnológicos con proveedor, sprint, cantidad y costo |
| Se calcula subtotal, contingencia y total del proyecto | Sí | Plantilla 5: subtotal $45.098.000 + contingencia 15 % = total $51.862.700 |
| El marco de negociación contempla soporte, seguridad, datos y pagos | Sí | Plantilla 6: 8 criterios comparados entre Turso y Supabase con decisión documentada |
| La conclusión explica la viabilidad del software a construir | Sí | Plantilla 8: 12 líneas con costo total, sprints costosos, riesgos, contingencia y condiciones negociadas |
| La bibliografía y evidencias de precios son verificables | Sí | Tabla de evidencias con URLs oficiales de cada proveedor |

---

## Glosario

| Término | Definición en contexto del proyecto |
|---|---|
| **Presupuesto de elaboración** | Estimación de los recursos económicos para construir los 12 módulos del sistema DobleYo Café. |
| **Sprint** | Periodo de 2 semanas con un objetivo específico, entregables verificables y dependencias tecnológicas definidas. |
| **Entregable** | Resultado funcional producido al finalizar el sprint (p. ej. checkout operativo, pipeline de producción completo). |
| **Talento humano** | Costo del tiempo del desarrollador full-stack Mike Rodríguez en cada área funcional del sprint. |
| **Contingencia** | Reserva del 15 % sobre el subtotal para cubrir cambios de alcance, errores de estimación y riesgos tecnológicos. |
| **SLA** | Acuerdo de nivel de servicio; en Vercel y Turso define el 99,9 % de disponibilidad garantizada. |
| **Licenciamiento** | Condiciones de uso de cada herramienta (mensual, cancelable, sin contrato mínimo). |
| **TCO** | Costo total de propiedad: incluye talento, suscripciones, dominio y contingencia durante 6 meses de desarrollo. |
| **Negociación tecnológica** | Proceso de evaluación y selección de Turso sobre Supabase basado en 8 criterios técnicos, económicos y operativos. |
| **libSQL / SQLite** | Motor de base de datos de Turso, compatible con SQLite estándar y distribuido en nodos edge globales. |
| **SSR** | Server-Side Rendering: técnica usada con Astro 5 para generar HTML en el servidor, mejorando SEO y rendimiento inicial. |
| **Edge** | Infraestructura distribuida geográficamente que ejecuta funciones cerca del usuario final, reduciendo latencia. |
