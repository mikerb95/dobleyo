/**
 * Fincas: las curvas de nivel de cada mapa se dibujan de la base a la cima
 * al entrar, tarjeta por tarjeta.
 */
import { gsap, ScrollTrigger, gridEntrance, type Piece } from '../motion/core.ts';

export const farms: Piece = () => {
  const root = document.querySelector<HTMLElement>('[data-farms]');
  if (!root) return;
  const grid = root.querySelector('.home-farms__grid');
  if (grid) gridEntrance(grid);
  const maps = Array.from(root.querySelectorAll<SVGSVGElement>('.hf-map'));
  maps.forEach((map) => gsap.set(map.querySelectorAll('path'), { drawSVG: '0%' }));
  ScrollTrigger.create({
    trigger: root,
    start: 'top 75%',
    once: true,
    onEnter: () =>
      maps.forEach((map, i) =>
        gsap.to(map.querySelectorAll('path'), {
          drawSVG: '100%',
          duration: 1,
          ease: 'power2.inOut',
          stagger: 0.09,
          delay: 0.25 + i * 0.15,
        })
      ),
  });
};
