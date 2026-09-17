-- AUTH-1：MFA 字段 + 管理操作审计（用户仍只在 menu-master）

ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64),
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER,
  actor_username VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_user_id INTEGER,
  target_username VARCHAR(64),
  detail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created ON platform_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_action ON platform_audit_logs(action);
