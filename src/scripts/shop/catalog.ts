/**
 * Catálogo de la tienda (ES y EN): luz que sigue al cursor en la rejilla y
 * entrada escalonada de las cards. El script de la página repinta la rejilla
 * al filtrar u ordenar y avisa con el evento `shop:render`; las cards nuevas
 * entran con un escalonado corto en vez de aparecer de golpe.
 */
import { gsap, cursorLight, gridEntrance, type Piece } from '../motion/core.ts';

export const catalog: Piece = (addCleanup) => {
  const grid = document.getElementById('shopResults');
  if (!grid) return;

  gridEntrance(grid);
  cursorLight(grid, '.card', addCleanup);

  const onRender = () => {
    gsap.fromTo(
      grid.children,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.04, clearProps: 'transform,opacity', overwrite: true }
    );
  };
  grid.addEventListener('shop:render', onRender);
  addCleanup(() => grid.removeEventListener('shop:render', onRender));
};
