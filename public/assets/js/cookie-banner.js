/**
 * Banner de consentimiento de cookies (Ley 1581/2012).
 * Externalizado (servido desde 'self') para cumplir la CSP estricta sin 'unsafe-inline'.
 */
function initCookieBanner() {
  const COOKIE_KEY = "dy_cookie_consent";
  const banner = document.getElementById("cookieBanner");
  if (!banner || banner.dataset.jsInit) return;
  banner.dataset.jsInit = "1";

  // Mostrar banner solo si no hay decisión guardada
  const saved = localStorage.getItem(COOKIE_KEY);
  if (!saved) {
    // Pequeño delay para evitar CLS en el primer render
    setTimeout(() => {
      banner.hidden = false;
    }, 400);
  }

  function dismiss(value) {
    localStorage.setItem(COOKIE_KEY, value);
    banner.hidden = true;
  }

  document
    .getElementById("cookieAccept")
    ?.addEventListener("click", () => dismiss("accepted"));
  document
    .getElementById("cookieReject")
    ?.addEventListener("click", () => dismiss("essential"));
}

initCookieBanner();
document.addEventListener("astro:page-load", initCookieBanner);
