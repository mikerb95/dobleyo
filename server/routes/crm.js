import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authenticateToken, requireRole } from './auth.js';

const STAGES   = ['prospect','contacted','sample_sent','negotiation','active','lost'];
const SEGMENTS = ['importer_us','distributor_co','hotel','cafeteria','retail','other'];
const KINDS    = ['call','email','meeting','sample','quote','note','order','payment'];

export const crmRouter = Router();

const ok  = (res, data)              => res.json({ success: true, data });
const err = (res, status, code, msg) => res.status(status).json({ success: false, error: { code, message: msg } });

// Todas las rutas requieren admin
crmRouter.use(authenticateToken, requireRole('admin'));

// GET /api/crm/accounts?stage=&segment=&country=&q=&limit=50&offset=0
crmRouter.get('/accounts', async (req, res) => {
  const { stage, segment, country, q } = req.query;
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Math.max(Number(req.query.offset ?? 0),  0);

  const where = [], params = [];
  if (stage) {
    if (!STAGES.includes(stage)) return err(res, 400, 'bad_stage', 'stage inválido');
    where.push('pipeline_stage = ?'); params.push(stage);
  }
  if (segment) {
    if (!SEGMENTS.includes(segment)) return err(res, 400, 'bad_segment', 'segment inválido');
    where.push('segment = ?'); params.push(segment);
  }
  if (country) { where.push('country = ?'); params.push(country); }
  if (q) {
    where.push('(display_name LIKE ? OR legal_name LIKE ? OR primary_contact_name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows, countRow] = await Promise.all([
      query(
        `SELECT * FROM crm_account_overview ${whereSql}
         ORDER BY COALESCE(last_interaction_at, created_at) DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) AS n FROM crm_account_overview ${whereSql}`, params),
    ]);
    ok(res, { items: rows.rows, total: countRow.rows[0].n, limit, offset });
  } catch (e) {
    console.error('[GET /api/crm/accounts]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// GET /api/crm/accounts/:id
crmRouter.get('/accounts/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const acctRes = await query('SELECT * FROM crm_account_overview WHERE id = ?', [id]);
    const account = acctRes.rows[0];
    if (!account) return err(res, 404, 'not_found', 'Cuenta no encontrada');

    const [contactsRes, interactionsRes] = await Promise.all([
      query(`SELECT * FROM crm_contacts WHERE account_id = ? ORDER BY is_primary DESC, full_name`, [id]),
      query(
        `SELECT i.*, c.full_name AS contact_name, u.name AS author_name
           FROM crm_interactions i
      LEFT JOIN crm_contacts c ON c.id = i.contact_id
      LEFT JOIN users        u ON u.id = i.created_by
          WHERE i.account_id = ?
          ORDER BY i.occurred_at DESC LIMIT 30`,
        [id]
      ),
    ]);

    ok(res, { account, contacts: contactsRes.rows, interactions: interactionsRes.rows });
  } catch (e) {
    console.error('[GET /api/crm/accounts/:id]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// POST /api/crm/accounts
crmRouter.post('/accounts', async (req, res) => {
  const {
    legal_name, display_name, segment,
    country = 'CO', city, region, tax_id,
    pipeline_value = 0, source, notes, contact,
  } = req.body ?? {};

  if (!legal_name || !display_name || !SEGMENTS.includes(segment)) {
    return err(res, 400, 'bad_payload', 'legal_name, display_name y segment válido son requeridos');
  }
  const ownerId = req.user?.id ?? null;

  try {
    const result = await withTransaction(async ({ query: txq }) => {
      const acctRes = await txq(
        `INSERT INTO crm_accounts
           (legal_name, display_name, segment, country, city, region, tax_id, pipeline_value, source, notes, owner_user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [legal_name, display_name, segment, country, city ?? null, region ?? null, tax_id ?? null,
         pipeline_value, source ?? null, notes ?? null, ownerId]
      );
      const accountId = Number(acctRes.lastInsertRowid);

      if (contact?.full_name) {
        await txq(
          `INSERT INTO crm_contacts(account_id, full_name, role, email, phone, is_primary)
           VALUES (?,?,?,?,?,1)`,
          [accountId, contact.full_name, contact.role ?? null, contact.email ?? null, contact.phone ?? null]
        );
      }
      return accountId;
    });

    const fullRes = await query('SELECT * FROM crm_account_overview WHERE id = ?', [result]);
    ok(res, fullRes.rows[0]);
  } catch (e) {
    console.error('[POST /api/crm/accounts]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// PATCH /api/crm/accounts/:id
crmRouter.patch('/accounts/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['legal_name','display_name','segment','country','region','city',
                   'tax_id','pipeline_value','source','notes','owner_user_id'];
  const sets = [], params = [];
  for (const k of allowed) {
    if (k in (req.body ?? {})) { sets.push(`${k} = ?`); params.push(req.body[k]); }
  }
  if (!sets.length) return err(res, 400, 'no_changes', 'No hay cambios');
  params.push(id);

  try {
    const result = await query(`UPDATE crm_accounts SET ${sets.join(', ')} WHERE id = ?`, params);
    if (!result.rowCount) return err(res, 404, 'not_found', 'Cuenta no encontrada');
    const row = await query('SELECT * FROM crm_account_overview WHERE id = ?', [id]);
    ok(res, row.rows[0]);
  } catch (e) {
    console.error('[PATCH /api/crm/accounts/:id]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// PATCH /api/crm/accounts/:id/stage
crmRouter.patch('/accounts/:id(\\d+)/stage', async (req, res) => {
  const id = Number(req.params.id);
  const { to, reason } = req.body ?? {};
  if (!STAGES.includes(to)) return err(res, 400, 'bad_stage', `stage inválido: ${to}`);

  try {
    const result = await query(
      `UPDATE crm_accounts SET pipeline_stage = ? WHERE id = ? AND pipeline_stage != ?`,
      [to, id, to]
    );
    if (!result.rowCount) return err(res, 409, 'no_change', 'Ya está en esa etapa o no existe');

    if (reason) {
      await query(
        `INSERT INTO crm_interactions(account_id, kind, subject, body, created_by)
         VALUES (?, 'note', 'Motivo del cambio de etapa', ?, ?)`,
        [id, reason, req.user?.id ?? null]
      );
    }
    const row = await query('SELECT * FROM crm_account_overview WHERE id = ?', [id]);
    ok(res, row.rows[0]);
  } catch (e) {
    console.error('[PATCH /api/crm/accounts/:id/stage]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// GET /api/crm/pipeline
crmRouter.get('/pipeline', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM crm_account_overview
        WHERE pipeline_stage != 'lost'
        ORDER BY pipeline_value DESC, last_interaction_at DESC`
    );
    const groups = Object.fromEntries(STAGES.map((s) => [s, []]));
    for (const row of rows.rows) {
      if (groups[row.pipeline_stage]) groups[row.pipeline_stage].push(row);
    }
    ok(res, { stages: STAGES, groups });
  } catch (e) {
    console.error('[GET /api/crm/pipeline]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// POST /api/crm/accounts/:id/interactions
crmRouter.post('/accounts/:id(\\d+)/interactions', async (req, res) => {
  const id = Number(req.params.id);
  const { kind, subject, body, contact_id, occurred_at, metadata } = req.body ?? {};
  if (!KINDS.includes(kind)) return err(res, 400, 'bad_kind', `kind inválido: ${kind}`);
  if (!subject)              return err(res, 400, 'bad_payload', 'subject requerido');

  try {
    const r1 = await query(
      `INSERT INTO crm_interactions
         (account_id, contact_id, kind, subject, body, metadata, occurred_at, created_by)
       VALUES (?,?,?,?,?,?, COALESCE(?, datetime('now')), ?)`,
      [id, contact_id ?? null, kind, subject, body ?? null,
       metadata ? JSON.stringify(metadata) : null, occurred_at ?? null, req.user?.id ?? null]
    );
    const row = await query(
      `SELECT i.*, c.full_name AS contact_name
         FROM crm_interactions i
    LEFT JOIN crm_contacts c ON c.id = i.contact_id
        WHERE i.id = ?`,
      [Number(r1.lastInsertRowid)]
    );
    ok(res, row.rows[0]);
  } catch (e) {
    console.error('[POST /api/crm/accounts/:id/interactions]', e);
    err(res, 500, 'db_error', e.message);
  }
});

// POST /api/crm/accounts/:id/contacts
crmRouter.post('/accounts/:id(\\d+)/contacts', async (req, res) => {
  const id = Number(req.params.id);
  const { full_name, role, email, phone, is_primary } = req.body ?? {};
  if (!full_name) return err(res, 400, 'bad_payload', 'full_name requerido');

  try {
    await withTransaction(async ({ query: txq }) => {
      if (is_primary) {
        await txq('UPDATE crm_contacts SET is_primary = 0 WHERE account_id = ?', [id]);
      }
      await txq(
        `INSERT INTO crm_contacts(account_id, full_name, role, email, phone, is_primary)
         VALUES (?,?,?,?,?,?)`,
        [id, full_name, role ?? null, email ?? null, phone ?? null, is_primary ? 1 : 0]
      );
    });
    ok(res, { account_id: id });
  } catch (e) {
    console.error('[POST /api/crm/accounts/:id/contacts]', e);
    err(res, 500, 'db_error', e.message);
  }
});
