// Utilidad compartida (Astro SSR + Express) para las notas de cata.
// En BD, products.tasting_notes se guarda como string JSON: {"es":[...],"en":[...]}.
// El driver libSQL lo devuelve como texto, por lo que hay que parsearlo antes de usarlo.

/**
 * Normaliza tasting_notes a objeto { es: string[], en: string[] } | null.
 * Acepta string JSON, objeto ya parseado, o null/undefined.
 */
export function parseTastingNotes(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
