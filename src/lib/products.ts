/**
 * Helpers compartidos para presentar productos en la tienda pública
 * (home, catálogo, resultados de búsqueda).
 *
 * El objetivo es que las tres superficies muestren exactamente las mismas
 * señales de confianza: calificación real, número de reseñas, notas de cata,
 * gramaje y disponibilidad.
 */

import { parseTastingNotes } from '../../server/utils/tasting.js';
import type { Lang } from '../i18n/index.ts';

// La subconsulta de agregados vive en server/utils para que Express también
// pueda usarla; se reexporta aquí para que las páginas Astro la importen junto
// al resto de helpers de presentación.
export { reviewAggregateSql } from '../../server/utils/reviews.js';

/** Mínimo de caracteres para que una búsqueda sea significativa. */
export const SEARCH_MIN_CHARS = 2;

/**
 * Busca productos activos por nombre, origen, proceso, tueste, notas de cata o
 * descripción. Se usa en el render SSR de /buscar y /search; el buscador del
 * header consume el equivalente en `GET /api/products/search`.
 *
 * Devuelve [] si la BD no está disponible: la página muestra el estado vacío en
 * lugar de reventar.
 */
export async function searchProducts(q: string, limit = 24): Promise<any[]> {
  const term = String(q ?? '').trim();
  if (term.length < SEARCH_MIN_CHARS) return [];

  const contains = `%${term}%`;
  const startsWith = `${term}%`;

  try {
    const { query } = await import('../../server/db.js');
    const result = await query(
      `SELECT
         p.id, p.slug, p.name, p.name_en, p.category, p.subcategory,
         p.origin, p.process, p.roast, p.tasting_notes,
         p.price, p.price_usd, p.rating,
         p.weight, p.weight_unit,
         p.image_url      AS image,
         p.stock_quantity AS stock,
         ${reviewAggregateSql('p')}
       FROM products p
       WHERE p.is_active = 1
         AND (p.name LIKE ? OR p.name_en LIKE ? OR p.origin LIKE ?
              OR p.process LIKE ? OR p.roast LIKE ? OR p.subcategory LIKE ?
              OR p.tasting_notes LIKE ? OR p.description LIKE ?)
       ORDER BY
         CASE
           WHEN p.name LIKE ? OR p.name_en LIKE ? THEN 0
           WHEN p.origin LIKE ? THEN 1
           ELSE 2
         END,
         p.is_bestseller DESC, p.rating DESC
       LIMIT ?`,
      [
        contains, contains, contains, contains,
        contains, contains, contains, contains,
        startsWith, startsWith, startsWith,
        limit,
      ]
    );
    return result.rows;
  } catch (_) {
    return [];
  }
}

export interface ProductRatingInfo {
  /** Promedio a mostrar (reseñas reales si existen, si no el rating editorial). */
  value: number;
  /** Número de reseñas aprobadas. 0 si nadie ha reseñado todavía. */
  count: number;
  /** true cuando el promedio proviene de reseñas de clientes verificadas. */
  fromReviews: boolean;
}

/**
 * Resuelve la calificación a mostrar. Prioriza las reseñas aprobadas sobre el
 * campo `products.rating`, que es editorial y no constituye prueba social.
 */
export function getRating(p: any): ProductRatingInfo | null {
  const count = Number(p?.review_count ?? 0) || 0;
  const avg = Number(p?.review_avg ?? 0) || 0;
  if (count > 0 && avg > 0) {
    return { value: Math.round(avg * 10) / 10, count, fromReviews: true };
  }
  const editorial = Number(p?.rating ?? 0) || 0;
  if (editorial > 0) {
    return { value: Math.round(editorial * 10) / 10, count: 0, fromReviews: false };
  }
  return null;
}

/**
 * Notas de cata del producto en el idioma pedido, con respaldo al otro idioma.
 * Devuelve como máximo `limit` notas para no romper el layout de las cards.
 */
export function getNotes(p: any, lang: Lang = 'es', limit = 3): string[] {
  // El catálogo estático de respaldo (src/data/products.ts) ya trae las notas
  // como arrays sueltos; la BD las guarda como JSON en tasting_notes.
  const tn =
    (parseTastingNotes(p?.tasting_notes) as { es?: string[]; en?: string[] } | null) ??
    (Array.isArray(p?.notes) || Array.isArray(p?.notesEn)
      ? { es: p?.notes, en: p?.notesEn }
      : null);
  if (!tn) return [];
  const primary = lang === 'en' ? tn.en : tn.es;
  const fallback = lang === 'en' ? tn.es : tn.en;
  const notes = (primary?.length ? primary : fallback) ?? [];
  return notes.filter((n) => typeof n === 'string' && n.trim()).slice(0, limit);
}

/**
 * Presentación legible del gramaje: 250 g, 1 kg, 500 ml, 1 unidad.
 */
export function formatWeight(p: any, lang: Lang = 'es'): string | null {
  const w = Number(p?.weight ?? 0);
  if (!w || Number.isNaN(w)) return null;
  const unit = p?.weight_unit ?? 'g';
  const n = Number.isInteger(w) ? w : Math.round(w * 100) / 100;
  const formatted = n.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO');
  if (unit === 'unidad') {
    const label = lang === 'en' ? (n === 1 ? 'unit' : 'units') : n === 1 ? 'unidad' : 'unidades';
    return `${formatted} ${label}`;
  }
  return `${formatted} ${unit}`;
}

export type StockLevel = 'out' | 'low' | 'ok' | 'unknown';

/** Clasifica el stock para decidir qué señal de disponibilidad mostrar. */
export function getStockLevel(p: any, lowThreshold = 5): StockLevel {
  const stock = p?.stock;
  if (typeof stock !== 'number' || Number.isNaN(stock)) return 'unknown';
  if (stock <= 0) return 'out';
  if (stock <= lowThreshold) return 'low';
  return 'ok';
}

/** Etiqueta de disponibilidad lista para pintar, o null si no aplica. */
export function stockLabel(p: any, lang: Lang = 'es', lowThreshold = 5): string | null {
  const level = getStockLevel(p, lowThreshold);
  if (level === 'out') return lang === 'en' ? 'Sold out' : 'Agotado';
  if (level === 'low') {
    return lang === 'en' ? `Only ${p.stock} left` : `Últimas ${p.stock}`;
  }
  return null;
}
