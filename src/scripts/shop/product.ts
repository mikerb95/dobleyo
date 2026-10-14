/**
 * Ficha de producto (ES y EN): solo microinteracciones, porque es una página
 * de compra. La foto se acerca al apuntar siguiendo al cursor, el precio rueda
 * como odómetro al cambiar de presentación, el botón de agregar es magnético y
 * late al tocarlo, y las opciones de presentación y molienda responden al
 * clic. La reseñas y el resto entran suaves al aparecer.
 */
import { gsap, ScrollTrigger, magnetic, liveOdometer, type Piece } from '../motion/core.ts';

export const product: Piece = (addCleanup) => {
  const wrap = document.querySelector<HTMLElement>('.product-image-wrap, .pp-imgwrap');
  if (!wrap) return;
  const img = wrap.querySelector<HTMLElement>('img');
  const detail = document.querySelector<HTMLElement>('.product-detail, .pp-detail');

  // ── Entrada ──────────────────────────────────────────────────────────────
  gsap.from(wrap, { opacity: 0, scale: 0.97, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity' });
  if (detail) {
    gsap.from(Array.from(detail.children), { y: 14, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05, delay: 0.15, clearProps: 'transform,opacity' });
  }

  // ── Lupa: la foto se acerca hacia donde apunta el cursor ────────────────
  if (img && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    wrap.style.overflow = 'hidden';
    const move = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    };
    const enter = () => gsap.to(img, { scale: 1.6, duration: 0.5, ease: 'power3.out' });
    const leave = () => gsap.to(img, { scale: 1, duration: 0.5, ease: 'power3.out' });
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerenter', enter);
    wrap.addEventListener('pointerleave', leave);
    addCleanup(() => {
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerenter', enter);
      wrap.removeEventListener('pointerleave', leave);
      wrap.style.overflow = '';
    });
  }

  // ── Precio: rueda al cambiar de presentación (producto.js cambia el texto)
  const price = document.querySelector<HTMLElement>('.price-cop');
  if (price) liveOdometer(price, addCleanup);

  // ── Botón de agregar y opciones ──────────────────────────────────────────
  const add = document.querySelector<HTMLElement>('.add-btn, .pp-add');
  if (add) {
    magnetic(add, addCleanup, 0.25);
    const pulse = () => gsap.fromTo(add, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    add.addEventListener('click', pulse);
    addCleanup(() => add.removeEventListener('click', pulse));
  }
  const variants = document.getElementById('variantsWrap');
  if (variants) {
    const pop = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('.variant-btn');
      if (btn) gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    };
    variants.addEventListener('click', pop);
    addCleanup(() => variants.removeEventListener('click', pop));
  }

  // ── Reseñas ──────────────────────────────────────────────────────────────
  const reviews = document.getElementById('reviewsSection');
  if (reviews) {
    gsap.set(reviews, { y: 24, opacity: 0 });
    let done = false;
    ScrollTrigger.create({
      trigger: reviews,
      start: 'top 90%',
      onEnter: () => {
        if (done) return;
        done = true;
        gsap.to(reviews, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity' });
      },
    });
  }
};
