/**
 * Regalos: la caja se abre al cargar y deja salir lo que trae el kit; al
 * cambiar de kit se cierra y se vuelve a abrir con el contenido nuevo. Abajo,
 * la regla de envío se llena hasta cada kit y los íconos se trazan.
 *
 * El HTML del servidor pinta la caja abierta: aquí se parte de cerrada.
 */
import { gsap, ScrollTrigger, SplitText, gridEntrance, cursorLight, type Piece } from '../motion/core.ts';

// Debe coincidir con el transform de .gift__lid en GiftBox.astro: la tapa
// queda parada en el piso junto a la caja (más vertical en celular para no
// salirse de la pantalla).
const narrow = () => window.matchMedia('(max-width: 480px)').matches;
const open = () => ({ x: 6, y: narrow() ? 140 : 170, rotation: narrow() ? 91 : 96 });
const CLOSED = { x: 0, y: 0, rotation: 0 };

export const gifts: Piece = (addCleanup) => {
  const root = document.querySelector<HTMLElement>('[data-gift]');
  const page = document.querySelector<HTMLElement>('.regalos-page');
  if (!page) return;

  const title = page.querySelector<HTMLElement>('[data-split]');
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    gsap.from(split.words, { yPercent: 110, duration: 1, ease: 'power3.out', stagger: 0.05 });
    gsap.from(page.querySelectorAll('.breadcrumb, .regalos-subtitle'), { y: 14, opacity: 0, duration: 0.7, stagger: 0.1, delay: 0.25 });
  }

  if (root) {
    const lid = root.querySelector<HTMLElement>('.gift__lid')!;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>('.gift__set:not([hidden]) .gift__item'));
    // Los artículos arrancan dentro de la caja (tapados por su frente)
    const rise = (tl: gsap.core.Timeline, at: number) =>
      tl.fromTo(items(), { y: 200, opacity: 1 }, { y: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.1 }, at);

    gsap.set(lid, CLOSED);
    gsap.set(items(), { y: 200 });
    const intro = gsap.timeline({ delay: 0.5 });
    intro
      .fromTo(root.querySelector('.gift__box'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 0)
      // Un pequeño salto antes de abrirse: la tapa "cede"
      .to(lid, { y: -8, duration: 0.18, ease: 'power2.out' }, 0.75)
      .to(lid, { ...open(), duration: 0.9, ease: 'back.out(1.4)' }, 0.93);
    rise(intro, 1.05);

    let current: gsap.core.Timeline | null = null;
    const onSwitch = () => {
      current?.kill();
      current = gsap.timeline();
      current.set(items(), { y: 200 }).to(lid, { ...CLOSED, duration: 0.01 }).to(lid, { y: -8, duration: 0.15 }, 0.1).to(lid, { ...open(), duration: 0.7, ease: 'back.out(1.4)' }, 0.25);
      rise(current, 0.35);
    };
    root.addEventListener('gift:switch', onSwitch);
    addCleanup(() => root.removeEventListener('gift:switch', onSwitch));
  }

  // ── Rejilla de kits ──────────────────────────────────────────────────────
  const grid = page.querySelector<HTMLElement>('.regalos-grid');
  if (grid) {
    gridEntrance(grid);
    cursorLight(grid, '.card', addCleanup);
  }

  // ── Beneficios: íconos que se trazan y la regla de envío ────────────────
  const info = page.querySelector<HTMLElement>('.regalos-info');
  if (info) {
    const paths = info.querySelectorAll('.info-icon svg > *');
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
