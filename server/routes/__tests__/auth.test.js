// Tests de integración para server/routes/auth.js
// Usa supertest para enviar requests HTTP al router Express

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// ── vi.hoisted() — necesario en ESM para que las fn de mock sean compartidas
// entre el factory de vi.mock y los tests que llaman a .mockResolvedValueOnce()
const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    comparePassword: vi.fn(),
    sendVerificationEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendWelcomeEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve({ success: true })),
    sendPasswordChangedEmail: vi.fn(() => Promise.resolve({ success: true })),
    verifyIdToken: vi.fn(),
    sessionUser: { current: null },
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
    authenticateToken: (req, _res, next) => { req.user = mocks.sessionUser.current; next(); },
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

vi.mock('google-auth-library', () => ({
    OAuth2Client: class { verifyIdToken = mocks.verifyIdToken; },
}));

// ── Importar router DESPUÉS de configurar mocks ───────────────────────────────
import { authRouter } from '../auth.js';

const { query } = mocks;

// App Express mínima para tests
function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
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
        query.mockResolvedValueOnce({ rows: [{ n: 0 }] }); // fallos recientes
        query.mockResolvedValueOnce({ rows: [] });         // INSERT audit LOGIN_FAILED

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@test.com', password: 'wrongpass' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/credenciales/i);
        const audit = query.mock.calls.find(([sql, args]) => /INSERT INTO audit_logs/.test(sql) && args.includes('LOGIN_FAILED'));
        expect(audit).toBeDefined();
    });

    it('bloquea la cuenta tras demasiados fallos aunque la contraseña sea correcta', async () => {
        mocks.comparePassword.mockResolvedValue(true);
        query.mockResolvedValueOnce({
            rows: [{ id: 1, email: 'user@test.com', password_hash: '$hashed$', role: 'client', first_name: 'A', last_name: 'B' }],
        });
        query.mockResolvedValueOnce({ rows: [{ n: 10 }] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@test.com', password: 'pass1234' });

        expect(res.status).toBe(429);
        expect(res.body.code).toBe('ACCOUNT_LOCKED');
        expect(mocks.comparePassword).not.toHaveBeenCalled();
        expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('debería retornar 200 con token y cookies en login correcto', async () => {
        const mockUser = {
            id: 5, email: 'user@test.com', password_hash: '$hashed$',
            role: 'caficultor', first_name: 'Carlos', last_name: 'Ruiz',
        };

        mocks.comparePassword.mockResolvedValue(true); // sobreescribir default
        // Vaciar cola y cargar mocks frescos con mockReset para este test
        mocks.query.mockReset();
        mocks.query.mockResolvedValueOnce({ rows: [mockUser] });  // SELECT user
        mocks.query.mockResolvedValueOnce({ rows: [{ n: 0 }] });   // fallos recientes
        mocks.query.mockResolvedValueOnce({ rows: [] });           // INSERT refresh_tokens
        mocks.query.mockResolvedValueOnce({ rows: [] });           // UPDATE last_login

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@test.com', password: 'pass123' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBe('mock.access.token');
        expect(res.body.user.role).toBe('caficultor');
        expect(res.body.user.id).toBe(5);
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rechaza la contraseña correcta de un admin: debe entrar con GitHub', async () => {
        mocks.comparePassword.mockResolvedValue(true);
        mocks.query.mockReset();
        mocks.query.mockResolvedValueOnce({
            rows: [{ id: 5, email: 'admin@test.com', password_hash: '$hashed$', role: 'admin', is_verified: 1 }],
        });
        mocks.query.mockResolvedValueOnce({ rows: [{ n: 0 }] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@test.com', password: 'pass1234' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_GITHUB_ONLY');
        expect(res.headers['set-cookie']).toBeUndefined();
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
        mocks.query.mockResolvedValueOnce({ rows: [{ n: 0 }] });

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
        mocks.query.mockResolvedValue({ rows: [{ n: 0 }] });

        const res = await request(app).post('/api/auth/login').send({ email: base.email, password: 'mala1234' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBeUndefined();
    });
});

// ── Login con Google ─────────────────────────────────────────────────────────
describe('POST /api/auth/google', () => {
    let app;
    const googlePayload = (extra) => ({ getPayload: () => ({ sub: 'g-123', email: 'admin@dobleyo.cafe', given_name: 'A', family_name: 'B', ...extra }) });

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    });

    it('rechaza un correo de Google sin verificar y no vincula ninguna cuenta', async () => {
        mocks.verifyIdToken.mockResolvedValue(googlePayload({ email_verified: false }));

        const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

        expect(res.status).toBe(401);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('entra con correo verificado y vincula la cuenta existente', async () => {
        mocks.verifyIdToken.mockResolvedValue(googlePayload({ email_verified: true }));
        mocks.query.mockResolvedValueOnce({ rows: [{ id: 3, email: 'admin@dobleyo.cafe', role: 'client', google_id: null }] });
        mocks.query.mockResolvedValue({ rows: [] });

        const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

        expect(res.status).toBe(200);
        expect(mocks.query.mock.calls.some(([sql]) => /UPDATE users SET google_id/.test(sql))).toBe(true);
    });

    it('no deja entrar a un admin con Google', async () => {
        mocks.verifyIdToken.mockResolvedValue(googlePayload({ email_verified: true }));
        mocks.query.mockResolvedValueOnce({ rows: [{ id: 3, email: 'admin@dobleyo.cafe', role: 'admin', google_id: 'g-123' }] });

        const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_GITHUB_ONLY');
        expect(res.headers['set-cookie']).toBeUndefined();
    });
});

// ── GitHub OAuth (admins) ─────────────────────────────────────────────────────
describe('GitHub OAuth de administradores', () => {
    let app;
    const STATE = 'a'.repeat(48);
    const stateCookie = (redirect = '/admin/pedidos') =>
        `gh_oauth_state=${encodeURIComponent('j:' + JSON.stringify({ state: STATE, redirect }))}`;

    // Respuestas de GitHub: token, /user y /user/emails.
    const stubGithub = (ghUser, emails = [{ email: 'mike@dobleyo.cafe', primary: true, verified: true }]) => {
        const fetchMock = vi.fn(async (url) => {
            const body = url.includes('access_token') ? { access_token: 'gho_test' }
                : url.endsWith('/user/emails') ? emails
                : ghUser;
            return { ok: true, status: 200, json: async () => body };
        });
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    };

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
        mocks.query.mockResolvedValue({ rows: [] });
        process.env.GITHUB_CLIENT_ID = 'gh-client';
        process.env.GITHUB_CLIENT_SECRET = 'gh-secret';
    });

    afterEach(() => vi.unstubAllGlobals());

    it('inicia el flujo con state en cookie y redirige a GitHub', async () => {
        const res = await request(app).get('/api/auth/github?redirect=/admin/pedidos');

        expect(res.status).toBe(302);
        const location = new URL(res.headers.location);
        expect(location.origin).toBe('https://github.com');
        expect(location.searchParams.get('client_id')).toBe('gh-client');
        const cookie = res.headers['set-cookie'].find((c) => c.startsWith('gh_oauth_state='));
        expect(cookie).toMatch(/HttpOnly/);
        expect(decodeURIComponent(cookie)).toContain(location.searchParams.get('state'));
    });

    it('rechaza el regreso si el state no coincide', async () => {
        const fetchMock = stubGithub({ id: 69970540, login: 'mikerb95' });

        const res = await request(app)
            .get(`/api/auth/github/callback?code=abc&state=${'b'.repeat(48)}`)
            .set('Cookie', stateCookie());

        expect(res.headers.location).toBe('/admin/login?error=state');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta de GitHub fuera de la lista', async () => {
        stubGithub({ id: 1, login: 'mikerb95-falso' });

        const res = await request(app)
            .get(`/api/auth/github/callback?code=abc&state=${STATE}`)
            .set('Cookie', stateCookie());

        expect(res.headers.location).toBe('/admin/login?error=not_allowed');
        expect(res.headers['set-cookie'].some((c) => c.startsWith('auth_token='))).toBe(false);
        expect(mocks.query.mock.calls.some(([, args]) => args?.includes('LOGIN_GITHUB_DENIED'))).toBe(true);
    });

    it('vincula por correo una cuenta existente, la deja como admin y abre sesión', async () => {
        stubGithub({ id: 69970540, login: 'mikerb95', name: 'Mike Rodríguez' });
        mocks.query.mockResolvedValueOnce({ rows: [] }); // SELECT por github_id
        mocks.query.mockResolvedValueOnce({ rows: [{ id: 7, email: 'mike@dobleyo.cafe', role: 'client' }] }); // por correo

        const res = await request(app)
            .get(`/api/auth/github/callback?code=abc&state=${STATE}`)
            .set('Cookie', stateCookie());

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/pedidos');
        expect(res.headers['set-cookie'].some((c) => c.startsWith('auth_token='))).toBe(true);
        const sqls = mocks.query.mock.calls.map(([sql]) => sql);
        expect(sqls.some((sql) => /UPDATE users SET github_id/.test(sql))).toBe(true);
        expect(sqls.some((sql) => /SET role = 'admin'/.test(sql))).toBe(true);
    });

    it('crea la cuenta admin si no existe ninguna con ese correo', async () => {
        stubGithub({ id: 264250788, login: 'nicodmarquez', name: null }, [{ email: 'nico@test.com', primary: true, verified: true }]);
        mocks.query.mockResolvedValueOnce({ rows: [] }); // SELECT por github_id
        mocks.query.mockResolvedValueOnce({ rows: [] }); // SELECT por correo
        mocks.query.mockResolvedValueOnce({ rows: [{ id: 9, email: 'nico@test.com', role: 'admin' }] }); // INSERT

        const res = await request(app)
            .get(`/api/auth/github/callback?code=abc&state=${STATE}`)
            .set('Cookie', stateCookie('https://evil.example'));

        expect(res.headers.location).toBe('/admin');
        const insert = mocks.query.mock.calls.find(([sql]) => /INSERT INTO users/.test(sql));
        expect(insert[1]).toEqual(['nico@test.com', 'nicodmarquez', '', '264250788']);
    });

    it('no crea cuenta si GitHub no tiene correo verificado', async () => {
        stubGithub({ id: 69970540, login: 'mikerb95' }, [{ email: 'x@test.com', primary: true, verified: false }]);

        const res = await request(app)
            .get(`/api/auth/github/callback?code=abc&state=${STATE}`)
            .set('Cookie', stateCookie());

        expect(res.headers.location).toBe('/admin/login?error=no_email');
        expect(mocks.query.mock.calls.some(([sql]) => /INSERT INTO users/.test(sql))).toBe(false);
    });
});

// ── Cambio de contraseña ─────────────────────────────────────────────────────
describe('PUT /api/auth/password', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
        vi.clearAllMocks();
        mocks.query.mockReset();
        mocks.sessionUser.current = { id: 7, role: 'client' };
    });

    it('cierra las demás sesiones y deja una nueva para este dispositivo', async () => {
        mocks.comparePassword.mockResolvedValue(true);
        mocks.query.mockResolvedValueOnce({ rows: [{ email: 'u@test.com', first_name: 'U', password_hash: '$hashed$' }] });
        mocks.query.mockResolvedValue({ rows: [] });

        const res = await request(app).put('/api/auth/password').send({ current_password: 'vieja1234', new_password: 'nueva12345' });

        expect(res.status).toBe(200);
        const sqls = mocks.query.mock.calls.map(([sql]) => sql);
        const revoke = sqls.findIndex((sql) => /UPDATE refresh_tokens SET revoked = 1 WHERE user_id = \?/.test(sql));
        const insert = sqls.findIndex((sql) => /INSERT INTO refresh_tokens/.test(sql));
        expect(revoke).toBeGreaterThan(-1);
        expect(insert).toBeGreaterThan(revoke);
        expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=/);
        expect(mocks.sendPasswordChangedEmail).toHaveBeenCalledWith('u@test.com', 'U', { sessionsRevoked: true });
    });
});
