/**
 * Regalos: la caja se abre al cargar y deja salir lo que trae el kit; al
 * cambiar de kit se cierra y se vuelve a abrir con el contenido nuevo. Abajo,
 * los kits entran escalonados, los íconos se trazan y la regla de envío se
 * llena hasta cada kit.
 *
 * El HTML del servidor pinta la caja abierta: aquí se parte de cerrada.
 */
import { gsap, ScrollTrigger, SplitText, gridEntrance, cursorLight, type Piece } from '../motion/core.ts';

// Debe coincidir con el transform de .gift__lid en GiftBox.astro
const OPEN = { xPercent: 9, yPercent: -15, rotation: 7 };
const CLOSED = { xPercent: 0, yPercent: 0, x: 0, y: 0, rotation: 0 };
// Cuánto bajan los artículos para quedar dentro de la caja (px del contenedor)
const INSIDE = 160;

export const gifts: Piece = (addCleanup) => {
  const page = document.querySelector<HTMLElement>('.gifts-page');
  if (!page) return;

  // ── Titular ──────────────────────────────────────────────────────────────
  const title = page.querySelector<HTMLElement>('[data-split]');
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    // El <em> del titular conserva su color: SplitText envuelve dentro de él
    gsap.from(split.words, { yPercent: 110, duration: 1, ease: 'power3.out', stagger: 0.06 });
    gsap.from(page.querySelectorAll('.gh__crumbs, .gh__lead, .gh__facts, .gh__cta'), {
      y: 16, opacity: 0, duration: 0.7, stagger: 0.08, delay: 0.3, clearProps: 'transform,opacity',
    });
  }

  // ── Caja ─────────────────────────────────────────────────────────────────
  const root = page.querySelector<HTMLElement>('[data-gift]');
  if (root) {
    const lid = root.querySelector<SVGElement>('.gift__lid')!;
    const stage = root.querySelector<HTMLElement>('.gift__stage')!;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>('.gift__set:not([hidden]) .gift__item'));

    // La tapa pasa delante del contenido solo mientras está cerrada
    const close = (tl: gsap.core.Timeline, at: number, d = 0.35) =>
      tl.to(lid, { ...CLOSED, duration: d, ease: 'power2.in' }, at).call(() => lid.classList.add('is-closed'), undefined, at + d * 0.5);
    const open = (tl: gsap.core.Timeline, at: number) =>
      tl
        .to(lid, { yPercent: -6, duration: 0.18, ease: 'power2.out' }, at)
        .call(() => lid.classList.remove('is-closed'), undefined, at + 0.3)
        .to(lid, { ...OPEN, duration: 0.85, ease: 'back.out(1.5)' }, at + 0.18)
        .fromTo(items(), { y: INSIDE }, { y: 0, duration: 0.8, ease: 'back.out(1.5)', stagger: 0.1 }, at + 0.35);

    gsap.set(lid, CLOSED);
    lid.classList.add('is-closed');
    gsap.set(items(), { y: INSIDE });
    const intro = gsap.timeline({ delay: 0.4 });
    intro.from(stage, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out' }, 0);
    open(intro, 0.9);

    // Un leve vaivén de la etiqueta mientras se ve la caja
    const tag = root.querySelector('.gift__tag');
    if (tag) gsap.to(tag, { rotation: 4, svgOrigin: '152 168', duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    let current: gsap.core.Timeline | null = null;
    const onSwitch = () => {
      current?.kill();
      current = gsap.timeline();
      // El contenido del kit anterior ya se ocultó: el nuevo arranca dentro
      current.set(items(), { y: INSIDE });
      close(current, 0, 0.3);
      open(current, 0.45);
    };
    root.addEventListener('gift:switch', onSwitch);
    addCleanup(() => root.removeEventListener('gift:switch', onSwitch));
  }

  // ── Kits ─────────────────────────────────────────────────────────────────
  const grid = page.querySelector<HTMLElement>('.gk__grid');
  if (grid) {
    gridEntrance(grid);
    cursorLight(grid, '.kit', addCleanup);
  }

  // ── Así llega: íconos que se trazan y la regla de envío ─────────────────
  const info = page.querySelector<HTMLElement>('.gb__grid');
  if (info) {
    const paths = info.querySelectorAll('.gb__icon svg > *');
    const ship = info.querySelector<HTMLElement>('[data-ship]');
    const kits = ship ? Array.from(ship.querySelectorAll<HTMLElement>('.ship__kit')) : [];
    gsap.set(paths, { drawSVG: '0%' });
    if (ship) {
      gsap.set(ship.querySelector('.ship__free'), { scaleX: 0, transformOrigin: '0 50%' });
      gsap.set(kits, { scale: 0 });
    }
    let done = false;
    ScrollTrigger.create({
      trigger: info,
      start: 'top 85%',
      onEnter: () => {
        if (done) return;
        done = true;
        const tl = gsap.timeline();
        tl.to(paths, { drawSVG: '100%', duration: 1.1, ease: 'power2.inOut', stagger: 0.05 }, 0);
        if (ship) {
          tl.to(ship.querySelector('.ship__free'), { scaleX: 1, duration: 0.6, ease: 'power2.out' }, 0.3)
            // De menor a mayor precio: cada kit cae en su punto de la regla
            .to(
              kits.sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left)),
              { scale: 1, duration: 0.45, ease: 'back.out(3)', stagger: 0.18 },
              0.6
            );
        }
      },
    });
  }
};
