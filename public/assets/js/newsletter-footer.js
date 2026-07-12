/**
 * Suscripción al newsletter (footer global).
 * Externalizado (servido desde 'self') para cumplir la CSP estricta sin 'unsafe-inline'.
 */
function initNewsletterFooter() {
  const btn = document.getElementById("newsletterBtn");
  const input = document.getElementById("newsletterEmail");
  const msg = document.getElementById("newsletterMsg");
  if (!btn || !input || !msg || btn.dataset.jsInit) return;
  btn.dataset.jsInit = "1";

  async function subscribe() {
    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Ingrese un correo válido.";
      msg.style.color = "#d32f2f";
      return;
    }

    btn.disabled = true;
    msg.textContent = "Enviando...";
    msg.style.color = "#666";

    try {
      const res = await fetch("/api/emails/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        msg.textContent = "¡Suscrito! Revise su correo para el descuento.";
        msg.style.color = "#4a6741";
        input.value = "";
      } else {
        msg.textContent = data.error || "No se pudo suscribir. Inténtelo de nuevo.";
        msg.style.color = "#d32f2f";
      }
    } catch {
      msg.textContent = "Error de conexión. Inténtelo de nuevo.";
      msg.style.color = "#d32f2f";
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", subscribe);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") subscribe();
  });
})();
