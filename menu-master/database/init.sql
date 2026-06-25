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

-- 种子：小说子应用（novel-sub）
INSERT INTO subapp_registry (
  microapp_name, app_key, display_name, entry_dev, entry_prod,
  vite_port, api_port, agent_port, status
)
SELECT
  'novel-app', 'novel', '小说管理',
  'http://localhost:5174', '/subapps/novel-app/',
  5174, 7002, 7003, 'enabled'
WHERE NOT EXISTS (
  SELECT 1 FROM subapp_registry WHERE microapp_name = 'novel-app'
);

-- 种子：一级菜单（幂等）
INSERT INTO menu_items (name, parent_id, route_prefix, microapp_name, status, "order", icon)
SELECT '小说管理', NULL, 'novel', 'novel-app', 'enabled', 1, 'icon-novel'
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE microapp_name = 'novel-app' AND route_prefix = 'novel'
);

-- 种子：AI智能测试平台（testgen-sub）
INSERT INTO subapp_registry (
  microapp_name, app_key, display_name, entry_dev, entry_prod,
  vite_port, api_port, agent_port, status
)
SELECT
  'testgen-app', 'testgen', 'AI智能测试平台',
  'http://localhost:5175', '/subapps/testgen-app/',
  5175, 7003, 3001, 'enabled'
WHERE NOT EXISTS (
  SELECT 1 FROM subapp_registry WHERE microapp_name = 'testgen-app'
);

INSERT INTO menu_items (name, parent_id, route_prefix, microapp_name, status, "order", icon)
SELECT 'AI智能测试平台', NULL, 'testgen', 'testgen-app', 'enabled', 2, 'icon-testgen'
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE microapp_name = 'testgen-app' AND route_prefix = 'testgen'
);
