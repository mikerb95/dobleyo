import { Router } from 'express';
import { query } from '../db.js';

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
      conditions.push(`category = $${params.length}`);
    }
    if (origin) {
      params.push(origin);
      conditions.push(`origin ILIKE $${params.length}`);
    }
    if (proc) {
      params.push(proc);
      conditions.push(`process ILIKE $${params.length}`);
    }
    if (roast) {
      params.push(roast);
      conditions.push(`roast ILIKE $${params.length}`);
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
    console.error('[GET /api/products] Error:', err);
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
       WHERE (id = $1 OR slug = $1) AND is_active = TRUE`,
      [id]
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
    console.error('[GET /api/products/:id] Error:', err);
    res.status(500).json({ success: false, error: 'Error al cargar producto' });
  }
});
