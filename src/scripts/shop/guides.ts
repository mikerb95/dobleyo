/**
 * Guías: el panel de recetas dibuja cada método al mostrarse. El café y el
 * agua crecen a escala, el anillo del tiempo se llena, la molienda se ubica en
 * su punto y la temperatura sube; las cifras ruedan.
 */
import { gsap, odometer, type Piece } from '../motion/core.ts';

export const guides: Piece = (addCleanup) => {
  const brew = document.querySelector<HTMLElement>('[data-brew]');
  if (!brew) return;

  gsap.from(brew, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.3, clearProps: 'transform,opacity' });

  let current: gsap.core.Timeline | null = null;
  const draw = (panel: HTMLElement) => {
    current?.progress(1).kill();
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(panel.querySelectorAll('.brew__head, .brew__cell'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, clearProps: 'transform,opacity' }, 0)
      .fromTo(panel.querySelectorAll('.dose__bar, .temp__bar'), { scaleX: 0 }, { scaleX: 1, duration: 1, stagger: 0.12 }, 0.15)
      .fromTo(panel.querySelectorAll('.grind__dot'), { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)', stagger: 0.06 }, 0.2);
    const ring = panel.querySelector<SVGCircleElement>('.ring__fg');
    if (ring) {
      const full = Number(ring.getAttribute('stroke-dasharray'));
      const end = Number(ring.getAttribute('stroke-dashoffset'));
      tl.fromTo(ring, { strokeDashoffset: full }, { strokeDashoffset: end, duration: 1.4, ease: 'power2.inOut' }, 0.2);
    }
    // Las cifras ruedan como odómetro; el texto original queda en data-odometer
    panel.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
      el.dataset.odometer ??= el.textContent ?? '';
      const odo = odometer(el, 0.15 + i * 0.08);
      odo?.play();
    });
    current = tl;
  };

  const visible = () => brew.querySelector<HTMLElement>('.brew__panel:not([hidden])');
  const first = visible();
  if (first) gsap.delayedCall(0.6, () => draw(first));
  const onShow = () => {
    const p = visible();
    if (p) draw(p);
  };
  brew.addEventListener('brew:show', onShow);
  addCleanup(() => brew.removeEventListener('brew:show', onShow));

};
