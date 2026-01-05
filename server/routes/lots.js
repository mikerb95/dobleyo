import { Router } from 'express';
import * as db from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';

export const lotsRouter = Router();

// Obtener todos los lotes
lotsRouter.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM lots ORDER BY created_at DESC'
    );
    res.json({ lots: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo lotes' });
  }
});

// Obtener un lote específico por código
lotsRouter.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.query(
      'SELECT * FROM lots WHERE code = ?',
      [code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo lote' });
  }
});

// Crear nuevo lote (solo admin)
lotsRouter.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      code,
      name,
      origin,
      farm,
      producer,
      altitude,
      process,
      variety,
      harvest_date,
      roast_date,
      moisture,
      score,
      notes,
      product_id
    } = req.body;

    // Validar campos requeridos
    if (!code || !name) {
      return res.status(400).json({ error: 'Code y name son requeridos' });
    }

    // Verificar que el código no existe ya
    const existing = await db.query(
      'SELECT id FROM lots WHERE code = ?',
      [code]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El lote con este código ya existe' });
    }

    // Verificar que el producto existe si se proporciona
    if (product_id) {
      const productCheck = await db.query(
        'SELECT id FROM products WHERE id = ?',
        [product_id]
      );
      if (productCheck.rows.length === 0) {
        return res.status(400).json({ error: 'El producto especificado no existe' });
      }
    }

    // Insertar lote
    await db.query(
      `INSERT INTO lots (
        code, name, origin, farm, producer, altitude, process, variety,
        harvest_date, roast_date, moisture, score, notes, product_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        name,
        origin || null,
        farm || null,
        producer || null,
        altitude || null,
        process || null,
        variety || null,
        harvest_date || null,
        roast_date || null,
        moisture || null,
        score || null,
        notes || null,
        product_id || null
      ]
    );

    // Retornar el lote creado
    const result = await db.query(
      'SELECT * FROM lots WHERE code = ?',
      [code]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando lote: ' + err.message });
  }
});

// Actualizar lote (solo admin)
lotsRouter.put('/:code', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { code } = req.params;
    const {
      name,
      origin,
      farm,
      producer,
      altitude,
      process,
      variety,
      harvest_date,
      roast_date,
      moisture,
      score,
      notes,
      product_id
    } = req.body;

    // Verificar que el lote existe
    const existing = await db.query(
      'SELECT id FROM lots WHERE code = ?',
      [code]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    // Actualizar
    await db.query(
      `UPDATE lots SET
        name = COALESCE(?, name),
        origin = COALESCE(?, origin),
        farm = COALESCE(?, farm),
        producer = COALESCE(?, producer),
        altitude = COALESCE(?, altitude),
        process = COALESCE(?, process),
        variety = COALESCE(?, variety),
        harvest_date = COALESCE(?, harvest_date),
        roast_date = COALESCE(?, roast_date),
        moisture = COALESCE(?, moisture),
        score = COALESCE(?, score),
        notes = COALESCE(?, notes),
        product_id = COALESCE(?, product_id),
        updated_at = NOW()
      WHERE code = ?`,
      [
        name,
        origin,
        farm,
        producer,
        altitude,
        process,
        variety,
        harvest_date,
        roast_date,
        moisture,
        score,
        notes,
        product_id,
        code
      ]
    );

    // Retornar el lote actualizado
    const result = await db.query(
      'SELECT * FROM lots WHERE code = ?',
      [code]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando lote: ' + err.message });
  }
});
