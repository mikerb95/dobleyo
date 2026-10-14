/** Solicitud de enlace para restablecer contraseña. Externalizado por CSP estricta. */
function initForgotPassword() {
  const form = document.getElementById("forgotForm");
  if (!form || form.dataset.jsInit) return;
  form.dataset.jsInit = "1";

  const status = document.getElementById("forgotStatus");
  const button = form.querySelector('button[type="submit"]');

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.email.value.trim();
    if (!form.email.checkValidity() || !email) {
      setStatus("Ingrese un correo electrónico válido.", "error");
      form.email.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Enviando...";
    setStatus("", "");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(
          `Si ${email} tiene una cuenta, en unos minutos recibirá el enlace. Revise también la carpeta de spam.`,
          "success"
        );
        form.reset();
      } else {
        setStatus(data.error || "No pudimos procesar la solicitud. Intente de nuevo.", "error");
      }
    } catch {
      setStatus("Error de conexión. Intente de nuevo.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Enviar enlace";
    }
  });
}

initForgotPassword();
document.addEventListener("astro:page-load", initForgotPassword);
