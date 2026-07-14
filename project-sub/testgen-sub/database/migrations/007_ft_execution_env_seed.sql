-- 默认执行环境种子（E1 / ENV-01：归属 fitness-agent）
-- 依赖：tables/ft_execution_env/init.sql 补列或 migration 038 前已有 project_code（SchemaSync 补列在 afterTables 之前）。
-- 唯一约束以 (project_code, name) 为准；勿再建全局 name 唯一索引。

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_name
  ON ft_execution_env (project_code, name);

INSERT INTO ft_execution_env (
  project_code,
  name,
  config_env_id,
  bff_coach_url,
  bff_member_url,
  bff_manager_url,
  agent_chat_url,
  auth_configured,
  is_default,
  created_at,
  updated_at
)
SELECT
  'fitness-agent',
  'local-docker',
  'LOCAL_DOCKER',
  'http://host.docker.internal:3001',
  'http://host.docker.internal:3001',
  'http://host.docker.internal:3001',
  'http://host.docker.internal:3001',
  '{}'::jsonb,
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ft_execution_env
  WHERE project_code = 'fitness-agent' AND name = 'local-docker'
);
