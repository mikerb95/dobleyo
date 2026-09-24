/**
 * Isolíneas generativas: anillos cerrados y ondulados, como las curvas de nivel
 * de una montaña vista desde arriba. Son el lenguaje visual común de la
 * portada (hero, mapa de cada finca, escena de cosecha).
 *
 * Deterministas: la misma semilla (p. ej. el slug de una finca) da siempre el
 * mismo mapa, así que el servidor pinta el SVG final y el cliente solo lo
 * anima. Módulo puro, probado con vitest.
 */

/** FNV-1a de 32 bits: convierte un texto en una semilla estable. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32: rápido, reproducible y suficiente para decoración. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ContourOptions {
  seed: number;
  /** Número de curvas de nivel. */
  rings: number;
  width: number;
  height: number;
  /** Centro de la cima, en fracción del lienzo (0-1). */
  cx?: number;
  cy?: number;
  /** Cuánto se ondulan las curvas (0 = círculos). */
  wobble?: number;
  /** Puntos por anillo. */
  resolution?: number;
}

export interface Contour {
  d: string;
  /** 0 = curva exterior (la más baja), 1 = cima. */
  level: number;
}

/**
 * Genera `rings` curvas concéntricas. Cada una es una suma de armónicos con
 * fase y amplitud de la semilla; los armónicos se comparten entre anillos
 * (con una deriva pequeña) para que las curvas no se crucen y se lean como un
 * mismo relieve.
 */
export function contourRings(opts: ContourOptions): Contour[] {
  const { seed, rings, width, height, cx = 0.5, cy = 0.5, wobble = 0.18, resolution = 64 } = opts;
  const rand = mulberry32(seed);
  const harmonics = [2, 3, 5].map((k) => ({
    k,
    amp: (0.35 + rand() * 0.65) / k,
    phase: rand() * Math.PI * 2,
    drift: (rand() - 0.5) * 0.9,
  }));

  const ox = cx * width;
  const oy = cy * height;
  const maxR = Math.min(width, height) * 0.62;
  const out: Contour[] = [];

  for (let r = 0; r < rings; r++) {
    const level = rings === 1 ? 1 : r / (rings - 1);
    // De afuera hacia adentro: la curva más baja es la más grande.
    const base = maxR * (1 - level * 0.86);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < resolution; i++) {
      const a = (i / resolution) * Math.PI * 2;
      let n = 0;
      for (const h of harmonics) n += h.amp * Math.sin(h.k * a + h.phase + h.drift * level);
      // La cima se ondula menos que la base, como en un relieve real.
      const rad = base * (1 + wobble * n * (1 - level * 0.5));
      pts.push([ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 0.82]);
    }
    out.push({ d: closedPath(pts), level });
  }
  return out;
}

/** Catmull-Rom cerrada convertida a Bézier cúbicas: curvas suaves sin codos. */
export function closedPath(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n < 3) return '';
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + ' Z';
}

/**
 * Cuántas curvas dibujar para una altitud: una cada 250 m, entre 4 y 9.
 * Así una finca a 2.100 msnm se ve más alta que una a 1.100.
 */
export function ringsForAltitude(altitude: number | null | undefined): number {
  if (!altitude || altitude <= 0) return 5;
  return Math.min(9, Math.max(4, Math.round(altitude / 250)));
}
