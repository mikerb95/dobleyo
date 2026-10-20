/**
 * "Del grano a tu taza": movimiento sobrio, al servicio de la lectura.
 *
 * - Escritorio (>= 1024 px): las fotos pasan a una columna fija y el capítulo
 *   que cruza el centro de la pantalla decide cuál se ve. El cambio es un
 *   fundido con un leve acercamiento, definido en el CSS del componente.
 * - Móvil y tableta: cada capítulo entra una vez al aparecer (foto y texto).
 *
 * Sin JS o con movimiento reducido no se monta nada: queda la maqueta por
 * defecto, con cada foto junto a su capítulo.
 */
import { gsap, ScrollTrigger, SplitText, headerOffset, loopWhileVisible, magnetic, type Piece } from '../motion/core.ts';

export const journey: Piece = (addCleanup) => {
  const section = document.querySelector<HTMLElement>('[data-journey]');
  if (!section) return;
  const chapters = Array.from(section.querySelectorAll<HTMLElement>('.tj__chapter'));
  const frames = Array.from(section.querySelectorAll<HTMLElement>('[data-frame]'));
  const counter = section.querySelector<HTMLElement>('[data-counter]');
  if (chapters.length === 0) return;

  // Titular: las palabras suben dentro de su máscara, una sola vez.
  const title = section.querySelector<HTMLElement>('.tj__title');
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    gsap.from(split.words, {
      yPercent: 105,
      duration: 1.1,
      stagger: 0.07,
      ease: 'power3.out',
      scrollTrigger: { trigger: title, start: 'top 85%', once: true },
    });
  }
  gsap.from(section.querySelectorAll('.tj__eyebrow, .tj__sub, .tj__lot'), {
    opacity: 0,
    y: 12,
    duration: 0.9,
    stagger: 0.1,
    ease: 'power2.out',
    scrollTrigger: { trigger: section, start: 'top 80%', once: true },
  });

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px)', () => {
    section.classList.add('tj--sticky');
    // El header cambia de alto (barra de anuncios, al bajar): se mide en cada
    // cambio de capítulo para que la foto nunca quede debajo de él.
    const placeMedia = () => section.style.setProperty('--pin-top', `${headerOffset() + 24}px`);
    placeMedia();

    let active = -1;
    const setActive = (i: number) => {
      if (i === active) return;
      active = i;
      placeMedia();
      chapters.forEach((c, j) => c.classList.toggle('is-active', j === i));
      frames.forEach((f, j) => f.classList.toggle('is-active', j === i));
      if (counter) counter.textContent = String(i + 1).padStart(2, '0');
    };
    setActive(0);

    chapters.forEach((chapter, i) => {
      ScrollTrigger.create({
        trigger: chapter,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => self.isActive && setActive(i),
      });
    });

    return () => {
      section.classList.remove('tj--sticky');
      chapters.forEach((c) => c.classList.remove('is-active'));
    };
  });

  mm.add('(max-width: 1023px)', () => {
    chapters.forEach((chapter) => {
      const tl = gsap
        .timeline({ paused: true, defaults: { ease: 'power2.out' } })
        .from(chapter.querySelector('.tj__photo'), { opacity: 0, duration: 1 }, 0)
        .from(chapter.querySelector('.tj__photo img'), { scale: 1.06, duration: 1.8, ease: 'power3.out' }, 0)
        .from(chapter.querySelector('.tj__text'), { opacity: 0, y: 16, duration: 0.9 }, 0.15);
      ScrollTrigger.create({ trigger: chapter, start: 'top 85%', once: true, onEnter: () => tl.play() });
    });
  });

  addCleanup(() => mm.revert());

  // ── CTA de trazabilidad (solo con SHOW_TRACEABILITY) ─────────────────────
  const cta = section.querySelector<HTMLElement>('[data-trace-cta]');
  if (cta) {
    const qr = cta.querySelector('.tcta__qr');
    gsap.set(cta.querySelectorAll('.tcta__qr .qr__finders rect'), { scale: 0, transformOrigin: '50% 50%' });
    gsap.set(cta.querySelectorAll('.tcta__qr .qr__data rect'), { opacity: 0 });
    ScrollTrigger.create({
      trigger: cta,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.to(cta.querySelectorAll('.tcta__qr .qr__finders rect'), { scale: 1, duration: 0.35, stagger: { each: 0.004, from: 'random' } });
        gsap.to(cta.querySelectorAll('.tcta__qr .qr__data rect'), { opacity: 1, duration: 0.15, delay: 0.2, stagger: { each: 0.0012, from: 'random' } });
      },
    });
    const scan = cta.querySelector('.tcta__scan');
    if (qr && scan) {
      const loop = gsap
        .timeline({ repeat: -1, repeatDelay: 0.6, delay: 1.2 })
        .fromTo(scan, { top: '8%', opacity: 0 }, { top: '90%', opacity: 1, duration: 1.3, ease: 'sine.inOut' })
        .to(scan, { top: '8%', opacity: 0.2, duration: 1.3, ease: 'sine.inOut' });
      loopWhileVisible(qr, loop, addCleanup);
    }
    cta.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => magnetic(el, addCleanup));
  }
};
