import crypto from 'crypto';
import { Router } from 'express';
import { logger } from '../logger.js';
import libsqlClient, { query, healthCheck } from '../db.js';
import { authenticateToken, requireRole, hashPassword } from '../auth.js';
import { logAudit } from '../services/audit.js';

const genTempPassword = () => crypto.randomBytes(12).toString('base64url');

export const systemRouter = Router();

systemRouter.use(authenticateToken, requireRole('admin'));

// ── Stats generales ───────────────────────────────────────────────────────────

systemRouter.get('/stats', async (req, res) => {
  try {
    const [dbHealth, usersByRole, products, orders, auditLogs, errorLogs] = await Promise.all([
      healthCheck(),
      query(`SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC`),
      query(`SELECT COUNT(*) as count FROM products`),
      query(`SELECT COUNT(*) as count FROM sales_invoices`),
      query(`SELECT COUNT(*) as count FROM audit_logs`),
      query(`SELECT COUNT(*) as count FROM error_logs`),
    ]);

    const totalUsers = usersByRole.rows.reduce((sum, r) => sum + Number(r.count), 0);
    const adminCount = usersByRole.rows.find(r => r.role === 'admin')?.count ?? 0;

    res.json({
      success: true,
      data: {
        db:         { ok: dbHealth.ok, latencyMs: dbHealth.latencyMs, error: dbHealth.error },
        uptime:     Math.floor(process.uptime()),
        users:      { total: totalUsers, byRole: usersByRole.rows, admins: Number(adminCount) },
        products:   Number(products.rows[0].count),
        orders:     Number(orders.rows[0].count),
        auditLogs:  Number(auditLogs.rows[0].count),
        errorLogs:  Number(errorLogs.rows[0].count),
      },
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/system/stats]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── Estadísticas de usuarios ──────────────────────────────────────────────────

systemRouter.get('/users/stats', async (req, res) => {
  try {
    const [regTrend, activeLast30, rolesDist, verifyStats, pendingApps] = await Promise.all([
      query(`
        SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
        FROM users
        WHERE created_at >= datetime('now', '-6 months')
        GROUP BY month
        ORDER BY month ASC
      `),
      query(`
        SELECT COUNT(*) AS count FROM users
        WHERE last_login_at >= datetime('now', '-30 days')
      `),
      query(`SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC`),
      query(`
        SELECT
          SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) AS verified,
          COUNT(*) AS total
        FROM users
      `),
      query(`SELECT COUNT(*) AS count FROM caficultor_applications WHERE status = 'pending'`),
    ]);

    res.json({
      success: true,
      data: {
        registrationsByMonth:  regTrend.rows,
        activeUsersLast30Days: Number(activeLast30.rows[0].count),
        roleDistribution:      rolesDist.rows,
        verification: {
          verified: Number(verifyStats.rows[0].verified ?? 0),
          total:    Number(verifyStats.rows[0].total ?? 0),
        },
        pendingCaficultorApps: Number(pendingApps.rows[0].count),
      },
    });
  } catch (err) {
    logger.error({ err }, '[GET /api/system/users/stats]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── Gestión de admins ─────────────────────────────────────────────────────────

systemRouter.get('/admins', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, email, first_name, last_name, role, is_verified, last_login_at, created_at
      FROM users
      ORDER BY role = 'admin' DESC, created_at ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/system/admins]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

systemRouter.post('/admins', async (req, res) => {
  try {
    const { email, first_name = '', last_name = '' } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email requerido' });

    const existing = await query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing.rows.length) return res.status(409).json({ success: false, error: 'Email ya registrado' });

    const temp = genTempPassword();
    const hash = await hashPassword(temp);

    const r = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
       VALUES (?, ?, ?, ?, 'admin', 1)`,
      [email, hash, first_name, last_name]
    );

    await logAudit(req.user.id, 'create_admin', 'user', String(r.lastInsertRowid), { email });

    res.status(201).json({ success: true, data: { id: Number(r.lastInsertRowid), tempPassword: temp } });
  } catch (err) {
    logger.error({ err }, '[POST /api/system/admins]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

systemRouter.put('/admins/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const allowed = ['admin', 'client', 'provider', 'caficultor'];

    if (!allowed.includes(role)) return res.status(400).json({ success: false, error: 'Rol inválido' });
    if (parseInt(id) === req.user.id) return res.status(400).json({ success: false, error: 'No puedes cambiar tu propio rol' });

    await query(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`, [role, id]);
    await logAudit(req.user.id, 'change_role', 'user', id, { new_role: role });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, '[PUT /api/system/admins/:id/role]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

systemRouter.post('/admins/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const temp = genTempPassword();
    const hash = await hashPassword(temp);

    const r = await query(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [hash, id]);
    if (r.rowCount === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    await logAudit(req.user.id, 'reset_password', 'user', id, { triggered_by: req.user.id });

    res.json({ success: true, data: { tempPassword: temp } });
  } catch (err) {
    logger.error({ err }, '[POST /api/system/admins/:id/reset-password]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── Error logs ────────────────────────────────────────────────────────────────

systemRouter.get('/errors', async (req, res) => {
  try {
    const limit = Number.isFinite(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 50;
    const offset = Number.isFinite(parseInt(req.query.offset)) ? parseInt(req.query.offset) : 0;
    const { level } = req.query;
    const params = [];
    let where = '';
    if (level) { where = ' WHERE el.level = ?'; params.push(level); }

    const [rows, total] = await Promise.all([
      query(
        `SELECT el.*, u.email as user_email
         FROM error_logs el LEFT JOIN users u ON el.user_id = u.id
         ${where}
         ORDER BY el.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      query(
        `SELECT COUNT(*) as count FROM error_logs${where ? ' el' + where : ''}`,
        level ? [level] : []
      ),
    ]);

    res.json({ success: true, data: rows.rows, total: Number(total.rows[0].count) });
  } catch (err) {
    logger.error({ err }, '[GET /api/system/errors]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

systemRouter.post('/errors', async (req, res) => {
  try {
    const { level = 'error', message, stack, source, request_path, request_method, details } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message requerido' });

    await query(
      `INSERT INTO error_logs (level, message, stack, source, user_id, request_path, request_method, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [level, message, stack ?? null, source ?? null, req.user?.id ?? null,
       request_path ?? null, request_method ?? null, details ? JSON.stringify(details) : null]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error({ err }, '[POST /api/system/errors]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

systemRouter.delete('/errors', async (req, res) => {
  try {
    const r = await query(`DELETE FROM error_logs`);
    await logAudit(req.user.id, 'clear_error_logs', 'system', 'error_logs', { deleted: r.rowCount });
    res.json({ success: true, data: { deleted: r.rowCount } });
  } catch (err) {
    logger.error({ err }, '[DELETE /api/system/errors]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── Changelog ─────────────────────────────────────────────────────────────────

systemRouter.get('/changelog', async (req, res) => {
  try {
    const result = await query(`
      SELECT sc.*, u.first_name, u.last_name, u.email as author_email
      FROM system_changelog sc
      LEFT JOIN users u ON sc.author_id = u.id
      ORDER BY sc.created_at DESC LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ err }, '[GET /api/system/changelog]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

systemRouter.post('/changelog', async (req, res) => {
  try {
    const { version, title, description, change_type = 'feature', published_at } = req.body;
    if (!version || !title) return res.status(400).json({ success: false, error: 'version y title requeridos' });

    const r = await query(
      `INSERT INTO system_changelog (version, title, description, change_type, author_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [version, title, description ?? null, change_type, req.user.id, published_at ?? null]
    );

    await logAudit(req.user.id, 'create_changelog', 'system', String(r.lastInsertRowid), { version, title });
    res.status(201).json({ success: true, data: { id: Number(r.lastInsertRowid) } });
  } catch (err) {
    logger.error({ err }, '[POST /api/system/changelog]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── Backup ────────────────────────────────────────────────────────────────────

systemRouter.post('/backup', async (req, res) => {
  try {
    const ts = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dobleyo-backup-${ts}.sql"`);

    const lines = [];
    lines.push(`-- DobleYo Café — Backup generado ${new Date().toISOString()}`);
    lines.push('PRAGMA foreign_keys = OFF;');
    lines.push('BEGIN TRANSACTION;');
    lines.push('');

    const { rows: tables } = await libsqlClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    for (const { name } of tables) {
      const { rows: ddl } = await libsqlClient.execute(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${name}'`
      );
      if (ddl[0]?.sql) {
        lines.push(`-- ── Tabla: ${name}`);
        lines.push(`DROP TABLE IF EXISTS "${name}";`);
        lines.push(ddl[0].sql + ';');
      }

      const { rows } = await libsqlClient.execute(`SELECT * FROM "${name}"`);
      if (rows.length === 0) { lines.push(''); continue; }

      const cols = Object.keys(rows[0]);
      for (const row of rows) {
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number' || typeof v === 'bigint') return String(v);
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        lines.push(`INSERT INTO "${name}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});`);
      }
      lines.push('');
    }

    lines.push('COMMIT;');
    lines.push('PRAGMA foreign_keys = ON;');

    await logAudit(req.user.id, 'backup_db', 'system', 'database', { tables: tables.length });

    res.send(lines.join('\n') + '\n');
  } catch (err) {
    logger.error({ err }, '[POST /api/system/backup]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── Migraciones ───────────────────────────────────────────────────────────────

systemRouter.post('/migrate', async (req, res) => {
  const results = [];

  const tryMigration = async (name, importPath, fnName) => {
    try {
      const mod = await import(importPath);
      if (typeof mod[fnName] !== 'function') throw new Error(`Función '${fnName}' no encontrada`);
      await mod[fnName]();
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
    }
  };

  await tryMigration('Origin fields on coffee_harvests', '../migrations/add_origin_fields_to_coffee_harvests.js', 'addOriginFieldsToCoffeeHarvests');
  await tryMigration('Farms table',                      '../migrations/create_farms_table.js',                   'createFarmsTable');
  await tryMigration('Finance tables',                   '../migrations/create_finance_tables.js',                'createFinanceTables');
  await tryMigration('Inventory tables',                 '../migrations/create_inventory_tables.js',              'migrateInventoryTables');
  await tryMigration('Customer orders tables',           '../migrations/create_customer_orders.js',               'createCustomerOrdersTables');
  await tryMigration('Geocoding on orders',              '../migrations/add_geocoding_to_orders.js',              'addGeocodingToOrders');
  await tryMigration('Split name fields',                '../migrations/split_name_fields.js',                    'splitNameFields');
  await tryMigration('Product variants table',           '../migrations/add_product_variants.js',                 'addProductVariants');
  await tryMigration('Newsletter subscribers',           '../migrations/add_newsletter_subscribers.js',           'addNewsletterSubscribers');
  await tryMigration('Blog posts table',                 '../migrations/add_blog_posts.js',                       'addBlogPosts');
  await tryMigration('Product reviews table',            '../migrations/add_product_reviews.js',                  'addProductReviews');
  await tryMigration('Gift sets',                        '../migrations/add_gift_sets.js',                        'addGiftSets');
  await tryMigration('System tables',                    '../migrations/add_system_tables.js',                    'addSystemTables');
  await tryMigration('Discount codes',                   '../migrations/add_discount_codes.js',                   'addDiscountCodes');

  const failed = results.filter(r => !r.ok).length;
  await logAudit(req.user.id, 'run_migrations', 'system', 'database', { total: results.length, failed });

  res.json({ success: true, data: results });
});

// ── Purga de logs antiguos ────────────────────────────────────────────────────

systemRouter.delete('/logs/old', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    if (days < 7) return res.status(400).json({ success: false, error: 'Mínimo 7 días' });

    const r = await query(
      `DELETE FROM audit_logs WHERE created_at < datetime('now', ?)`,
      [`-${days} days`]
    );

    await logAudit(req.user.id, 'purge_old_logs', 'system', 'audit_logs', { days, deleted: r.rowCount });
    res.json({ success: true, data: { deleted: r.rowCount, olderThanDays: days } });
  } catch (err) {
    logger.error({ err }, '[DELETE /api/system/logs/old]');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});
