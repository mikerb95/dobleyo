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

// 2) Header inteligente + barra de anuncio.
//    Las métricas en reposo viven en styles.css (--topbar-h, --header-height),
//    así la primera pintura es correcta sin JS. Aquí solo se mueve lo que
//    depende del scroll:
//    - La barra de anuncio se desplaza con la página y el header la sigue
//      (--nav-top) hasta quedar en top:0.
//    - nav-compact: en escritorio el header pasa de 93 a 65px al bajar.
//    - nav-hidden: al bajar se oculta y vuelve con unos px hacia arriba
//      (header parcialmente persistente, NN/g: slide de ~300 ms).
//    - Nunca se oculta con el menú, el buscador, el carrito, un modal o un
//      desplegable abiertos, ni con el foco de teclado dentro del header.
//    El header y la barra se persisten con View Transitions, por eso los
//    bindings llevan guard y el estado se repone tras cada swap.
const TOPBAR_CLOSED_KEY = "dy-topbar-closed";
const NAV_COMPACT_AT = 80; // px de scroll para compactar
const NAV_HIDE_AFTER = 160; // px por debajo del header en reposo antes de ocultar
const NAV_DELTA = 8; // px de scroll en un sentido para cambiar de estado
const NAV_ANIM_MS = 360;

const navState = { lastY: 0, navTop: null, ticking: false, animTimer: 0 };

function readTopbarClosed() {
  try {
    return !!sessionStorage.getItem(TOPBAR_CLOSED_KEY);
  } catch {
    return false;
  }
}

function topbarHeight() {
  const tb = document.querySelector("#topbar");
  if (!tb || document.documentElement.classList.contains("topbar-closed")) return 0;
  return tb.offsetHeight;
}

// Algo del header está en uso: no se oculta.
function navBusy() {
  const root = document.documentElement;
  const body = document.body;
  if (root.classList.contains("search-open")) return true;
  if (body.classList.contains("menu-open")) return true;
  if (body.classList.contains("cart-drawer-lock")) return true;
  if (body.classList.contains("modal-open")) return true;
  const header = document.querySelector(".site-header");
  if (!header) return true;
  if (header.querySelector(".user-dropdown.active")) return true;
  if (header.querySelector(":focus-visible")) return true;
  const cart = document.getElementById("cartPreviewWrap");
  if (cart && cart.matches(":hover")) return true;
  return false;
}

// Las transiciones de posición solo corren durante un cambio de estado.
function navAnimate() {
  const root = document.documentElement;
  root.classList.add("nav-anim");
  clearTimeout(navState.animTimer);
  navState.animTimer = setTimeout(() => root.classList.remove("nav-anim"), NAV_ANIM_MS);
}

function setNavClass(name, on, animate) {
  const root = document.documentElement;
  if (root.classList.contains(name) === on) return;
  if (animate) navAnimate();
  root.classList.toggle(name, on);
}

function updateNav(force) {
  navState.ticking = false;
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  if (!header) return;

  const y = Math.max(0, window.scrollY);
  const tbH = topbarHeight();

  // La barra se va con el scroll; el header baja a top:0 detrás de ella.
  const navTop = Math.max(0, tbH - y);
  if (force || navTop !== navState.navTop) {
    navState.navTop = navTop;
    root.style.setProperty("--nav-top", navTop + "px");
  }

  setNavClass("nav-scrolled", y > tbH, false);
  setNavClass("nav-compact", y > tbH + NAV_COMPACT_AT, true);

  // Ocultar al bajar, volver al subir. lastY solo avanza cuando el
  // movimiento supera NAV_DELTA, así varios px seguidos también cuentan.
  const restBottom = tbH + header.offsetHeight;
  const diff = y - navState.lastY;
  if (y <= restBottom + NAV_HIDE_AFTER || navBusy()) {
    setNavClass("nav-hidden", false, true);
    navState.lastY = y;
  } else if (Math.abs(diff) >= NAV_DELTA) {
    setNavClass("nav-hidden", diff > 0, true);
    navState.lastY = y;
  }
}

function requestNavUpdate() {
  if (navState.ticking) return;
  navState.ticking = true;
  requestAnimationFrame(() => updateNav(false));
}

// Mostrar ya (por ejemplo al abrir el buscador con "/" estando oculto).
function revealNav() {
  setNavClass("nav-hidden", false, true);
  navState.lastY = Math.max(0, window.scrollY);
}

function initHeaderChrome() {
  const root = document.documentElement;
  const topbar = document.querySelector("#topbar");

  // Si el usuario ya cerró la barra en esta sesión, ocultarla sin animar.
  if (topbar && readTopbarClosed()) root.classList.add("topbar-closed");

  const topbarClose = document.querySelector("#topbarClose");
  if (topbar && topbarClose && !topbarClose.dataset.jsInit) {
    topbarClose.dataset.jsInit = "1";
    topbarClose.addEventListener("click", () => {
      try {
        sessionStorage.setItem(TOPBAR_CLOSED_KEY, "1");
      } catch {}
      // La barra sube y el header/contenido la siguen (transiciones en CSS).
      // topbar-closed ya aplica las métricas sin barra; topbar-closing la
      // mantiene visible mientras se anima.
      root.classList.add("topbar-closing", "topbar-closed");
      navAnimate();
      updateNav(true);
      setTimeout(() => root.classList.remove("topbar-closing"), 300);
    });
  }

  const header = document.querySelector(".site-header");
  if (header && !header.dataset.navInit) {
    header.dataset.navInit = "1";
    // Foco con teclado dentro del header estando oculto: mostrarlo.
    header.addEventListener("focusin", revealNav);
    // Abrir buscador, menú o carrito cambia clases en <html>/<body>.
    const obs = new MutationObserver(() => {
      if (navBusy()) revealNav();
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  navState.lastY = Math.max(0, window.scrollY);
  updateNav(true);
}

window.addEventListener("scroll", requestNavUpdate, { passive: true });
window.addEventListener("resize", requestNavUpdate, { passive: true });

if (document.readyState !== "loading") initHeaderChrome();
else document.addEventListener("DOMContentLoaded", initHeaderChrome);
document.addEventListener("astro:page-load", initHeaderChrome);
// Al terminar el swap Astro copia los atributos del <html> nuevo (clases y
// style incluidos): reponer estado de la barra y del header en el mismo frame
// para que no reaparezca la barra ni salte el header.
document.addEventListener("astro:after-swap", () => {
  if (readTopbarClosed()) document.documentElement.classList.add("topbar-closed");
  navState.lastY = Math.max(0, window.scrollY);
  updateNav(true);
});

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
