-- ENV-01: 执行环境按项目隔离，禁止跨项目落到 fitness 默认环境
-- 幂等：可重复执行；配合 database/tables/ft_execution_env/init.sql 与 seed data.json

ALTER TABLE ft_execution_env
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(64);

UPDATE ft_execution_env
SET project_code = 'fitness-agent'
WHERE project_code IS NULL OR TRIM(project_code) = '';

ALTER TABLE ft_execution_env
  ALTER COLUMN project_code SET DEFAULT 'fitness-agent';

ALTER TABLE ft_execution_env
  ALTER COLUMN project_code SET NOT NULL;

-- 历史全局 name 唯一 → 改为项目内唯一
DROP INDEX IF EXISTS idx_ft_execution_env_name;

-- 创建「每项目至多一个 default」前先消解历史重复
UPDATE ft_execution_env e
SET is_default = FALSE,
    updated_at = NOW()
WHERE e.is_default IS TRUE
  AND e.id NOT IN (
    SELECT DISTINCT ON (project_code) id
    FROM ft_execution_env
    WHERE is_default IS TRUE
    ORDER BY project_code, id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_name
  ON ft_execution_env (project_code, name);

CREATE INDEX IF NOT EXISTS idx_ft_execution_env_project
  ON ft_execution_env (project_code);

-- 每个项目至多一个 is_default=true
CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_default
  ON ft_execution_env (project_code)
  WHERE is_default IS TRUE;

-- 确保 fitness-agent 种子环境齐全（与 tables/.../data.json、007/008 对齐）
INSERT INTO ft_execution_env (
  project_code,
  name,
  config_env_id,
  bff_coach_url,
  bff_member_url,
  bff_manager_url,
  agent_chat_url,
  cli_workspace_root,
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
  '/fitness-agent',
  jsonb_build_object(
    'database_url',
    'postgresql://fitness:fitness_secret@host.docker.internal:5433/fitness_db'
  ),
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ft_execution_env
  WHERE project_code = 'fitness-agent' AND name = 'local-docker'
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

UPDATE ft_execution_env
SET
  cli_workspace_root = COALESCE(NULLIF(TRIM(cli_workspace_root), ''), '/fitness-agent'),
  auth_configured = CASE
    WHEN COALESCE(auth_configured, '{}'::jsonb) ? 'database_url' THEN auth_configured
    ELSE COALESCE(auth_configured, '{}'::jsonb) || jsonb_build_object(
      'database_url',
      'postgresql://fitness:fitness_secret@host.docker.internal:5433/fitness_db'
    )
  END,
  updated_at = NOW()
WHERE project_code = 'fitness-agent'
  AND name = 'local-docker';
