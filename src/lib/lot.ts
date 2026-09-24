/**
 * Ficha de lote para la portada: convierte una fila de trazabilidad
 * (coffee_harvests + tostión + empaque + finca) en los datos que muestran la
 * etiqueta viva del hero y la escena "Del grano a tu taza".
 *
 * Módulo puro (sin BD ni DOM): se usa en el servidor y se prueba con vitest.
 * La consulta vive en `lot.server.ts`.
 */
import type { Lang } from '../i18n/index.ts';

export interface LotRow {
  lot_id: string;
  farm?: string | null;
  farm_slug?: string | null;
  region?: string | null;
  municipality?: string | null;
  altitude?: number | string | null;
  variety?: string | null;
  process?: string | null;
  taste_notes?: string | null;
  harvest_date?: string | null;
  roast_level?: string | null;
  actual_temp?: number | null;
  roast_time_minutes?: number | null;
  roast_date?: string | null;
  score?: number | null;
}

export interface LotView {
  code: string;
  /** true cuando no hay lote real y se muestra el ejemplo (lleva etiqueta visible). */
  illustrative: boolean;
  farm: string;
  farmSlug: string | null;
  region: string;
  altitude: number | null;
  altitudeLabel: string;
  variety: string;
  process: string;
  notes: string[];
  roastLevel: string;
  roastTemp: number | null;
  roastMinutes: number | null;
  roastDate: string | null;
  harvestDate: string | null;
  /** Puntaje SCA. Solo se muestra en escala SCA (>= 60); otras escalas se ignoran. */
  score: number | null;
  /** URL absoluta que codifica el QR: la misma que imprime la etiqueta física. */
  qrUrl: string;
}

/** Ejemplo para cuando la BD no responde. Se marca como ilustrativo en la UI. */
export const EXAMPLE_LOT: LotRow = {
  lot_id: 'DY-EJEMPLO-001',
  farm: 'Finca de ejemplo',
  region: 'Huila',
  altitude: 1750,
  variety: 'Caturra',
  process: 'Lavado',
  taste_notes: 'Panela, durazno, cacao',
  harvest_date: null,
  roast_level: 'Medio',
  actual_temp: 200,
  roast_time_minutes: 12,
  roast_date: null,
  score: null,
};

const SITE = 'https://dobleyo.cafe';

// Los datos de lote se registran en español; en inglés se traducen los
// valores conocidos y el resto se deja tal cual (mejor el término original
// que una traducción inventada).
const EN_TERMS: Record<string, string> = {
  lavado: 'Washed',
  honey: 'Honey',
  natural: 'Natural',
  claro: 'Light',
  medio: 'Medium',
  'medio-oscuro': 'Medium-dark',
  oscuro: 'Dark',
  bergamota: 'bergamot',
  durazno: 'peach',
  'té negro': 'black tea',
  mora: 'blackberry',
  'vino tinto': 'red wine',
  cacao: 'cacao',
  naranja: 'orange',
  miel: 'honey',
  'chocolate con leche': 'milk chocolate',
  chocolate: 'chocolate',
  cereza: 'cherry',
  panela: 'panela',
  caramelo: 'caramel',
  floral: 'floral',
  jazmín: 'jasmine',
  'frutos rojos': 'red berries',
};

const ES_TERMS: Record<string, string> = {
  light: 'Claro',
  medium: 'Medio',
  dark: 'Oscuro',
};

function term(value: string, lang: Lang): string {
  const key = value.trim().toLowerCase();
  const dict = lang === 'en' ? EN_TERMS : ES_TERMS;
  return dict[key] ?? value.trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function parseNotes(raw: string | null | undefined, lang: Lang, limit = 3): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;/]/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((n) => capitalize(term(n, lang)));
}

export function formatAltitude(alt: number | null, lang: Lang): string {
  if (alt == null) return '';
  const n = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CO').format(alt);
  return lang === 'en' ? `${n} masl` : `${n} msnm`;
}

function formatShortDate(raw: string | null | undefined, lang: Lang): string | null {
  if (!raw) return null;
  // SQLite guarda "YYYY-MM-DD HH:MM:SS" sin zona: se lee como UTC para que la
  // fecha no cambie según el servidor.
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function toLotView(row: LotRow, lang: Lang, illustrative = false): LotView {
  const altitude = toNumber(row.altitude);
  const score = toNumber(row.score);
  return {
    code: row.lot_id,
    illustrative,
    farm: row.farm ?? '',
    farmSlug: row.farm_slug ?? null,
    region: [row.municipality, row.region].filter(Boolean).join(', '),
    altitude,
    altitudeLabel: formatAltitude(altitude, lang),
    variety: row.variety ?? '',
    process: row.process ? term(row.process, lang) : '',
    notes: parseNotes(row.taste_notes, lang),
    roastLevel: row.roast_level ? term(row.roast_level, lang) : '',
    roastTemp: toNumber(row.actual_temp),
    roastMinutes: toNumber(row.roast_time_minutes),
    roastDate: formatShortDate(row.roast_date, lang),
    harvestDate: formatShortDate(row.harvest_date, lang),
    score: score != null && score >= 60 && score <= 100 ? score : null,
    qrUrl: `${SITE}/trazabilidad?lote=${encodeURIComponent(row.lot_id)}`,
  };
}

// ─── Curva de tueste ────────────────────────────────────────────────────────

export interface RoastCurveOptions {
  width: number;
  height: number;
  /** Temperatura de carga del tambor (°C). */
  charge?: number;
  /** Rango vertical del gráfico (°C). */
  tempMin?: number;
  tempMax?: number;
  /** Muestras de la curva. */
  samples?: number;
}

export interface RoastCurve {
  d: string;
  points: Array<[number, number]>;
  /** Punto final (el dato real del lote: temperatura y minutos). */
  end: { x: number; y: number };
  /** Punto de retorno: donde el grano deja de enfriar el tambor y empieza a subir. */
  turning: { x: number; y: number; t: number; temp: number };
  x: (minutes: number) => number;
  y: (temp: number) => number;
}

/**
 * Curva de referencia de temperatura del grano. No es la curva medida del
 * lote (la BD solo guarda temperatura final y duración): es la forma típica
 * de un tueste que termina en ese punto real. La UI lo dice así.
 *
 * Forma: la carga cae hasta el punto de retorno (~1,3 min) y después sube con
 * una tasa de subida que decrece (1 - e^-k), como en un tueste de especialidad.
 */
export function roastCurve(endTemp: number, minutes: number, opts: RoastCurveOptions): RoastCurve {
  const { width, height, charge = 200, tempMin = 60, tempMax = 240, samples = 48 } = opts;
  const total = Math.max(minutes, 3);
  const tp = Math.min(1.3, total * 0.2);
  const tpTemp = 92;
  const k = 1.7;

  const temp = (t: number): number => {
    if (t <= tp) {
      const u = t / tp;
      return charge - (charge - tpTemp) * Math.sin((u * Math.PI) / 2);
    }
    const u = (t - tp) / (total - tp);
    return tpTemp + (endTemp - tpTemp) * ((1 - Math.exp(-k * u)) / (1 - Math.exp(-k)));
  };

  const x = (m: number) => (m / total) * width;
  const y = (c: number) => height - ((c - tempMin) / (tempMax - tempMin)) * height;

  const points: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * total;
    points.push([round(x(t)), round(y(temp(t)))]);
  }
  const d = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ');

  return {
    d,
    points,
    end: { x: round(x(total)), y: round(y(endTemp)) },
    turning: { x: round(x(tp)), y: round(y(tpTemp)), t: tp, temp: tpTemp },
    x,
    y,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Método de beneficio ────────────────────────────────────────────────────

export type ProcessKind = 'washed' | 'honey' | 'natural' | 'other';

/** Clasifica el proceso registrado (en español, inglés o código de etiqueta). */
export function processKind(process: string | null | undefined): ProcessKind {
  const p = (process ?? '').trim().toLowerCase();
  if (!p) return 'other';
  if (/lavad|washed|^hum$|húmedo|humedo/.test(p)) return 'washed';
  if (/honey|miel|^hon$/.test(p)) return 'honey';
  if (/natural|^nat$|seco/.test(p)) return 'natural';
  return 'other';
}
