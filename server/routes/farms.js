// Módulo de Fincas — Fase 7
// Gestión de landing pages de fincas y caficultores
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { logAudit } from '../services/audit.js';

export const farmsRouter = Router();

// Helper: construye donde va el slug a partir del nombre
function toSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function handleValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(422).json({ success: false, errors: errors.array() });
        return true;
    }
    return false;
}

// ===================================================
// RUTAS PÚBLICAS
// ===================================================

// GET /api/farms — listado de fincas publicadas
farmsRouter.get('/', async (req, res) => {
    try {
        const { region, limit = 20, offset = 0 } = req.query;
        const conditions = ['f.is_published = TRUE'];
        const params = [];

        if (region) {
            params.push(region);
            conditions.push(`f.region = $${params.length}`);
        }

        params.push(parseInt(limit, 10), parseInt(offset, 10));
        const where = `WHERE ${conditions.join(' AND ')}`;

        const { rows } = await query(`
      SELECT f.id, f.slug, f.name, f.region, f.municipality,
             f.altitude_min, f.altitude_max, f.hectares,
             f.varieties, f.certifications, f.processes,
             f.short_description, f.cover_image_url,
             u.name AS caficultor_name
      FROM farms f
      JOIN users u ON u.id = f.caficultor_id
      ${where}
      ORDER BY f.name
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

        const countParams = params.slice(0, params.length - 2);
        const { rows: countRows } = await query(
            `SELECT COUNT(*) AS total FROM farms f ${where}`, countParams
        );

        res.json({ success: true, data: rows, total: parseInt(countRows[0].total, 10) });
    } catch (err) {
        console.error('[GET /api/farms]', err);
        res.status(500).json({ success: false, error: 'Error al obtener las fincas' });
    }
});

// GET /api/farms/regions — lista de regiones con fincas publicadas
farmsRouter.get('/regions', async (req, res) => {
    try {
        const { rows } = await query(`
      SELECT region, COUNT(*) AS count
      FROM farms
      WHERE is_published = TRUE
      GROUP BY region
      ORDER BY count DESC, region
    `, []);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[GET /api/farms/regions]', err);
        res.status(500).json({ success: false, error: 'Error al obtener regiones' });
    }
});

// GET /api/farms/my — finca(s) del caficultor autenticado
// ?list=true → devuelve array con todas las fincas del usuario
farmsRouter.get('/my', authenticateToken, async (req, res) => {
    try {
        const isList = req.query.list === 'true';
        const { rows } = await query(
            `SELECT id, name, region, municipality, altitude_min, altitude_max,
                    varieties, processes, slug
             FROM farms
             WHERE caficultor_id = $1
             ORDER BY name`,
            [req.user.id]
        );
        if (isList) {
            return res.json({ success: true, data: rows });
        }
        res.json({ success: true, data: rows[0] ?? null });
    } catch (err) {
        console.error('[GET /api/farms/my]', err);
        res.status(500).json({ success: false, error: 'Error al obtener tu finca' });
    }
});

// GET /api/farms/admin/all — todas las fincas (admin)
farmsRouter.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { rows } = await query(`
      SELECT f.id, f.slug, f.name, f.region, f.is_published, f.created_at,
             u.name AS caficultor_name, u.email AS caficultor_email
      FROM farms f
      JOIN users u ON u.id = f.caficultor_id
      ORDER BY f.created_at DESC
    `, []);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[GET /api/farms/admin/all]', err);
        res.status(500).json({ success: false, error: 'Error al listar fincas' });
    }
});

// GET /api/farms/:slug — perfil público completo de una finca
farmsRouter.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const { rows } = await query(`
      SELECT f.*,
             u.name AS caficultor_name,
             u.city AS caficultor_city
      FROM farms f
      JOIN users u ON u.id = f.caficultor_id
      WHERE f.slug = $1 AND f.is_published = TRUE
    `, [slug]);

        if (!rows.length) {
            return res.status(404).json({ success: false, error: 'Finca no encontrada' });
        }

        const farm = rows[0];

        // Lotes recientes de la finca (últimas 5 cosechas)
        const { rows: lots } = await query(`
      SELECT ch.lot_id, ch.variety, ch.process, ch.region,
             ch.altitude, ch.created_at,
             gl.label_code, gl.flavor_notes
      FROM coffee_harvests ch
      LEFT JOIN generated_labels gl ON gl.lot_code = ch.lot_id
      WHERE ch.farm = $1
      ORDER BY ch.created_at DESC
      LIMIT 5
    `, [farm.name]);

        res.json({ success: true, data: { ...farm, recent_lots: lots } });
    } catch (err) {
        console.error('[GET /api/farms/:slug]', err);
        res.status(500).json({ success: false, error: 'Error al obtener la finca' });
    }
});

// ===================================================
// RUTAS CAFICULTOR AUTENTICADO
// ===================================================

// POST /api/farms — caficultor crea su finca
farmsRouter.post('/', authenticateToken, [
    body('name').trim().notEmpty().withMessage('Nombre de la finca requerido'),
    body('region').trim().notEmpty().withMessage('Región requerida'),
    body('short_description').optional().isLength({ max: 300 }).withMessage('Máximo 300 caracteres'),
], async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
        // Verificar que no tenga ya una finca
        const { rows: existing } = await query(
            'SELECT id FROM farms WHERE caficultor_id = $1', [req.user.id]
        );
        if (existing.length) {
            return res.status(409).json({ success: false, error: 'Ya tienes una finca registrada. Usa PATCH para actualizarla.' });
        }

        const {
            name, region, municipality, altitude_min, altitude_max, hectares,
            varieties, certifications, soil_type, processes,
            story, short_description, cover_image_url, gallery_urls,
            latitude, longitude,
        } = req.body;

        // Generar slug único
        let slug = toSlug(name);
        const { rows: slugCheck } = await query('SELECT id FROM farms WHERE slug = $1', [slug]);
        if (slugCheck.length) slug = `${slug}-${Date.now().toString(36)}`;

        const { rows } = await query(`
      INSERT INTO farms (
        caficultor_id, name, slug, region, municipality,
        altitude_min, altitude_max, hectares,
        varieties, certifications, soil_type, processes,
        story, short_description, cover_image_url, gallery_urls,
        latitude, longitude
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[],$11,$12::text[],$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
            req.user.id, name, slug, region, municipality ?? null,
            altitude_min ?? null, altitude_max ?? null, hectares ?? null,
            varieties ?? null, certifications ?? null, soil_type ?? null, processes ?? null,
            story ?? null, short_description ?? null, cover_image_url ?? null,
            JSON.stringify(gallery_urls ?? []),
            latitude ?? null, longitude ?? null,
        ]);

        await logAudit(req.user.id, 'create', 'farm', rows[0].id, { name, slug });
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ success: false, error: 'El slug de la finca ya existe' });
        console.error('[POST /api/farms]', err);
        res.status(500).json({ success: false, error: 'Error al crear la finca' });
    }
});

// PATCH /api/farms/:id — caficultor actualiza su finca
farmsRouter.patch('/:id', authenticateToken, [
    param('id').isInt().withMessage('ID inválido'),
    body('name').optional().trim().notEmpty().withMessage('Nombre no puede ser vacío'),
    body('short_description').optional().isLength({ max: 300 }).withMessage('Máximo 300 caracteres'),
], async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin';

        // Verificar pertenencia (o admin)
        const { rows: farmRows } = await query('SELECT * FROM farms WHERE id = $1', [id]);
        if (!farmRows.length) return res.status(404).json({ success: false, error: 'Finca no encontrada' });
        if (!isAdmin && farmRows[0].caficultor_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Sin permiso para editar esta finca' });
        }

        const allowed = [
            'name', 'region', 'municipality', 'altitude_min', 'altitude_max', 'hectares',
            'varieties', 'certifications', 'soil_type', 'processes',
            'story', 'short_description', 'cover_image_url', 'gallery_urls',
            'latitude', 'longitude',
        ];
        const updates = [];
        const vals = [];

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                vals.push(req.body[key]);
                if (key === 'varieties' || key === 'certifications' || key === 'processes') {
                    updates.push(`${key} = $${vals.length}::text[]`);
                } else if (key === 'gallery_urls') {
                    updates.push(`${key} = $${vals.length}`);
                } else {
                    updates.push(`${key} = $${vals.length}`);
                }
            }
        }

        if (!updates.length) return res.status(422).json({ success: false, error: 'No hay campos para actualizar' });

        vals.push(id);
        const { rows } = await query(
            `UPDATE farms SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
            vals
        );

        await logAudit(req.user.id, 'update', 'farm', id, req.body);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[PATCH /api/farms/:id]', err);
        res.status(500).json({ success: false, error: 'Error al actualizar la finca' });
    }
});

// PATCH /api/farms/:id/publish — admin publica/despublica una finca
farmsRouter.patch('/:id/publish', authenticateToken, requireRole('admin'), [
    param('id').isInt().withMessage('ID inválido'),
    body('is_published').isBoolean().withMessage('Valor booleano requerido'),
], async (req, res) => {
    if (handleValidation(req, res)) return;
    try {
        const { id } = req.params;
        const { is_published } = req.body;
        const { rows } = await query(
            'UPDATE farms SET is_published = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, slug, is_published',
            [is_published, id]
        );
        if (!rows.length) return res.status(404).json({ success: false, error: 'Finca no encontrada' });
        await logAudit(req.user.id, 'update', 'farm', id, { is_published });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[PATCH /api/farms/:id/publish]', err);
        res.status(500).json({ success: false, error: 'Error al actualizar visibilidad' });
    }
});
