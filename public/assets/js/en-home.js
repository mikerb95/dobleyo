/**
 * EN landing — B2B export inquiry form handler.
 * Externalized (served from 'self') to comply with the strict CSP (no 'unsafe-inline').
 */
document.getElementById("exportForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("button[type='submit']");

  btn.disabled = true;
  btn.textContent = "Sending...";

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/contact/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      btn.textContent = "Inquiry Sent ✓";
      btn.style.background = "#2d6a4f";
      form.reset();
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Submit Inquiry";
        btn.style.background = "";
      }, 3000);
    } else {
      throw new Error("Failed to send");
    }
  } catch (error) {
    btn.textContent = "Error - Try Again";
    btn.style.background = "#dc2626";
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Submit Inquiry";
      btn.style.background = "";
    }, 3000);
  }
});
