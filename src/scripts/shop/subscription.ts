/**
 * Suscripción: entrada del titular, el calendario de pedidos que se dibuja al
 * entrar en pantalla y late al cambiar la frecuencia, el total que rueda como
 * odómetro y el café elegido que "salta" al seleccionarlo.
 *
 * Los campos del formulario y el pago no se animan.
 */
import { gsap, ScrollTrigger, SplitText, liveOdometer, type Piece } from '../motion/core.ts';

export const subscription: Piece = (addCleanup) => {
  const cal = document.querySelector<HTMLElement>('[data-sub-calendar]');
  if (!cal) return;

  // ── Titular ──────────────────────────────────────────────────────────────
  const title = document.querySelector<HTMLElement>('.dh [data-split]');
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    gsap.from(split.words, { yPercent: 110, duration: 1, ease: 'power3.out', stagger: 0.05 });
    gsap.from('.dh__crumbs, .dh__lead, .dh__facts', { y: 14, opacity: 0, duration: 0.7, stagger: 0.1, delay: 0.25, clearProps: 'transform,opacity' });
    gsap.from('.ticket', { y: 30, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.35, clearProps: 'transform,opacity' });
  }

  // ── Calendario: la regla se traza y los pedidos caen en su fecha ────────
  const line = cal.querySelector('.cal__line');
  const pins = () => Array.from(cal.querySelectorAll<HTMLElement>('.cal__dot:not(.is-off) .cal__pin'));
  const labels = () => Array.from(cal.querySelectorAll<HTMLElement>('.cal__dot:not(.is-off) .cal__label'));
  gsap.set(line, { scaleX: 0 });
  gsap.set(pins(), { scale: 0 });
  gsap.set(labels(), { opacity: 0, y: 6 });
  let shown = false;
  ScrollTrigger.create({
    trigger: cal,
    start: 'top 88%',
    onEnter: () => {
      if (shown) return;
      shown = true;
      gsap.timeline()
        .to(line, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' })
        .to(pins(), { scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.08 }, 0.25)
        .to(labels(), { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, clearProps: 'opacity,transform' }, 0.35);
    },
  });

  // Al cambiar la frecuencia el CSS mueve los pedidos; aquí late cada uno
  const freq = document.getElementById('subFreq');
  const pulse = (e: Event) => {
    if (!(e.target as HTMLElement).closest('[data-freq]')) return;
    requestAnimationFrame(() =>
      gsap.fromTo(pins(), { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'back.out(3)', stagger: 0.05, delay: 0.25, overwrite: true })
    );
  };
  freq?.addEventListener('click', pulse);
  addCleanup(() => freq?.removeEventListener('click', pulse));

  // ── Total como odómetro ──────────────────────────────────────────────────
  const total = document.getElementById('sumTotal');
  if (total) liveOdometer(total, addCleanup);

  // ── Café elegido ─────────────────────────────────────────────────────────
  const coffees = document.getElementById('subCoffees');
  const pick = (e: Event) => {
    const img = (e.target as HTMLElement).closest('.sub-coffee')?.querySelector('.sub-coffee__img');
    if (img) gsap.fromTo(img, { scale: 0.82, rotation: -10 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(3)' });
  };
  coffees?.addEventListener('change', pick);
  addCleanup(() => coffees?.removeEventListener('change', pick));
};
