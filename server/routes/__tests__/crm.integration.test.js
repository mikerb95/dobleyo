// Prueba de integración de la creación de cuentas B2B del CRM.
//
// Como en costs.integration.test.js, no se mockea la base de datos: la cuenta
// se crea por HTTP contra un SQLite real y se verifica contra la vista
// crm_account_overview, que es lo que consume el panel. Se mockea solo la
// autenticación, porque el JWT ya se prueba en auth.test.js.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// El cliente libSQL se crea al importar db.js: la URL debe fijarse antes.
const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-crm-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

const session = { user: { id: 1, role: 'admin' } };

vi.mock('../../auth.js', () => ({
    authenticateToken: (req, _res, next) => { req.user = session.user; next(); },
    requireRole: (roles) => (req, res, next) => {
        const allowed = Array.isArray(roles) ? roles : [roles];
        if (allowed.includes(req.user?.role)) return next();
        res.status(403).json({ error: 'Permisos insuficientes' });
    },
}));

let query, app;

beforeAll(async () => {
    ({ query } = await import('../../db.js'));

    await query(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT)`);
    await query(`INSERT OR IGNORE INTO users (id, name, email, role)
                 VALUES (1, 'Admin DobleYo', 'admin@dobleyo.cafe', 'admin')`);
    await query(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT,
        entity_type TEXT, entity_id TEXT, details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    // La vista del CRM lee de sales_tracking para el LTV.
    await query(`CREATE TABLE IF NOT EXISTS sales_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ml_order_id TEXT, purchase_date TEXT,
        total_amount REAL, order_status TEXT, recipient_city TEXT,
        recipient_state TEXT, products TEXT)`);

    const { createCrmTables } = await import('../../migrations/create_crm_tables.js');
    await createCrmTables();

    const { crmRouter } = await import('../crm.js');
    app = express();
    app.use(express.json());
    app.use('/api/crm', crmRouter);
});

const base = {
    legal_name: 'Tostadores del Norte S.A.S.',
    display_name: 'Tostadores del Norte',
    segment: 'distributor_co',
};

describe('POST /api/crm/accounts', () => {
    it('crea la cuenta y la devuelve desde crm_account_overview', async () => {
        const res = await request(app).post('/api/crm/accounts').send({
            ...base,
            country: 'CO',
            city: 'Medellín',
            region: 'Antioquia',
            tax_id: '900123456-7',
            pipeline_stage: 'contacted',
            pipeline_value: 250_000_00,
            source: 'Feria del café',
            notes: 'Pidió muestra de Huila lavado.',
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            display_name: 'Tostadores del Norte',
            segment: 'distributor_co',
            pipeline_stage: 'contacted',
            pipeline_value: 25_000_000,
            city: 'Medellín',
        });
        // La vista debe traer sus agregados aunque la cuenta esté recién creada.
        expect(res.body.data.interactions_count).toBe(0);
        expect(res.body.data.lifetime_value_cents).toBe(0);
        expect(res.body.data.owner_user_id).toBe(1);
    });

    it('aparece en el listado que recarga el panel tras crear', async () => {
        const created = await request(app).post('/api/crm/accounts')
            .send({ ...base, display_name: 'Café del Puerto' });

        const list = await request(app).get('/api/crm/accounts');
        expect(list.status).toBe(200);
        const ids = list.body.data.items.map((a) => a.id);
        expect(ids).toContain(created.body.data.id);
    });

    it('guarda el contacto principal cuando viene en el payload', async () => {
        const res = await request(app).post('/api/crm/accounts').send({
            ...base,
            display_name: 'Hotel Monserrate',
            segment: 'hotel',
            contact: {
                full_name: 'Ana Gómez', role: 'Jefe de compras',
                email: 'ana@monserrate.co', phone: '3001234567',
            },
        });

        expect(res.status).toBe(200);
        expect(res.body.data.primary_contact_name).toBe('Ana Gómez');
        expect(res.body.data.primary_contact_email).toBe('ana@monserrate.co');
    });

    it('normaliza espacios y usa la razón social si no hay nombre comercial', async () => {
        const res = await request(app).post('/api/crm/accounts').send({
            legal_name: '  Comercializadora Andina Ltda.  ',
            display_name: '  Andina  ',
            segment: 'retail',
            country: 'co',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.legal_name).toBe('Comercializadora Andina Ltda.');
        expect(res.body.data.display_name).toBe('Andina');
        expect(res.body.data.country).toBe('CO');
    });

    it('registra la creación en la auditoría', async () => {
        const res = await request(app).post('/api/crm/accounts')
            .send({ ...base, display_name: 'Auditada' });

        const logs = await query(
            `SELECT * FROM audit_logs WHERE entity_type = 'crm_account' AND entity_id = ?`,
            [String(res.body.data.id)]
        );
        expect(logs.rows).toHaveLength(1);
        expect(logs.rows[0].action).toBe('create');
        expect(logs.rows[0].user_id).toBe(1);
    });

    describe('validación', () => {
        const cases = [
            ['razón social vacía',   { ...base, legal_name: '   ' },            'bad_payload'],
            ['segmento inválido',    { ...base, segment: 'mayorista' },         'bad_segment'],
            ['sin segmento',         { legal_name: 'X', display_name: 'X' },    'bad_segment'],
            ['país inválido',        { ...base, country: 'Colombia' },          'bad_country'],
            ['etapa inválida',       { ...base, pipeline_stage: 'ganado' },     'bad_stage'],
            ['valor negativo',       { ...base, pipeline_value: -100 },         'bad_payload'],
            ['valor no entero',      { ...base, pipeline_value: 12.5 },         'bad_payload'],
            ['correo inválido',      { ...base, contact: { full_name: 'A', email: 'ana@' } }, 'bad_email'],
            ['contacto sin nombre',  { ...base, contact: { email: 'ana@x.co' } },             'bad_payload'],
        ];

        it.each(cases)('rechaza %s', async (_label, payload, code) => {
            const res = await request(app).post('/api/crm/accounts').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe(code);
        });

        it('no deja cuentas huérfanas cuando el payload es inválido', async () => {
            const before = await query('SELECT COUNT(*) AS n FROM crm_accounts');
            await request(app).post('/api/crm/accounts').send({ ...base, segment: 'mayorista' });
            const after = await query('SELECT COUNT(*) AS n FROM crm_accounts');
            expect(after.rows[0].n).toBe(before.rows[0].n);
        });
    });

    it('rechaza a quien no es admin', async () => {
        session.user = { id: 2, role: 'caficultor' };
        const res = await request(app).post('/api/crm/accounts').send(base);
        session.user = { id: 1, role: 'admin' };
        expect(res.status).toBe(403);
    });
});
