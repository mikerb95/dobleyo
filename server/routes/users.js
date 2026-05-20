import { Router } from 'express';
import { logger } from '../logger.js';
import * as auth from '../auth.js';
import { query } from '../db.js';
import { logAudit } from '../services/audit.js';

const usersRouter = Router();

// GET /api/users - Obtener todos los usuarios (solo admin)
usersRouter.get('/', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, parseInt(limit) || 50);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];

    if (role) { conditions.push('role = ?'); params.push(role); }
    if (search) {
      conditions.push('(email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
      const p = `%${search}%`;
      params.push(p, p, p);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, result] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM users ${where}`, params),
      query(
        `SELECT
          id, email, name, first_name, last_name, mobile_phone, landline_phone,
          tax_id, address, city, state_province, country, role, is_verified,
          caficultor_status, last_login_at, created_at
        FROM users ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
    ]);

    const total = countResult.rows[0].total;
    res.json({
      success: true,
      data: result.rows,
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/users] Error:');
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// PUT /api/users/:id - Editar usuario (solo admin)
usersRouter.put('/:id', auth.authenticateToken, auth.requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, first_name, last_name, mobile_phone, city, state_province, country, role, is_verified, tax_id } = req.body;

    // Validar que el usuario existe
    const userResult = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Construir dinámicamente los campos a actualizar
    const updates = [];
    const values = [];

    if (first_name !== undefined && first_name !== null) {
      updates.push(`first_name = ?`);
      values.push(first_name);
    }
    if (last_name !== undefined && last_name !== null) {
      updates.push(`last_name = ?`);
      values.push(last_name);
    }
    if (name !== undefined && name !== null) {
      updates.push(`name = ?`);
      values.push(name);
    }
    if (mobile_phone !== undefined && mobile_phone !== null) {
      updates.push(`mobile_phone = ?`);
      values.push(mobile_phone);
    }
    if (city !== undefined && city !== null) {
      updates.push(`city = ?`);
      values.push(city);
    }
    if (state_province !== undefined && state_province !== null) {
      updates.push(`state_province = ?`);
      values.push(state_province);
    }
    if (country !== undefined && country !== null) {
      updates.push(`country = ?`);
      values.push(country);
    }
    if (tax_id !== undefined && tax_id !== null) {
      updates.push(`tax_id = ?`);
      values.push(tax_id);
    }
    if (role !== undefined && role !== null) {
      updates.push(`role = ?`);
      values.push(role);
    }
    if (is_verified !== undefined && is_verified !== null) {
      updates.push(`is_verified = ?`);
      values.push(is_verified);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // Agregar el ID al final de los valores
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    values.push(parseInt(id));
    console.log('[PUT /api/users/:id] Query:', updateQuery);
    console.log('[PUT /api/users/:id] Values:', values);

    const result = await query(updateQuery, values);
    console.log('[PUT /api/users/:id] Update result:', result);

    // Retornar usuario actualizado
    const updated = await query(
      `SELECT 
        id, 
        email, 
        name,
        first_name,
        last_name, 
        mobile_phone, 
        landline_phone,
        tax_id,
        address,
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
      [parseInt(id)]
    );

    console.log('[PUT /api/users/:id] Updated user:', updated.rows[0]);

    // Registrar en auditoría
    await logAudit(
      req.user.id,
      'update_user',
      'user',
      parseInt(id),
      {
        fields_updated: Object.keys(req.body).filter(k =>
          req.body[k] !== undefined && req.body[k] !== null
        )
      }
    );

    res.json({ user: updated.rows[0] });
  } catch (err) {
    logger.error({ err }, '[PUT /api/users/:id] Error:');
    res.status(500).json({ error: 'Error al actualizar usuario', details: err.message });
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
    logger.error({ err }, '[DELETE /api/users/:id] Error:');
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
      [email, passwordHash, name, mobile_phone || null, city || null, state_province || null, country || null, role || 'client', is_verified ? 1 : 0]
    );

    const newUserId = result.lastInsertRowid;

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
    logger.error({ err }, '[POST /api/users] Error:');
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

export { usersRouter };
