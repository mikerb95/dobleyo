import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import * as db from '../db.js';
import * as auth from '../auth.js';
import { sendVerificationEmail } from '../services/email.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loginLimiter, registerLimiter, refreshLimiter } from '../middleware/rateLimit.js';

// google-auth-library se carga perezosamente dentro del handler /google para
// evitar ERR_INTERNAL_ASSERTION de Node.js al mezclar ESM/CJS en cold start serverless.
let googleClientPromise = null;
async function getGoogleClient() {
  if (!googleClientPromise) {
    googleClientPromise = import('google-auth-library').then(
      ({ OAuth2Client }) => new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    );
  }
  return googleClientPromise;
}

// Apple JWKS — caché de 1 hora para no consultar en cada request
let appleJwksCache = null;
let appleJwksCacheTime = 0;

async function getApplePublicKey(kid) {
  const now = Date.now();
  if (!appleJwksCache || now - appleJwksCacheTime > 3_600_000) {
    const { default: fetch } = await import('node-fetch');
    const resp = await fetch('https://appleid.apple.com/auth/keys');
    appleJwksCache = await resp.json();
    appleJwksCacheTime = now;
  }
  return appleJwksCache.keys.find((k) => k.kid === kid) ?? null;
}

export const authRouter = Router();

// Register
authRouter.post('/register',
  registerLimiter,
  body('email').isEmail(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('first_name').notEmpty(),
  body('last_name').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, first_name, last_name } = req.body;

    try {
      // Verificar si existe
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'El email ya esta registrado' });
      }

      const hash = await auth.hashPassword(password);

      // Crear usuario (rol default: client)
      const result = await db.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hash, first_name, last_name, 'client', 0]
      );

      const insertId = result.lastInsertRowid;

      const newUser = { id: insertId, email, first_name, last_name, role: 'client' };

      // Generar token de verificacion (temporal, guardado en DB o JWT firmado)
      // Para simplificar, usaremos un JWT de corta duracion con payload especifico
      const verifyToken = auth.generateVerificationToken(newUser);
      
      // Enviar email (No bloqueante para no demorar la respuesta)
      sendVerificationEmail(email, verifyToken).then(r => console.log('Email result:', r));
      
      // Log de auditoria
      await db.query('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)',
        ['REGISTER', 'user', String(newUser.id), JSON.stringify({ email: newUser.email })]
      );

      res.status(201).json({ message: 'Usuario registrado. Por favor revisa tu correo para verificar la cuenta.', user: newUser });

    } catch (err) {
      logger.error(err);
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
    // Solo aceptamos tokens emitidos específicamente para verificación: un access
    // token de sesión no debe servir para marcar la cuenta como verificada.
    if (decoded.type !== 'verification') {
      return res.status(400).json({ error: 'Token invalido o expirado' });
    }

    await db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [decoded.id]);
    
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

    // Dev credentials bypass — bloqueado completamente en producción
    if (process.env.NODE_ENV !== 'production') {
      const devEmail = process.env.DEV_USER;
      const devPassword = process.env.DEV_PASSWORD;
      if (devEmail && devPassword && email === devEmail && password === devPassword) {
        const syntheticUser = { id: 0, role: 'admin', email: devEmail, first_name: 'Dev', last_name: 'Admin' };
        const accessToken = auth.generateToken(syntheticUser);
        res.cookie('auth_token', accessToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000
        });
        return res.json({
          message: 'Login exitoso',
          token: accessToken,
          user: { id: syntheticUser.id, first_name: syntheticUser.first_name, last_name: syntheticUser.last_name, role: syntheticUser.role, devUser: true }
        });
      }
    }

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
      await db.query('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?', [user.id]);

      // Cookies - usar 'lax' para permitir navegación normal
      const isProd = process.env.NODE_ENV === 'production';
      
      res.cookie('auth_token', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax', // Cambiado de 'strict' a 'lax' para mejor compatibilidad
        maxAge: 15 * 60 * 1000 // 15 min
      });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax', // Cambiado de 'strict' a 'lax' para mejor compatibilidad
        path: '/api/auth/refresh', // Solo se envia a este endpoint
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
      });

      // Devolver token también en JSON para clientes que usen localStorage.
      // Los clientes nativos (app móvil) no pueden usar cookies HttpOnly:
      // si lo solicitan con `client: 'mobile'`, reciben el refresh token en JSON
      // y lo guardan en el llavero seguro del dispositivo.
      const payload = {
        message: 'Login exitoso',
        token: accessToken,
        user: { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role }
      };
      if (req.body.client === 'mobile') payload.refresh_token = refreshToken;
      res.json(payload);

    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Error de servidor' });
    }
});

// Refresh Token
authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  // Web envía el token por cookie HttpOnly; la app móvil lo envía en el body.
  const bodyToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : null;
  const refreshToken = req.cookies['refresh_token'] || bodyToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    // Hashear token antes de buscar en BD
    const hashedToken = auth.hashRefreshToken(refreshToken);
    
    // Buscar token hasheado en DB
    const result = await db.query(
      "SELECT rt.*, u.role, u.email, u.name FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token_hash = ? AND rt.revoked = 0 AND rt.expires_at > datetime('now')",
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

    await db.query('UPDATE refresh_tokens SET revoked = 1, replaced_by_token = ? WHERE id = ?', [newRefreshTokenHash, tokenRecord.id]);
    await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, newRefreshTokenHash, newExpires]);

    const newAccessToken = auth.generateToken(user);

    // Set Cookies - usar 'lax' para mejor compatibilidad
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', newAccessToken, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', newRefreshToken, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

    // Devolver también el token en JSON para actualizar localStorage.
    // Si el refresh llegó por body (móvil), el cliente necesita el token rotado
    // en JSON: el anterior queda revocado y no recibe la cookie.
    const payload = {
      message: 'Token refrescado',
      token: newAccessToken,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role }
    };
    if (bodyToken && !req.cookies['refresh_token']) payload.refresh_token = newRefreshToken;
    res.json(payload);

  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Error al refrescar token' });
  }
});

// Logout
authRouter.post('/logout', async (req, res) => {
  // Web envía el token por cookie; la app móvil lo envía en el body.
  const refreshToken = req.cookies['refresh_token'] ||
    (typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : null);
  if (refreshToken) {
    // Revocar en DB (hasheado)
    const hashedToken = auth.hashRefreshToken(refreshToken);
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', [hashedToken]);
  }
  
  res.clearCookie('auth_token');
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  res.json({ message: 'Logout exitoso' });
});

// Google OAuth — verificación de ID token (Google Identity Services)
authRouter.post('/google', loginLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Token de Google requerido' });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google auth no configurado' });
  }

  try {
    const googleClient = await getGoogleClient();
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, given_name, family_name, sub: googleId } = payload;

    // Buscar usuario existente por google_id o email
    let result = await db.query(
      'SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1',
      [googleId, email]
    );
    let user = result.rows[0];

    if (!user) {
      // Crear usuario nuevo (verificado, sin contraseña)
      const insert = await db.query(
        `INSERT INTO users (email, first_name, last_name, role, is_verified, google_id)
         VALUES (?, ?, ?, 'client', 1, ?) RETURNING *`,
        [email, given_name || '', family_name || '', googleId]
      );
      user = insert.rows[0];
    } else if (!user.google_id) {
      // Cuenta existente por email — vincular google_id
      await db.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
    }

    // Emitir tokens igual que el login normal
    const accessToken = auth.generateToken(user);
    const refreshToken = auth.generateRefreshToken();
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const hashedRefreshToken = auth.hashRefreshToken(refreshToken);

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashedRefreshToken, refreshExpires]
    );
    await db.query("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', accessToken, {
      httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true, secure: isProd, sameSite: 'lax',
      path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login con Google exitoso',
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role },
    });
  } catch (err) {
    logger.error({ err }, '[POST /api/auth/google] Error:');
    res.status(401).json({ error: 'Token de Google inválido' });
  }
});

// Check auth status
authRouter.get('/me', auth.authenticateToken, async (req, res) => {
  // Usuario dev sintético (id=0) — no existe en BD
  if (req.user.id === 0) {
    return res.json({
      id: 0,
      first_name: 'Dev',
      last_name: 'Admin',
      email: process.env.DEV_USER || 'dev@dobleyo.cafe',
      role: 'admin',
      caficultor_status: null
    });
  }

  try {
    const result = await db.query(
      'SELECT id, first_name, last_name, name, email, role, caficultor_status, mobile_phone, landline_phone, tax_id, city, state_province, country, address, last_login_at, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, '[/api/auth/me] Error:');
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
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
        "SELECT id FROM caficultor_applications WHERE user_id = ? AND status = 'pending'",
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
        "UPDATE users SET caficultor_status = 'pending' WHERE id = ?",
        [userId]
      );

      const appId = result.lastInsertRowid;

      // Log de auditoria
      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, 'REQUEST_CAFICULTOR', 'caficultor_applications', String(appId), JSON.stringify({ farm_name })]
      );

      res.status(201).json({
        message: 'Solicitud enviada. El administrador revisará tu perfil pronto.',
        application_id: appId
      });

    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Error al enviar solicitud' });
    }
  }
);

// Update profile
authRouter.put('/profile',
  auth.authenticateToken,
  [
    body('first_name').trim().notEmpty().withMessage('Nombre requerido'),
    body('last_name').trim().notEmpty().withMessage('Apellido requerido'),
    body('mobile_phone').optional({ checkFalsy: true }).trim(),
    body('landline_phone').optional({ checkFalsy: true }).trim(),
    body('tax_id').optional({ checkFalsy: true }).trim(),
    body('city').optional({ checkFalsy: true }).trim(),
    body('state_province').optional({ checkFalsy: true }).trim(),
    body('country').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    if (req.user.id === 0) return res.status(403).json({ success: false, error: 'Usuario de desarrollo no editable' });

    const { first_name, last_name, mobile_phone, landline_phone, tax_id, city, state_province, country, address } = req.body;
    const fullName = `${first_name} ${last_name}`.trim();

    try {
      await db.query(
        `UPDATE users SET first_name=?, last_name=?, name=?, mobile_phone=?, landline_phone=?, tax_id=?, city=?, state_province=?, country=?, address=?, updated_at=datetime('now') WHERE id=?`,
        [first_name, last_name, fullName, mobile_phone || null, landline_phone || null, tax_id || null, city || null, state_province || null, country || 'Colombia', address || null, req.user.id]
      );

      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'UPDATE_PROFILE', 'users', String(req.user.id), JSON.stringify({ first_name, last_name })]
      );

      res.json({ success: true, message: 'Perfil actualizado' });
    } catch (err) {
      logger.error({ err }, '[PUT /api/auth/profile] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// Change password
authRouter.put('/password',
  auth.authenticateToken,
  [
    body('current_password').notEmpty().withMessage('Contraseña actual requerida'),
    body('new_password').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    if (req.user.id === 0) return res.status(403).json({ success: false, error: 'Usuario de desarrollo no editable' });

    const { current_password, new_password } = req.body;

    try {
      const result = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

      const { password_hash } = result.rows[0];
      if (!password_hash) return res.status(400).json({ success: false, error: 'Esta cuenta usa Google Sign-In y no tiene contraseña' });

      const valid = await auth.comparePassword(current_password, password_hash);
      if (!valid) return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });

      const newHash = await auth.hashPassword(new_password);
      await db.query(`UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`, [newHash, req.user.id]);

      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'CHANGE_PASSWORD', 'users', String(req.user.id), '{}']
      );

      res.json({ success: true, message: 'Contraseña actualizada' });
    } catch (err) {
      logger.error({ err }, '[PUT /api/auth/password] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
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
      logger.error(err);
      res.status(500).json({ error: 'Error al obtener estado' });
    }
  }
);
