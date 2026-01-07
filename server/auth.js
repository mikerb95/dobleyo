import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey_change_in_production';

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

// Middleware para validar JWT en cookies (HttpOnly)
export const authenticateToken = (req, res, next) => {
  const token = req.cookies['auth_token'];
  
  if (!token) return res.status(401).json({ error: 'Acceso denegado' });

  try {
    const verified = verifyToken(token);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token invalido' });
  }
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
