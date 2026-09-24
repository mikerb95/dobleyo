/**
 * Banda de origen: las cifras ruedan como un odómetro al entrar en pantalla.
 */
import { ScrollTrigger, odometer, type Piece } from '../motion/core.ts';

export const strip: Piece = () => {
  const root = document.querySelector<HTMLElement>('[data-origin-strip]');
  if (!root) return;
  const timelines = Array.from(root.querySelectorAll<HTMLElement>('[data-odometer]')).map((el, i) => odometer(el, i * 0.15));
  ScrollTrigger.create({
    trigger: root,
    start: 'top 95%',
    once: true,
    onEnter: () => timelines.forEach((tl) => tl?.restart(true)),
  });
};
