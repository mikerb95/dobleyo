// Tests de integración para server/routes/auth.js
// Usa supertest para enviar requests HTTP al router Express

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── vi.hoisted() — necesario en ESM para que las fn de mock sean compartidas
// entre el factory de vi.mock y los tests que llaman a .mockResolvedValueOnce()
const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    comparePassword: vi.fn(),
}));

vi.mock('../../db.js', () => ({ query: mocks.query }));

vi.mock('../../auth.js', () => ({
    hashPassword: vi.fn().mockResolvedValue('$hashed$'),
    comparePassword: mocks.comparePassword,
    generateToken: vi.fn().mockReturnValue('mock.access.token'),
    generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
    hashRefreshToken: vi.fn().mockReturnValue('mock-refresh-hash'),
    verifyToken: vi.fn(),
    authenticateToken: (req, _res, next) => { req.user = null; next(); },
    requireRole: () => (_req, _res, next) => next(),
}));

// Rate limiters → passthrough en tests
vi.mock('../../middleware/rateLimit.js', () => ({
    loginLimiter: (_req, _res, next) => next(),
    registerLimiter: (_req, _res, next) => next(),
    refreshLimiter: (_req, _res, next) => next(),
    apiLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../services/email.js', () => ({
    sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendOrderConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Importar router DESPUÉS de configurar mocks ───────────────────────────────
import { authRouter } from '../auth.js';

const { query } = mocks;

// App Express mínima para tests
function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    return app;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
    });

    it('debería retornar 400 si el email es inválido', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'no-es-email', password: 'pass123', first_name: 'Juan', last_name: 'Pérez' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    it('debería retornar 400 si la contraseña tiene menos de 6 caracteres', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'juan@test.com', password: '123', first_name: 'Juan', last_name: 'Pérez' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    it('debería retornar 400 si el email ya está registrado', async () => {
        // Primera query: SELECT para verificar si existe → retorna usuario existente
        query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'existente@test.com' }] });
        // Segunda query: INSERT audit_log (no debería llegarse, pero por si acaso)
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'existente@test.com', password: 'pass123', first_name: 'Juan', last_name: 'Pérez' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/registrado/i);
    });

    it('debería retornar 201 con datos del usuario al registrarse correctamente', async () => {
        // Query 1: verificar email → no existe
        query.mockResolvedValueOnce({ rows: [] });
        // Query 2: INSERT usuario → retorna id
        query.mockResolvedValueOnce({ rows: [{ id: 99, email: 'nuevo@test.com' }] });
        // Query 3: INSERT audit_log
        query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'nuevo@test.com', password: 'secreta123', first_name: 'Ana', last_name: 'López' });

        expect(res.status).toBe(201);
        expect(res.body.message).toMatch(/registrado/i);
    });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    // Por defecto comparePassword falla — sobreescribir en el test de éxito
    mocks.comparePassword.mockResolvedValue(false);
  });

  it('debería retornar 400 si el email es inválido', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-email', password: 'pass123' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('debería retornar 401 si el usuario no existe', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'pass123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciales/i);
  });

  it('debería retornar 401 si la contraseña es incorrecta', async () => {
    // comparePassword ya devuelve false por defecto
    query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'user@test.com', password_hash: '$hashed$', role: 'client', first_name: 'A', last_name: 'B' }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciales/i);
  });

  it('debería retornar 200 con token y cookies en login correcto', async () => {
    const mockUser = {
      id: 5, email: 'user@test.com', password_hash: '$hashed$',
      role: 'admin', first_name: 'Carlos', last_name: 'Ruiz',
    };

    mocks.comparePassword.mockResolvedValue(true); // sobreescribir default
    // Vaciar cola y cargar mocks frescos con mockReset para este test
    mocks.query.mockReset();
    mocks.query.mockResolvedValueOnce({ rows: [mockUser] });  // SELECT user
    mocks.query.mockResolvedValueOnce({ rows: [] });           // INSERT refresh_tokens
    mocks.query.mockResolvedValueOnce({ rows: [] });           // UPDATE last_login

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('mock.access.token');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.id).toBe(5);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
