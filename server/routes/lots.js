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

// Obtener un lote específico por código o ID
lotsRouter.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Intentar obtener por ID primero (si es número)
    if (!isNaN(identifier)) {
      const result = await db.query(
        'SELECT * FROM lots WHERE id = ?',
        [parseInt(identifier)]
      );
      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
    }
    
    // Si no, intentar por código
    const result = await db.query(
      'SELECT * FROM lots WHERE code = ?',
      [identifier]
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
      product_id,
      weight_kg
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
        harvest_date, roast_date, moisture, score, notes, product_id, weight_kg, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        product_id || null,
        weight_kg || null,
        'verde'
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

// Tostar café - crear lote tostado y restar del verde (solo admin)
lotsRouter.post('/roast/:lotId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { lotId } = req.params;
    const { weight_kg, fecha_tostado } = req.body;

    // Validar campos requeridos
    if (!weight_kg || !fecha_tostado) {
      return res.status(400).json({ error: 'weight_kg y fecha_tostado son requeridos' });
    }

    if (weight_kg <= 0) {
      return res.status(400).json({ error: 'El peso a tostar debe ser mayor a 0' });
    }

    // Obtener el lote verde original
    const greenLotResult = await db.query(
      'SELECT * FROM lots WHERE id = ? AND estado = "verde"',
      [lotId]
    );

    if (greenLotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lote verde no encontrado o ya está tostado' });
    }

    const greenLot = greenLotResult.rows[0];
    const currentWeight = greenLot.weight_kg || 0;

    if (weight_kg > currentWeight) {
      return res.status(400).json({ 
        error: `No puedes tostar ${weight_kg}kg, el lote solo tiene ${currentWeight}kg` 
      });
    }

    // Calcular peso restante
    const remainingWeight = currentWeight - weight_kg;

    // Generar código para el lote tostado
    const roastCode = `${greenLot.code}-ROAST-${Date.now()}`;

    // Crear lote tostado (copia del verde pero tostado)
    await db.query(
      `INSERT INTO lots (
        code, name, origin, farm, producer, altitude, process, variety,
        harvest_date, roast_date, fecha_tostado, moisture, score, notes,
        product_id, estado, parent_lot_id, weight_kg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roastCode,
        greenLot.name || `Tostado - ${greenLot.code}`,
        greenLot.origin,
        greenLot.farm,
        greenLot.producer,
        greenLot.altitude,
        greenLot.process,
        greenLot.variety,
        greenLot.harvest_date,
        greenLot.roast_date,
        fecha_tostado,
        greenLot.moisture,
        greenLot.score,
        greenLot.notes,
        greenLot.product_id,
        'tostado',
        greenLot.id,
        weight_kg
      ]
    );

    // Actualizar el lote verde con el peso restante
    await db.query(
      'UPDATE lots SET weight_kg = ?, updated_at = NOW() WHERE id = ?',
      [remainingWeight, lotId]
    );

    // Obtener el lote tostado creado
    const roastLotResult = await db.query(
      'SELECT * FROM lots WHERE code = ?',
      [roastCode]
    );

    res.status(201).json({
      message: 'Café tostado exitosamente',
      roasted_lot: roastLotResult.rows[0],
      remaining_green_weight: remainingWeight
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error tostando café: ' + err.message });
  }
});

// Obtener lotes verdes disponibles
lotsRouter.get('/status/verde', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, code, name, farm, variety, weight_kg, altitude FROM lots WHERE estado = "verde" ORDER BY created_at DESC'
    );
    res.json({ lots: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo lotes verdes' });
  }
});

