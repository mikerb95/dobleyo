// Utilidad compartida (Astro SSR + Express) para los agregados de reseñas.
// Vive en server/ porque Express no puede importar los .ts de src/lib.

/**
 * Subconsulta con el número de reseñas aprobadas y su promedio, para añadir al
 * SELECT de cualquier query sobre `products`.
 *
 * `alias` es el alias de la tabla products en la query (por defecto `p`). Nunca
 * recibe datos de usuario, así que interpolarlo no abre una vía de inyección.
 *
 * @param {string} alias
 * @returns {string}
 */
export function reviewAggregateSql(alias = 'p') {
  return `
       (SELECT COUNT(*)
          FROM product_reviews r
         WHERE r.product_id = ${alias}.id AND r.is_approved = 1) AS review_count,
       (SELECT AVG(CAST(r.rating AS REAL))
          FROM product_reviews r
         WHERE r.product_id = ${alias}.id AND r.is_approved = 1) AS review_avg`;
}
