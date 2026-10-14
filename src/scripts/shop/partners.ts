/**
 * Partners: una bolsa recorre la línea de suministro (finca, tueste a la
 * medida, su negocio) y cada parada se enciende al pasar. El recorrido usa la
 * geometría real del camino SVG (getPointAtLength), así la bolsa no se sale de
 * él aunque cambie el tamaño de la pieza.
 */
import { gsap, loopWhileVisible, type Piece } from '../motion/core.ts';

const VIEW = { w: 360, h: 320 };

export const partners: Piece = (addCleanup) => {
  const root = document.querySelector<HTMLElement>('[data-sline]');
  if (!root) return;
  const path = root.querySelector<SVGPathElement>('.sline__path')!;
  const road = root.querySelector<SVGPathElement>('.sline__road')!;
  const packet = root.querySelector<HTMLElement>('.sline__packet')!;
  const stops = Array.from(root.querySelectorAll<HTMLElement>('.sline__stop'));
  // Celular: lista vertical sin camino; las paradas se encienden por turnos
  if (getComputedStyle(path.ownerSVGElement!).display === 'none') {
    gsap.from(stops, { x: -16, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.15, delay: 0.4, clearProps: 'transform,opacity' });
    const turns = gsap.timeline({ repeat: -1, delay: 1 });
    stops.forEach((s, i) => {
      turns.call(() => stops.forEach((x) => x.classList.toggle('is-hit', x === s)), undefined, i * 1.4);
    });
    turns.call(() => stops.forEach((x) => x.classList.remove('is-hit')), undefined, stops.length * 1.4);
    turns.to({}, { duration: 0.8 });
    loopWhileVisible(root, turns, addCleanup);
    return;
  }
  const len = path.getTotalLength();

  // Largo del camino en el que cae cada parada (la muestra más cercana)
  const stopAt = stops.map((s) => {
    const x = (parseFloat(s.style.left) / 100) * VIEW.w;
    const y = (parseFloat(s.style.top) / 100) * VIEW.h;
    let best = 0;
    let dist = Infinity;
    for (let l = 0; l <= len; l += len / 120) {
      const p = path.getPointAtLength(l);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < dist) { dist = d; best = l; }
    }
    return best / len;
  });

  const place = (t: number) => {
    const p = path.getPointAtLength(t * len);
    packet.style.left = `${(p.x / VIEW.w) * 100}%`;
    packet.style.top = `${(p.y / VIEW.h) * 100}%`;
    stops.forEach((s, i) => s.classList.toggle('is-hit', t >= stopAt[i] - 0.02 && t <= stopAt[i] + 0.12));
  };

  // Entrada: el camino se traza y las paradas aparecen en orden
  const intro = gsap.timeline({ delay: 0.4 });
  intro
    .from(road, { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' }, 0)
    .from(stops, { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)', stagger: 0.3, clearProps: 'transform,opacity' }, 0.2);

  // Recorrido en bucle, solo con la pieza en pantalla
  const state = { t: 0 };
  place(0);
  const trip = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
  trip
    .fromTo(packet, { scale: 0 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' })
    .fromTo(state, { t: 0 }, { t: 1, duration: 5, ease: 'none', onUpdate: () => place(state.t) })
    .to(packet, { scale: 0, duration: 0.3 });
  loopWhileVisible(root, trip, addCleanup);
};
