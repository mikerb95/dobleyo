import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { parseTastingNotes } from '../utils/tasting.js';
import { reviewAggregateSql } from '../utils/reviews.js';

export const productsRouter = Router();

// Mapa de categoría BD → etiqueta visual
const CATEGORY_LABEL = { cafe: 'Cafés', accesorio: 'Accesorios', merchandising: 'Merchandising' };

// ─── GET /api/products ───────────────────────────────────────────────────────
// Listado público de productos activos con filtros y paginación opcionales.
// Query params: category, origin, process, roast, active, page, limit
productsRouter.get('/', async (req, res) => {
  try {
    const { category, origin, process: proc, roast, active = 'true', page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(200, parseInt(limit) || 50);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];

    if (active !== 'all') {
      conditions.push(`is_active = ${active === 'false' ? '0' : '1'}`);
    }
    if (category) { params.push(category); conditions.push(`category = ?`); }
    if (origin)   { params.push(origin);   conditions.push(`origin LIKE ?`); }
    if (proc)     { params.push(proc);     conditions.push(`process LIKE ?`); }
    if (roast)    { params.push(roast);    conditions.push(`roast LIKE ?`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, { rows }] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM products ${where}`, params),
      query(
        `SELECT
           p.id, p.slug, p.name, p.name_en, p.category, p.origin, p.process, p.roast,
           p.tasting_notes, p.price, p.price_usd, p.rating,
           p.weight, p.weight_unit,
           p.is_deal       AS deal,
           p.is_bestseller AS bestseller,
           p.is_new        AS new,
           p.is_fast       AS fast,
           p.image_url     AS image,
           p.stock_quantity AS stock,
           p.description, p.meta_description,
           ${reviewAggregateSql('p')}
         FROM products p
         ${where}
         ORDER BY p.is_bestseller DESC, p.is_new DESC, p.is_deal DESC, p.rating DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
    ]);

    const total = countResult.rows[0].total;
    const data = rows.map(p => {
      const tn = parseTastingNotes(p.tasting_notes);
      return {
        ...p,
        categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
        notes: tn?.es ?? null,
        notesEn: tn?.en ?? null,
      };
    });

    res.json({ success: true, data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) });
  } catch (err) {
    logger.error({ err }, '[GET /api/products] Error:');
    res.status(500).json({ success: false, error: 'Error al cargar productos' });
  }
});

// ─── GET /api/products/search ────────────────────────────────────────────────
// Búsqueda pública del catálogo. Alimenta el buscador del header y las páginas
// /buscar y /search.
//
// IMPORTANTE: debe declararse ANTES de GET /:id, o Express resolvería 'search'
// como el id de un producto.
productsRouter.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit) || 8));

    // Con menos de dos caracteres cualquier término trae medio catálogo:
    // no es una búsqueda útil y no compensa el costo de la consulta.
    if (q.length < 2) {
      return res.json({ success: true, data: [], total: 0, query: q });
    }

    const contains = `%${q}%`;
    const startsWith = `${q}%`;

    const { rows } = await query(
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

    const data = rows.map((p) => {
      const tn = parseTastingNotes(p.tasting_notes);
      return {
        ...p,
        categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
        notes: tn?.es ?? null,
        notesEn: tn?.en ?? null,
      };
    });

    res.json({ success: true, data, total: data.length, query: q });
  } catch (err) {
    logger.error({ err }, '[GET /api/products/search] Error:');
    res.status(500).json({ success: false, error: 'Error al buscar productos' });
  }
});

// ─── GET /api/products/:id ───────────────────────────────────────────────────
// Detalle de un producto por id o slug. Público.
productsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT
         p.id, p.slug, p.name, p.name_en, p.category, p.origin, p.process, p.roast,
         p.tasting_notes, p.price, p.price_usd, p.rating,
         p.weight, p.weight_unit,
         p.is_deal AS deal, p.is_bestseller AS bestseller,
         p.is_new AS new, p.is_fast AS fast,
         p.image_url AS image, p.images,
         p.stock_quantity AS stock,
         p.description, p.meta_description,
         ${reviewAggregateSql('p')}
       FROM products p
       WHERE (p.id = ? OR p.slug = ?) AND p.is_active = TRUE`,
      [id, id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    const p = rows[0];
    const tn = parseTastingNotes(p.tasting_notes);
    res.json({
      success: true,
      data: {
        ...p,
        categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
        notes: tn?.es ?? null,
        notesEn: tn?.en ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/products/:id] Error:');
    res.status(500).json({ success: false, error: 'Error al cargar producto' });
  }
});

// ─── Reseñas ──────────────────────────────────────────────────────────────────

// GET /api/products/:id/reviews
productsRouter.get('/:id/reviews', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, reviewer_name, rating, comment, created_at
             FROM product_reviews
             WHERE product_id = ? AND is_approved = 1
             ORDER BY created_at DESC`,
            [req.params.id]
        );
        const { rows: agg } = await query(
            `SELECT AVG(CAST(rating AS REAL)) AS avg_rating, COUNT(*) AS total
             FROM product_reviews WHERE product_id = ? AND is_approved = 1`,
            [req.params.id]
        );
        res.json({
            success: true,
            data: { reviews: rows, avg_rating: agg[0]?.avg_rating ?? null, total: agg[0]?.total ?? 0 },
        });
    } catch (err) {
        logger.error({ err }, '[GET /api/products/:id/reviews] Error:');
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// POST /api/products/:id/reviews
productsRouter.post('/:id/reviews',
    [
        body('reviewer_name').trim().notEmpty().withMessage('Nombre requerido'),
        body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating entre 1 y 5'),
        body('comment').optional().trim(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

        try {
            const { reviewer_name, rating, comment } = req.body;
            const user_id = req.user?.id ?? null;
            await query(
                `INSERT INTO product_reviews (product_id, user_id, reviewer_name, rating, comment)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.params.id, user_id, reviewer_name, parseInt(rating), comment || null]
            );
            res.status(201).json({ success: true, message: 'Reseña enviada. Aparecerá tras revisión.' });
        } catch (err) {
            logger.error({ err }, '[POST /api/products/:id/reviews] Error:');
            res.status(500).json({ success: false, error: 'Error interno' });
        }
    }
);

// PATCH /api/products/reviews/:reviewId/approve (admin)
productsRouter.patch('/reviews/:reviewId/approve', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        await query(`UPDATE product_reviews SET is_approved = 1 WHERE id = ?`, [req.params.reviewId]);
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[PATCH /api/products/reviews/:reviewId/approve] Error:');
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// DELETE /api/products/reviews/:reviewId (admin)
productsRouter.delete('/reviews/:reviewId', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        await query(`DELETE FROM product_reviews WHERE id = ?`, [req.params.reviewId]);
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[DELETE /api/products/reviews/:reviewId] Error:');
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
