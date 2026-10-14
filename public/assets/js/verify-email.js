/** Verificación de correo. Externalizado por CSP estricta (sin 'unsafe-inline'). */
function initVerifyEmail() {
  const loadingState = document.getElementById("loadingState");
  if (!loadingState || loadingState.dataset.jsInit) return;
  loadingState.dataset.jsInit = "1";

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const successState = document.getElementById("successState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");

  async function verifyEmail() {
    if (!token) {
      showError("No se proporcionó un token de verificación.");
      return;
    }

    try {
      const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (response.ok) {
        showSuccess();
      } else {
        showError(data.error || "Error al verificar la cuenta.");
      }
    } catch (error) {
      console.error("Error:", error);
      showError("Error de conexión. Por favor inténtelo nuevamente.");
    }
  }

  function showSuccess() {
    if (loadingState) loadingState.style.display = "none";
    if (errorState) errorState.style.display = "none";
    if (successState) successState.style.display = "block";
  }

  function showError(message) {
    if (loadingState) loadingState.style.display = "none";
    if (successState) successState.style.display = "none";
    if (errorState) errorState.style.display = "block";
    if (errorMessage) errorMessage.textContent = message;
  }

  verifyEmail();

  const resendForm = document.getElementById("resendForm");
  const resendStatus = document.getElementById("resendStatus");
  resendForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = resendForm.email;
    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
      resendStatus.textContent = "Ingrese un correo electrónico válido.";
      resendStatus.dataset.tone = "error";
      return;
    }
    const button = resendForm.querySelector("button");
    button.disabled = true;
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      resendStatus.textContent = res.ok
        ? "Si la cuenta existe y aún no está verificada, le llegará un enlace nuevo en unos minutos."
        : data.error || "No pudimos enviar el enlace. Intente más tarde.";
      resendStatus.dataset.tone = res.ok ? "success" : "error";
    } catch {
      resendStatus.textContent = "Error de conexión. Intente de nuevo.";
      resendStatus.dataset.tone = "error";
    } finally {
      button.disabled = false;
    }
  });
}

initVerifyEmail();
document.addEventListener("astro:page-load", initVerifyEmail);
