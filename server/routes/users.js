import { Router } from 'express';
import * as auth from '../auth.js';
import { query } from '../db.js';

const usersRouter = Router();

// GET /api/users - Obtener todos los usuarios (solo admin)
usersRouter.get('/', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, 
        email, 
        name, 
        mobile_phone, 
        city, 
        state_province, 
        country, 
        role, 
        is_verified, 
        caficultor_status,
        last_login_at, 
        created_at 
      FROM users 
      ORDER BY created_at DESC`
    );
    
    res.json({ users: result.rows });
  } catch (err) {
    console.error('[GET /api/users] Error:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

export { usersRouter };
