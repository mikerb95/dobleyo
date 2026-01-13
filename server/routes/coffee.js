import express from 'express';
import { query } from '../db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

export const coffeeRouter = express.Router();

// Aplicar rate limiting y autenticación a todas las rutas
coffeeRouter.use(apiLimiter);
coffeeRouter.use(authenticateToken);
coffeeRouter.use(requireRole(['admin', 'caficultor']));

// 1. CREAR LOTE (Recolección en Finca)
coffeeRouter.post('/harvest', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { farm, region, altitude, variety, climate, process, aroma, tasteNotes } = req.body;

    // Validaciones
    if (!farm || !variety || !climate || !process || !aroma || !tasteNotes) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos requeridos',
        details: { farm, variety, climate, process, aroma: !!aroma, tasteNotes: !!tasteNotes }
      });
    }

    // Usar región y altura proporcionados o usar defaults
    let farmRegion = region;
    let farmAltitude = altitude;

    if (!farmRegion || !farmAltitude) {
      // Fallback a valores por defecto si no se proporcionan
      const farmMap = {
        'finca-la-sierra': { region: 'HUI', altitude: 1800 },
        'finca-nariño': { region: 'NAR', altitude: 1900 },
        'finca-cauca': { region: 'CAU', altitude: 1750 }
      };

      const farmInfo = farmMap[farm];
      if (farmInfo) {
        farmRegion = farmInfo.region;
        farmAltitude = farmInfo.altitude;
      }
    }

    const lotNumber = String(Math.floor(Math.random() * 100) + 1).padStart(2, '0');
    const lotId = `COL-${farmRegion}-${farmAltitude}-${variety}-${process}-${lotNumber}`;

    // Guardar en BD
    const result = await query(
      `INSERT INTO coffee_harvests (lot_id, farm, region, altitude, variety, climate, process, aroma, taste_notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [lotId, farm, farmRegion, farmAltitude, variety, climate, process, aroma, tasteNotes]
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

// 5.1 OBTENER DETALLE DE ALMACENAMIENTO DE TOSTADO
coffeeRouter.get('/roasted-storage/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID de almacenamiento requerido' });
    }

    // Obtener información completa del almacenamiento
    const result = await query(
      `SELECT 
        rci.id,
        rci.location,
        rci.container_type as container,
        rci.container_count,
        rci.storage_conditions as conditions,
        rci.notes,
        rci.created_at as storage_date,
        rc.weight_kg,
        rc.roast_level,
        rb.lot_id,
        ch.variety,
        ch.climate,
        ch.region,
        ch.altitude,
        ch.process,
        ch.aroma,
        ch.taste_notes
       FROM roasted_coffee_inventory rci
       INNER JOIN roasted_coffee rc ON rci.roasted_id = rc.id
       INNER JOIN roasting_batches rb ON rc.roasting_id = rb.id
       INNER JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
       WHERE rci.id = ?`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Almacenamiento no encontrado' });
    }

    const data = result.rows[0];
    
    // Parsear condiciones si existen
    const conditions = data.conditions ? data.conditions.split(',') : [];

    res.json({
      id: data.id,
      lot_id: data.lot_id,
      variety: data.variety,
      climate: data.climate,
      region: data.region,
      altitude: data.altitude,
      process: data.process,
      aroma: data.aroma,
      taste_notes: data.taste_notes,
      weight_kg: data.weight_kg,
      roast_level: data.roast_level,
      location: data.location,
      container: data.container,
      container_count: data.container_count,
      conditions: conditions,
      notes: data.notes,
      storage_date: data.storage_date
    });
  } catch (err) {
    console.error('Error obteniendo detalle de almacenamiento:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. PREPARAR PARA VENTA (Packaging)
coffeeRouter.post('/packaging', async (req, res) => {
  try {
    const { roastedStorageId, acidity, body, balance, presentation, grindSize, packageSize, unitCount, notes, addToInventory } = req.body;

    if (!roastedStorageId || !acidity || !body || !balance || !presentation || !packageSize || !unitCount) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (presentation === 'MOLIDO' && !grindSize) {
      return res.status(400).json({ error: 'Debe especificar tipo de molienda' });
    }

    // Calcular puntuación
    const score = ((parseInt(acidity) + parseInt(body) + parseInt(balance)) / 3).toFixed(2);

    // Obtener información del café tostado para crear el SKU
    const roastedResult = await query(
      `SELECT rci.*, rc.roast_level, rb.lot_id, ch.region
       FROM roasted_coffee_inventory rci
       INNER JOIN roasted_coffee rc ON rci.roasted_id = rc.id
       INNER JOIN roasting_batches rb ON rc.roasting_id = rb.id
       INNER JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
       WHERE rci.id = ?`,
      [roastedStorageId]
    );

    if (!roastedResult.rows.length) {
      return res.status(404).json({ error: 'Café tostado no encontrado' });
    }

    const roastedInfo = roastedResult.rows[0];

    // Guardar en BD
    const result = await query(
      `INSERT INTO packaged_coffee (roasted_storage_id, acidity, body, balance, score, presentation, grind_size, package_size, unit_count, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready_for_sale', NOW())`,
      [roastedStorageId, acidity, body, balance, score, presentation, grindSize || null, packageSize, unitCount, notes || null]
    );

    // Actualizar estado del café tostado
    await query(
      'UPDATE roasted_coffee_inventory SET status = ? WHERE id = ?',
      ['packaged', roastedStorageId]
    );

    let productId = null;
    let inventoryMovementCreated = false;

    // Si se marcó la opción de sumar al inventario disponible
    if (addToInventory === true) {
      // Generar SKU basado en información del café
      const timestamp = Date.now().toString().slice(-6);
      productId = `CAFE-${roastedInfo.lot_id || 'GEN'}-${packageSize.replace(/[^0-9]/g, '')}-${timestamp}`.substring(0, 50);
      
      // Crear producto en la tabla products
      const productName = `Café ${roastedInfo.lot_id || 'Premium'} - ${packageSize} (${presentation === 'GRANO' ? 'Grano' : 'Molido'})`;
      
      const roastLevel = roastedInfo.roast_level || 'medium';
      const region = roastedInfo.region || 'Colombia';
      
      await query(
        `INSERT INTO products (id, name, category, origin, process, roast, price, cost, is_active, stock_quantity, stock_min, weight, weight_unit, created_at)
         VALUES (?, ?, 'cafe', ?, ?, ?, 0, 0, 1, ?, 0, ?, ?, NOW())`,
        [productId, productName, region, 'unknown', roastLevel, unitCount, packageSize, 'unidad']
      );

      // Registrar movimiento de inventario
      await query(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, created_at)
         VALUES (?, 'entrada', ?, 0, ?, 'Café empacado para venta', ?, NOW())`,
        [productId, unitCount, unitCount, roastedInfo.lot_id || 'packaging']
      );

      inventoryMovementCreated = true;
    }

    res.status(201).json({
      success: true,
      packagedId: result.rows.insertId,
      productId: productId,
      score,
      inventoryUpdated: inventoryMovementCreated,
      message: inventoryMovementCreated 
        ? `Café preparado para venta y ${unitCount} unidades agregadas al inventario`
        : 'Café preparado para venta correctamente'
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
    // Primero verificar si hay lotes en roasted_coffee_inventory
    const checkResult = await query(
      `SELECT COUNT(*) as count FROM roasted_coffee_inventory WHERE status = ?`,
      ['ready_for_packaging']
    );
    
    console.log('[roasted-coffee] Lotes con status ready_for_packaging:', checkResult.rows[0]?.count || 0);

    const result = await query(
      `SELECT 
        rci.id,
        rci.roasted_id,
        rci.location,
        rci.container_type,
        rci.container_count,
        rci.status,
        rc.roast_level,
        rc.weight_kg,
        rc.weight_loss_percent,
        rb.lot_id,
        COALESCE(ch.farm, '') as farm,
        COALESCE(ch.farm, '') as farm_name,
        COALESCE(ch.region, '') as region,
        COALESCE(ch.altitude, 0) as altitude,
        COALESCE(ch.variety, '') as variety,
        COALESCE(ch.climate, '') as climate,
        COALESCE(ch.process, '') as process,
        COALESCE(ch.aroma, '') as aroma,
        COALESCE(ch.taste_notes, '') as taste_notes,
        COALESCE(ch.taste_notes, '') as notes
      FROM roasted_coffee_inventory rci
      INNER JOIN roasted_coffee rc ON rci.roasted_id = rc.id
      LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
      LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
      WHERE rci.status = ? 
      ORDER BY rci.created_at DESC 
      LIMIT 100`,
      ['ready_for_packaging']
    );
    
    console.log('[roasted-coffee] Resultados encontrados:', result.rows.length);
    
    // Log para debugging
    if (result.rows.length > 0) {
      console.log('[roasted-coffee] Primer resultado (datos de origen):', {
        lot_id: result.rows[0].lot_id,
        farm: result.rows[0].farm,
        region: result.rows[0].region,
        altitude: result.rows[0].altitude,
        aroma: result.rows[0].aroma
      });
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET roasted-coffee:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Lotes tostados listos para almacenar
coffeeRouter.get('/roasted-for-storage', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        rc.id,
        rc.roasting_id,
        rc.roast_level,
        rc.weight_kg,
        rc.weight_loss_percent,
        rc.actual_temp,
        rc.roast_time_minutes,
        rc.observations,
        rc.status,
        rb.lot_id,
        ch.farm,
        ch.farm as farm_name,
        ch.region,
        ch.altitude,
        ch.variety,
        ch.climate,
        ch.process,
        ch.aroma,
        ch.taste_notes,
        ch.taste_notes as notes
      FROM roasted_coffee rc
      INNER JOIN roasting_batches rb ON rc.roasting_id = rb.id
      INNER JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
      WHERE rc.status = ? 
      ORDER BY rc.created_at DESC 
      LIMIT 100`,
      ['ready_for_storage']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET roasted-for-storage:', err);
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

// GET: Todos los lotes (verde, tostado almacenado, tostado pendiente)
coffeeRouter.get('/lots', async (req, res) => {
  try {
    console.log('[GET /lots] Iniciando carga de todos los lotes');
    const allLots = [];
    
    // 1. Lotes de café verde (coffee_harvests)
    try {
      const greenResult = await query(
        `SELECT 
          ch.id,
          ch.lot_id,
          ch.farm as farm_name,
          ch.variety,
          ch.region,
          ch.altitude,
          ch.climate,
          ch.process,
          ch.aroma,
          ch.taste_notes as notes,
          ch.created_at,
          'verde' as status,
          COALESCE(ci.weight_kg, 0) as weight
        FROM coffee_harvests ch
        LEFT JOIN coffee_inventory ci ON ch.lot_id = ci.lot_id
        ORDER BY ch.created_at DESC`
      );
      if (greenResult.rows) {
        allLots.push(...greenResult.rows);
        console.log(`[GET /lots] Lotes verdes: ${greenResult.rows.length}`);
      }
    } catch (err) {
      console.error('[GET /lots] Error cargando lotes verdes:', err.message);
    }

    // 2. Lotes de café tostado almacenado (roasted_coffee_inventory)
    try {
      const storedResult = await query(
        `SELECT 
          rci.id,
          rci.lot_id,
          ch.farm as farm_name,
          ch.variety,
          ch.region,
          ch.altitude,
          ch.climate,
          ch.process,
          ch.aroma,
          ch.taste_notes as notes,
          rci.storage_date as created_at,
          'tostado' as status,
          rci.weight_kg as weight
        FROM roasted_coffee_inventory rci
        LEFT JOIN roasting_batches rb ON rci.lot_id = rb.lot_id
        LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
        ORDER BY rci.storage_date DESC`
      );
      if (storedResult.rows) {
        allLots.push(...storedResult.rows);
        console.log(`[GET /lots] Lotes tostados almacenados: ${storedResult.rows.length}`);
      }
    } catch (err) {
      console.error('[GET /lots] Error cargando tostados almacenados:', err.message);
    }

    // 3. Lotes de café tostado pendiente de almacenar (roasted_coffee)
    try {
      const pendingResult = await query(
        `SELECT 
          rc.id,
          rb.lot_id,
          ch.farm as farm_name,
          ch.variety,
          ch.region,
          ch.altitude,
          ch.climate,
          ch.process,
          ch.aroma,
          ch.taste_notes as notes,
          rc.created_at,
          'pendiente' as status,
          rc.weight_kg as weight
        FROM roasted_coffee rc
        LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
        LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
        WHERE rc.status = 'ready_for_storage'
        ORDER BY rc.created_at DESC`
      );
      if (pendingResult.rows) {
        allLots.push(...pendingResult.rows);
        console.log(`[GET /lots] Lotes tostados pendientes: ${pendingResult.rows.length}`);
      }
    } catch (err) {
      console.error('[GET /lots] Error cargando tostados pendientes:', err.message);
    }

    // 4. Lotes en proceso de tostado (roasting_batches)
    try {
      const roastingResult = await query(
        `SELECT 
          rb.id,
          rb.lot_id,
          ch.farm as farm_name,
          ch.variety,
          ch.region,
          ch.altitude,
          ch.climate,
          ch.process,
          ch.aroma,
          ch.taste_notes as notes,
          rb.created_at,
          'en_tostado' as status,
          rb.quantity_sent_kg as weight
        FROM roasting_batches rb
        LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
        WHERE rb.status = 'in_roasting'
        ORDER BY rb.created_at DESC`
      );
      if (roastingResult.rows) {
        allLots.push(...roastingResult.rows);
        console.log(`[GET /lots] Lotes en tostado: ${roastingResult.rows.length}`);
      }
    } catch (err) {
      console.error('[GET /lots] Error cargando lotes en tostado:', err.message);
    }

    // Ordenar todos los lotes por fecha (más recientes primero)
    allLots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`[GET /lots] Total lotes cargados: ${allLots.length}`);
    
    res.json({
      lots: allLots,
      total: allLots.length,
      breakdown: {
        verde: allLots.filter(l => l.status === 'verde').length,
        en_tostado: allLots.filter(l => l.status === 'en_tostado').length,
        tostado: allLots.filter(l => l.status === 'tostado').length,
        pendiente: allLots.filter(l => l.status === 'pendiente').length
      }
    });
  } catch (err) {
    console.error('[GET /lots] Error general:', err);
    res.status(500).json({ 
      error: err.message,
      lots: []
    });
  }
});

// DELETE: Eliminar lote de café verde (coffee_harvests)
coffeeRouter.delete('/harvest/:lotId', async (req, res) => {
  try {
    const { lotId } = req.params;
    console.log(`[DELETE /harvest] Eliminando lote verde: ${lotId}`);

    // Verificar si el lote existe
    const checkResult = await query(
      'SELECT id FROM coffee_harvests WHERE lot_id = ?',
      [lotId]
    );

    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Lote no encontrado' 
      });
    }

    // Eliminar de coffee_inventory primero (si existe)
    await query('DELETE FROM coffee_inventory WHERE lot_id = ?', [lotId]);

    // Eliminar el lote
    await query('DELETE FROM coffee_harvests WHERE lot_id = ?', [lotId]);

    console.log(`[DELETE /harvest] Lote ${lotId} eliminado correctamente`);
    res.json({ 
      success: true, 
      message: 'Lote eliminado correctamente' 
    });
  } catch (err) {
    console.error('[DELETE /harvest] Error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// DELETE: Eliminar café tostado almacenado
coffeeRouter.delete('/roasted-storage/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DELETE /roasted-storage] Eliminando tostado almacenado ID: ${id}`);

    // Verificar si existe
    const checkResult = await query(
      'SELECT id FROM roasted_coffee_inventory WHERE id = ?',
      [id]
    );

    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Registro no encontrado' 
      });
    }

    // Eliminar
    await query('DELETE FROM roasted_coffee_inventory WHERE id = ?', [id]);

    console.log(`[DELETE /roasted-storage] ID ${id} eliminado correctamente`);
    res.json({ 
      success: true, 
      message: 'Café tostado almacenado eliminado correctamente' 
    });
  } catch (err) {
    console.error('[DELETE /roasted-storage] Error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// DELETE: Eliminar café tostado pendiente de almacenar
coffeeRouter.delete('/roasted-coffee/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DELETE /roasted-coffee] Eliminando tostado pendiente ID: ${id}`);

    // Verificar si existe
    const checkResult = await query(
      'SELECT id FROM roasted_coffee WHERE id = ?',
      [id]
    );

    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Registro no encontrado' 
      });
    }

    // Eliminar
    await query('DELETE FROM roasted_coffee WHERE id = ?', [id]);

    console.log(`[DELETE /roasted-coffee] ID ${id} eliminado correctamente`);
    res.json({ 
      success: true, 
      message: 'Café tostado pendiente eliminado correctamente' 
    });
  } catch (err) {
    console.error('[DELETE /roasted-coffee] Error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});
