/**
 * Scroll-reveal global: secciones marcadas con .reveal aparecen suavemente
 * al entrar en el viewport. Idempotente y compatible con View Transitions
 * (astro:page-load) y con prefers-reduced-motion.
 * Externalizado (servido desde 'self') por la CSP estricta sin 'unsafe-inline'.
 */
(function () {
  let observer = null;

  function initReveal() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll(".reveal:not(.is-visible):not([data-reveal-bound])");

    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
    }

    els.forEach((el) => {
      el.dataset.revealBound = "1";
      observer.observe(el);
    });
  }

  initReveal();
  document.addEventListener("astro:page-load", initReveal);
})();
