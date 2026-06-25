-- 增量迁移：AI智能测试平台子应用（testgen-sub）
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
