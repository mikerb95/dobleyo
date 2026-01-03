import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_in_production';

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
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

// Middleware para roles
export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Permisos insuficientes' });
    }
  };
};
