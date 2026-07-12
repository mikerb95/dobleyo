/** Formulario de contacto. Externalizado por CSP estricta (sin 'unsafe-inline'). */
function initContacto() {
  const contactForm = document.getElementById("contactForm");
  if (!contactForm || contactForm.dataset.jsInit) return;
  contactForm.dataset.jsInit = "1";
  contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!status) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  const formData = {
    name: form.querySelector("#name").value,
    email: form.querySelector("#email").value,
    phone: form.querySelector("#phone").value,
    subject: form.querySelector("#subject").value,
    message: form.querySelector("#message").value,
  };

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      status.textContent = "¡Mensaje enviado con éxito! Le responderemos pronto.";
      status.className = "form-status success";
      form.reset();
    } else {
      throw new Error("Error al enviar el mensaje");
    }
  } catch (error) {
    status.textContent =
      "Hubo un error al enviar el mensaje. Por favor inténtelo de nuevo o contáctenos por WhatsApp.";
    status.className = "form-status error";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar Mensaje";
  }
  });
}

initContacto();
document.addEventListener("astro:page-load", initContacto);
