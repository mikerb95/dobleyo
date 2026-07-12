// Suscripción de café — DobleYo Café
// Tokeniza la tarjeta directamente contra Wompi (la tarjeta NUNCA pasa por
// nuestro servidor) y luego crea la suscripción vía /api/subscriptions.
function initSuscripcion() {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const form = $('#subForm');
  if (!form || form.dataset.jsInit) return;
  form.dataset.jsInit = '1';

  const fmt = (n) => '$' + Number(n).toLocaleString('es-CO');

  let wompi = null; // { public_key, api_base, acceptance_token, accept_personal_auth, permalink, discount_percent }
  let freq = 30;

  // ─── Cargar tokens de aceptación + config de Wompi ─────────────────────────
  async function loadAcceptance() {
    try {
      const res = await fetch('/api/subscriptions/acceptance');
      const json = await res.json();
      if (json.success) {
        wompi = json.data;
        const link = $('#acceptLink');
        if (link && wompi.permalink) link.href = wompi.permalink;
        updateSummary();
      }
    } catch (_) { /* se reintenta al enviar */ }
  }

  // ─── Resumen de precio ─────────────────────────────────────────────────────
  function selectedCoffee() { return $('input[name="coffee"]:checked'); }

  function updateSummary() {
    const c = selectedCoffee();
    const qty = Math.max(1, parseInt($('#subQty').value, 10) || 1);
    const price = c ? Number(c.dataset.price) : 0;
    const discount = wompi ? Number(wompi.discount_percent || 0) : 0;
    const total = Math.round((price * qty * (100 - discount)) / 100);
    $('#sumDiscount').textContent = String(discount);
    $('#sumTotal').textContent = fmt(total);
    $('#sumNote').textContent = `Primer cobro hoy, luego cada ${freq} días. Cancele cuando quiera.`;
  }

  // ─── Interacciones ─────────────────────────────────────────────────────────
  $('#subCoffees')?.addEventListener('change', () => {
    document.querySelectorAll('.sub-coffee').forEach((el) =>
      el.classList.toggle('active', el.querySelector('input').checked));
    updateSummary();
  });
  $('#subQty')?.addEventListener('input', updateSummary);
  $('#subFreq')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.sub-toggle__btn');
    if (!btn) return;
    freq = parseInt(btn.dataset.freq, 10);
    document.querySelectorAll('.sub-toggle__btn').forEach((b) => b.classList.toggle('active', b === btn));
    updateSummary();
  });

  // ─── Helpers de mensaje ────────────────────────────────────────────────────
  function showMsg(text, type) {
    const el = $('#subMsg');
    el.textContent = text;
    el.className = 'sub-msg ' + type;
    el.style.display = '';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ─── Tokenización de tarjeta en Wompi ──────────────────────────────────────
  async function tokenizeCard() {
    const raw = $('#ccExp').value.trim();
    const m = raw.match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (!m) throw new Error('Fecha de vencimiento inválida (use MM/AA).');
    const body = {
      number: $('#ccNum').value.replace(/\s+/g, ''),
      exp_month: m[1],
      exp_year: m[2],
      cvc: $('#ccCvc').value.trim(),
      card_holder: $('#ccName').value.trim(),
    };
    const res = await fetch(`${wompi.api_base}/v1/tokens/cards`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wompi.public_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json?.data?.id) {
      const reason = json?.error?.messages ? JSON.stringify(json.error.messages) : 'Tarjeta rechazada';
      throw new Error('No se pudo validar la tarjeta: ' + reason);
    }
    return json.data.id;
  }

  // ─── Envío ─────────────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = $('#subSubmit');

    if (!$('#subAccept').checked) { showMsg('Debe aceptar el reglamento y el cobro recurrente.', 'error'); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!wompi) { await loadAcceptance(); if (!wompi) { showMsg('Pagos no disponibles. Intente más tarde.', 'error'); return; } }

    submit.disabled = true;
    submit.textContent = 'Procesando…';
    try {
      const cardToken = await tokenizeCard();

      const payload = {
        productId: selectedCoffee().value,
        quantity: parseInt($('#subQty').value, 10) || 1,
        frequencyDays: freq,
        customerName: $('#cName').value.trim(),
        customerEmail: $('#cEmail').value.trim(),
        customerPhone: $('#cPhone').value.trim(),
        shippingAddress: $('#cAddr').value.trim(),
        shippingCity: $('#cCity').value.trim(),
        shippingDepartment: $('#cDept').value.trim(),
        cardToken,
        acceptanceToken: wompi.acceptance_token,
        acceptPersonalAuth: wompi.accept_personal_auth,
      };

      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || (json.errors && json.errors[0]?.msg) || 'No se pudo crear la suscripción.');
      }

      const st = json.data.charge?.status;
      if (st === 'APPROVED') {
        showMsg('¡Suscripción activada! Su primer pedido está en camino. Recibirá un correo de confirmación.', 'success');
      } else if (st === 'PENDING') {
        showMsg('Suscripción registrada. Estamos confirmando el primer pago; le avisaremos por correo.', 'success');
      } else {
        showMsg('La tarjeta fue rechazada en el primer cobro. Verifique los datos e intente de nuevo.', 'error');
        submit.disabled = false;
        submit.textContent = 'Suscribirme';
        return;
      }
      form.reset();
      submit.textContent = 'Suscripción creada';
    } catch (err) {
      showMsg(err.message || 'Error al procesar la suscripción.', 'error');
      submit.disabled = false;
      submit.textContent = 'Suscribirme';
    }
  });

  loadAcceptance();
  updateSummary();
}

initSuscripcion();
document.addEventListener('astro:page-load', initSuscripcion);
