/**
 * Núcleo de motion compartido (portada ES y EN, y lo que venga después).
 *
 * - Registra GSAP y sus plugins una sola vez.
 * - Ciclo de vida compatible con ClientRouter: cada pieza se monta en
 *   `astro:page-load` dentro de un gsap.context y se desmonta en
 *   `astro:before-swap` (ScrollTriggers, observers y listeners incluidos).
 * - Fail-open: si el visitante prefiere movimiento reducido, las piezas no se
 *   montan y el HTML del servidor (estado final) queda tal cual.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, DrawSVGPlugin);

export { gsap, ScrollTrigger, SplitText };

export type Cleanup = () => void;
/** Una pieza recibe un registrador de limpiezas para lo que GSAP no revierte solo. */
export type Piece = (addCleanup: (fn: Cleanup) => void) => void;

const pieces: Piece[] = [];
let ctx: gsap.Context | null = null;
let extra: Cleanup[] = [];

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function registerPiece(piece: Piece): void {
  pieces.push(piece);
}

let mounted = false;

function mount(): void {
  // astro:page-load y el arranque directo pueden llegar los dos en la primera
  // carga: montar dos veces revierte a medias transiciones CSS y deja valores
  // finales equivocados. Una página se monta una sola vez hasta el swap.
  if (mounted) return;
  mounted = true;
  if (prefersReducedMotion()) return;
  document.documentElement.classList.add('motion-on');
  ctx = gsap.context(() => {
    for (const piece of pieces) {
      try {
        piece((fn) => extra.push(fn));
      } catch (err) {
        // Una pieza rota no debe tumbar las demás ni dejar contenido oculto.
        console.error('[motion]', err);
      }
    }
  });
  // Las fuentes cambian medidas: recalcular pines y disparadores cuando llegan.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

function unmount(): void {
  mounted = false;
  extra.forEach((fn) => {
    try {
      fn();
    } catch (_) {
      /* limpieza best-effort */
    }
  });
  extra = [];
  ctx?.revert();
  ctx = null;
  document.documentElement.classList.remove('motion-on');
}

let started = false;
/** Arranca el ciclo de vida. Idempotente: varias entradas pueden llamarlo. */
export function start(): void {
  if (started) return;
  started = true;
  document.addEventListener('astro:page-load', mount);
  document.addEventListener('astro:before-swap', unmount);
  // Si el módulo carga después del primer astro:page-load, montar ya.
  if (document.readyState !== 'loading') queueMicrotask(mount);
}

// ─── Utilidades para las piezas ─────────────────────────────────────────────

/**
 * Reproduce una timeline (o llama a play/pause) solo mientras el elemento está
 * en pantalla y la pestaña visible. Fuera de pantalla no gasta fotogramas.
 */
export function whileVisible(
  el: Element,
  onShow: () => void,
  onHide: () => void,
  addCleanup: (fn: Cleanup) => void,
  rootMargin = '0px'
): void {
  let inView = false;
  const sync = () => (inView && !document.hidden ? onShow() : onHide());
  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      sync();
    },
    { rootMargin }
  );
  io.observe(el);
  document.addEventListener('visibilitychange', sync);
  addCleanup(() => {
    io.disconnect();
    document.removeEventListener('visibilitychange', sync);
    onHide();
  });
}

/** Timeline en bucle que solo corre en pantalla. */
export function loopWhileVisible(el: Element, tl: gsap.core.Timeline, addCleanup: (fn: Cleanup) => void): void {
  tl.pause();
  whileVisible(el, () => tl.play(), () => tl.pause(), addCleanup);
}

/** Alto del header fijo (y la barra superior si está), para no fijar secciones debajo de él. */
export function headerOffset(): number {
  const header = document.querySelector('.site-header');
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
}

/**
 * Botón magnético: la píldora sigue al cursor y el texto interior se mueve un
 * 45 % de eso (dos capas, sensación de volumen). Solo con puntero fino.
 */
export function magnetic(el: HTMLElement, addCleanup: (fn: Cleanup) => void, strength = 0.35): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const inner = el.querySelector<HTMLElement>('[data-magnetic-inner]');
  const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
  const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.5, ease: 'power3.out' }) : null;
  const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.5, ease: 'power3.out' }) : null;

  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    // El centro se mide sin la traslación propia; si no, el botón se
    // retroalimenta y tiembla.
    const cx = r.left + r.width / 2 - (gsap.getProperty(el, 'x') as number);
    const cy = r.top + r.height / 2 - (gsap.getProperty(el, 'y') as number);
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    xTo(dx);
    yTo(dy);
    ixTo?.(dx * 0.45);
    iyTo?.(dy * 0.45);
  };
  const leave = () => {
    xTo(0);
    yTo(0);
    ixTo?.(0);
    iyTo?.(0);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  addCleanup(() => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
  });
}

/**
 * Luz que sigue al cursor en una rejilla de tarjetas: un solo listener escribe
 * --fx/--fy en cada tarjeta, así el halo asoma también en las vecinas.
 */
export function cursorLight(grid: HTMLElement, cardSelector: string, addCleanup: (fn: Cleanup) => void): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let raf = 0;
  const move = (e: PointerEvent) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      // Se consultan en cada movimiento: hay rejillas que se repintan al filtrar
      for (const card of grid.querySelectorAll<HTMLElement>(cardSelector)) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--fx', `${e.clientX - r.left}px`);
        card.style.setProperty('--fy', `${e.clientY - r.top}px`);
      }
    });
  };
  grid.addEventListener('pointermove', move);
  grid.classList.add('has-cursor-light');
  addCleanup(() => {
    cancelAnimationFrame(raf);
    grid.removeEventListener('pointermove', move);
    grid.classList.remove('has-cursor-light');
  });
}

/**
 * Entrada escalonada de los hijos de una rejilla. `clearProps` devuelve el
 * control al CSS de hover al terminar (si no, el transform de GSAP pisa el
 * :hover que levanta la tarjeta).
 */
export function gridEntrance(grid: Element, children?: Element[]): void {
  const items = children ?? Array.from(grid.children);
  if (!items.length) return;
  gsap.set(items, { y: 28, opacity: 0 });
  ScrollTrigger.create({
    trigger: grid,
    start: 'top 85%',
    once: true,
    onEnter: () =>
      gsap.to(items, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.09,
        clearProps: 'transform,opacity',
      }),
  });
}

/**
 * Odómetro: cada dígito es una columna con la tira 0-9 repetida dos veces y
 * se desplaza hasta su valor con expo.out y retraso por columna. El texto
 * original queda en aria-label.
 */
export function odometer(el: HTMLElement, delay = 0): gsap.core.Timeline | null {
  const text = el.dataset.odometer ?? el.textContent ?? '';
  if (!/\d/.test(text)) return null;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  el.classList.add('odo');
  const tl = gsap.timeline({ paused: true, delay });
  let col = 0;
  for (const ch of text) {
    if (!/\d/.test(ch)) {
      const s = document.createElement('span');
      s.className = 'odo__sep';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch;
      el.appendChild(s);
      continue;
    }
    const wrap = document.createElement('span');
    wrap.className = 'odo__col';
    wrap.setAttribute('aria-hidden', 'true');
    const strip = document.createElement('span');
    strip.className = 'odo__strip';
    strip.textContent = '01234567890123456789';
    wrap.appendChild(strip);
    el.appendChild(wrap);
    const digit = Number(ch);
    const final = -((10 + digit) / 20) * 100;
    // Arranca mostrando el valor real; solo rueda desde 0 cuando se reproduce.
    gsap.set(strip, { yPercent: final });
    tl.fromTo(
      strip,
      { yPercent: 0 },
      { yPercent: final, duration: 1.6, ease: 'expo.out', immediateRender: false },
      col * 0.08
    );
    col++;
  }
  return tl;
}
