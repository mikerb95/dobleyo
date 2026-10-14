/**
 * Lectura de las recetas de /guias y /en/guides para la pieza interactiva
 * (BrewGuide). Las recetas son texto escrito para personas; aquí se sacan los
 * números que la pieza dibuja. Si un texto no trae número (la moka no se pesa,
 * se calienta "a fuego medio-bajo"), la función devuelve null y la pieza
 * muestra solo el texto.
 */

export interface Dose {
  coffee: number; // gramos
  water: number; // mililitros
}

/** "1:16 (15 g de café · 240 ml de agua)" → { coffee: 15, water: 240 } */
export function parseDose(ratio: string): Dose | null {
  const g = ratio.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  const ml = ratio.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (!g || !ml) return null;
  const coffee = Number(g[1].replace(',', '.'));
  const water = Number(ml[1].replace(',', '.'));
  return coffee > 0 && water > 0 ? { coffee, water } : null;
}

/** "1:16 (…)" → "1:16". Null si el texto no empieza por una proporción. */
export function ratioLabel(ratio: string): string | null {
  const m = ratio.match(/^\s*(1\s*:\s*\d+)/);
  return m ? m[1].replace(/\s+/g, '') : null;
}

/** Primer valor en °C: "92 – 94 °C / 198 °F" → 92. Null si no hay grados. */
export function parseTempC(temp: string): number | null {
  if (!/°\s*C/i.test(temp)) return null;
  const m = temp.match(/(\d{2,3})/);
  return m ? Number(m[1]) : null;
}

/** Duración media en segundos: "2:30 – 3:00 min" → 165; "4:00 min" → 240. */
export function parseSeconds(time: string): number | null {
  const parts = Array.from(time.matchAll(/(\d+):(\d{2})/g)).map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

const GRIND: Record<'es' | 'en', string[]> = {
  es: ['fina', 'fina-media', 'media', 'media-gruesa', 'gruesa'],
  en: ['fine', 'fine-medium', 'medium', 'medium-coarse', 'coarse'],
};
export const GRIND_STEPS = 5;

/** Posición de la molienda en una escala de 5 (0 = fina, 4 = gruesa). */
export function grindIndex(grind: string, lang: 'es' | 'en'): number | null {
  const i = GRIND[lang].indexOf(grind.trim().toLowerCase());
  return i >= 0 ? i : null;
}
