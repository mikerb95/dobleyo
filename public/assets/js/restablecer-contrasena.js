/** Formulario de nueva contraseña con el token del correo. Externalizado por CSP estricta. */
function initResetPassword() {
  const form = document.getElementById("resetForm");
  if (!form || form.dataset.jsInit) return;
  form.dataset.jsInit = "1";

  const status = document.getElementById("resetStatus");
  const links = document.getElementById("resetLinks");
  const button = form.querySelector('button[type="submit"]');
  const token = new URLSearchParams(window.location.search).get("token");

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  if (!token) {
    setStatus("Este enlace está incompleto. Solicite uno nuevo para continuar.", "error");
    button.disabled = true;
    return;
  }

  // Sacar el token de la barra de direcciones (y del historial) una vez leído.
  window.history.replaceState(null, "", window.location.pathname);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = form.password.value;
    const confirm = form.confirm.value;

    if (password.length < 8) {
      setStatus("La contraseña debe tener al menos 8 caracteres.", "error");
      form.password.focus();
      return;
    }
    if (password !== confirm) {
      setStatus("Las contraseñas no coinciden.", "error");
      form.confirm.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Guardando...";
    setStatus("", "");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        form.hidden = true;
        links.innerHTML = '<a href="/login">Iniciar sesión</a>';
        setStatus(data.message || "Contraseña actualizada. Ya puede iniciar sesión.", "success");
        // El mensaje vive dentro del formulario oculto: moverlo antes de los enlaces.
        links.before(status);
      } else {
        const message = data.error || (data.errors && data.errors[0] && data.errors[0].msg) || "No se pudo actualizar la contraseña.";
        setStatus(message, "error");
        button.disabled = false;
        button.textContent = "Guardar contraseña";
      }
    } catch {
      setStatus("Error de conexión. Intente de nuevo.", "error");
      button.disabled = false;
      button.textContent = "Guardar contraseña";
    }
  });
}

initResetPassword();
document.addEventListener("astro:page-load", initResetPassword);
