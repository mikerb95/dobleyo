/**
 * Motion de las secciones compartidas de las páginas de compra y contenido
 * (components/shop/*): encabezado oscuro, rejilla de beneficios, lista
 * numerada, fila de perfiles y cierre. Cada pieza de página se ocupa solo de
 * su pieza central (caja, panel de recetas, línea de suministro…).
 */
import { gsap, ScrollTrigger, SplitText, gridEntrance, cursorLight, type Piece } from '../motion/core.ts';

/** Ejecuta `fn` una vez cuando `el` entra en pantalla (sin once:true, ver técnicas). */
function onFirstView(el: Element, fn: () => void, start = 'top 85%'): void {
  let done = false;
  ScrollTrigger.create({ trigger: el, start, onEnter: () => { if (!done) { done = true; fn(); } } });
}

export const sections: Piece = (addCleanup) => {
  // ── Encabezado oscuro ────────────────────────────────────────────────────
  const hero = document.querySelector<HTMLElement>('.dh');
  if (hero) {
    const title = hero.querySelector<HTMLElement>('[data-split]');
    if (title) {
      const split = SplitText.create(title, { type: 'words', mask: 'words' });
      gsap.from(split.words, { yPercent: 110, duration: 1, ease: 'power3.out', stagger: 0.05 });
    }
    gsap.from(hero.querySelectorAll('.dh__crumbs, .dh__lead, .dh__facts, .dh__actions'), {
      y: 14, opacity: 0, duration: 0.7, stagger: 0.08, delay: 0.25, clearProps: 'transform,opacity',
    });
  }

  // ── Beneficios: entrada, luz del cursor e íconos que se trazan ──────────
  document.querySelectorAll<HTMLElement>('[data-fgrid]').forEach((grid) => {
    gridEntrance(grid);
    cursorLight(grid, '.fgrid__item', addCleanup);
    const paths = grid.querySelectorAll('.fgrid__icon svg > *');
    gsap.set(paths, { drawSVG: '0%' });
    onFirstView(grid, () => gsap.to(paths, { drawSVG: '100%', duration: 1.2, ease: 'power2.inOut', stagger: 0.04, delay: 0.2 }));
  });

  // ── Lista numerada: las cifras se descifran al entrar ───────────────────
  document.querySelectorAll<HTMLElement>('.nlist__grid').forEach((list) => {
    gridEntrance(list);
    const nums = list.querySelectorAll<HTMLElement>('.nlist__n');
    onFirstView(list, () =>
      nums.forEach((n, i) => gsap.to(n, { duration: 0.8, delay: 0.2 + i * 0.09, scrambleText: { text: n.textContent ?? '', chars: '0123456789', speed: 0.6 } }))
    );
  });

  // ── Perfiles ─────────────────────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('[data-chips]').forEach((row) => {
    const chips = Array.from(row.children) as HTMLElement[];
    gsap.set(chips, { y: 12, opacity: 0, scale: 0.96 });
    onFirstView(row, () => gsap.to(chips, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.06, clearProps: 'transform,opacity' }), 'top 90%');
  });

  // ── Blog ─────────────────────────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('[data-blog-grid]').forEach((grid) => gridEntrance(grid));
  const feature = document.querySelector<HTMLElement>('.dh .post--feature');
  if (feature) gsap.from(feature, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.3, clearProps: 'transform,opacity' });

  // ── Cierre ───────────────────────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('.ctab__inner').forEach((band) => {
    gsap.set(band, { y: 30, opacity: 0 });
    onFirstView(band, () => gsap.to(band, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity' }), 'top 92%');
  });
};
