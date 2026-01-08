import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as db from '../db.js';
import * as auth from '../auth.js';
import { sendVerificationEmail } from '../services/email.js';
import crypto from 'crypto';
import { loginLimiter, registerLimiter, refreshLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

// Register
authRouter.post('/register',
  registerLimiter,
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name } = req.body;

    try {
      // Verificar si existe
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'El email ya esta registrado' });
      }

      const hash = await auth.hashPassword(password);
      
      // Crear usuario (rol default: client)
      const result = await db.query(
        'INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, ?)',
        [email, hash, name, 'client', false]
      );
      
      // En MySQL, el ID insertado viene en result.rows.insertId (dependiendo del driver, pero con mysql2/promise y execute devuelve [rows, fields])
      // Con execute de mysql2, result es [ResultSetHeader, undefined] para inserts
      // Mi wrapper en db.js devuelve { rows, fields }. Para inserts, rows es el ResultSetHeader.
      const insertId = result.rows.insertId;
      
      const newUser = { id: insertId, email, name, role: 'client' };

      // Generar token de verificacion (temporal, guardado en DB o JWT firmado)
      // Para simplificar, usaremos un JWT de corta duracion con payload especifico
      const verifyToken = auth.generateToken({ ...newUser, type: 'verification' }); // Reusamos generateToken pero idealmente seria uno especifico
      
      // Enviar email (No bloqueante para no demorar la respuesta)
      sendVerificationEmail(email, verifyToken).then(r => console.log('Email result:', r));
      
      // Log de auditoria
      await db.query('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)', 
        ['REGISTER', 'user', String(newUser.id), JSON.stringify({ email: newUser.email })]
      );

      res.status(201).json({ message: 'Usuario registrado. Por favor revisa tu correo para verificar la cuenta.', user: newUser });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }
);

// Verify Email Endpoint
authRouter.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token requerido' });

  try {
    const decoded = auth.verifyToken(token);
    // Aqui podriamos validar decoded.type === 'verification' si lo hubieramos seteado especificamente

    await db.query('UPDATE users SET is_verified = TRUE WHERE id = ?', [decoded.id]);
    
    res.json({ message: 'Cuenta verificada exitosamente. Ya puedes iniciar sesion.' });
  } catch (err) {
    res.status(400).json({ error: 'Token invalido o expirado' });
  }
});

// Login
authRouter.post('/login',
  loginLimiter,
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      const user = result.rows[0];

      if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });

      const validPass = await auth.comparePassword(password, user.password_hash);
      if (!validPass) return res.status(401).json({ error: 'Credenciales invalidas' });

      // Generar tokens
      const accessToken = auth.generateToken(user);
      const refreshToken = auth.generateRefreshToken();
      const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      // Guardar refresh token hasheado en DB (seguridad)
      const hashedRefreshToken = auth.hashRefreshToken(refreshToken);
      await db.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, hashedRefreshToken, refreshExpires]
      );

      // Actualizar last_login
      await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

      // Cookies
      const isProd = process.env.NODE_ENV === 'production';
      
      res.cookie('auth_token', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 min
      });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        path: '/api/auth/refresh', // Solo se envia a este endpoint
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
      });

      // Devolver token también en JSON para clientes que usen localStorage
      res.json({ 
        message: 'Login exitoso', 
        token: accessToken,
        user: { id: user.id, name: user.name, role: user.role } 
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error de servidor' });
    }
});

// Refresh Token
authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  const refreshToken = req.cookies['refresh_token'];
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    // Hashear token antes de buscar en BD
    const hashedToken = auth.hashRefreshToken(refreshToken);
    
    // Buscar token hasheado en DB
    const result = await db.query(
      'SELECT rt.*, u.role, u.email, u.name FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token_hash = ? AND rt.revoked = FALSE AND rt.expires_at > NOW()',
      [hashedToken]
    );

    if (result.rows.length === 0) {
      // Token invalido o reusado maliciosamente -> podriamos borrar todos los tokens del usuario por seguridad
      res.clearCookie('auth_token');
      res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
      return res.status(403).json({ error: 'Token invalido o expirado' });
    }

    const tokenRecord = result.rows[0];
    const user = { id: tokenRecord.user_id, role: tokenRecord.role, name: tokenRecord.name, email: tokenRecord.email };

    // Rotacion de Refresh Token (Seguridad avanzada)
    // Invalidamos el usado y creamos uno nuevo
    const newRefreshToken = auth.generateRefreshToken();
    const newRefreshTokenHash = auth.hashRefreshToken(newRefreshToken);
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query('UPDATE refresh_tokens SET revoked = TRUE, replaced_by_token = ? WHERE id = ?', [newRefreshTokenHash, tokenRecord.id]);
    await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, newRefreshTokenHash, newExpires]);

    const newAccessToken = auth.generateToken(user);

    // Set Cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', newAccessToken, { httpOnly: true, secure: isProd, sameSite: 'strict', maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', newRefreshToken, { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

    // Devolver también el token en JSON para actualizar localStorage
    res.json({ 
      message: 'Token refrescado',
      token: newAccessToken,
      user: { id: user.id, name: user.name, role: user.role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al refrescar token' });
  }
});

// Logout
authRouter.post('/logout', async (req, res) => {
  const refreshToken = req.cookies['refresh_token'];
  if (refreshToken) {
    // Revocar en DB (hasheado)
    const hashedToken = auth.hashRefreshToken(refreshToken);
    await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?', [hashedToken]);
  }
  
  res.clearCookie('auth_token');
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  res.json({ message: 'Logout exitoso' });
});

// Check auth status
authRouter.get('/me', auth.authenticateToken, async (req, res) => {
    const result = await db.query('SELECT id, name, email, role, caficultor_status FROM users WHERE id = ?', [req.user.id]);
    res.json(result.rows[0]);
});

// Request Caficultor Role
authRouter.post('/request-caficultor',
  auth.authenticateToken,
  body('farm_name').notEmpty(),
  body('region').notEmpty(),
  body('description').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { farm_name, region, altitude, hectares, varieties_cultivated, certifications, description } = req.body;
    const userId = req.user.id;

    try {
      // Verificar si ya existe una solicitud activa
      const existing = await db.query(
        'SELECT id FROM caficultor_applications WHERE user_id = ? AND status = "pending"',
        [userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Ya tienes una solicitud pendiente de revisión' });
      }

      // Insertar solicitud
      const result = await db.query(
        'INSERT INTO caficultor_applications (user_id, farm_name, region, altitude, hectares, varieties_cultivated, certifications, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, farm_name, region, altitude || null, hectares || null, varieties_cultivated || null, certifications || null, description]
      );

      // Actualizar estado del usuario
      await db.query(
        'UPDATE users SET caficultor_status = "pending" WHERE id = ?',
        [userId]
      );

      // Log de auditoria
      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, 'REQUEST_CAFICULTOR', 'caficultor_applications', String(result.rows.insertId), JSON.stringify({ farm_name })]
      );

      res.status(201).json({ 
        message: 'Solicitud enviada. El administrador revisará tu perfil pronto.',
        application_id: result.rows.insertId
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al enviar solicitud' });
    }
  }
);

// Get caficultor application status (para que el usuario vea el estado de su solicitud)
authRouter.get('/caficultor-status',
  auth.authenticateToken,
  async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, status, admin_notes, reviewed_at FROM caficultor_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (result.rows.length === 0) {
        return res.json({ hasApplication: false });
      }
      res.json({ hasApplication: true, application: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener estado' });
    }
  }
);
