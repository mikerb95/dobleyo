/**
 * Homepage scripts (EN): newsletter block + "+" grid buttons.
 * Externalized (served from 'self') to comply with strict CSP without 'unsafe-inline'.
 */

// Newsletter form
(function () {
  const form = document.getElementById("homeNewsletterForm");
  const msgEl = document.getElementById("homeNlMsg");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("homeNlEmail").value.trim();
    if (!email) return;
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await fetch("/api/emails/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (msgEl) {
        msgEl.textContent = data.message ?? "Subscribed! Check your inbox.";
        msgEl.className = res.ok ? "newsletter-msg success" : "newsletter-msg error";
        msgEl.style.display = "block";
      }
      if (res.ok) form.reset();
    } catch {
      if (msgEl) {
        msgEl.textContent = "Connection error. Please try again.";
        msgEl.style.display = "block";
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Subscribe";
    }
  });
})();

// "+" grid buttons → cart
document.querySelector(".cs-grid")?.addEventListener("click", (e) => {
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
    btn.classList.add("cs-card__add--added");
    setTimeout(() => btn.classList.remove("cs-card__add--added"), 900);
  }
});
