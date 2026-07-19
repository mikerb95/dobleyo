# Plan de Remediación — Módulo de Logística y Envíos

> Auditoría realizada el 2026-07-19 sobre el flujo completo: creación de orden
> (`server/routes/orders.js`) → pago Wompi (webhook) → despacho con Mipaquete
> (`server/routes/shipping.js`, `server/services/mipaquete.js`) → tracking →
> entrega/conciliación COD.
>
> Estado general: la arquitectura es sólida (índice único parcial contra doble
> guía, patrón trigger-don't-trust en el webhook, timeouts con AbortController,
> clasificación de errores retriables). Este plan corrige los bugs encontrados,
> cierra huecos de fallback y completa la trazabilidad de logs.

---

## Resumen de hallazgos

| # | Severidad | Hallazgo | Archivo |
|---|---|---|---|
| A1 | 🔴 Crítico | Webhook Wompi retorna sin respuesta HTTP → request colgada, reintentos de Wompi | `server/routes/orders.js:628` |
| A2 | 🔴 Crítico | Órdenes USD nunca pasan a `paid`: el webhook valida monto como COP y rechaza `currency !== 'COP'` | `server/routes/orders.js:592-596` |
| A3 | 🔴 Crítico | Creación de orden + ítems sin transacción → órdenes sin ítems si falla a mitad | `server/routes/orders.js:288-314` |
| A4 | 🔴 Crítico | "No entregado" / "Entrega fallida" se mapean como `delivered` (substring match) | `server/routes/shipping.js:388-396` |
| A5 | 🔴 Crítico | COD: `collection_value_cop` nunca se persiste (queda 0) → email informa recaudo $0 y la conciliación no tiene valor de referencia. `quoted_shipping_cost_cop` tampoco se guarda | `server/routes/shipping.js:250-258` |
| B1 | 🟠 Alto | `/shipping/create` no valida estado de la orden: permite generar guía para órdenes `pending_payment` o `cancelled` | `server/routes/shipping.js:210-244` |
| B2 | 🟠 Alto | Orden `cancelled` puede pasar a `shipped`/`delivered` (los UPDATE solo excluyen `delivered`) | `server/routes/shipping.js:355,452,464` |
| B3 | 🟠 Alto | Envío huérfano irrecuperable: si el proceso muere entre `createSending` OK y el UPDATE de `mp_code`, el shipment queda en `created` con `mp_code NULL`, bloquea la orden (índice único) y `refresh-all` lo ignora | `server/routes/shipping.js:319-331,482` |
| B4 | 🟠 Alto | Email de confirmación de pago puede perderse: si Resend falla → 500 → reintento de Wompi → idempotencia responde 200 sin reenviar | `server/routes/orders.js:651-668` |
| B5 | 🟠 Alto | Match de guía a ciegas: `getSendings({ mpCode })` toma `sendings[0]` sin verificar que corresponda al mpCode pedido | `server/routes/shipping.js:337-341,414` |
| B6 | 🟡 Medio | Órdenes `pending_payment` nunca expiran (sin TTL/limpieza) | — |
| B7 | 🟡 Medio | Checkout crea la orden aunque Wompi no esté configurado → orden impagable | `server/routes/orders.js:323`, `src/pages/checkout.astro:712` |
| C1 | 🟡 Medio | Tracking depende de que un admin abra el panel: el fallback del webhook (`refresh-all`) solo corre desde la UI | `server/routes/shipping.js:474` |
| C2 | 🟡 Medio | Sin alertas de envíos estancados (SLA por estado) | — |
| C3 | 🟡 Medio | Sin control de inventario: ni la orden ni el despacho verifican/descuentan stock | — |
| C4 | 🟢 Bajo | Órdenes USD pagadas no aparecen en ninguna cola operativa (`orders-pending` filtra `currency='COP'`) | `server/routes/shipping.js:95` |
| D1 | 🟡 Medio | Cambios de estado por webhook Wompi (el evento "pago aprobado") no pasan por `logAudit` | `server/routes/orders.js:543-675` |
| D2 | 🟢 Bajo | Rechazos antifraude COD no se loguean (tope de monto, pedidos abiertos, devoluciones previas) | `server/routes/orders.js:247-281` |
| D3 | 🟢 Bajo | Cotizaciones sin rastro: no queda registro de qué transportadoras/precios se ofrecieron vs. cuál se eligió | `server/routes/shipping.js:162-206` |
| D4 | 🟢 Bajo | `refresh-all` no persiste resumen de sus corridas | `server/routes/shipping.js:474-504` |
| D5 | 🟢 Bajo | `db/schema.sql` (fuente de verdad) no incluye `shipments`, `shipment_events` ni `dane_locations` | `db/schema.sql` |

---

## Fase A — Bugs críticos (rompen dinero o clientes)

### A1. Respuesta faltante en webhook Wompi
- En `orders.js:628`, cambiar `if (!orderResult.rows.length) return;` por
  `return res.sendStatus(200);`.
- Es una carrera improbable (la orden existía en el lookup previo), pero hoy
  deja la conexión abierta hasta el timeout de la función.

### A2. Soporte de montos USD en el webhook
- Al crear la orden, persistir el monto esperado en centavos y la moneda tal
  como se enviarán a Wompi: nuevas columnas `expected_amount_cents INTEGER` y
  reutilizar `currency` existente (migración incremental en `server/migrations/`).
- En el webhook, validar `Number(amount_in_cents) === order.expected_amount_cents`
  y `currency === order.currency` en lugar de asumir COP.
- Revisar de paso que los totales USD guardados en columnas `*_cop` queden
  documentados (o renombrar semánticamente en una fase posterior; no bloquear).

### A3. Transacción en creación de orden
- Envolver el INSERT de `customer_orders` + el loop de `customer_order_items`
  (+ el incremento de cupón COD) en `withTransaction()` de `server/db.js`.
- Sin cambios de comportamiento visible; elimina el estado "orden sin ítems"
  que hoy rompe `/shipping/:orderId/suggest` (peso 0, valor declarado 0).

### A4. Mapeo de estados de tracking robusto
- Reescribir `mapTrackingStateToStatus` en `shipping.js`:
  1. Evaluar primero negaciones y fallos: `no entregado`, `entrega fallida`,
     `intento de entrega`, `novedad` → `in_transit` (o estado nuevo `exception`,
     ver Fase C2).
  2. Luego devoluciones: `devuel`, `retorno` → `returned`.
  3. Luego `cancelado` → `cancelled`.
  4. Solo entonces `entregado` → `delivered`, exigiendo que NO venga precedido
     de negación (regex con límite de palabra, no `includes`).
- Evaluar únicamente el **último** evento de tracking (el más reciente), no el
  join de todos: hoy un histórico que contiene "entregado" en cualquier punto
  contamina el resultado.
- Test unitario con los estados reales de Coordinadora/Servientrega/Inter
  Rapidísimo (fixtures en `server/services/__tests__/`).

### A5. Persistir valores COD y costo cotizado
- En `POST /shipping/create`: agregar al INSERT
  `collection_value_cop = paymentMode === 'cod' ? declaredValueCop : 0` y
  aceptar del body `quotedShippingCostCop` (la UI ya conoce la cotización
  elegida; agregar el campo en `src/pages/admin/envios.astro`).
- El email de despacho disparado desde `refreshShipment` (línea 459) leerá
  entonces un `collection_value_cop` correcto.
- La vista de conciliación COD (`GET /api/shipping?codPending=1`) mostrará el
  valor a conciliar.

**Criterio de salida Fase A:** tests de `server/routes/__tests__/` en verde +
casos nuevos para A2/A4; una orden USD de prueba pasa a `paid` con el webhook
simulado; un tracking con "No entregado" no marca `delivered`.

---

## Fase B — Robustez del flujo de despacho (fallbacks)

### B1. Validar estado de la orden antes de crear guía
- En `POST /shipping/create` (y en `/quote`), rechazar con 422 si
  `order.status NOT IN ('paid','processing')`. Mensaje: "La orden no está en un
  estado despachable".

### B2. Proteger órdenes canceladas/reembolsadas
- Cambiar los UPDATE de `customer_orders` en `shipping.js` (líneas 355, 452,
  464) a `WHERE status NOT IN ('delivered','cancelled','refunded')`.
- Si llega tracking para una orden cancelada, loguear `warn` (indica guía que
  debió cancelarse y no se canceló → alerta operativa).

### B3. Recuperación de envíos huérfanos
- En `refresh-all`, agregar una segunda consulta: shipments en `created` con
  `mp_code IS NULL` y `created_at` > 10 minutos atrás.
- Para cada uno, buscar en Mipaquete por `productReference` (la referencia de
  la orden viaja en `productInformation.productReference` del payload):
  - Si aparece → adoptar el `mpCode` y continuar el flujo normal.
  - Si no aparece tras 2 intentos (contador en `error_detail` o columna nueva
    `recovery_attempts`) → marcar `status='error'` con detalle, liberando el
    candado del índice único para que el admin reintente.
- En `POST /create`, registrar `logAudit` también cuando el envío queda en
  `error` (hoy solo se audita el éxito).

### B4. Email de confirmación desacoplado (outbox simplificado)
- Migración: columna `confirmation_email_sent_at TEXT` en `customer_orders`.
- En el webhook Wompi: intentar el envío con `.catch()` (no tumbar el request);
  al lograrlo, estampar `confirmation_email_sent_at`.
- En el ciclo de `refresh-all` (que ya corre periódicamente al abrir el panel,
  y programado tras C1): reintentar emails de órdenes `paid` sin estampa, con
  tope de antigüedad de 48 h.
- Aplicar el mismo patrón al email COD de `POST /api/orders` (hoy solo se
  loguea el error, sin reintento).

### B5. Verificar el match de `getSendings`
- Tras `getSendings({ mpCode })`, filtrar explícitamente:
  `sendings.find(s => String(s.mpCode ?? s.mp_code ?? '') === String(mpCode))`
  con fallback a comparar `productReference` con `order.reference`. Si no hay
  match inequívoco, no adoptar guía y loguear `warn` con el payload.

### B6. Expiración de órdenes abandonadas
- Job liviano (puede vivir dentro de `refresh-all` o del endpoint de salud):
  `UPDATE customer_orders SET status='cancelled' WHERE status='pending_payment'
  AND created_at < datetime('now','-48 hours')`, con `logAudit` (actor system).
- No toca cupones (el uso se contabiliza solo al pagar, ya correcto).

### B7. No crear órdenes impagables
- En `POST /api/orders`: si `!isCod` y faltan `WOMPI_PUBLIC_KEY` o
  `WOMPI_INTEGRITY_SECRET`, responder 503 "Pagos en línea temporalmente no
  disponibles" ANTES de insertar la orden.
- En `checkout.astro`: mostrar el error y ofrecer COD si aplica, en español
  formal colombiano (tratamiento de usted).

**Criterio de salida Fase B:** simular caída entre `createSending` y el UPDATE
(mock) y verificar que `refresh-all` recupera o libera el shipment; una orden
cancelada con webhook de tracking no cambia de estado.

---

## Fase C — Operación estilo tienda grande (3PL de última milla)

> Referencia: las tiendas que operan con un tercero de última milla combinan
> (1) webhook como señal rápida, (2) polling programado como red de seguridad,
> (3) reconciliación periódica de estados y costos, y (4) alertas por SLA.
> Hoy existe (1) y un (2) manual; faltan la programación, (3) y (4).

### C1. Polling programado de tracking
- **Decisión pendiente del usuario** (los crons de Vercel pueden tener
  implicaciones de plan — no agregar sin autorización explícita):
  - Opción a: `vercel.json` cron → `POST /api/shipping/refresh-all` (proteger
    con un token de sistema tipo `CRON_SECRET`, no JWT).
  - Opción b: scheduler externo gratuito (GitHub Actions `schedule`, cron-job.org)
    golpeando el mismo endpoint con el token.
- Cadencia sugerida: cada 30–60 min en horario hábil. El presupuesto de tiempo
  (`TIME_BUDGET_MS`) y `MAX_ITEMS` ya existen y sirven tal cual.
- El endpoint debe aceptar autenticación por token de sistema además del JWT
  admin actual (mismo patrón que el webhook de Mipaquete).

### C2. Alertas de envíos estancados (SLA por estado)
- Vista en `/admin/envios`: badge "atrasado" cuando
  `pickup_requested` > 2 días, `created` sin guía > 1 día, `in_transit` > 7 días
  (calculado con `tracking_updated_at`/`created_at`, sin columnas nuevas).
- Endpoint `GET /api/shipping/stuck` que devuelva la lista (reutilizable para
  un email/resumen diario si se activa C1).
- Opcional: estado `exception` en el CHECK de `shipments.status` para novedades
  de transportadora (requiere recrear tabla en SQLite — evaluar si el badge es
  suficiente antes de migrar).

### C3. Control de inventario (fase propia, coordinada con productos)
- Al confirmarse el pago (webhook) o crearse orden COD: descontar stock por
  ítem; al cancelar/expirar: reponerlo. Registrar movimiento en el sistema de
  inventario existente (`server/routes/inventory.js`).
- En `POST /api/orders`: validar existencia disponible y rechazar con 422 si no
  alcanza ("Producto agotado").
- Esta fase toca el modelo de productos/inventario: diseñarla aparte antes de
  implementar (reserva vs. descuento directo, sobreventa permitida o no).

### C4. Cola de fulfillment manual para órdenes USD
- Nueva pestaña en `/admin/envios` (o filtro en `/orders-pending` sin el filtro
  `currency='COP'`, con columna de moneda) para que las órdenes USD pagadas
  sean visibles y despachables por fuera de Mipaquete.
- Permitir registrar guía/transportadora manual en `shipments`
  (`delivery_company_id='manual'`, sin llamadas a Mipaquete).

---

## Fase D — Trazabilidad y logging completo

### D1. Auditar el webhook Wompi
- Tras cada cambio de estado de orden en el webhook: `logAudit(null, 'update',
  'customer_orders', order.id, { reference, from, to, txId, source: 'wompi-webhook' })`.
- El pago aprobado es el evento de negocio más importante y hoy no queda en
  `audit_logs`.

### D2. Loguear rechazos antifraude COD
- En cada una de las tres validaciones COD de `orders.js` (tope de monto,
  pedidos abiertos, devolución previa): `logger.warn` estructurado + `logAudit`
  con acción `cod_rejected` y el motivo. Da visibilidad de intentos de fraude y
  de falsos positivos que estén bloqueando clientes legítimos.

### D3. Registrar cotizaciones
- Tabla ligera `shipping_quotes` (order_id, request_json, response_json,
  chosen_company_id NULL, created_by, created_at) o, más simple, un
  `shipment_events` con `source='system'` y `raw_payload` con la cotización.
- Permite auditar sobrecostos de flete contra lo cotizado (junto con A5).

### D4. Resumen persistido de `refresh-all`
- Al terminar cada corrida: `logAudit(actor, 'poll', 'shipments', 0,
  { processed, failed, durationMs, source })`. Sin tabla nueva.

### D5. Actualizar la fuente de verdad del schema
- Agregar `shipments`, `shipment_events` y `dane_locations` (con sus índices y
  trigger) a `db/schema.sql`, copiadas de
  `server/migrations/create_shipments.js`.
- Documentar el flujo de envíos en `AGENTS.md` y registrar los cambios de cada
  fase en `CHANGELOG.md`.

### D6. Endurecimiento menor del webhook Mipaquete
- El token viaja por query string (`?token=`) y puede filtrarse en logs de
  proxies/CDN. Al re-registrar el webhook (endpoint `setup-webhook`), evaluar
  si Mipaquete soporta headers custom; si no, rotar el token periódicamente y
  mantener el rate limit actual. No bloqueante.

---

## Orden de ejecución y alcance

```
Fase A (crítica, ~1 sesión)  →  Fase B (~1-2 sesiones)  →  Fase D (transversal, corta)
                                        ↓
                              Fase C (requiere decisiones del usuario:
                                      C1 cron/scheduler, C3 modelo de inventario)
```

- **A y B no requieren decisiones**: son correcciones quirúrgicas sobre código
  existente + 2 migraciones incrementales (`expected_amount_cents`,
  `confirmation_email_sent_at`).
- **C1 y C3 requieren autorización/diseño previo** antes de implementarse.
- Mantener paridad `server/index.js` ↔ `api/index.js` en cualquier endpoint
  nuevo (C2, C4) — hoy la paridad está correcta para orders/shipping.
- Todos los textos de UI/errores nuevos en español formal colombiano (usted).
