import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

export const blogRouter = Router();

// GET /api/blog — posts publicados
blogRouter.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, parseInt(limit) || 20);
        const offset = (pageNum - 1) * pageSize;

        const [countResult, result] = await Promise.all([
            query(`SELECT COUNT(*) as total FROM blog_posts WHERE is_published = 1`),
            query(
                `SELECT id, slug, title, excerpt, cover_image_url, author, reading_time_min, tags, published_at
                 FROM blog_posts
                 WHERE is_published = 1
                 ORDER BY published_at DESC
                 LIMIT ? OFFSET ?`,
                [pageSize, offset]
            ),
        ]);

        const total = countResult.rows[0].total;
        res.json({
            success: true,
            data: result.rows,
            total,
            page: pageNum,
            limit: pageSize,
            pages: Math.ceil(total / pageSize),
        });
    } catch (err) {
        logger.error({ err }, '[GET /api/blog] Error:');
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// GET /api/blog/:slug — post individual
blogRouter.get('/:slug', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1`,
            [req.params.slug]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'Post no encontrado' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error({ err }, '[GET /api/blog/:slug] Error:');
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// POST /api/blog — crear post (solo admin)
blogRouter.post('/',
    authenticateToken,
    requireRole('admin'),
    [
        body('title').trim().notEmpty().withMessage('Título requerido'),
        body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Slug inválido'),
        body('excerpt').optional().trim(),
        body('content_md').optional().trim(),
        body('reading_time_min').optional().isInt({ min: 1 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

        try {
            const { title, slug, excerpt, content_md, cover_image_url, author, reading_time_min, tags, is_published } = req.body;
            const published_at = is_published ? new Date().toISOString() : null;

            const result = await query(
                `INSERT INTO blog_posts (title, slug, excerpt, content_md, cover_image_url, author, reading_time_min, tags, is_published, published_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
                [title, slug, excerpt || null, content_md || null, cover_image_url || null,
                 author || 'DobleYo Café', reading_time_min || 3,
                 tags ? JSON.stringify(tags) : null, is_published ? 1 : 0, published_at]
            );
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (err) {
            logger.error({ err }, '[POST /api/blog] Error:');
            res.status(500).json({ success: false, error: 'Error interno' });
        }
    }
);

// PATCH /api/blog/:id — editar post (solo admin)
blogRouter.patch('/:id',
    authenticateToken,
    requireRole('admin'),
    async (req, res) => {
        try {
            const { title, excerpt, content_md, cover_image_url, author, reading_time_min, tags, is_published } = req.body;
            const { rows: current } = await query(`SELECT is_published, published_at FROM blog_posts WHERE id = ?`, [req.params.id]);
            if (!current.length) return res.status(404).json({ success: false, error: 'Post no encontrado' });

            const wasPublished = current[0].is_published;
            const published_at = is_published && !wasPublished ? new Date().toISOString() : (current[0].published_at ?? null);

            await query(
                `UPDATE blog_posts SET
                    title = COALESCE(?, title),
                    excerpt = COALESCE(?, excerpt),
                    content_md = COALESCE(?, content_md),
                    cover_image_url = COALESCE(?, cover_image_url),
                    author = COALESCE(?, author),
                    reading_time_min = COALESCE(?, reading_time_min),
                    tags = COALESCE(?, tags),
                    is_published = COALESCE(?, is_published),
                    published_at = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [title || null, excerpt || null, content_md || null, cover_image_url || null,
                 author || null, reading_time_min || null,
                 tags ? JSON.stringify(tags) : null,
                 is_published !== undefined ? (is_published ? 1 : 0) : null,
                 published_at, req.params.id]
            );
            res.json({ success: true });
        } catch (err) {
            logger.error({ err }, '[PATCH /api/blog/:id] Error:');
            res.status(500).json({ success: false, error: 'Error interno' });
        }
    }
);

// DELETE /api/blog/:id (solo admin)
blogRouter.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        await query(`DELETE FROM blog_posts WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, '[DELETE /api/blog/:id] Error:');
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
