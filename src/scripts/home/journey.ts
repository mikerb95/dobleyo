/**
 * "Del grano a tu taza": cada escena tiene su propia timeline, que se usa de
 * dos formas según el ancho:
 *
 * - Escritorio (>= 1024 px): la sección se fija y una timeline maestra con
 *   scrub encadena las cuatro escenas; el scroll decide la etapa activa.
 * - Móvil y tableta: sin fijar; cada escena se reproduce una vez al entrar.
 *
 * Las timelines parten de un estado inicial y terminan en el estado que ya
 * pinta el servidor, así que sin JS (o si algo falla) todo se ve completo.
 */
import {
  gsap,
  ScrollTrigger,
  SplitText,
  headerOffset,
  loopWhileVisible,
  magnetic,
  type Piece,
} from '../motion/core.ts';

type SceneBuilder = (scene: HTMLElement) => gsap.core.Timeline;

// ── Escenas ────────────────────────────────────────────────────────────────

const harvest: SceneBuilder = (scene) => {
  const tl = gsap.timeline();
  tl.fromTo(scene.querySelector('.sc-origin__photo'), { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0)
    .from(scene.querySelector('.sc-origin__card'), { y: 24, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0.1)
    .from(scene.querySelectorAll('.sc-origin__row, .sc-origin__code'), { opacity: 0, x: -8, duration: 0.3, stagger: 0.06 }, 0.3);
  return tl;
};

const process: SceneBuilder = (scene) => {
  const tl = gsap.timeline();
  const root = scene.querySelector<HTMLElement>('[data-process]');
  const kind = root?.dataset.process ?? 'other';
  const skin = scene.querySelector('.sc-process__skin');
  const muc = scene.querySelector('.sc-process__mucilage');
  const bean = scene.querySelector('.sc-process__bean');
  const chips = scene.querySelectorAll('.sc-process__chips li');
  const lotChip = scene.querySelector('.sc-process__chips li.is-lot');
  const text = scene.querySelector('.sc-process__text');
  const origin = { svgOrigin: '120 120' };

  // Parte siempre de la cereza entera, recién cosechada.
  tl.fromTo(skin, { opacity: 0.95, scale: 1, ...origin }, { opacity: 0.95, duration: 0.01 }, 0)
    .fromTo(muc, { opacity: 0.85, scale: 1, ...origin }, { opacity: 0.85, duration: 0.01 }, 0)
    .from(chips, { y: 10, opacity: 0, duration: 0.4, stagger: 0.08 }, 0.1)
    .from(text, { opacity: 0, y: 8, duration: 0.5 }, 0.2);

  if (kind === 'washed') {
    tl.to(skin, { opacity: 0, scale: 1.3, duration: 0.7, ease: 'power2.in' }, 0.5)
      .to(muc, { opacity: 0, scale: 1.18, duration: 0.7, ease: 'power2.in' }, 1)
      .fromTo(bean, { scale: 0.94, ...origin }, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 1.5);
  } else if (kind === 'honey') {
    tl.to(skin, { opacity: 0, scale: 1.3, duration: 0.7, ease: 'power2.in' }, 0.5)
      .to(muc, { opacity: 0.55, scale: 0.97, duration: 0.8 }, 1);
  } else if (kind === 'natural') {
    tl.to([skin, muc], { scale: 0.92, duration: 1.2, ease: 'power1.inOut' }, 0.5).to(skin, { opacity: 0.92, duration: 1.2 }, 0.5);
  }
  if (lotChip) tl.fromTo(lotChip, { scale: 1 }, { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1 }, 1.6);
  return tl;
};

const roast: SceneBuilder = (scene) => {
  const tl = gsap.timeline();
  const svg = scene.querySelector<SVGSVGElement>('.sc-roast');
  const line = scene.querySelector<SVGPathElement>('.sc-roast__line');
  const head = scene.querySelector<SVGCircleElement>('.sc-roast__head');
  const readout = scene.querySelector<SVGTextElement>('[data-readout]');
  if (!svg || !line) return tl;
  const length = line.getTotalLength();
  const plotH = 220;
  const tMin = 60;
  const tMax = 240;
  const final = readout?.textContent ?? '';
  const progress = { p: 0 };

  tl.from(scene.querySelectorAll('.sc-grid, .sc-tick'), { opacity: 0, duration: 0.4, stagger: 0.02 }, 0)
    .fromTo(line, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2, ease: 'none' }, 0.2)
    .fromTo(
      progress,
      { p: 0 },
      {
        p: 1,
        duration: 2,
        ease: 'none',
        // La cabeza y la lectura de °C siguen al trazo. DrawSVG avanza por
        // longitud de trazo (no por tiempo), así que el punto se toma del
        // mismo path a la misma fracción de longitud.
        onUpdate: () => {
          const { x, y } = line.getPointAtLength(progress.p * length);
          head?.setAttribute('cx', String(x));
          head?.setAttribute('cy', String(y));
          if (readout) readout.textContent = `${Math.round(tMin + (1 - y / plotH) * (tMax - tMin))}°C`;
        },
        onComplete: () => readout && (readout.textContent = final),
      },
      0.2
    )
    .from(scene.querySelector('.sc-roast__charge'), { opacity: 0, duration: 0.3 }, 0.25)
    .from(scene.querySelector('.sc-roast__turning'), { opacity: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.35 }, 0.55)
    .from(scene.querySelector('.sc-roast__drop'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.45, ease: 'back.out(2)' }, 2.2)
    .from(scene.querySelector('.sc-caption'), { opacity: 0, duration: 0.4 }, 2.3);
  return tl;
};

const bag: SceneBuilder = (scene) => {
  const tl = gsap.timeline();
  tl.from(scene.querySelector('.sc-bag__bag'), { y: 60, opacity: 0, rotate: -4, duration: 0.8, ease: 'power3.out' }, 0)
    .from(scene.querySelector('.sc-bag__label'), { scale: 1.25, opacity: 0, duration: 0.45, ease: 'back.out(2)' }, 0.55)
    .from(scene.querySelectorAll('.qr__finders rect'), { scale: 0, transformOrigin: '50% 50%', duration: 0.3, stagger: { each: 0.004, from: 'random' } }, 0.8)
    .from(scene.querySelectorAll('.qr__data rect'), { opacity: 0, duration: 0.15, stagger: { each: 0.0012, from: 'random' } }, 0.9)
    .fromTo(scene.querySelector('.sc-bag__scan'), { top: '0%', opacity: 1 }, { top: '100%', opacity: 0, duration: 0.8, ease: 'sine.inOut' }, 1.7)
    .from(scene.querySelector('.sc-bag__code'), { opacity: 0, duration: 0.3 }, 1.9);
  return tl;
};

const BUILDERS: SceneBuilder[] = [harvest, process, roast, bag];

// ── Pieza ─────────────────────────────────────────────────────────────────

export const journey: Piece = (addCleanup) => {
  const section = document.querySelector<HTMLElement>('[data-journey]');
  if (!section) return;
  const body = section.querySelector<HTMLElement>('[data-journey-body]');
  const steps = Array.from(section.querySelectorAll<HTMLElement>('.tj__step'));
  const scenes = steps.map((s) => s.querySelector<HTMLElement>('[data-scene]'));
  const railFill = section.querySelector<HTMLElement>('.tj__rail-fill');
  if (!body || steps.length !== 4) return;

  // Titular
  const title = section.querySelector<HTMLElement>('.tj__title');
  if (title) {
    const split = SplitText.create(title, { type: 'words', mask: 'words' });
    gsap.from(split.words, {
      yPercent: 110,
      duration: 0.9,
      stagger: 0.06,
      ease: 'power3.out',
      scrollTrigger: { trigger: title, start: 'top 85%', once: true },
    });
  }

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px)', () => {
    section.classList.add('tj--pinned');
    const pinTop = () => headerOffset() + 16;
    section.style.setProperty('--pin-top', `${pinTop()}px`);

    let active = -1;
    const setActive = (i: number) => {
      if (i === active) return;
      active = i;
      steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    };
    setActive(0);

    const master = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: body,
        start: () => `top ${pinTop()}px`,
        end: () => `+=${Math.round(window.innerHeight * 3)}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setActive(Math.min(3, Math.floor(self.progress * 4 * 0.999)));
          if (railFill) gsap.set(railFill, { scaleY: self.progress });
        },
      },
    });
    // Cada escena ocupa una cuarta parte del recorrido: 80 % animación, 20 %
    // de pausa para leerla antes de pasar a la siguiente.
    scenes.forEach((scene, i) => {
      if (!scene) return;
      const tl = BUILDERS[i](scene);
      const d = tl.duration() || 1;
      master.add(tl.timeScale(d / 0.8), i);
    });
    master.to({}, { duration: 0.001 }, 4);

    // Clic en un paso: salta a su tramo del recorrido.
    const onClick = (e: Event) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('.tj__step');
      const st = master.scrollTrigger;
      if (!li || !st) return;
      const i = Number(li.dataset.step);
      window.scrollTo({ top: st.start + (st.end - st.start) * ((i + 0.35) / 4), behavior: 'smooth' });
    };
    body.addEventListener('click', onClick);

    return () => {
      body.removeEventListener('click', onClick);
      section.classList.remove('tj--pinned');
      steps.forEach((s) => s.classList.remove('is-active'));
    };
  });

  mm.add('(max-width: 1023px)', () => {
    scenes.forEach((scene, i) => {
      if (!scene) return;
      const tl = BUILDERS[i](scene).pause(0);
      ScrollTrigger.create({
        trigger: scene,
        // Por el centro: el texto va encima y la escena asoma antes de verse.
        start: 'center 88%',
        once: true,
        onEnter: () => tl.play(),
      });
    });
  });

  addCleanup(() => mm.revert());

  // ── CTA de trazabilidad ──────────────────────────────────────────────────
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
