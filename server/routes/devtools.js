import express from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

export const devtoolsRouter = express.Router();

// PROTECCIÓN: Bloquear devtools en producción, forzar autenticación admin
devtoolsRouter.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Developer tools are disabled in production' });
  }
  next();
});
devtoolsRouter.use(apiLimiter);
devtoolsRouter.use(authenticateToken);
devtoolsRouter.use(requireRole(['admin'])); // Solo admin puede usar estas herramientas

// 1. Limpiar Usuarios - Mantener solo los 2 primeros (admin)
devtoolsRouter.post('/clean-users', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Obtener los IDs de los 2 primeros usuarios
    const result = await query(`
      SELECT id FROM users ORDER BY id ASC LIMIT 2
    `);

    const firstTwoIds = (result.rows || result).map(u => u.id);

    if (firstTwoIds.length === 0) {
      return res.status(400).json({ error: 'No hay usuarios para preservar' });
    }

    // Eliminar todos los usuarios excepto los 2 primeros
    let placeholders = '?';
    for (let i = 1; i < firstTwoIds.length; i++) {
      placeholders += ',?';
    }

    const deleteResult = await query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, firstTwoIds);

    res.json({
      success: true,
      message: `✅ Usuarios eliminados. Se preservaron los 2 primeros admins.`,
      deletedCount: deleteResult.affectedRows || 0
    });
  } catch (error) {
    console.error('Error al limpiar usuarios:', error);
    res.status(500).json({ error: `Error al limpiar usuarios: ${error.message}` });
  }
});

// 2. Limpiar Lotes de Café
devtoolsRouter.post('/clean-lots', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Primero desactivar verificación de claves foráneas para poder eliminar en cualquier orden
    await query('SET FOREIGN_KEY_CHECKS = 0;');

    // Eliminar en orden de dependencias - primero las referencias, luego los lotes
    const tablesToDelete = [
      'generated_labels',           // Etiquetas generadas
      'product_labels',             // Etiquetas de productos
      'packaged_coffee',            // Café empaquetado
      'roasted_coffee_inventory',   // Inventario de café tostado
      'roasted_coffee',             // Café tostado (lotes de tostado)
      'roasting_batches',           // Lotes de tostión
      'coffee_inventory',           // Inventario de café verde
      'coffee_harvests',            // Cosechas de café (lotes verdes)
      'lots'                        // Tabla genérica de lotes
    ];

    let deletedCount = 0;
    let details = [];
    
    for (const table of tablesToDelete) {
      try {
        const result = await query(`DELETE FROM ${table}`);
        deletedCount++;
        details.push(`✓ ${table}: ${result.affectedRows || 0} registros`);
      } catch (tableError) {
        details.push(`⚠ ${table}: ${tableError.message}`);
        console.warn(`Error limpiando ${table}:`, tableError.message);
      }
    }

    // Reactivar verificación de claves foráneas
    await query('SET FOREIGN_KEY_CHECKS = 1;');

    res.json({
      success: true,
      message: `✅ Limpiza completada. Se eliminaron registros de ${deletedCount} tablas.`,
      details: details
    });
  } catch (error) {
    console.error('Error general al limpiar lotes:', error);
    // Asegurar que reactivamos las claves foráneas en caso de error
    await query('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    res.status(500).json({ error: `Error al limpiar lotes: ${error.message}` });
  }
});

// 3. Limpiar Productos
devtoolsRouter.post('/clean-products', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Desactivar verificación de claves foráneas temporalmente
    await query('SET FOREIGN_KEY_CHECKS = 0;');

    const tablesToDelete = [
      'product_supplier_prices',   // Depende de products
      'product_suppliers',         // Depende de products y users
      'inventory_movements',       // Depende de products
      'product_labels',            // Depende de lots y products (indirectamente)
      'products'                   // Tabla principal
    ];

    let deletedCount = 0;
    let details = [];
    
    for (const table of tablesToDelete) {
      try {
        const result = await query(`DELETE FROM ${table}`);
        deletedCount++;
        details.push(`✓ ${table}: ${result.affectedRows || 0} registros`);
      } catch (tableError) {
        details.push(`⚠ ${table}: ${tableError.message}`);
        console.warn(`Error limpiando ${table}:`, tableError.message);
      }
    }

    // Reactivar verificación de claves foráneas
    await query('SET FOREIGN_KEY_CHECKS = 1;');

    res.json({
      success: true,
      message: `✅ Productos eliminados. Se eliminaron registros de ${deletedCount} tablas.`,
      details: details
    });
  } catch (error) {
    console.error('Error general al limpiar productos:', error);
    // Asegurar que reactivamos las claves foráneas en caso de error
    await query('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    res.status(500).json({ error: `Error al limpiar productos: ${error.message}` });
  }
});
