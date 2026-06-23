-- menu-master · admin_platform
-- 主应用菜单表

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

-- 种子数据（幂等：按 microapp_name + route_prefix 去重）
INSERT INTO menu_items (name, parent_id, route_prefix, microapp_name, status, "order", icon)
SELECT '小说管理', NULL, 'novel', 'novel-app', 'enabled', 1, 'icon-novel'
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE microapp_name = 'novel-app' AND route_prefix = 'novel'
);
