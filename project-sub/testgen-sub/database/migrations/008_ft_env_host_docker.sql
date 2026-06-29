-- E1 修复：testgen Docker 内访问宿主机 fitness BFF 须用 host.docker.internal

UPDATE ft_execution_env
SET
  bff_coach_url = 'http://host.docker.internal:3001',
  bff_member_url = 'http://host.docker.internal:3001',
  bff_manager_url = 'http://host.docker.internal:3001',
  agent_chat_url = 'http://host.docker.internal:3001',
  updated_at = NOW()
WHERE name = 'local-docker';

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
  'local-host',
  'LOCAL_HOST',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3001',
  '{}'::jsonb,
  FALSE,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM ft_execution_env WHERE name = 'local-host');

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_name ON ft_execution_env(name);
