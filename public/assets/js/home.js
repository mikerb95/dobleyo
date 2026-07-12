/**
 * Scripts de la homepage: newsletter del hero/bloque + botones "+" del grid showcase.
 * Externalizado (servido desde 'self') para cumplir la CSP estricta sin 'unsafe-inline'.
 */

// Newsletter (formulario de la home)
function initHomeNewsletter() {
  const form = document.getElementById("homeNewsletterForm");
  const msgEl = document.getElementById("homeNlMsg");
  if (!form || form.dataset.jsInit) return;
  form.dataset.jsInit = "1";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("homeNlEmail").value.trim();
    if (!email) return;
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      const res = await fetch("/api/emails/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (msgEl) {
        msgEl.textContent = data.message ?? "¡Suscrito! Revise su correo.";
        msgEl.className = res.ok ? "newsletter-msg success" : "newsletter-msg error";
        msgEl.style.display = "block";
      }
      if (res.ok) form.reset();
    } catch {
      if (msgEl) {
        msgEl.textContent = "Error de conexión. Inténtelo de nuevo.";
        msgEl.style.display = "block";
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Suscribirse";
    }
  });
}

// Botones "+" del grid showcase → carrito
function initHomeShowcase() {
  const grid = document.querySelector(".cs-grid");
  if (!grid || grid.dataset.jsInit) return;
  grid.dataset.jsInit = "1";
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-add");
    if (!btn) return;
    const { id, name, price, image } = btn.dataset;
    if (id && name && price && image && window.Cart) {
      window.Cart.addToCart({
        id,
        name,
        price: parseInt(price, 10),
        image,
        qty: 1,
      });
      // feedback visual breve
      btn.classList.add("cs-card__add--added");
      setTimeout(() => btn.classList.remove("cs-card__add--added"), 900);
    }
  });
}

function initHome() {
  initHomeNewsletter();
  initHomeShowcase();
}

initHome();
document.addEventListener("astro:page-load", initHome);
