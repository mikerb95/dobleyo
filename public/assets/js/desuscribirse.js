/** Baja del newsletter. Externalizado por CSP estricta (sin 'unsafe-inline'). */
function initDesuscribirse() {
const form = document.getElementById("unsub-form");
const feedback = document.getElementById("form-feedback");
if (!form || form.dataset.jsInit) return;
form.dataset.jsInit = "1";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.elements.namedItem("email").value.trim();
  const btn = form.querySelector("button");

  btn.disabled = true;
  btn.textContent = "Procesando...";
  if (feedback) {
    feedback.textContent = "";
    feedback.className = "unsub-feedback";
  }

  try {
    const res = await fetch(
      `/api/emails/newsletter/unsubscribe?email=${encodeURIComponent(email)}`
    );
    const data = await res.json();

    if (res.ok && data.success) {
      form.innerHTML = `
        <div class="unsub-state unsub-state--success" style="padding:0;box-shadow:none;background:none;">
          <div class="unsub-icon">✓</div>
          <p style="font-weight:600;color:var(--color-success,#2e7d32);">¡Listo! Lo dimos de baja del boletín.</p>
          <p style="font-size:0.875rem;color:var(--color-text-muted,#666);">Ya no recibirá correos. Si fue un error, vuelva a suscribirse desde el pie de página.</p>
        </div>`;
    } else {
      if (feedback) {
        feedback.textContent = data.error ?? "No encontramos ese correo en nuestra lista.";
        feedback.className = "unsub-feedback unsub-feedback--error";
      }
      btn.disabled = false;
      btn.textContent = "Darme de baja";
    }
  } catch {
    if (feedback) {
      feedback.textContent = "Error de conexión. Por favor inténtelo de nuevo.";
      feedback.className = "unsub-feedback unsub-feedback--error";
    }
    btn.disabled = false;
    btn.textContent = "Darme de baja";
  }
});
}

initDesuscribirse();
document.addEventListener("astro:page-load", initDesuscribirse);
