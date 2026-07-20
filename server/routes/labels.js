import express from 'express';
import { body, query as queryValidator, validationResult } from 'express-validator';
import { logger } from '../logger.js';
import { query, withTransaction } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../services/audit.js';

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
        ch.lot_id as lot_code,
        ch.region,
        ch.farm,
        ch.variety,
        ch.process,
        ch.taste_notes as flavor_notes
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
    const lots = results.rows.map(row => ({
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
    logger.error('Error al obtener lotes preparados:', error);
    res.status(500).json({ error: 'Error al obtener lotes preparados' });
  }
});

// 2. POST - Generar etiquetas desde lote preparado
labelsRouter.post('/generate-from-lot',
  [
    body('lotId').notEmpty().withMessage('lotId requerido'),
    body('quantity').isInt({ min: 1, max: 1000 }).withMessage('quantity debe ser un entero entre 1 y 1000').toInt(),
    body('includeQR').optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const { lotId, quantity, includeQR } = req.body;

      // Obtener información del café empacado
      const coffeeResults = await query(
        `SELECT pc.*, rc.roast_level, rc.weight_kg, rb.lot_id,
                ch.lot_id as lot_code, ch.region, ch.farm,
                ch.variety, ch.process, ch.taste_notes as flavor_notes
         FROM packaged_coffee pc
         LEFT JOIN roasted_coffee_inventory rci ON pc.roasted_storage_id = rci.id
         LEFT JOIN roasted_coffee rc ON rci.roasted_id = rc.id
         LEFT JOIN roasting_batches rb ON rc.roasting_id = rb.id
         LEFT JOIN coffee_harvests ch ON rb.lot_id = ch.lot_id
         WHERE pc.id = ?`,
        [lotId]
      );

      if (coffeeResults.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Café empacado no encontrado'
        });
      }

      const coffee = coffeeResults.rows[0];
      const lotCode = coffee.lot_code || `PKG-${lotId}`;
      const baseCode = `LBL-${lotCode}`;

      // Continuar la secuencia existente para este lote en vez de reiniciar en 1,
      // ya que label_code es UNIQUE y una segunda tanda del mismo lote chocaría.
      const maxSeqResult = await query(
        `SELECT COALESCE(MAX(sequence), 0) as max_sequence FROM generated_labels WHERE lot_code = ?`,
        [lotCode]
      );
      const startSequence = (maxSeqResult.rows[0]?.max_sequence || 0) + 1;

      const labels = [];

      await withTransaction(async (client) => {
        for (let offset = 0; offset < quantity; offset++) {
          const seq = startSequence + offset;
          const labelId = `${baseCode}-${String(seq).padStart(4, '0')}`;
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
            sequence: seq
          });

          await client.query(
            `INSERT INTO generated_labels (label_code, lot_code, origin, variety, roast, process,
                                           farm, altitude, acidity, body, balance, score, flavor_notes,
                                           qr_data, sequence, user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              labelId,
              lotCode,
              coffee.region,
              coffee.variety,
              coffee.roast_level,
              coffee.process,
              coffee.farm,
              null,
              coffee.acidity,
              coffee.body,
              coffee.balance,
              coffee.score,
              coffee.flavor_notes,
              qrData,
              seq,
              req.user.id
            ]
          );
        }
      });

      // Log de auditoría (no debe hacer fallar la respuesta si falla)
      await logAudit(req.user.id, 'generate_labels', 'packaged_coffee', lotId, { quantity, includeQR });

      res.json({
        success: true,
        message: `${quantity} etiquetas generadas exitosamente`,
        labels: labels
      });
    } catch (error) {
      logger.error('Error al generar etiquetas desde lote:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar etiquetas'
      });
    }
  }
);

// 3. POST - Generar etiquetas desde cero
labelsRouter.post('/generate-from-scratch',
  [
    body('origin').trim().notEmpty().withMessage('origin requerido'),
    body('variety').trim().notEmpty().withMessage('variety requerido'),
    body('roast').trim().notEmpty().withMessage('roast requerido'),
    body('quantity').isInt({ min: 1, max: 1000 }).withMessage('quantity debe ser un entero entre 1 y 1000').toInt(),
    body('acidity').isInt({ min: 1, max: 5 }).withMessage('acidity debe ser un entero entre 1 y 5').toInt(),
    body('body').isInt({ min: 1, max: 5 }).withMessage('body debe ser un entero entre 1 y 5').toInt(),
    body('balance').isInt({ min: 1, max: 5 }).withMessage('balance debe ser un entero entre 1 y 5').toInt(),
    body('farm').optional().trim(),
    body('process').optional().trim(),
    body('altitude').optional().trim(),
    body('region').optional().trim(),
    body('climate').optional().trim(),
    body('roastDate').optional().trim(),
    body('flavorNotes').optional().trim(),
  ],
  async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const {
        origin,
        farm,
        variety,
        roast,
        process,
        altitude,
        region,
        climate,
        roastDate,
        acidity,
        body: coffeeBody,
        balance,
        flavorNotes,
        quantity
      } = req.body;

      // Calcular puntuación
      const score = ((acidity + coffeeBody + balance) / 3).toFixed(1);

      // Generar código único para este lote temporal
      const timestamp = Date.now();
      const lotCode = `TMP-${origin.substring(0, 3).toUpperCase()}-${variety.substring(0, 3).toUpperCase()}-${timestamp}`;

      const labels = [];

      await withTransaction(async (client) => {
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
            region,
            climate,
            roastDate,
            profile: {
              acidity,
              body: coffeeBody,
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
            region,
            climate,
            roastDate,
            acidity,
            body: coffeeBody,
            balance,
            score,
            flavorNotes,
            qrCode: JSON.stringify(qrData),
            generatedAt: new Date(),
            sequence: i
          });

          await client.query(
            `INSERT INTO generated_labels (label_code, lot_code, origin, variety, roast, process,
                                           farm, altitude, acidity, body, balance, score, flavor_notes,
                                           qr_data, sequence, user_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              labelId,
              lotCode,
              origin,
              variety,
              roast,
              process || null,
              farm || null,
              altitude || null,
              acidity,
              coffeeBody,
              balance,
              score,
              flavorNotes,
              JSON.stringify(qrData),
              i,
              req.user.id
            ]
          );
        }
      });

      // Log de auditoría (no debe hacer fallar la respuesta si falla)
      await logAudit(req.user.id, 'generate_labels_custom', 'custom_profile', lotCode, { origin, variety, roast, quantity });

      res.json({
        success: true,
        message: `${quantity} etiquetas generadas exitosamente`,
        labels: labels
      });
    } catch (error) {
      logger.error('Error al generar etiquetas personalizadas:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar etiquetas personalizadas'
      });
    }
  }
);

// 4. GET - Obtener todas las etiquetas generadas
labelsRouter.get('/list',
  [
    queryValidator('type').optional().isIn(['all', 'lots', 'custom']),
    queryValidator('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
    queryValidator('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const { type = 'all', limit = 100, offset = 0 } = req.query;

      let sql = `SELECT * FROM generated_labels WHERE 1=1`;
      const params = [];

      if (type === 'lots') {
        sql += ` AND lot_code NOT LIKE 'TMP-%'`;
      } else if (type === 'custom') {
        sql += ` AND lot_code LIKE 'TMP-%'`;
      }

      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const labelsResult = await query(sql, params);
      const labels = labelsResult.rows;

      // Contar total
      let countSql = `SELECT COUNT(*) as total FROM generated_labels WHERE 1=1`;
      if (type === 'lots') {
        countSql += ` AND lot_code NOT LIKE 'TMP-%'`;
      } else if (type === 'custom') {
        countSql += ` AND lot_code LIKE 'TMP-%'`;
      }

      const countResult = await query(countSql);
      const total = parseInt(countResult.rows[0]?.total || 0);

      res.json({
        success: true,
        data: labels,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error al obtener etiquetas:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener etiquetas'
      });
    }
  }
);

// 5. GET - Estadísticas consolidadas (KPIs de la página de etiquetas)
labelsRouter.get('/stats', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const countsResult = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN lot_code NOT LIKE 'TMP-%' THEN 1 ELSE 0 END) as from_lots,
        SUM(CASE WHEN lot_code LIKE 'TMP-%' THEN 1 ELSE 0 END) as custom
       FROM generated_labels`
    );

    const counts = countsResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        total: parseInt(counts.total || 0),
        fromLots: parseInt(counts.from_lots || 0),
        custom: parseInt(counts.custom || 0),
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de etiquetas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de etiquetas',
    });
  }
});

// 6. GET - Obtener etiqueta específica
labelsRouter.get('/:labelId', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { labelId } = req.params;

    const results = await query(
      `SELECT * FROM generated_labels WHERE label_code = ?`,
      [labelId]
    );

    if (results.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etiqueta no encontrada'
      });
    }

    res.json({
      success: true,
      data: results.rows[0]
    });
  } catch (error) {
    logger.error('Error al obtener etiqueta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener etiqueta'
    });
  }
});

// 7. PATCH - Marcar/desmarcar etiqueta como impresa
labelsRouter.patch('/:labelId/print',
  [
    body('printed').optional().isBoolean().toBoolean(),
  ],
  async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const { labelId } = req.params;
      const printed = req.body.printed !== false; // por defecto marca como impresa

      const result = await query(
        `UPDATE generated_labels
         SET printed = ?, printed_at = ?, updated_at = datetime('now')
         WHERE label_code = ?`,
        [printed ? 1 : 0, printed ? new Date().toISOString() : null, labelId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Etiqueta no encontrada'
        });
      }

      await logAudit(req.user.id, printed ? 'mark_label_printed' : 'unmark_label_printed', 'label', labelId);

      res.json({
        success: true,
        message: printed ? 'Etiqueta marcada como impresa' : 'Etiqueta marcada como pendiente'
      });
    } catch (error) {
      logger.error('Error al actualizar estado de impresión:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar estado de impresión'
      });
    }
  }
);

// 8. DELETE - Eliminar etiquetas
labelsRouter.delete('/:labelId', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { labelId } = req.params;

    const result = await query(
      `DELETE FROM generated_labels WHERE label_code = ?`,
      [labelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etiqueta no encontrada'
      });
    }

    // Log de auditoría
    await logAudit(req.user.id, 'delete_label', 'label', labelId);

    res.json({
      success: true,
      message: 'Etiqueta eliminada'
    });
  } catch (error) {
    logger.error('Error al eliminar etiqueta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar etiqueta'
    });
  }
});

// Función auxiliar para generar datos QR
// lot puede ser un objeto raw de BD (campos snake_case) o un objeto transformado
function generateQRData(lot, labelId) {
  return JSON.stringify({
    type: 'product_label',
    labelId,
    lotCode: lot.lot_code || lot.lot_id,
    origin: lot.region || lot.origin,
    farm: lot.farm,
    variety: lot.variety,
    roast: lot.roast_level || lot.roast,
    process: lot.process,
    presentation: lot.presentation,
    grind: lot.grind_size || lot.grind,
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
