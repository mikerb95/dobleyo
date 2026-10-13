// Prueba de integración del registro de auditoría paginado y filtrado.
//
// Como en crm.integration.test.js, se usa un SQLite real y solo se mockea la
// autenticación. Lo que importa aquí es que el filtrado ocurra en el servidor
// y que el conteo total respete los mismos filtros que el listado.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-audit-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';

vi.mock('../../auth.js', () => ({
    authenticateToken: (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
    requireRole: () => (_req, _res, next) => next(),
}));

let app;

beforeAll(async () => {
    const { query } = await import('../../db.js');

    await query(`CREATE TABLE users (
        id INTEGER PRIMARY KEY, email TEXT, first_name TEXT, last_name TEXT, name TEXT, role TEXT)`);
    await query(`INSERT INTO users (id, email, first_name, last_name, role) VALUES
        (1, 'laura@dobleyo.cafe', 'Laura', 'Gómez', 'admin'),
        (2, 'andres@dobleyo.cafe', 'Andrés', 'Pérez', 'caficultor')`);
    await query(`CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT,
        entity_type TEXT, entity_id TEXT, details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    const rows = [
        [1, 'update', 'shipments', 'ENV-0882', '{"status":{"before":"en_transito","after":"entregado"}}', "datetime('now', '-1 hours')"],
        [null, 'reconcile', 'shipments', 'interrapidisimo', '{"updated":12}', "datetime('now', '-2 hours')"],
        [1, 'create', 'product', 'CAC-POL-250', '{"name":"Cacao 100%"}', "datetime('now', '-3 hours')"],
        [2, 'update', 'coffee_harvest', 'C-0311', '{"weight_kg":{"before":182,"after":186}}', "datetime('now', '-2 days')"],
        [1, 'delete', 'user', 'USR-0193', '{}', "datetime('now', '-20 days')"],
    ];
    for (const [userId, action, type, id, details, at] of rows) {
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
             VALUES (?, ?, ?, ?, ?, ${at})`,
            [userId, action, type, id, details]
        );
    }

    const { default: auditRouter } = await import('../audit.js');
    app = express();
    app.use('/api/audit', auditRouter);
});

describe('GET /api/audit/logs', () => {
    it('devuelve el total y el desglose del conjunto completo', async () => {
        const res = await request(app).get('/api/audit/logs');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.total).toBe(5);
        expect(res.body.summary).toEqual({ total: 5, creates: 1, updates: 2, deletes: 1, system: 1 });
        expect(res.body.logs[0].entity_id).toBe('ENV-0882');
        expect(res.body.logs[0].user_role).toBe('admin');
    });

    it('filtra por ventana de días y el total acompaña al filtro', async () => {
        const res = await request(app).get('/api/audit/logs?days=7');
        expect(res.body.total).toBe(4);
        expect(res.body.logs.map((l) => l.entity_id)).not.toContain('USR-0193');
    });

    it('busca por nombre de usuario y por ID de entidad', async () => {
        const byName = await request(app).get('/api/audit/logs?q=Andrés');
        expect(byName.body.logs.map((l) => l.entity_id)).toEqual(['C-0311']);

        const byId = await request(app).get('/api/audit/logs?q=env-0882');
        expect(byId.body.total).toBe(1);
    });

    it('trata % como texto literal en la búsqueda', async () => {
        const res = await request(app).get('/api/audit/logs?q=' + encodeURIComponent('100%'));
        expect(res.body.logs.map((l) => l.entity_id)).toEqual(['CAC-POL-250']);

        const none = await request(app).get('/api/audit/logs?q=' + encodeURIComponent('%'));
        expect(none.body.total).toBe(1);
    });

    it('oculta las acciones del sistema', async () => {
        const res = await request(app).get('/api/audit/logs?hide_system=1');
        expect(res.body.total).toBe(4);
        expect(res.body.summary.system).toBe(0);
    });

    it('pagina con limit y offset sin alterar el total', async () => {
        const res = await request(app).get('/api/audit/logs?limit=2&offset=2');
        expect(res.body.total).toBe(5);
        expect(res.body.logs.map((l) => l.entity_id)).toEqual(['CAC-POL-250', 'C-0311']);
    });

    it('ignora una ventana de días no permitida', async () => {
        const res = await request(app).get('/api/audit/logs?days=3');
        expect(res.body.total).toBe(5);
    });
});

describe('GET /api/audit/entity-types', () => {
    it('lista los tipos de entidad distintos', async () => {
        const res = await request(app).get('/api/audit/entity-types');
        expect(res.body.entityTypes).toEqual(['coffee_harvest', 'product', 'shipments', 'user']);
    });
});
