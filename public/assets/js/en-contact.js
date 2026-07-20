/** EN contact form. Externalized for the strict CSP (no 'unsafe-inline'). */
function initEnContact() {
  const contactForm = document.getElementById("contactForm");
  if (!contactForm || contactForm.dataset.jsInit) return;
  contactForm.dataset.jsInit = "1";
  contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("submitBtn");
  const status = document.getElementById("formStatus");
  btn.disabled = true;
  btn.textContent = "Sending...";
  status.className = "form-status";

  try {
    const body = Object.fromEntries(new FormData(form).entries());
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, lang: "en" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Error");
    status.textContent = "Message sent! We'll reply within 24 hours.";
    status.className = "form-status success";
    form.reset();
  } catch {
    status.textContent = "Error sending message. Please try again.";
    status.className = "form-status error";
  } finally {
    btn.disabled = false;
    btn.textContent = "Send message";
  }
  });
}

initEnContact();
document.addEventListener("astro:page-load", initEnContact);
