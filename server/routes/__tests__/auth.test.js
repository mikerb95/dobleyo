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
    sendVerificationEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendWelcomeEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendPasswordChangedEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('../../db.js', () => ({ query: mocks.query }));

vi.mock('../../auth.js', () => ({
    hashPassword: vi.fn().mockResolvedValue('$hashed$'),
    comparePassword: mocks.comparePassword,
    generateToken: vi.fn().mockReturnValue('mock.access.token'),
    generateVerificationToken: vi.fn().mockReturnValue('mock.verify.token'),
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
    accountEmailLimiter: (_req, _res, next) => next(),
    apiLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../services/email.js', () => ({
    sendVerificationEmail: mocks.sendVerificationEmail,
    sendWelcomeEmail: mocks.sendWelcomeEmail,
    sendPasswordResetEmail: mocks.sendPasswordResetEmail,
    sendPasswordChangedEmail: mocks.sendPasswordChangedEmail,
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

    it('debería retornar 400 si la contraseña tiene menos de 8 caracteres', async () => {
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
            .send({ email: 'existente@test.com', password: 'password123', first_name: 'Juan', last_name: 'Pérez' });

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
        expect(res.body.message).toMatch(/cuenta creada/i);
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

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
    });

    it('responde igual si el correo no existe (no revela cuentas) y no envía nada', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [] }); // SELECT user

        const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nadie@test.com' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('guarda solo el hash del token y envía el enlace con el token en claro', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ id: 7, email: 'ana@test.com', first_name: 'Ana' }] }); // SELECT
        mocks.query.mockResolvedValue({ rows: [] }); // invalidar previos, INSERT token, audit

        const res = await request(app).post('/api/auth/forgot-password').send({ email: 'Ana@Test.com' });

        expect(res.status).toBe(200);
        expect(mocks.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        const [to, name, token] = mocks.sendPasswordResetEmail.mock.calls[0];
        expect(to).toBe('ana@test.com');
        expect(name).toBe('Ana');

        const insert = mocks.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO password_reset_tokens'));
        expect(insert).toBeDefined();
        const storedHash = insert[1][1];
        expect(storedHash).not.toBe(token);
        expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('retorna 422 si el correo es inválido', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({ email: 'no-es-correo' });
        expect(res.status).toBe(422);
    });
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
describe('POST /api/auth/reset-password', () => {
    let app;
    const token = 'a'.repeat(43);

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
    });

    it('retorna 400 si el token no existe, venció o ya se usó', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [] }); // UPDATE ... RETURNING sin filas

        const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'nuevaClave123' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('actualiza la contraseña, revoca sesiones y avisa por correo', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ user_id: 7 }] });                                  // consumir token
        mocks.query.mockResolvedValueOnce({ rows: [{ email: 'ana@test.com', first_name: 'Ana' }] });  // UPDATE users
        mocks.query.mockResolvedValue({ rows: [] });                                                    // revocar + audit

        const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'nuevaClave123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?'))).toBe(true);
        expect(mocks.sendPasswordChangedEmail).toHaveBeenCalledWith('ana@test.com', 'Ana', { sessionsRevoked: true });
    });

    it('retorna 422 si la contraseña es muy corta', async () => {
        const res = await request(app).post('/api/auth/reset-password').send({ token, password: '123' });
        expect(res.status).toBe(422);
    });
});

// ── GET /api/auth/verify ──────────────────────────────────────────────────────
describe('GET /api/auth/verify', () => {
    let app;

    beforeEach(async () => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
        const authMod = await import('../../auth.js');
        authMod.verifyToken.mockReturnValue({ id: 9, type: 'verification' });
    });

    it('envía la bienvenida solo en la primera verificación', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ email: 'leo@test.com', first_name: 'Leo' }] });
        const first = await request(app).get('/api/auth/verify?token=x');
        expect(first.status).toBe(200);
        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);

        mocks.query.mockResolvedValueOnce({ rows: [] }); // ya estaba verificada
        const second = await request(app).get('/api/auth/verify?token=x');
        expect(second.status).toBe(200);
        expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    });
});

// ── Verificación obligatoria en login (cuentas nuevas) ───────────────────────
describe('POST /api/auth/login con correo sin verificar', () => {
    let app;
    const base = { id: 11, email: 'nuevo@test.com', password_hash: '$hashed$', role: 'client', first_name: 'Eva', last_name: 'Paz' };

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
        mocks.comparePassword.mockResolvedValue(true);
    });

    it('bloquea cuentas creadas desde la fecha de corte sin verificar', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ ...base, is_verified: 0, created_at: '2026-10-20 10:00:00' }] });

        const res = await request(app).post('/api/auth/login').send({ email: base.email, password: 'pass1234' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
        expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('deja entrar a cuentas anteriores a la fecha de corte aunque no estén verificadas', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ ...base, is_verified: 0, created_at: '2026-09-01 10:00:00' }] });
        mocks.query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/auth/login').send({ email: base.email, password: 'pass1234' });

        expect(res.status).toBe(200);
    });

    it('deja entrar a cuentas nuevas ya verificadas', async () => {
        mocks.query.mockResolvedValueOnce({ rows: [{ ...base, is_verified: 1, created_at: '2026-10-20 10:00:00' }] });
        mocks.query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/auth/login').send({ email: base.email, password: 'pass1234' });

        expect(res.status).toBe(200);
    });

    it('con contraseña incorrecta responde 401 sin revelar si falta verificar', async () => {
        mocks.comparePassword.mockResolvedValue(false);
        mocks.query.mockResolvedValueOnce({ rows: [{ ...base, is_verified: 0, created_at: '2026-10-20 10:00:00' }] });

        const res = await request(app).post('/api/auth/login').send({ email: base.email, password: 'mala1234' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBeUndefined();
    });
});
