import express from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

export const devtoolsRouter = express.Router();

// Aplicar seguridad y autenticación a todas las rutas
devtoolsRouter.use(apiLimiter);
devtoolsRouter.use(authenticateToken);
devtoolsRouter.use(requireRole(['admin'])); // Solo admin puede usar estas herramientas

// 1. Limpiar Usuarios - Mantener solo los 2 primeros (admin)
devtoolsRouter.post('/clean-users', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Obtener los IDs de los 2 primeros usuarios
    const firstTwoUsers = await query(`
      SELECT id FROM users ORDER BY id ASC LIMIT 2
    `);

    const firstTwoIds = firstTwoUsers.map(u => u.id);

    if (firstTwoIds.length === 0) {
      return res.status(400).json({ error: 'No hay usuarios para preservar' });
    }

    // Eliminar todos los usuarios excepto los 2 primeros
    let placeholders = '?';
    for (let i = 1; i < firstTwoIds.length; i++) {
      placeholders += ',?';
    }

    const result = await query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, firstTwoIds);

    res.json({
      success: true,
      message: `✅ Usuarios eliminados. Se preservaron los 2 primeros admins.`,
      deletedCount: result.affectedRows || 0
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
    // Eliminar en orden de dependencias - primero las referencias, luego los lotes
    const tablesToDelete = [
      'generated_labels',  // Depende de users (opcional)
      'product_labels',    // Depende de lots
      'lots'               // Tabla principal de lotes
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

    res.json({
      success: true,
      message: `✅ Limpiza completada. Se procesaron ${deletedCount} tablas.`,
      details: details
    });
  } catch (error) {
    console.error('Error general al limpiar lotes:', error);
    res.status(500).json({ error: `Error al limpiar lotes: ${error.message}` });
  }
});

// 3. Limpiar Productos
devtoolsRouter.post('/clean-products', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
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

    res.json({
      success: true,
      message: `✅ Productos eliminados. Se procesaron ${deletedCount} tablas.`,
      details: details
    });
  } catch (error) {
    console.error('Error general al limpiar productos:', error);
    res.status(500).json({ error: `Error al limpiar productos: ${error.message}` });
  }
});
