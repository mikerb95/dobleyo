import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

export const productsRouter = Router();

// Mapa de categoría BD → etiqueta visual
const CATEGORY_LABEL = { cafe: 'Cafés', accesorio: 'Accesorios', merchandising: 'Merchandising' };

// ─── GET /api/products ───────────────────────────────────────────────────────
// Listado público de productos activos con filtros opcionales.
// Query params: category, origin, process, roast, active (default=true)
productsRouter.get('/', async (req, res) => {
  try {
    const { category, origin, process: proc, roast, active = 'true' } = req.query;

    const conditions = [];
    const params = [];

    if (active !== 'all') {
      conditions.push(`is_active = ${active === 'false' ? 'FALSE' : 'TRUE'}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = ?`);
    }
    if (origin) {
      params.push(origin);
      conditions.push(`origin LIKE ?`);
    }
    if (proc) {
      params.push(proc);
      conditions.push(`process LIKE ?`);
    }
    if (roast) {
      params.push(roast);
      conditions.push(`roast LIKE ?`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT
         id,
         slug,
         name,
         name_en,
         category,
         origin,
         process,
         roast,
         tasting_notes,
         price,
         price_usd,
         rating,
         is_deal       AS deal,
         is_bestseller AS bestseller,
         is_new        AS new,
         is_fast       AS fast,
         image_url     AS image,
         stock_quantity AS stock,
         description,
         meta_description
       FROM products
       ${where}
       ORDER BY is_bestseller DESC, is_new DESC, is_deal DESC, rating DESC`,
      params
    );

    // Añadir etiqueta de categoría para el frontend
    const data = rows.map(p => ({
      ...p,
      categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
      notes: p.tasting_notes?.es ?? null,
      notesEn: p.tasting_notes?.en ?? null,
    }));

    res.json({ success: true, data, total: data.length });
  } catch (err) {
    logger.error({ err }, '[GET /api/products] Error:');
    res.status(500).json({ success: false, error: 'Error al cargar productos' });
  }
});

// ─── GET /api/products/:id ───────────────────────────────────────────────────
// Detalle de un producto por id o slug. Público.
productsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT
         id, slug, name, name_en, category, origin, process, roast,
         tasting_notes, price, price_usd, rating,
         is_deal AS deal, is_bestseller AS bestseller,
         is_new AS new, is_fast AS fast,
         image_url AS image, images,
         stock_quantity AS stock,
         description, meta_description
       FROM products
       WHERE (id = ? OR slug = ?) AND is_active = TRUE`,
      [id, id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    const p = rows[0];
    res.json({
      success: true,
      data: {
        ...p,
        categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
        notes: p.tasting_notes?.es ?? null,
        notesEn: p.tasting_notes?.en ?? null,
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
