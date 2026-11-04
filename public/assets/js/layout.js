/**
 * Handlers globales del Layout público.
 *
 * Externalizado (servido desde 'self') a propósito: la CSP del sitio no permite
 * 'unsafe-inline' en script-src, y Astro incrusta inline los <script> pequeños,
 * lo que los dejaba bloqueados. Como archivo en /public se carga vía
 * <script is:inline src> y la CSP lo permite por 'self'.
 */

// 1) Botones [data-add] de ProductCard (agregar al carrito)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-add]");
  if (!btn || btn.disabled) return;
  // tienda.astro maneja sus propios botones via #shopResults
  if (btn.closest("#shopResults")) return;
  const id = btn.dataset.add ?? "";
  const name = btn.dataset.name ?? "";
  const price = Number(btn.dataset.price ?? 0);
  const image = btn.dataset.image ?? "";
  if (!id) return;
  window.Cart?.addToCart({ id, name, price, image, qty: 1 });
  btn.textContent = "✓ Agregado";
  setTimeout(() => {
    btn.textContent = "Agregar";
  }, 1500);
});

// 2) Métricas de header (CSS vars) + cierre de la barra superior de anuncio.
//    El header/topbar se persisten con View Transitions (transition:persist),
//    por eso el binding lleva un guard y las métricas se recalculan tras cada
//    navegación para evitar saltos de layout.
const TOPBAR_CLOSED_KEY = "dy-topbar-closed";

// Las métricas base viven en styles.css (--topbar-h, --header-height), así la
// primera pintura ya es correcta. Esto solo afina con la medida real (zoom de
// texto, fuentes) y mide el header COMPLETO (con su borde), igual que
// Header.astro, para que ambos scripts no se pisen con valores distintos.
function setHeaderMetrics() {
  const root = document.documentElement;
  const tb = document.querySelector("#topbar");
  const topbarVisible = tb && !root.classList.contains("topbar-closed");
  const top = topbarVisible ? tb.offsetHeight : 0;
  const header = document.querySelector(".site-header");
  if (!header) return;
  const hh = header.offsetHeight;
  root.style.setProperty("--header-top", top + "px");
  root.style.setProperty("--header-height", hh + "px");
  root.style.setProperty("--page-offset-top", top + hh + 12 + "px");
}

function readTopbarClosed() {
  try {
    return !!sessionStorage.getItem(TOPBAR_CLOSED_KEY);
  } catch {
    return false;
  }
}

function initHeaderChrome() {
  const root = document.documentElement;
  const topbar = document.querySelector("#topbar");

  // Si el usuario ya cerró la barra en esta sesión, ocultarla sin animar.
  if (topbar && readTopbarClosed()) {
    root.classList.add("topbar-closed");
    setHeaderMetrics();
    return;
  }

  const topbarClose = document.querySelector("#topbarClose");
  if (topbar && topbarClose && !topbarClose.dataset.jsInit) {
    topbarClose.dataset.jsInit = "1";
    topbarClose.addEventListener("click", () => {
      try {
        sessionStorage.setItem(TOPBAR_CLOSED_KEY, "1");
      } catch {}
      // La barra sube y el header/contenido la siguen (transiciones en CSS).
      root.classList.add("topbar-closing");
      root.style.setProperty("--header-top", "0px");
      const header = document.querySelector(".site-header");
      root.style.setProperty(
        "--page-offset-top",
        (header ? header.offsetHeight : 0) + 12 + "px"
      );
      setTimeout(() => {
        root.classList.add("topbar-closed");
        root.classList.remove("topbar-closing");
        setHeaderMetrics();
      }, 260);
    });
  }

  setHeaderMetrics();
}

window.addEventListener("resize", setHeaderMetrics);

if (document.readyState !== "loading") initHeaderChrome();
else document.addEventListener("DOMContentLoaded", initHeaderChrome);
document.addEventListener("astro:page-load", initHeaderChrome);
// Recalcular al terminar el swap para evitar un frame con métricas viejas.
document.addEventListener("astro:after-swap", setHeaderMetrics);

// 3) Localización de enlaces internos en páginas EN servidas bajo /en
//    (entorno local y previews de Vercel). En el subdominio en.dobleyo.cafe
//    las rutas planas (/shop, /blog…) ya se reescriben a /en/* vía vercel.json,
//    así que ahí la URL del navegador no lleva el prefijo /en y esto no actúa.
//    Sin el prefijo, en local/preview los enlaces planos caían en la raíz (ES)
//    y daban 404. Aquí se les antepone /en para que la navegación EN funcione.
//    Se re-ejecuta tras cada navegación porque los enlaces son nuevos en cada swap.
function localizeEnLinks() {
  const path = location.pathname;
  const onEn = path === "/en" || path.indexOf("/en/") === 0;
  if (!onEn) return;
  if (location.hostname === "en.dobleyo.cafe") return; // prod: lo maneja el edge

  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    // No tocar el selector de idioma (ES/EN): sus hrefs ya son correctos.
    if (a.closest("[data-lang-toggle]")) return;

    const href = a.getAttribute("href");
    if (!href) return;
    // Ya prefijado, o ruta no navegable que no debe llevar /en.
    if (href === "/en" || href.indexOf("/en/") === 0) return;
    if (href.indexOf("/api") === 0 || href.indexOf("/assets") === 0) return;

    a.setAttribute("href", href === "/" ? "/en" : "/en" + href);
  });
}

if (document.readyState !== "loading") localizeEnLinks();
else document.addEventListener("DOMContentLoaded", localizeEnLinks);
document.addEventListener("astro:page-load", localizeEnLinks);

// 4) prefers-reduced-motion: pausar el video decorativo del hero (autoplay/loop).
//    El efecto de granos del header se maneja en Header.astro (ahí vive su script).
function applyReducedMotion() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) return;

  document.querySelectorAll(".hero-media video").forEach((video) => {
    video.pause();
    video.removeAttribute("autoplay");
  });
}

applyReducedMotion();
document.addEventListener("astro:page-load", applyReducedMotion);
