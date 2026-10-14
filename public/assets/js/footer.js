/**
 * Footer global: suscripción al newsletter y columnas plegables en móvil.
 * Externalizado (servido desde 'self') para cumplir la CSP estricta sin 'unsafe-inline'.
 */
function initNewsletterFooter() {
  const form = document.getElementById("newsletterForm");
  const btn = document.getElementById("newsletterBtn");
  const input = document.getElementById("newsletterEmail");
  const msg = document.getElementById("newsletterMsg");
  if (!form || !btn || !input || !msg || form.dataset.jsInit) return;
  form.dataset.jsInit = "1";

  const isEn = document.documentElement.lang === "en";
  const t = isEn
    ? {
        invalid: "Please enter a valid email.",
        sending: "Sending...",
        ok: "Subscribed! Check your inbox for the discount.",
        fail: "We couldn't subscribe you. Please try again.",
        network: "Connection error. Please try again.",
      }
    : {
        invalid: "Ingrese un correo válido.",
        sending: "Enviando...",
        ok: "¡Suscrito! Revise su correo para el descuento.",
        fail: "No se pudo suscribir. Inténtelo de nuevo.",
        network: "Error de conexión. Inténtelo de nuevo.",
      };

  function show(text, state) {
    msg.textContent = text;
    if (state) msg.dataset.state = state;
    else delete msg.dataset.state;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show(t.invalid, "error");
      input.focus();
      return;
    }

    btn.disabled = true;
    show(t.sending);

    try {
      const res = await fetch("/api/emails/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        show(t.ok, "ok");
        input.value = "";
      } else {
        show(data.error || t.fail, "error");
      }
    } catch {
      show(t.network, "error");
    } finally {
      btn.disabled = false;
    }
  });
}

// En móvil las columnas de enlaces son acordeones cerrados; desde 768px siempre abiertas.
function initFooterColumns() {
  const cols = document.querySelectorAll(".site-footer .footer-col");
  if (!cols.length || cols[0].dataset.jsInit) return;
  const desktop = window.matchMedia("(min-width: 768px)");

  const sync = () => cols.forEach((col) => (col.open = desktop.matches));
  sync();
  desktop.addEventListener("change", sync);

  cols.forEach((col) => {
    col.dataset.jsInit = "1";
    col.addEventListener("toggle", () => {
      if (desktop.matches && !col.open) col.open = true;
    });
  });
}

function initFooter() {
  initNewsletterFooter();
  initFooterColumns();
}

initFooter();
document.addEventListener("astro:page-load", initFooter);
