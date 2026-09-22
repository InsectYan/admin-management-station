-- menu-master · admin_platform
-- 主应用菜单表与子应用注册表

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  route_prefix VARCHAR(50) NOT NULL,
  microapp_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'enabled',
  "order" INTEGER DEFAULT 0,
  icon VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_parent_id ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_route_prefix ON menu_items(route_prefix);
CREATE INDEX IF NOT EXISTS idx_menu_status ON menu_items(status);

-- 子应用注册表（菜单 microapp_name 关联；entry 可由环境变量覆盖）
CREATE TABLE IF NOT EXISTS subapp_registry (
  id SERIAL PRIMARY KEY,
  microapp_name VARCHAR(50) UNIQUE NOT NULL,
  app_key VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  entry_dev VARCHAR(200) NOT NULL,
  entry_prod VARCHAR(200),
  vite_port INTEGER,
  api_port INTEGER,
  agent_port INTEGER,
  status VARCHAR(20) DEFAULT 'enabled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subapp_app_key ON subapp_registry(app_key);
CREATE INDEX IF NOT EXISTS idx_subapp_status ON subapp_registry(status);

-- 子应用与一级菜单由 deploy/scripts/sync-subapps.mjs 从 project-sub/*/subapp.manifest.json 同步。
-- 启动 ams-main local 时会自动执行；也可手动：ams-main sync:subapps

CREATE TABLE IF NOT EXISTS platform_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  role VARCHAR(20) NOT NULL DEFAULT 'operator',
  mfa_secret VARCHAR(64),
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  github_login VARCHAR(128),
  github_token TEXT,
  aliyun_account_id VARCHAR(64),
  aliyun_access_key_id VARCHAR(128),
  aliyun_access_key_secret TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_users_status ON platform_users(status);

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
