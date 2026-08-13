/**
 * Acceso a datos de productos para el render SSR.
 *
 * Vive separado de `products.ts` porque este módulo importa el cliente de BD:
 * el catálogo importa los helpers de presentación también desde el navegador y
 * arrastrar el driver de Turso al bundle del cliente sería un error grave.
 */

import { SEARCH_MIN_CHARS } from './products.ts';
import { reviewAggregateSql } from '../../server/utils/reviews.js';

export { reviewAggregateSql };

/**
 * Busca productos activos por nombre, origen, proceso, tueste, notas de cata o
 * descripción. Alimenta el render SSR de /buscar y /search; el buscador del
 * header consume el equivalente en `GET /api/products/search`.
 *
 * Devuelve [] si la BD no está disponible: la página muestra su estado vacío en
 * lugar de fallar.
 */
export async function searchProducts(q: string, limit = 24): Promise<any[]> {
  const term = String(q ?? '').trim();
  if (term.length < SEARCH_MIN_CHARS) return [];

  if (process.env.SEARCH_FIXTURE === '1') {
    return [
      { id: 'cf-huila', slug: 'cf-huila', name: 'Huila', name_en: 'Huila', origin: 'Huila', process: 'Honey', price: 45000, price_usd: 12, rating: 4.7, review_count: 2, review_avg: 4.5, tasting_notes: '{"es":["Cítricos","Miel","Floral"],"en":["Citrus","Honey","Floral"]}', weight: 250, weight_unit: 'g', stock: 3, image: 'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop' },
      { id: 'cf-narino', slug: 'cf-narino', name: 'Nariño', origin: 'Nariño', process: 'Natural', price: 48000, price_usd: 13, rating: 4.5, review_count: 0, review_avg: null, tasting_notes: '{"es":["Frutas Rojas","Chocolate"]}', weight: 1, weight_unit: 'kg', stock: 0, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop' },
    ];
  }

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
