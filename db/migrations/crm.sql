-- Migración CRM — DobleYo Café
-- Turso / libSQL (SQLite 3.45+)
-- Ejecutar una sola vez. Idempotente con IF NOT EXISTS.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  legal_name     TEXT    NOT NULL,
  display_name   TEXT    NOT NULL,
  segment        TEXT    NOT NULL
                 CHECK(segment IN ('importer_us','distributor_co','hotel','cafeteria','retail','other')),
  country        TEXT    NOT NULL DEFAULT 'CO',
  region         TEXT,
  city           TEXT,
  tax_id         TEXT,
  pipeline_stage TEXT    NOT NULL DEFAULT 'prospect'
                 CHECK(pipeline_stage IN ('prospect','contacted','sample_sent','negotiation','active','lost')),
  pipeline_value INTEGER NOT NULL DEFAULT 0,
  owner_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source         TEXT,
  notes          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_stage   ON crm_accounts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_segment ON crm_accounts(segment);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_country ON crm_accounts(country);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_owner   ON crm_accounts(owner_user_id);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES crm_accounts(id) ON DELETE CASCADE,
  full_name   TEXT    NOT NULL,
  role        TEXT,
  email       TEXT,
  phone       TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON crm_contacts(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_contacts_primary
  ON crm_contacts(account_id) WHERE is_primary = 1;

CREATE TABLE IF NOT EXISTS crm_interactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES crm_accounts(id) ON DELETE CASCADE,
  contact_id  INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
  kind        TEXT    NOT NULL
              CHECK(kind IN ('call','email','meeting','sample','quote','note','stage_change','order','payment')),
  subject     TEXT    NOT NULL,
  body        TEXT,
  metadata    TEXT,
  occurred_at TEXT    NOT NULL DEFAULT (datetime('now')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_account_time
  ON crm_interactions(account_id, occurred_at DESC);

-- Columna que vincula ventas ML a cuentas CRM. Debe existir ANTES de crear la
-- vista, porque crm_account_overview la referencia. sales_tracking.total_amount
-- está en pesos (COP), por eso se multiplica por 100 para expresar centavos.
ALTER TABLE sales_tracking ADD COLUMN crm_account_id INTEGER REFERENCES crm_accounts(id) ON DELETE SET NULL;

CREATE VIEW IF NOT EXISTS crm_account_overview AS
SELECT
  a.*,
  (SELECT COUNT(*) FROM crm_interactions i WHERE i.account_id = a.id)          AS interactions_count,
  (SELECT MAX(occurred_at) FROM crm_interactions i WHERE i.account_id = a.id)  AS last_interaction_at,
  (SELECT IFNULL(SUM(s.total_amount * 100), 0) FROM sales_tracking s WHERE s.crm_account_id = a.id) AS lifetime_value_cents,
  (SELECT c.full_name FROM crm_contacts c WHERE c.account_id = a.id AND c.is_primary = 1 LIMIT 1) AS primary_contact_name,
  (SELECT c.email    FROM crm_contacts c WHERE c.account_id = a.id AND c.is_primary = 1 LIMIT 1) AS primary_contact_email
FROM crm_accounts a;

CREATE TRIGGER IF NOT EXISTS trg_crm_accounts_updated
AFTER UPDATE ON crm_accounts
FOR EACH ROW BEGIN
  UPDATE crm_accounts SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_crm_accounts_stage_log
AFTER UPDATE OF pipeline_stage ON crm_accounts
FOR EACH ROW WHEN OLD.pipeline_stage IS NOT NEW.pipeline_stage
BEGIN
  INSERT INTO crm_interactions(account_id, kind, subject, metadata)
  VALUES (
    NEW.id, 'stage_change',
    'Etapa: ' || OLD.pipeline_stage || ' → ' || NEW.pipeline_stage,
    json_object('from', OLD.pipeline_stage, 'to', NEW.pipeline_stage)
  );
END;
