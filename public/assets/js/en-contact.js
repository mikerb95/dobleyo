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
  status.style.display = "none";

  try {
    const body = Object.fromEntries(new FormData(form).entries());
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, lang: "en" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Error");
    status.style.background = "#f0fdf4";
    status.style.border = "1px solid #bbf7d0";
    status.style.color = "#166534";
    status.textContent = "✓ Message sent! We'll reply within 24 hours.";
    form.reset();
  } catch {
    status.style.background = "#fef2f2";
    status.style.border = "1px solid #fecaca";
    status.style.color = "#991b1b";
    status.textContent = "✕ Error sending message. Please try again.";
  } finally {
    status.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Send message";
  }
});
