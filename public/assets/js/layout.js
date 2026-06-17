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

// 2) Métricas de header (CSS vars) + cierre de la barra superior de anuncio
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  const topbar = $("#topbar");
  const topbarClose = $("#topbarClose");

  const setHeaderMetrics = () => {
    const tb = $("#topbar");
    const top = tb ? tb.offsetHeight : 0;
    const headerCont = document.querySelector(".site-header .container");
    const hh = headerCont ? headerCont.offsetHeight : 96;
    const pageOffset = top + hh + 12;
    const root = document.documentElement;
    root.style.setProperty("--header-top", top + "px");
    root.style.setProperty("--header-height", hh + "px");
    root.style.setProperty("--page-offset-top", pageOffset + "px");
  };

  setHeaderMetrics();
  window.addEventListener("resize", setHeaderMetrics);

  if (topbar && topbarClose) {
    topbarClose.addEventListener("click", () => {
      topbar.style.height = topbar.offsetHeight + "px";
      requestAnimationFrame(() => {
        topbar.style.transition = "height .25s ease, opacity .25s ease";
        topbar.style.height = "0px";
        topbar.style.opacity = "0";
        setTimeout(() => {
          topbar.remove();
          setHeaderMetrics();
        }, 300);
      });
    });
  }
})();
