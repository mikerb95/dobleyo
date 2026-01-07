import express from 'express';
import { query } from '../db.js';
import crypto from 'crypto';

export const coffeeRouter = express.Router();

// Middleware de autenticación básica
const authMiddleware = async (req, res, next) => {
  // Por ahora permitir todos, en producción verificar token
  next();
};

coffeeRouter.use(authMiddleware);

// 1. CREAR LOTE (Recolección en Finca)
coffeeRouter.post('/harvest', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { farm, variety, climate, process, aroma, tasteNotes } = req.body;

    // Validaciones
    if (!farm || !variety || !climate || !process || !aroma || !tasteNotes) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos requeridos',
        details: { farm, variety, climate, process, aroma: !!aroma, tasteNotes: !!tasteNotes }
      });
    }

    // Generar ID de lote
    const farmMap = {
      'finca-la-sierra': { region: 'HUI', altitude: '1800' },
      'finca-nariño': { region: 'NAR', altitude: '1900' },
      'finca-cauca': { region: 'CAU', altitude: '1750' }
    };

    const farmInfo = farmMap[farm];
    if (!farmInfo) {
      return res.status(400).json({ success: false, error: 'Finca inválida' });
    }

    const lotNumber = String(Math.floor(Math.random() * 100) + 1).padStart(2, '0');
    const lotId = `COL-${farmInfo.region}-${farmInfo.altitude}-${variety}-${process}-${lotNumber}`;

    // Guardar en BD
    const result = await query(
      `INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [lotId, farm, variety, climate, process, aroma, tasteNotes]
    );

    return res.status(201).json({
      success: true,
      message: 'Lote registrado correctamente',
      lotId: lotId,
      harvestId: result.insertId || result.rows?.[0]?.insertId
    });
  } catch (err) {
    console.error('Error en harvest:', err);
    
    // Detectar si es un error de tabla no existente
    if (err.code === 'ER_NO_SUCH_TABLE' || err.message?.includes('coffee_harvests')) {
      return res.status(500).json({ 
        success: false, 
        error: 'La tabla coffee_harvests no existe. Ejecuta la migración primero',
        message: err.message,
        hint: 'Ejecuta: node server/migrations/create_coffee_tables.js'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Error al registrar lote',
      message: err.message,
      code: err.code
    });
  }
});

// 2. ALMACENAR EN INVENTARIO (Café Verde)
coffeeRouter.post('/inventory-storage', async (req, res) => {
  try {
    const { lotId, weight, weightUnit, location, storageDate, notes } = req.body;

    if (!lotId || !weight || !location || !storageDate) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar que el lote existe
    const harvestResult = await query(
      'SELECT id FROM coffee_harvests WHERE lot_id = ?',
      [lotId]
    );

    if (!harvestResult.rows.length) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    const harvestId = harvestResult.rows[0].id;

    // Guardar en BD
    const result = await query(
      `INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [harvestId, lotId, weight, location, storageDate, notes || null]
    );

    res.status(201).json({
      success: true,
      storageId: result.rows.insertId,
      message: 'Café verde almacenado correctamente'
    });
  } catch (err) {
    console.error('Error en inventory-storage:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. ENVIAR A TOSTIÓN
coffeeRouter.post('/send-roasting', async (req, res) => {
  try {
    const { lotId, quantitySent, targetTemp, notes } = req.body;

    if (!lotId || !quantitySent) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar inventario disponible
    const inventoryResult = await query(
      'SELECT SUM(weight_kg) as total FROM green_coffee_inventory WHERE lot_id = ?',
      [lotId]
    );

    const availableWeight = inventoryResult.rows[0]?.total || 0;
    if (quantitySent > availableWeight) {
      return res.status(400).json({ error: 'Cantidad excede el inventario disponible' });
    }

    // Guardar en BD
    const result = await query(
      `INSERT INTO roasting_batches (lot_id, quantity_sent_kg, target_temp, notes, status, created_at)
       VALUES (?, ?, ?, ?, 'in_roasting', NOW())`,
      [lotId, quantitySent, targetTemp || null, notes || null]
    );

    res.status(201).json({
      success: true,
      roastingId: result.rows.insertId,
      message: 'Lote enviado a tostión correctamente'
    });
  } catch (err) {
    console.error('Error en send-roasting:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. RECOGER DEL TUESTE
coffeeRouter.post('/roast-retrieval', async (req, res) => {
  try {
    const { roastingId, roastLevel, roastedWeight, actualTemp, roastTime, observations } = req.body;

    if (!roastingId || !roastLevel || !roastedWeight) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar roasting batch
    const roastingResult = await query(
      'SELECT quantity_sent_kg FROM roasting_batches WHERE id = ?',
      [roastingId]
    );

    if (!roastingResult.rows.length) {
      return res.status(404).json({ error: 'Lote en tostión no encontrado' });
    }

    const quantitySent = roastingResult.rows[0].quantity_sent_kg;
    const weightLossPercent = (((quantitySent - roastedWeight) / quantitySent) * 100).toFixed(2);

    // Guardar en BD
    const result = await query(
      `INSERT INTO roasted_coffee (roasting_id, roast_level, weight_kg, weight_loss_percent, actual_temp, roast_time_minutes, observations, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready_for_storage', NOW())`,
      [roastingId, roastLevel, roastedWeight, weightLossPercent, actualTemp || null, roastTime || null, observations || null]
    );

    // Actualizar estado del roasting batch
    await query(
      'UPDATE roasting_batches SET status = ? WHERE id = ?',
      ['completed', roastingId]
    );

    res.status(201).json({
      success: true,
      roastedId: result.rows.insertId,
      weightLossPercent,
      message: 'Café tostado registrado correctamente'
    });
  } catch (err) {
    console.error('Error en roast-retrieval:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. ALMACENAR CAFÉ TOSTADO
coffeeRouter.post('/roasted-storage', async (req, res) => {
  try {
    const { roastedId, location, container, containerCount, conditions, notes } = req.body;

    if (!roastedId || !location || !container || !containerCount) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar café tostado existe
    const roastedResult = await query(
      'SELECT weight_kg FROM roasted_coffee WHERE id = ?',
      [roastedId]
    );

    if (!roastedResult.rows.length) {
      return res.status(404).json({ error: 'Café tostado no encontrado' });
    }

    // Guardar en BD
    const result = await query(
      `INSERT INTO roasted_coffee_inventory (roasted_id, location, container_type, container_count, storage_conditions, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ready_for_packaging', NOW())`,
      [roastedId, location, container, containerCount, conditions.join(',') || null, notes || null]
    );

    // Actualizar estado
    await query(
      'UPDATE roasted_coffee SET status = ? WHERE id = ?',
      ['stored', roastedId]
    );

    res.status(201).json({
      success: true,
      storageId: result.rows.insertId,
      message: 'Café tostado almacenado correctamente'
    });
  } catch (err) {
    console.error('Error en roasted-storage:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. PREPARAR PARA VENTA (Packaging)
coffeeRouter.post('/packaging', async (req, res) => {
  try {
    const { roastedStorageId, acidity, body, balance, presentation, grindSize, packageSize, unitCount, notes } = req.body;

    if (!roastedStorageId || !acidity || !body || !balance || !presentation || !packageSize || !unitCount) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (presentation === 'MOLIDO' && !grindSize) {
      return res.status(400).json({ error: 'Debe especificar tipo de molienda' });
    }

    // Calcular puntuación
    const score = ((parseInt(acidity) + parseInt(body) + parseInt(balance)) / 3).toFixed(2);

    // Guardar en BD
    const result = await query(
      `INSERT INTO packaged_coffee (roasted_storage_id, acidity, body, balance, score, presentation, grind_size, package_size, unit_count, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready_for_sale', NOW())`,
      [roastedStorageId, acidity, body, balance, score, presentation, grindSize || null, packageSize, unitCount, notes || null]
    );

    // Actualizar estado
    await query(
      'UPDATE roasted_coffee_inventory SET status = ? WHERE id = ?',
      ['packaged', roastedStorageId]
    );

    res.status(201).json({
      success: true,
      packagedId: result.rows.insertId,
      score,
      message: 'Café preparado para venta correctamente'
    });
  } catch (err) {
    console.error('Error en packaging:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Lotes disponibles por tipo
coffeeRouter.get('/harvests', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM coffee_harvests ORDER BY created_at DESC LIMIT 100',
      []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET harvests:', err);
    res.status(500).json({ error: err.message });
  }
});

coffeeRouter.get('/green-inventory', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM green_coffee_inventory ORDER BY created_at DESC LIMIT 100',
      []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET green-inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

coffeeRouter.get('/roasting-batches', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM roasting_batches WHERE status = ? ORDER BY created_at DESC LIMIT 100',
      ['in_roasting']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET roasting-batches:', err);
    res.status(500).json({ error: err.message });
  }
});

coffeeRouter.get('/roasted-coffee', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM roasted_coffee WHERE status = ? ORDER BY created_at DESC LIMIT 100',
      ['ready_for_storage']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET roasted-coffee:', err);
    res.status(500).json({ error: err.message });
  }
});

coffeeRouter.get('/packaged', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM packaged_coffee WHERE status = ? ORDER BY created_at DESC LIMIT 100',
      ['ready_for_sale']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET packaged:', err);
    res.status(500).json({ error: err.message });
  }
});
