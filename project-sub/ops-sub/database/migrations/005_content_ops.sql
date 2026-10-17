-- 内容运维：告警、审计、运行阈值。与 init.sql 同为幂等语句。

CREATE TABLE IF NOT EXISTS ops_runtime_config (
  id                  INTEGER PRIMARY KEY,
  queue_backlog       INTEGER NOT NULL DEFAULT 20,
  stuck_minutes       INTEGER NOT NULL DEFAULT 30,
  fail_rate           NUMERIC(6, 4) NOT NULL DEFAULT 0.5,
  fail_min_samples    INTEGER NOT NULL DEFAULT 3,
  retention_days      INTEGER NOT NULL DEFAULT 30,
  require_moderation  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ops_runtime_config ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE ops_runtime_config ALTER COLUMN updated_at SET DEFAULT NOW();

INSERT INTO ops_runtime_config (id, created_at, updated_at)
VALUES (1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ops_alert_rules (
  id          SERIAL PRIMARY KEY,
  rule_key    VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  level       VARCHAR(16) NOT NULL DEFAULT 'warning',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_alerts (
  id           SERIAL PRIMARY KEY,
  rule_key     VARCHAR(64) NOT NULL,
  object_key   VARCHAR(200) NOT NULL,
  level        VARCHAR(16) NOT NULL DEFAULT 'warning',
  title        VARCHAR(200) NOT NULL,
  detail       TEXT,
  status       VARCHAR(16) NOT NULL DEFAULT 'open',
  assignee     VARCHAR(128),
  note         TEXT,
  acked_at     TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_status
  ON ops_alerts (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_alerts_open_object
  ON ops_alerts (rule_key, object_key)
  WHERE status IN ('open', 'ack');

CREATE TABLE IF NOT EXISTS ops_audit_logs (
  id             BIGSERIAL PRIMARY KEY,
  actor          VARCHAR(128) NOT NULL,
  action         VARCHAR(64) NOT NULL,
  biz_app        VARCHAR(32),
  external_type  VARCHAR(32),
  external_id    VARCHAR(64),
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_logs_created
  ON ops_audit_logs (created_at DESC);
