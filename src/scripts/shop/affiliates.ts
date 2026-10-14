/**
 * Afiliados: el recorrido del enlace en bucle. Se escribe el nombre en el
 * enlace, la línea baja hasta la compra, la compra aparece "tocada" y al final
 * llega la comisión con su marca de verificación. Solo corre en pantalla.
 */
import { gsap, loopWhileVisible, type Piece } from '../motion/core.ts';

export const affiliates: Piece = (addCleanup) => {
  const root = document.querySelector<HTMLElement>('[data-rflow]');
  if (!root) return;
  const handle = root.querySelector<HTMLElement>('[data-handle]')!;
  const caret = root.querySelector<HTMLElement>('.rflow__caret')!;
  const [, order, fee] = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
  const wires = root.querySelectorAll('.rflow__wire path');
  const check = root.querySelector<HTMLElement>('.rflow__check')!;
  const text = handle.dataset.handle ?? '';

  gsap.from(root, { y: 30, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.35, clearProps: 'transform,opacity' });
  gsap.to(caret, { opacity: 0, duration: 0.5, repeat: -1, yoyo: true, ease: 'steps(1)' });

  const typed = { n: 0 };
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6, delay: 0.8 });
  tl.set([order, fee], { opacity: 0.25, y: 8 })
    .set(check, { scale: 0 })
    .set(wires, { drawSVG: '0%' })
    .fromTo(typed, { n: 0 }, {
      n: text.length, duration: text.length * 0.08, ease: 'none',
      onUpdate: () => { handle.textContent = text.slice(0, Math.round(typed.n)); },
    })
    .to(wires[0], { drawSVG: '100%', duration: 0.5, ease: 'power1.inOut' }, '+=0.3')
    .to(order, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' })
    .fromTo(order, { scale: 1 }, { scale: 1.03, duration: 0.15, yoyo: true, repeat: 1 })
    .to(wires[1], { drawSVG: '100%', duration: 0.5, ease: 'power1.inOut' }, '+=0.2')
    .to(fee, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' })
    .to(check, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  loopWhileVisible(root, tl, addCleanup);
  addCleanup(() => { handle.textContent = text; });
};
