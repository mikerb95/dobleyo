/**
 * Manifiesto: las palabras pasan de tenues a plenas con el scroll y el puente
 * se dibuja al mismo ritmo, con un grano que lo cruza de la finca a la taza.
 */
import { gsap, SplitText, type Piece } from '../motion/core.ts';

export const manifesto: Piece = () => {
  const root = document.querySelector<HTMLElement>('[data-manifesto]');
  if (!root) return;
  const quote = root.querySelector<HTMLElement>('.mf__quote');
  const arc = root.querySelector<SVGPathElement>('.mf__arc');
  const bean = root.querySelector<SVGEllipseElement>('.mf__bean');
  if (!quote || !arc) return;

  const split = SplitText.create(quote, { type: 'words' });
  const length = arc.getTotalLength();
  const progress = { p: 0 };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: root, start: 'top 75%', end: 'bottom 60%', scrub: 0.5 },
  });
  tl.fromTo(split.words, { opacity: 0.16 }, { opacity: 1, stagger: 0.05, duration: 0.3 }, 0)
    .fromTo(arc, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2 }, 0.1)
    .fromTo(
      progress,
      { p: 0 },
      {
        p: 1,
        duration: 1.2,
        onUpdate: () => {
          if (!bean) return;
          const { x, y } = arc.getPointAtLength(progress.p * length);
          bean.setAttribute('cx', String(x));
          bean.setAttribute('cy', String(y));
          bean.style.opacity = progress.p > 0.02 && progress.p < 0.98 ? '1' : '0';
        },
      },
      0.1
    )
    .from(root.querySelectorAll('.mf__steam'), { opacity: 0, y: 6, duration: 0.2 }, 1.2);
};
