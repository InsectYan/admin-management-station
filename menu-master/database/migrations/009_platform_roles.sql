-- 账号类型与按子应用划分的角色。role 列保留给旧数据，鉴权以 account_type 为准。

ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20);

UPDATE platform_users
SET account_type = CASE WHEN role = 'admin' THEN 'super_admin' ELSE 'user' END
WHERE account_type IS NULL OR account_type = '';

ALTER TABLE platform_users ALTER COLUMN account_type SET DEFAULT 'user';

CREATE TABLE IF NOT EXISTS platform_roles (
  id SERIAL PRIMARY KEY,
  app_code VARCHAR(50) NOT NULL,
  app_name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  remark TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (app_code, code)
);

CREATE INDEX IF NOT EXISTS idx_platform_roles_app ON platform_roles(app_code);

CREATE TABLE IF NOT EXISTS platform_user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_user_roles_user ON platform_user_roles(user_id);
