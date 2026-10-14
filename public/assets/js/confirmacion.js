/** Confirmación de pedido. Externalizado por CSP estricta (sin 'unsafe-inline'). */
function initConfirmacion() {
  const root = document.getElementById("stateLoading");
  if (!root || root.dataset.jsInit) return;
  root.dataset.jsInit = "1";

  function fmt(n) {
    return "$" + Number(n || 0).toLocaleString("es-CO");
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function fmtDate(s) {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  const SHIPMENT_LABELS = {
    created: "Guía generada",
    pickup_requested: "Esperando recogida",
    in_transit: "En camino",
    delivered: "Entregado",
    returned: "Devuelto",
  };

  function renderTracking(order) {
    const el = document.getElementById("orderTracking");
    const sh = order.shipment;
    if (!el) return;
    if (!sh || !sh.guideNumber) {
      el.hidden = true;
      return;
    }

    const title = document.getElementById("paidTitle");
    const subtitle = document.getElementById("paidSubtitle");
    const nextSteps = document.getElementById("nextSteps");
    if (sh.status === "delivered") {
      if (title) title.textContent = "¡Pedido entregado!";
      if (subtitle) subtitle.textContent = "Esperamos que disfrute su café.";
    } else {
      if (title) title.textContent = "Tu pedido va en camino";
      if (subtitle) subtitle.textContent = "Aquí puede seguir el recorrido de su envío.";
    }
    if (nextSteps) nextSteps.style.display = "none";

    const events = (sh.events || [])
      .map(
        (e) => `<li><div>
          <p class="tr-events__state">${esc(e.update_state)}</p>
          <p class="tr-events__meta">${esc(fmtDate(e.event_date))}${e.description ? " · " + esc(e.description) : ""}</p>
        </div></li>`
      )
      .join("");

    el.innerHTML = `
      <div class="tr-head">
        <div>
          <h2 class="tr-title" id="trackingTitle">Seguimiento del envío</h2>
          <p class="tr-carrier">${esc(sh.carrier || "Transportadora")}</p>
        </div>
        <span class="oc-status" style="background:${statusColor("shipped")}20; color:${statusColor("shipped")}">
          ${esc(SHIPMENT_LABELS[sh.status] || statusLabel(order.status))}
        </span>
      </div>
      <div class="tr-guide">
        <div>
          <p class="tr-guide__label">Número de guía</p>
          <p class="tr-guide__number">${esc(sh.guideNumber)}</p>
        </div>
        ${sh.trackingUrl ? `<a class="tr-link" href="${esc(sh.trackingUrl)}" target="_blank" rel="noopener">Rastrear en la transportadora</a>` : ""}
      </div>
      ${events
        ? `<ol class="tr-events">${events}</ol>`
        : `<p class="tr-empty">La transportadora aún no reporta movimientos. Vuelva a consultar en unas horas.</p>`}
    `;
    el.hidden = false;
  }

  const STATES = ["stateLoading", "statePaid", "statePending", "stateError", "stateNotFound", "stateUnknown"];
  function showState(id) {
    STATES.forEach((s) => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? "block" : "none";
    });
  }

  function statusLabel(status) {
    const m = {
      paid: "Pagado",
      processing: "En proceso",
      shipped: "En camino",
      delivered: "Entregado",
      pending_payment: "Pago pendiente",
      cancelled: "Cancelado",
      refunded: "Reembolsado",
    };
    return m[status] || status;
  }

  function statusColor(status) {
    if (["paid", "processing", "shipped", "delivered"].includes(status)) return "#16a34a";
    if (status === "pending_payment") return "#d97706";
    return "#dc2626";
  }

  function renderOrderCard(order, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const items = (order.items || [])
      .map(
        (i) =>
          `<div class="oc-line">
            <span class="oc-line__name">${i.quantity}× ${i.product_name}</span>
            <span class="oc-line__price">${fmt(i.subtotal_cop)}</span>
          </div>`
      )
      .join("");

    el.innerHTML = `
      <div class="oc-header">
        <div>
          <p class="oc-ref-label">Número de pedido</p>
          <p class="oc-ref">#${order.reference}</p>
        </div>
        <span class="oc-status" style="background:${statusColor(order.status)}20; color:${statusColor(order.status)}">
          ${statusLabel(order.status)}
        </span>
      </div>
      <div class="oc-items">${items}</div>
      <div class="oc-totals">
        <div class="oc-total-line">
          <span>Envío</span>
          <span>${order.shipping_cop === 0 ? "Gratis" : fmt(order.shipping_cop)}</span>
        </div>
        <div class="oc-total-line oc-total-line--final">
          <span>Total</span>
          <span>${fmt(order.total_cop)}</span>
        </div>
      </div>
      <div class="oc-delivery">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1.5 10.5l4-8 2.5 5 2-3 2.5 6" stroke="#4a6741" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Entrega en <strong>${order.shipping_city}</strong>
      </div>
    `;
  }

  // El estado "pagado" lo pone el webhook de Wompi, que suele llegar unos
  // segundos DESPUÉS de que el cliente vuelve aquí. Mientras el pedido siga
  // pendiente se vuelve a consultar cada 3 s durante un minuto.
  const POLL_MS = 3000;
  const POLL_MAX = 20;
  let pollTimer = null;
  const stopPolling = () => { clearTimeout(pollTimer); pollTimer = null; };
  document.addEventListener("astro:before-swap", stopPolling, { once: true });

  // El carrito se vacía cuando el pago queda aprobado (no antes: si Wompi
  // rechaza la tarjeta, el cliente conserva su carrito para reintentar).
  function clearCartOnce() {
    try {
      if (window.Cart && window.Cart.clearCart) window.Cart.clearCart();
      sessionStorage.removeItem("dy_coupon");
    } catch (_) { /* almacenamiento no disponible */ }
  }

  async function loadOrder(ref, attempt = 0) {
    let res;
    try {
      res = await fetch(`/api/orders/${encodeURIComponent(ref)}`);
    } catch {
      // Sin conexión: no sabemos el estado del pago, no decir que fue rechazado
      if (attempt === 0) showState("stateUnknown");
      else schedule(ref, attempt);
      return;
    }
    if (res.status === 404) {
      showState("stateNotFound");
      return;
    }
    let data = null;
    try { data = res.ok ? await res.json() : null; } catch { data = null; }
    if (!data || !data.success) {
      if (attempt === 0) showState("stateUnknown");
      else schedule(ref, attempt);
      return;
    }

    const order = data.data;
    const s = order.status;

    if (["paid", "processing", "shipped", "delivered"].includes(s)) {
      stopPolling();
      clearCartOnce();
      renderOrderCard(order, "orderDetails");
      renderTracking(order);
      showState("statePaid");
    } else if (s === "pending_payment") {
      renderOrderCard(order, "orderDetailsPending");
      showState("statePending");
      schedule(ref, attempt);
    } else {
      stopPolling();
      showState("stateError");
    }
  }

  function schedule(ref, attempt) {
    if (attempt + 1 >= POLL_MAX) {
      // Se acabó la espera: el pedido sigue registrado y el correo llegará
      // cuando Wompi confirme. Dejamos el estado pendiente con un aviso claro.
      const sub = document.getElementById("pendingSubtitle");
      if (sub) sub.textContent = "Wompi aún no confirma el pago. Su pedido está registrado: le enviaremos un correo apenas se apruebe. Puede recargar esta página más tarde.";
      showState("statePending");
      return;
    }
    stopPolling();
    pollTimer = setTimeout(() => loadOrder(ref, attempt + 1), POLL_MS);
  }

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") || params.get("reference");
  document.getElementById("retryVerify")?.addEventListener("click", () => {
    if (!ref) return;
    showState("stateLoading");
    loadOrder(ref);
  });
  if (!ref) showState("stateNotFound");
  else loadOrder(ref);
}

initConfirmacion();
document.addEventListener("astro:page-load", initConfirmacion);
