/** Solicitud de caficultor. Externalizado por CSP estricta (sin 'unsafe-inline'). */
function initSolicitarCaficultor() {
  const f = document.getElementById("caficulorForm");
  const err = document.getElementById("formError");
  const btn = document.getElementById("submitBtn");
  if (!f || f.dataset.jsInit) return;
  f.dataset.jsInit = "1";

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        window.location.href = "/login?redirect=/solicitar-caficultor";
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    }
  }

  checkAuth();

  f.addEventListener("submit", async function (e) {
    e.preventDefault();
    const farmName = (document.getElementById("farmName").value || "").trim();
    const region = (document.getElementById("region").value || "").trim();
    const altitude = document.getElementById("altitude").value
      ? parseInt(document.getElementById("altitude").value)
      : null;
    const hectares = document.getElementById("hectares").value
      ? parseFloat(document.getElementById("hectares").value)
      : null;
    const varieties = (document.getElementById("varieties").value || "").trim();
    const certifications = (document.getElementById("certifications").value || "").trim();
    const description = (document.getElementById("description").value || "").trim();

    if (!farmName || !region || !description) {
      showError("Complete los campos obligatorios.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Enviando...";
    err.style.display = "none";

    try {
      const res = await fetch("/api/auth/request-caficultor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          farm_name: farmName,
          region,
          altitude,
          hectares,
          varieties_cultivated: varieties,
          certifications,
          description,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar solicitud");
      }

      showError("✓ Solicitud enviada. Le notificaremos pronto.", true);
      setTimeout(() => {
        window.location.href = "/cuenta";
      }, 2000);
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
      btn.textContent = "Enviar solicitud";
    }
  });

  function showError(msg, isSuccess = false) {
    err.textContent = msg;
    err.style.color = isSuccess ? "#16a34a" : "#b91c1c";
    err.style.display = "block";
  }
}

initSolicitarCaficultor();
document.addEventListener("astro:page-load", initSolicitarCaficultor);
