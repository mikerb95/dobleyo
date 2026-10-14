/**
 * Mostrador de la tienda: entrada del titular y las bolsas, inclinación al
 * apuntar y etiqueta que se descifra (el dato "llega" en vez de aparecer).
 * En táctil no hay hover: mientras el mostrador está en pantalla, las bolsas
 * se levantan por turnos para mostrar que se pueden tocar.
 *
 * El filtro por origen no vive aquí (es de la página y funciona sin motion).
 */
import { gsap, SplitText, loopWhileVisible, type Piece } from '../motion/core.ts';

const CHARS = 'ABCDEFGHILMNOPRSTUVXYZ';

export const counter: Piece = (addCleanup) => {
  const root = document.querySelector<HTMLElement>('[data-shop-hero]');
  if (!root) return;
  const bags = Array.from(root.querySelectorAll<HTMLElement>('.bag'));

  // ── Entrada ──────────────────────────────────────────────────────────────
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  const title = root.querySelector<HTMLElement>('[data-split]');
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    tl.from(split.words, { yPercent: 110, duration: 1, stagger: 0.05 }, 0);
  }
  tl.from(root.querySelectorAll('.shop-hero__eyebrow, .shop-hero__lead'), { y: 14, opacity: 0, duration: 0.7, stagger: 0.1 }, 0.25);
  if (bags.length) {
    tl.from(bags, { y: 70, rotation: (i) => (i % 2 ? 4 : -4), opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, clearProps: 'transform,opacity' }, 0.2)
      .from(root.querySelector('.shop-hero__hint'), { opacity: 0, duration: 0.6 }, 0.9);
  }

  // ── Etiqueta que se descifra ─────────────────────────────────────────────
  const scramble = (bag: HTMLElement) => {
    bag.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el, i) => {
      const text = el.dataset.text ?? (el.dataset.text = el.textContent ?? '');
      gsap.to(el, { duration: 0.7, delay: i * 0.08, scrambleText: { text, chars: CHARS, speed: 0.7 }, overwrite: true });
    });
  };

  const lift = (bag: HTMLElement, on: boolean) =>
    gsap.to(bag, { y: on ? -12 : 0, duration: 0.5, ease: on ? 'back.out(2)' : 'power3.out', overwrite: 'auto' });

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (fine) {
    for (const bag of bags) {
      const rx = gsap.quickTo(bag, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      const ry = gsap.quickTo(bag, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      const enter = () => {
        lift(bag, true);
        scramble(bag);
      };
      const move = (e: PointerEvent) => {
        const r = bag.getBoundingClientRect();
        // Máximo 8° en Y y 5° en X: más deforma la etiqueta
        ry(((e.clientX - r.left) / r.width - 0.5) * 16);
        rx(((e.clientY - r.top) / r.height - 0.5) * -10);
      };
      const leave = () => {
        rx(0);
        ry(0);
        lift(bag, false);
      };
      bag.addEventListener('pointerenter', enter);
      bag.addEventListener('pointermove', move);
      bag.addEventListener('pointerleave', leave);
      bag.addEventListener('focus', enter);
      bag.addEventListener('blur', leave);
      addCleanup(() => {
        bag.removeEventListener('pointerenter', enter);
        bag.removeEventListener('pointermove', move);
        bag.removeEventListener('pointerleave', leave);
        bag.removeEventListener('focus', enter);
        bag.removeEventListener('blur', leave);
      });
    }
  } else if (bags.length > 1) {
    // Táctil: turnos de 2,4 s, solo con el mostrador en pantalla
    const turns = gsap.timeline({ repeat: -1, delay: 1.6 });
    bags.forEach((bag, i) => {
      turns
        .call(() => {
          lift(bag, true);
          scramble(bag);
        }, undefined, i * 2.4)
        .call(() => lift(bag, false), undefined, i * 2.4 + 1.8);
    });
    turns.to({}, { duration: 0.6 }, bags.length * 2.4 - 0.6);
    loopWhileVisible(root.querySelector('.bags')!, turns, addCleanup);
  }
};
