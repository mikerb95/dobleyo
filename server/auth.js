import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Verificar que los secretos JWT estén configurados
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in .env or Vercel.');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required. Set it in .env or Vercel.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' }); // Access token corto
};

// Token de verificación de email: lleva un 'type' específico para que NO pueda
// usarse como token de sesión (ver authenticateToken). Vida más larga (24h) porque
// depende de que la persona abra el correo. No incluye 'role' a propósito.
export const generateVerificationToken = (user) => {
  return jwt.sign({ id: user.id, type: 'verification' }, JWT_SECRET, { expiresIn: '24h' });
};

export const generateRefreshToken = () => {
  // Opaque token (random string) es mas seguro para refresh tokens que JWT si se guarda en DB
  return crypto.randomBytes(40).toString('hex');
};

// Hashear refresh token antes de guardar en BD (SHA-256)
export const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Middleware para validar JWT en cookies (HttpOnly) o Authorization header
export const authenticateToken = (req, res, next) => {
  // Primero intentar cookie, luego Authorization header
  let token = req.cookies['auth_token'];
  
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) return res.status(401).json({ error: 'Acceso denegado' });

  try {
    const verified = verifyToken(token);
    // Un token con 'type' (p.ej. verificación de email) NO es un token de sesión:
    // rechazarlo evita que un enlace de verificación sirva para autenticarse.
    if (verified.type) {
      return res.status(401).json({ error: 'Token invalido' });
    }
    req.user = verified;
    next();
  } catch (err) {
    // 401 = no autenticado (token vencido/inválido) → el cliente debe refrescar.
    // 403 queda reservado para permisos insuficientes (requireRole).
    res.status(401).json({ error: 'Token invalido' });
  }
};

// Middleware de autenticación opcional: adjunta req.user si hay un token de
// sesión válido, pero NO bloquea si no hay sesión. Pensado para flujos que
// funcionan tanto con usuario registrado como con invitado (p.ej. checkout).
export const optionalAuth = (req, res, next) => {
  let token = req.cookies['auth_token'];

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return next();

  try {
    const verified = verifyToken(token);
    // Ignorar tokens que no son de sesión (p.ej. verificación de email).
    if (!verified.type) req.user = verified;
  } catch {
    // Token vencido/inválido → continuar como invitado, sin error.
  }
  next();
};

// Middleware para roles (soporta string unico o array de roles)
export const requireRole = (roles) => {
  return (req, res, next) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (req.user && allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Permisos insuficientes' });
    }
  };
};

// Convenience aliases
export const requireAuth = authenticateToken;
export const requireAdmin = requireRole('admin');
