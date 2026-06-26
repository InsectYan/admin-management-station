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
