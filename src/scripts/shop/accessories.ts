/**
 * Accesorios: las fichas de la pila se reparten en abanico al entrar; al
 * apuntar una, sube al frente y las demás se apartan. En táctil se queda el
 * abanico de reposo (cada ficha es un enlace, no hace falta más).
 */
import { gsap, gridEntrance, cursorLight, type Piece } from '../motion/core.ts';

export const accessories: Piece = (addCleanup) => {
  const stack = document.querySelector<HTMLElement>('[data-pstack]');
  const grid = document.querySelector<HTMLElement>('.acc-grid');
  if (grid) {
    gridEntrance(grid);
    cursorLight(grid, '.card', addCleanup);
  }
  if (!stack) return;
  const cards = Array.from(stack.querySelectorAll<HTMLElement>('.pstack__card'));
  // GSAP toma el control del transform: el CSS solo pinta el reposo sin JS
  // En celular el abanico se cierra (igual que el CSS de ProductStack)
  const spread = window.matchMedia('(max-width: 480px)').matches ? 0.35 : 1;
  const rest = (c: HTMLElement) => ({ rotation: Number(c.dataset.restR), xPercent: Number(c.dataset.restX) * spread, y: 0, scale: 1 });
  // x: 0 anula el desplazamiento que GSAP lee del transform del CSS (ya va en xPercent)
  cards.forEach((c) => gsap.set(c, { x: 0, ...rest(c) }));
  gsap.from(cards, { rotation: 0, xPercent: 0, y: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, delay: 0.3 });

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || cards.length < 2) return;
  const focus = (target: HTMLElement | null) => {
    cards.forEach((c, i) => {
      if (!target) return gsap.to(c, { ...rest(c), zIndex: i + 1, duration: 0.5, ease: 'power3.out' });
      const on = c === target;
      const side = cards.indexOf(c) < cards.indexOf(target) ? -1 : 1;
      gsap.to(c, on
        ? { rotation: 0, xPercent: 0, y: -14, scale: 1.04, zIndex: 10, duration: 0.5, ease: 'power3.out' }
        : { rotation: side * 9, xPercent: side * 40, y: 10, scale: 0.94, zIndex: i + 1, duration: 0.5, ease: 'power3.out' });
    });
  };
  const handlers = cards.map((c) => {
    const enter = () => focus(c);
    c.addEventListener('pointerenter', enter);
    c.addEventListener('focus', enter);
    return () => { c.removeEventListener('pointerenter', enter); c.removeEventListener('focus', enter); };
  });
  const leave = () => focus(null);
  stack.addEventListener('pointerleave', leave);
  addCleanup(() => { handlers.forEach((h) => h()); stack.removeEventListener('pointerleave', leave); });
};
