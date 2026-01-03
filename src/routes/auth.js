import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as db from '../db.js';
import * as auth from '../auth.js';

export const authRouter = Router();

// Login
authRouter.post('/login', 
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });

      const validPass = await auth.comparePassword(password, user.password_hash);
      if (!validPass) return res.status(401).json({ error: 'Credenciales invalidas' });

      const token = auth.generateToken(user);

      // Cookie segura HttpOnly
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS en prod
        sameSite: 'strict', // Proteccion CSRF basica
        maxAge: 8 * 60 * 60 * 1000 // 8 horas
      });

      res.json({ message: 'Login exitoso', user: { id: user.id, name: user.name, role: user.role } });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error de servidor' });
    }
});

// Logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logout exitoso' });
});

// Check auth status
authRouter.get('/me', auth.authenticateToken, async (req, res) => {
    const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
});
