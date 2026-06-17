/** Confirmación de pedido. Externalizado por CSP estricta (sin 'unsafe-inline'). */
(function () {
  function fmt(n) {
    return "$" + Number(n || 0).toLocaleString("es-CO");
  }

  const STATES = ["stateLoading", "statePaid", "statePending", "stateError", "stateNotFound"];
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

  async function loadOrder(ref) {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(ref)}`);
      if (res.status === 404) {
        showState("stateNotFound");
        return;
      }
      if (!res.ok) throw new Error("Network error");

      const data = await res.json();
      if (!data.success) {
        showState("stateNotFound");
        return;
      }

      const order = data.data;
      const s = order.status;

      if (["paid", "processing", "shipped", "delivered"].includes(s)) {
        renderOrderCard(order, "orderDetails");
        showState("statePaid");
      } else if (s === "pending_payment") {
        renderOrderCard(order, "orderDetailsPending");
        showState("statePending");
      } else {
        showState("stateError");
      }
    } catch {
      showState("stateError");
    }
  }

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") || params.get("reference");
  if (!ref) showState("stateNotFound");
  else loadOrder(ref);
})();
