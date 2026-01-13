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

    await query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, firstTwoIds);

    res.json({
      success: true,
      message: `✅ Usuarios eliminados. Se preservaron los 2 primeros admins.`
    });
  } catch (error) {
    console.error('Error al limpiar usuarios:', error);
    res.status(500).json({ error: 'Error al limpiar usuarios' });
  }
});

// 2. Limpiar Lotes de Café
devtoolsRouter.post('/clean-lots', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Eliminar en orden de dependencias (de más específico a más general)
    // Primero las tablas que dependen de coffee_harvests
    await query('DELETE FROM roasted_coffee_inventory');
    await query('DELETE FROM roasted_coffee');
    await query('DELETE FROM roasting_batches');
    await query('DELETE FROM green_coffee_inventory');
    await query('DELETE FROM coffee_harvests');

    res.json({
      success: true,
      message: '✅ Todos los lotes de café y sus datos relacionados han sido eliminados.'
    });
  } catch (error) {
    console.error('Error al limpiar lotes:', error);
    res.status(500).json({ error: 'Error al limpiar lotes de café' });
  }
});

// 3. Limpiar Productos
devtoolsRouter.post('/clean-products', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // Eliminar en orden de dependencias
    await query('DELETE FROM packaged_coffee');
    await query('DELETE FROM products');

    res.json({
      success: true,
      message: '✅ Todos los productos han sido eliminados.'
    });
  } catch (error) {
    console.error('Error al limpiar productos:', error);
    res.status(500).json({ error: 'Error al limpiar productos' });
  }
});
