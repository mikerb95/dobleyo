/**
 * Hero: entrada del titular, video del viaje y etiqueta viva sincronizada.
 *
 * El video es un loop de 4 tomas de 4 s (cereza, secado, tambor, taza). La
 * etiqueta lee `currentTime` en cada fotograma: la etapa activa y su barra de
 * progreso siguen exactamente a la imagen. Si el video no se carga (ahorro de
 * datos, error de códec), un reloj interno hace lo mismo sin imagen.
 */
import { gsap, SplitText, magnetic, whileVisible, odometer, type Piece } from '../motion/core.ts';

const SEGMENT = 4; // segundos por toma
const STAGES = 4;

export const hero: Piece = (addCleanup) => {
  const root = document.querySelector<HTMLElement>('[data-home-hero]');
  if (!root) return;
  const video = root.querySelector<HTMLVideoElement>('[data-hero-video]');
  const ticket = root.querySelector<HTMLElement>('[data-lot-ticket]');
  const title = root.querySelector<HTMLElement>('.hh__title');

  // ── Entrada ──────────────────────────────────────────────────────────────
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    tl.from(split.words, { yPercent: 110, duration: 1, stagger: 0.045 }, 0);
  }
  tl.from('.hh__lead', { y: 16, opacity: 0, duration: 0.8 }, 0.35)
    .from('.hh__actions', { y: 16, opacity: 0, duration: 0.8 }, 0.45);
  if (ticket) {
    tl.from('.hh__ticket', { y: 60, rotate: -6, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0.3);
    // El QR solo está cuando la trazabilidad pública está encendida (lib/flags.ts).
    if (ticket.querySelector('.qr')) {
      tl.from(ticket.querySelectorAll('.qr__finders rect'), { scale: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: { each: 0.004, from: 'random' } }, 0.7)
        .from(ticket.querySelectorAll('.qr__data rect'), { opacity: 0, duration: 0.2, stagger: { each: 0.0015, from: 'random' } }, 0.8);
    }
    // clearProps: después manda el CSS de la etapa activa (filas tenues o encendidas).
    tl.from(ticket.querySelectorAll('.lot__row'), { x: -10, opacity: 0, duration: 0.5, stagger: 0.06, clearProps: 'opacity,transform' }, 0.8);
    const code = ticket.querySelector<HTMLElement>('.lot__code');
    if (code) tl.to(code, { duration: 1, scrambleText: { text: code.textContent ?? '', chars: '0123456789ABCDEFHKLMNPRSTUVXYZ-', speed: 0.6 } }, 0.7);
  }

  root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => magnetic(el, addCleanup));

  // ── Isolíneas: parallax con el cursor y con el scroll ────────────────────
  const contours = root.querySelector<SVGElement>('.hh__contours');
  if (contours) {
    gsap.to(contours, {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
    });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const xTo = gsap.quickTo(contours, 'x', { duration: 1.2, ease: 'power2.out' });
      const yTo = gsap.quickTo(contours, 'y', { duration: 1.2, ease: 'power2.out' });
      const move = (e: PointerEvent) => {
        const r = root.getBoundingClientRect();
        xTo(((e.clientX - r.left) / r.width - 0.5) * -24);
        yTo(((e.clientY - r.top) / r.height - 0.5) * -16);
      };
      root.addEventListener('pointermove', move);
      addCleanup(() => root.removeEventListener('pointermove', move));
    }
  }

  // ── Video ────────────────────────────────────────────────────────────────
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let videoOk = false;
  if (video && !conn?.saveData) {
    video.preload = 'auto';
    // Invisible hasta que de verdad reproduce: si el navegador no decodifica
    // H.264 pinta un cuadro gris, y es mejor dejar ver el póster del fondo.
    gsap.set(video, { opacity: 0 });
    const onPlaying = () => {
      videoOk = true;
      gsap.to(video, { opacity: 1, duration: 0.8, ease: 'power1.out' });
    };
    const onError = () => {
      videoOk = false;
      gsap.set(video, { opacity: 0 });
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError, true);
    whileVisible(
      root,
      () => void video.play().catch(() => (videoOk = false)),
      () => video.pause(),
      addCleanup
    );
    addCleanup(() => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError, true);
    });
  }

  // ── Etiqueta sincronizada ────────────────────────────────────────────────
  if (!ticket) return;
  const stageEls = Array.from(ticket.querySelectorAll<HTMLElement>('.lot__stage'));
  const fills = stageEls.map((s) => s.querySelector<HTMLElement>('.lot__stage-fill'));
  const rows = Array.from(ticket.querySelectorAll<HTMLElement>('[data-for-stage]'));
  const scan = ticket.querySelector<HTMLElement>('.lot__scan');
  const curveLine = ticket.querySelector<SVGPathElement>('.lot__curve-line');
  const curveEnd = ticket.querySelector<SVGCircleElement>('.lot__curve-end');
  const score = ticket.querySelector<HTMLElement>('.lot__score');
  const scoreTl = score ? odometer(score) : null;
  const seen = new Set<number>();

  ticket.classList.add('is-syncing');
  gsap.set(fills, { scaleX: 0 });

  const enterStage = (i: number) => {
    stageEls.forEach((el, j) => el.classList.toggle('is-active', j === i));
    rows.forEach((r) => r.classList.toggle('is-lit', Number(r.dataset.forStage) === i));
    fills.forEach((f, j) => j < i && gsap.set(f, { scaleX: 1 }));
    if (i === 0) gsap.set(fills, { scaleX: 0 });

    // Cada dato "llega" la primera vez que su etapa se enciende.
    if (!seen.has(i)) {
      seen.add(i);
      rows
        .filter((r) => Number(r.dataset.forStage) === i)
        .forEach((r) =>
          r.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) =>
            gsap.to(el, { duration: 0.9, scrambleText: { text: el.textContent ?? '', chars: 'lowerCase', speed: 0.5 } })
          )
        );
    }
    if (i === 2 && curveLine) {
      gsap.fromTo(curveLine, { drawSVG: '0%' }, { drawSVG: '100%', duration: SEGMENT * 0.8, ease: 'power1.inOut' });
      if (curveEnd) gsap.fromTo(curveEnd, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, delay: SEGMENT * 0.8 });
    }
    if (i === 3) {
      scoreTl?.restart();
      if (scan) gsap.fromTo(scan, { top: '0%', opacity: 1 }, { top: '100%', opacity: 0.2, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: 1 });
    }
  };

  let current = -1;
  let clock = 0;
  const tick = (_time: number, deltaMs: number) => {
    let t: number;
    if (videoOk && video && !video.paused) {
      t = video.currentTime;
    } else {
      clock += deltaMs / 1000;
      t = clock;
    }
    const cycle = t % (SEGMENT * STAGES);
    const i = Math.min(STAGES - 1, Math.floor(cycle / SEGMENT));
    if (i !== current) {
      current = i;
      enterStage(i);
    }
    const f = fills[i];
    if (f) gsap.set(f, { scaleX: (cycle - i * SEGMENT) / SEGMENT });
  };

  // El reloj solo corre con la etiqueta en pantalla y la pestaña visible.
  let ticking = false;
  whileVisible(
    ticket,
    () => {
      if (!ticking) gsap.ticker.add(tick);
      ticking = true;
    },
    () => {
      if (ticking) gsap.ticker.remove(tick);
      ticking = false;
    },
    addCleanup
  );
  addCleanup(() => {
    ticket.classList.remove('is-syncing');
    rows.forEach((r) => r.classList.remove('is-lit'));
    stageEls.forEach((s) => s.classList.remove('is-active'));
  });
};
