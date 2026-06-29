-- 默认执行环境种子（E1）

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_name ON ft_execution_env(name);

INSERT INTO ft_execution_env (
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
  'local-docker',
  'LOCAL_DOCKER',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3001',
  '{}'::jsonb,
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM ft_execution_env WHERE name = 'local-docker');
