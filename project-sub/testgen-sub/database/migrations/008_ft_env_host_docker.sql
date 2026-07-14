-- E1 修复：testgen Docker 内访问宿主机 fitness BFF 须用 host.docker.internal
-- ENV-01：按 project_code + name 作用域更新/插入

UPDATE ft_execution_env
SET
  bff_coach_url = 'http://host.docker.internal:3001',
  bff_member_url = 'http://host.docker.internal:3001',
  bff_manager_url = 'http://host.docker.internal:3001',
  agent_chat_url = 'http://host.docker.internal:3001',
  updated_at = NOW()
WHERE name = 'local-docker'
  AND (
    project_code = 'fitness-agent'
    OR project_code IS NULL
    OR TRIM(project_code) = ''
  );

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
WHERE NOT EXISTS (
  SELECT 1 FROM ft_execution_env
  WHERE project_code = 'fitness-agent' AND name = 'local-host'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_name
  ON ft_execution_env (project_code, name);

-- 清理历史全局 name 唯一索引（若仍存在）
DROP INDEX IF EXISTS idx_ft_execution_env_name;
