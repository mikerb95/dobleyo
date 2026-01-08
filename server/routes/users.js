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

// PUT /api/users/:id - Editar usuario (solo admin)
usersRouter.put('/:id', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile_phone, city, state_province, country, role, is_verified } = req.body;

    // Validar que el usuario existe
    const userResult = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar usuario
    const updateQuery = `
      UPDATE users 
      SET 
        name = COALESCE(?, name),
        mobile_phone = COALESCE(?, mobile_phone),
        city = COALESCE(?, city),
        state_province = COALESCE(?, state_province),
        country = COALESCE(?, country),
        role = COALESCE(?, role),
        is_verified = COALESCE(?, is_verified)
      WHERE id = ?
    `;

    await query(updateQuery, [name, mobile_phone, city, state_province, country, role, is_verified, id]);

    // Retornar usuario actualizado
    const updated = await query(
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
      WHERE id = ?`,
      [id]
    );

    res.json({ user: updated.rows[0] });
  } catch (err) {
    console.error('[PUT /api/users/:id] Error:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id - Eliminar usuario (solo admin)
usersRouter.delete('/:id', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // No permitir eliminar al usuario actual
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    // Validar que el usuario existe
    const userResult = await query('SELECT email FROM users WHERE id = ?', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userEmail = userResult.rows[0].email;

    // Eliminar usuario
    await query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ 
      message: `Usuario ${userEmail} eliminado exitosamente`,
      deletedId: id
    });
  } catch (err) {
    console.error('[DELETE /api/users/:id] Error:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// POST /api/users - Crear nuevo usuario (solo admin)
usersRouter.post('/', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const { email, name, mobile_phone, city, state_province, country, role, is_verified } = req.body;

    // Validar campos requeridos
    if (!email || !name) {
      return res.status(400).json({ error: 'Email y nombre son requeridos' });
    }

    // Validar que el email no exista
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Generar contraseña temporal aleatoria
    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await auth.hashPassword(tempPassword);

    // Crear usuario
    const result = await query(
      `INSERT INTO users 
        (email, password_hash, name, mobile_phone, city, state_province, country, role, is_verified) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, name, mobile_phone || null, city || null, state_province || null, country || null, role || 'client', is_verified || false]
    );

    const newUserId = result.rows.insertId;

    // Obtener usuario creado
    const newUser = await query(
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
        created_at 
      FROM users 
      WHERE id = ?`,
      [newUserId]
    );

    res.status(201).json({ 
      message: 'Usuario creado exitosamente',
      tempPassword: tempPassword,
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error('[POST /api/users] Error:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

export { usersRouter };
