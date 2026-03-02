import express from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

export const labelsRouter = express.Router();

// Aplicar rate limiting y autenticación a todas las rutas
labelsRouter.use(apiLimiter);
labelsRouter.use(authenticateToken);
labelsRouter.use(requireRole(['admin', 'caficultor']));

// 1. GET - Obtener lotes preparados para venta
labelsRouter.get('/prepared-lots', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const results = await query(
      `SELECT 
        pc.id,
        pc.roasted_storage_id,
        pc.acidity,
        pc.body,
        pc.balance,
        pc.score,
        pc.presentation,
        pc.grind_size,
        pc.package_size,
        pc.unit_count,
        rc.roast_level,
        rc.weight_kg,
        rb.lot_id,
        ch.code as lot_code,
        ch.region,
        ch.farm,
        ch.variety,
        ch.process,
        ch.flavor_notes,
        ch.weight as lot_weight
       FROM packaged_coffee pc
       LEFT JOIN roasted_coffee_inventory rci ON pc.roasted_storage_id = rci.id
       LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id
       LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
       LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
       WHERE pc.status = 'ready_for_sale' 
       ORDER BY pc.created_at DESC 
       LIMIT 100`
    );

    // Transformar resultados al formato esperado
    const lots = results.map(row => ({
      id: row.id,
      code: row.lot_code || `LOT-${row.roasted_storage_id}`,
      origin: row.region || 'Colombia',
      farm: row.farm,
      variety: row.variety,
      roast: row.roast_level || 'Medio',
      process: row.process,
      presentation: row.presentation,
      grind: row.grind_size,
      acidity: row.acidity,
      body: row.body,
      balance: row.balance,
      score: row.score,
      flavorNotes: row.flavor_notes,
      weight: row.weight_kg,
      packageSize: row.package_size,
      unitCount: row.unit_count
    }));

    res.json(lots);
  } catch (error) {
    console.error('Error al obtener lotes preparados:', error);
    res.status(500).json({ error: 'Error al obtener lotes preparados' });
  }
});

// 2. POST - Generar etiquetas desde lote preparado
labelsRouter.post('/generate-from-lot', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { lotId, quantity, includeQR } = req.body;

    if (!lotId || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos: lotId, quantity'
      });
    }

    // Obtener información del café empacado
    const coffeeResults = await query(
      `SELECT pc.*, rc.roast_level, rc.weight_kg, rb.lot_id, ch.code as lot_code, ch.region, ch.farm, 
              ch.variety, ch.process, ch.flavor_notes, ch.weight as lot_weight
       FROM packaged_coffee pc
       LEFT JOIN roasted_coffee_inventory rci ON pc.roasted_storage_id = rci.id
       LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id
       LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
       LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
       WHERE pc.id = ?`,
      [lotId]
    );

    if (coffeeResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Café empacado no encontrado'
      });
    }

    const coffee = coffeeResults[0];

    // Generar etiquetas
    const labels = [];
    const baseCode = `LBL-${coffee.lot_code || `PKG-${lotId}`}`;

    for (let i = 1; i <= quantity; i++) {
      const labelId = `${baseCode}-${String(i).padStart(4, '0')}`;
      const qrData = includeQR ? generateQRData(coffee, labelId) : null;

      labels.push({
        id: labelId,
        packagedCoffeeId: coffee.id,
        lotCode: coffee.lot_code,
        origin: coffee.region,
        farm: coffee.farm,
        variety: coffee.variety,
        roast: coffee.roast_level,
        process: coffee.process,
        presentation: coffee.presentation,
        grind: coffee.grind_size,
        acidity: coffee.acidity,
        body: coffee.body,
        balance: coffee.balance,
        score: coffee.score,
        flavorNotes: coffee.flavor_notes,
        qrCode: qrData,
        generatedAt: new Date(),
        sequence: i
      });

      // Guardar en BD
      await query(
        `INSERT INTO generated_labels (label_code, lot_code, origin, variety, roast, 
                                       acidity, body, balance, score, flavor_notes, 
                                       qr_data, sequence, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          labelId,
          coffee.lot_code || `PKG-${lotId}`,
          coffee.region,
          coffee.variety,
          coffee.roast_level,
          coffee.acidity,
          coffee.body,
          coffee.balance,
          coffee.score,
          coffee.flavor_notes,
          qrData,
          i,
          req.user.id
        ]
      );
    }

    // Log de auditoría
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'generate_labels', 'packaged_coffee', lotId, JSON.stringify({ quantity, includeQR })]
    );

    res.json({
      success: true,
      message: `${quantity} etiquetas generadas exitosamente`,
      labels: labels
    });
  } catch (error) {
    console.error('Error al generar etiquetas desde lote:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar etiquetas'
    });
  }
});

// 3. POST - Generar etiquetas desde cero
labelsRouter.post('/generate-from-scratch', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const {
      origin,
      farm,
      variety,
      roast,
      process,
      altitude,
      acidity,
      body,
      balance,
      flavorNotes,
      quantity
    } = req.body;

    if (!origin || !variety || !roast || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos: origin, variety, roast, quantity'
      });
    }

    // Calcular puntuación
    const score = ((acidity + body + balance) / 3).toFixed(1);

    // Generar código único para este lote temporal
    const timestamp = Date.now();
    const lotCode = `TMP-${origin.substring(0, 3).toUpperCase()}-${variety.substring(0, 3).toUpperCase()}-${timestamp}`;

    // Generar etiquetas
    const labels = [];

    for (let i = 1; i <= quantity; i++) {
      const labelId = `LBL-${lotCode}-${String(i).padStart(4, '0')}`;
      const qrData = {
        type: 'custom_profile',
        origin,
        farm,
        variety,
        roast,
        process,
        altitude,
        profile: {
          acidity,
          body,
          balance,
          score
        },
        flavorNotes,
        generated: new Date().toISOString()
      };

      labels.push({
        id: labelId,
        lotCode: lotCode,
        origin,
        farm,
        variety,
        roast,
        process,
        altitude,
        acidity,
        body,
        balance,
        score,
        flavorNotes,
        qrCode: JSON.stringify(qrData),
        generatedAt: new Date(),
        sequence: i
      });

      // Guardar en BD tabla temporal de etiquetas generadas
      await query(
        `INSERT INTO generated_labels (label_code, lot_code, origin, variety, roast, 
                                       acidity, body, balance, score, flavor_notes, 
                                       qr_data, sequence, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          labelId,
          lotCode,
          origin,
          variety,
          roast,
          acidity,
          body,
          balance,
          score,
          flavorNotes,
          JSON.stringify(qrData),
          i,
          req.user.id
        ]
      );
    }

    // Log de auditoría
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'generate_labels_custom', 'custom_profile', lotCode, 
       JSON.stringify({ origin, variety, roast, quantity })]
    );

    res.json({
      success: true,
      message: `${quantity} etiquetas generadas exitosamente`,
      labels: labels
    });
  } catch (error) {
    console.error('Error al generar etiquetas personalizadas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar etiquetas personalizadas'
    });
  }
});

// 4. GET - Obtener todas las etiquetas generadas
labelsRouter.get('/list', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { type = 'all', limit = 100, offset = 0 } = req.query;

    let sql = `SELECT * FROM generated_labels WHERE 1=1`;
    const params = [];

    if (type === 'lots') {
      sql += ` AND lot_id IS NOT NULL`;
    } else if (type === 'custom') {
      sql += ` AND lot_id IS NULL`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const labels = await query(sql, params);

    // Contar total
    let countSql = `SELECT COUNT(*) as total FROM generated_labels WHERE 1=1`;
    if (type === 'lots') {
      countSql += ` AND lot_id IS NOT NULL`;
    } else if (type === 'custom') {
      countSql += ` AND lot_id IS NULL`;
    }

    const countResult = await query(countSql);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: labels,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener etiquetas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener etiquetas'
    });
  }
});

// 5. GET - Obtener etiqueta específica
labelsRouter.get('/:labelId', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { labelId } = req.params;

    const results = await query(
      `SELECT * FROM generated_labels WHERE label_code = ?`,
      [labelId]
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etiqueta no encontrada'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error('Error al obtener etiqueta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener etiqueta'
    });
  }
});

// 6. DELETE - Eliminar etiquetas
labelsRouter.delete('/:labelId', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { labelId } = req.params;

    const result = await query(
      `DELETE FROM generated_labels WHERE label_code = ?`,
      [labelId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etiqueta no encontrada'
      });
    }

    // Log de auditoría
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [req.user.id, 'delete_label', 'label', labelId]
    );

    res.json({
      success: true,
      message: 'Etiqueta eliminada'
    });
  } catch (error) {
    console.error('Error al eliminar etiqueta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar etiqueta'
    });
  }
});

// Función auxiliar para generar datos QR
function generateQRData(lot, labelId) {
  return JSON.stringify({
    type: 'product_label',
    labelId,
    lotCode: lot.code,
    origin: lot.origin,
    farm: lot.farm,
    variety: lot.variety,
    roast: lot.roast,
    process: lot.process,
    presentation: lot.presentation,
    grind: lot.grind,
    profile: {
      acidity: lot.acidity,
      body: lot.body,
      balance: lot.balance,
      score: lot.score
    },
    flavorNotes: lot.flavor_notes,
    generated: new Date().toISOString()
  });
}
