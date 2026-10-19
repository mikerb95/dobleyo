import { Router } from 'express';
import { logger } from '../logger.js';
import { body, validationResult } from 'express-validator';
import * as db from '../db.js';
import * as auth from '../auth.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from '../services/email.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loginLimiter, registerLimiter, refreshLimiter, accountEmailLimiter } from '../middleware/rateLimit.js';
import { notifyCaficultorApplication } from '../services/alerts.js';

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
    const resp = await fetch('https://appleid.apple.com/auth/keys');
    appleJwksCache = await resp.json();
    appleJwksCacheTime = now;
  }
  return appleJwksCache.keys.find((k) => k.kid === kid) ?? null;
}

export const authRouter = Router();

// Las cuentas creadas desde esta fecha (UTC) deben confirmar el correo antes de
// iniciar sesión. Las anteriores entran sin verificar para no bloquear a clientes
// que se registraron cuando la verificación era opcional.
export const EMAIL_VERIFICATION_REQUIRED_SINCE = '2026-10-14 00:00:00';

// Hash bcrypt de una clave aleatoria: solo sirve para que el login de un correo
// inexistente cueste lo mismo que uno real.
const DUMMY_HASH = '$2a$10$1Ia2dbC8VShSLfTyMQ4lc.qP3YjDPZ0/Q./61lSRS4mMpWJWkcZFW';

// Fallos de contraseña permitidos por cuenta antes del bloqueo temporal.
const LOCKOUT_MAX_FAILS = 10;
const LOCKOUT_WINDOW_MIN = 15;

const mustVerifyEmail = (user) =>
  !user.is_verified && String(user.created_at ?? '') >= EMAIL_VERIFICATION_REQUIRED_SINCE;

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
      sendVerificationEmail(email, verifyToken, first_name).then((r) => {
        if (!r.success) logger.error({ err: r.error, email }, '[POST /api/auth/register] No se pudo enviar el correo de verificación');
      });
      
      // Log de auditoria
      await db.query('INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)',
        ['REGISTER', 'user', String(newUser.id), JSON.stringify({ email: newUser.email })]
      );

      res.status(201).json({ message: 'Cuenta creada. Le enviamos un correo para confirmarla; debe hacerlo antes de iniciar sesión.', user: newUser });

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

    // Solo la primera verificación dispara la bienvenida: el enlace puede abrirse
    // más de una vez (vista previa del cliente de correo, doble clic).
    const updated = await db.query(
      'UPDATE users SET is_verified = 1 WHERE id = ? AND is_verified = 0 RETURNING email, first_name',
      [decoded.id]
    );
    if (updated.rows.length) {
      const { email, first_name } = updated.rows[0];
      sendWelcomeEmail(email, first_name).catch((err) => logger.error({ err }, '[GET /api/auth/verify] Error enviando bienvenida'));
    }

    res.json({ message: 'Cuenta verificada exitosamente. Ya puedes iniciar sesion.' });
  } catch (err) {
    res.status(400).json({ error: 'Token invalido o expirado' });
  }
});

// ─── Correos de cuenta ──────────────────────────────────────────────────────
// Respuesta genérica en los tres endpoints públicos: nunca revelar si un correo
// está registrado (evita enumerar cuentas).

const RESET_TOKEN_TTL_MIN = 60;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Reenviar verificación
authRouter.post('/resend-verification',
  accountEmailLimiter,
  body('email').trim().isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    const generic = { success: true, message: 'Si el correo está registrado y aún no se ha verificado, le enviamos un nuevo enlace.' };
    try {
      const result = await db.query('SELECT id, email, first_name, is_verified FROM users WHERE lower(email) = lower(?)', [req.body.email]);
      const user = result.rows[0];
      if (user && !user.is_verified) {
        const verifyToken = auth.generateVerificationToken(user);
        sendVerificationEmail(user.email, verifyToken, user.first_name).then((r) => {
          if (!r.success) logger.error({ err: r.error }, '[POST /api/auth/resend-verification] Envío fallido');
        });
      }
      res.json(generic);
    } catch (err) {
      logger.error({ err }, '[POST /api/auth/resend-verification] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// Olvido de contraseña: genera un enlace de un solo uso válido por 1 hora
authRouter.post('/forgot-password',
  accountEmailLimiter,
  body('email').trim().isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    const generic = { success: true, message: 'Si el correo está registrado, le enviamos un enlace para restablecer la contraseña.' };
    try {
      const result = await db.query('SELECT id, email, first_name FROM users WHERE lower(email) = lower(?)', [req.body.email]);
      const user = result.rows[0];
      if (!user) return res.json(generic);

      // Un solo enlace vigente por usuario: los anteriores dejan de servir.
      await db.query(
        `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`,
        [user.id]
      );

      const token = crypto.randomBytes(32).toString('base64url');
      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, request_ip)
         VALUES (?, ?, datetime('now', ?), ?)`,
        [user.id, hashResetToken(token), `+${RESET_TOKEN_TTL_MIN} minutes`, req.ip ?? null]
      );

      sendPasswordResetEmail(user.email, user.first_name, token).then((r) => {
        if (!r.success) logger.error({ err: r.error, userId: user.id }, '[POST /api/auth/forgot-password] Envío fallido');
      });

      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [user.id, 'REQUEST_PASSWORD_RESET', 'users', String(user.id), JSON.stringify({ ip: req.ip ?? null })]
      );

      res.json(generic);
    } catch (err) {
      logger.error({ err }, '[POST /api/auth/forgot-password] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

// Restablecer contraseña con el token del correo
authRouter.post('/reset-password',
  accountEmailLimiter,
  body('token').isString().isLength({ min: 20, max: 200 }).withMessage('Enlace inválido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    const { token, password } = req.body;
    const invalid = { success: false, error: 'El enlace no es válido o ya venció. Solicite uno nuevo.' };

    try {
      // Marcar el token como usado en la misma sentencia que lo valida: dos envíos
      // simultáneos del formulario no pueden consumirlo dos veces.
      const consumed = await db.query(
        `UPDATE password_reset_tokens SET used_at = datetime('now')
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
         RETURNING user_id`,
        [hashResetToken(token)]
      );
      if (!consumed.rows.length) return res.status(400).json(invalid);

      const userId = consumed.rows[0].user_id;
      const hash = await auth.hashPassword(password);

      // Abrir el enlace prueba que el correo es suyo: también queda verificado.
      const updated = await db.query(
        `UPDATE users SET password_hash = ?, is_verified = 1, updated_at = datetime('now') WHERE id = ? RETURNING email, first_name`,
        [hash, userId]
      );
      if (!updated.rows.length) return res.status(400).json(invalid);

      // Cerrar todas las sesiones: si alguien más tenía acceso, lo pierde.
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0', [userId]);

      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [userId, 'RESET_PASSWORD', 'users', String(userId), JSON.stringify({ ip: req.ip ?? null })]
      );

      const { email, first_name } = updated.rows[0];
      sendPasswordChangedEmail(email, first_name, { sessionsRevoked: true })
        .catch((err) => logger.error({ err }, '[POST /api/auth/reset-password] Error enviando aviso'));

      res.json({ success: true, message: 'Contraseña actualizada. Ya puede iniciar sesión.' });
    } catch (err) {
      logger.error({ err }, '[POST /api/auth/reset-password] Error:');
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
);

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

      // Bloqueo por cuenta: el rate limit por IP vive en memoria de cada instancia
      // serverless y un atacante puede repartir intentos entre IPs. Contar en la
      // BD los fallos recientes del usuario sí aplica en todas las instancias.
      if (user) {
        const recent = await db.query(
          `SELECT COUNT(*) AS n FROM audit_logs
           WHERE user_id = ? AND action = 'LOGIN_FAILED' AND created_at > datetime('now', ?)`,
          [user.id, `-${LOCKOUT_WINDOW_MIN} minutes`]
        );
        if (Number(recent.rows[0]?.n) >= LOCKOUT_MAX_FAILS) {
          logger.warn({ userId: user.id, ip: req.ip }, '[POST /api/auth/login] Cuenta bloqueada temporalmente');
          return res.status(429).json({
            error: `Demasiados intentos fallidos. Por seguridad, intente de nuevo en ${LOCKOUT_WINDOW_MIN} minutos o restablezca su contraseña.`,
            code: 'ACCOUNT_LOCKED',
          });
        }
      }

      // Sin usuario (o cuenta solo-Google) se compara igual contra un hash de
      // relleno: la respuesta tarda lo mismo y no delata qué correos existen.
      const validPass = await auth.comparePassword(password, user?.password_hash || DUMMY_HASH);
      if (!user || !user.password_hash || !validPass) {
        logger.warn({ email, ip: req.ip, userId: user?.id ?? null }, '[POST /api/auth/login] Intento fallido');
        await db.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
          [user?.id ?? null, 'LOGIN_FAILED', 'users', user ? String(user.id) : null, JSON.stringify({ email, ip: req.ip ?? null })]
        ).catch((err) => logger.error({ err }, '[POST /api/auth/login] No se pudo auditar el intento fallido'));
        return res.status(401).json({ error: 'Credenciales invalidas' });
      }

      // Se revisa después de la contraseña para no revelar el estado de cuentas ajenas.
      if (mustVerifyEmail(user)) {
        return res.status(403).json({
          error: 'Debe confirmar su correo antes de iniciar sesión. Revise su bandeja de entrada o solicite un nuevo enlace.',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }

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
      // Un token ya rotado que vuelve a llegar indica que alguien más lo tiene:
      // se cierran todas las sesiones del usuario. Se tolera el minuto siguiente
      // a la rotación porque dos pestañas pueden refrescar a la vez.
      const reused = await db.query(
        `SELECT rt.user_id FROM refresh_tokens rt
         JOIN refresh_tokens nxt ON nxt.token_hash = rt.replaced_by_token
         WHERE rt.token_hash = ? AND rt.revoked = 1 AND nxt.created_at < datetime('now', '-60 seconds')`,
        [hashedToken]
      );
      if (reused.rows.length) {
        const userId = reused.rows[0].user_id;
        await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0', [userId]);
        await db.query(
          'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
          [userId, 'REFRESH_TOKEN_REUSE', 'users', String(userId), JSON.stringify({ ip: req.ip ?? null })]
        );
        logger.warn({ userId, ip: req.ip }, '[POST /api/auth/refresh] Reuso de refresh token: sesiones revocadas');
      }
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
    const { email, given_name, family_name, sub: googleId, email_verified } = payload;

    // Sin correo verificado por Google no se crea ni se vincula nada: de lo
    // contrario, una cuenta de Google con un correo ajeno sin verificar entraría
    // como el dueño de ese correo (incluido un admin).
    if (!email || email_verified !== true) {
      return res.status(401).json({ error: 'Su cuenta de Google no tiene el correo verificado' });
    }

    // Buscar usuario existente por google_id o email
    let result = await db.query(
      'SELECT * FROM users WHERE google_id = ? OR lower(email) = lower(?) ORDER BY (google_id = ?) DESC LIMIT 1',
      [googleId, email, googleId]
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

// Apple Sign-In — verificación de id_token con JWKS de Apple
authRouter.post('/apple', loginLimiter, async (req, res) => {
  const { id_token, first_name, last_name } = req.body;
  if (!id_token) return res.status(400).json({ error: 'Token de Apple requerido' });

  if (!process.env.APPLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Apple auth no configurado' });
  }

  try {
    // Leer kid del header del JWT sin verificar aún
    const [headerB64] = id_token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

    const jwk = await getApplePublicKey(header.kid);
    if (!jwk) {
      return res.status(401).json({ error: 'Clave pública de Apple no encontrada' });
    }

    // Convertir JWK → PEM con el módulo crypto nativo de Node ≥18
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const pem = publicKey.export({ type: 'spki', format: 'pem' });

    const payload = jwt.verify(id_token, pem, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID,
    });

    const { sub: appleId, email } = payload;
    // Apple manda email_verified como booleano o como el texto "true".
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

    // Solo se vincula por correo si Apple lo da por verificado; si no, se busca
    // únicamente por apple_id (mismo motivo que en /google).
    let result = emailVerified && email
      ? await db.query(
        'SELECT * FROM users WHERE apple_id = ? OR lower(email) = lower(?) ORDER BY (apple_id = ?) DESC LIMIT 1',
        [appleId, email, appleId]
      )
      : await db.query('SELECT * FROM users WHERE apple_id = ? LIMIT 1', [appleId]);
    let user = result.rows[0];

    if (!user) {
      // Primera vez: crear usuario (Apple solo envía nombre en la primera autorización)
      const insert = await db.query(
        `INSERT INTO users (email, first_name, last_name, role, is_verified, apple_id)
         VALUES (?, ?, ?, 'client', 1, ?) RETURNING *`,
        [emailVerified ? email : null, first_name || 'Usuario', last_name || '', appleId]
      );
      user = insert.rows[0];
    } else if (!user.apple_id) {
      // Cuenta existente por email — vincular apple_id
      await db.query('UPDATE users SET apple_id = ? WHERE id = ?', [appleId, user.id]);
    }

    // Emitir tokens igual que en el login normal
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
      message: 'Login con Apple exitoso',
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role },
    });
  } catch (err) {
    logger.error({ err }, '[POST /api/auth/apple] Error:');
    res.status(401).json({ error: 'Token de Apple inválido' });
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
      'SELECT id, first_name, last_name, name, email, role, caficultor_status, mobile_phone, landline_phone, tax_id, city, state_province, country, address, last_login_at, created_at, is_verified, password_hash, google_id, apple_id FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No exponer hashes ni IDs externos: solo flags de métodos de acceso.
    const { password_hash, google_id, apple_id, ...user } = result.rows[0];
    user.has_password = !!password_hash;
    user.has_google = !!google_id;
    user.has_apple = !!apple_id;

    res.json(user);
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

      notifyCaficultorApplication({ farmName: farm_name, region, userName: req.user.name || req.user.email });

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
      const result = await db.query('SELECT email, first_name, password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

      const { email, first_name, password_hash } = result.rows[0];
      if (!password_hash) return res.status(400).json({ success: false, error: 'Esta cuenta usa Google Sign-In y no tiene contraseña' });

      const valid = await auth.comparePassword(current_password, password_hash);
      if (!valid) return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });

      const newHash = await auth.hashPassword(new_password);
      await db.query(`UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`, [newHash, req.user.id]);

      // Cerrar las demás sesiones y abrir una nueva para este dispositivo: si
      // alguien más tenía acceso, lo pierde sin sacar a quien cambió la clave.
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0', [req.user.id]);
      const refreshToken = auth.generateRefreshToken();
      await db.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [req.user.id, auth.hashRefreshToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true, secure: isProd, sameSite: 'lax',
        path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      await db.query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'CHANGE_PASSWORD', 'users', String(req.user.id), '{}']
      );

      sendPasswordChangedEmail(email, first_name, { sessionsRevoked: true })
        .catch((err) => logger.error({ err }, '[PUT /api/auth/password] Error enviando aviso'));

      const payload = { success: true, message: 'Contraseña actualizada. Se cerraron las sesiones en otros dispositivos.' };
      if (req.body.client === 'mobile') payload.refresh_token = refreshToken;
      res.json(payload);
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
