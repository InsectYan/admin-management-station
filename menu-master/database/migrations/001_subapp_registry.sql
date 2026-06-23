-- 增量迁移：子应用注册表（已有库执行一次即可）
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
