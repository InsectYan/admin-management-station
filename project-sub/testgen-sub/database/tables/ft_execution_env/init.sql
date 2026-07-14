-- 执行环境（按项目隔离；ENV-01）
-- 已有旧表时 CREATE TABLE IF NOT EXISTS 不会改列，须先 ADD COLUMN 再建索引。

CREATE TABLE IF NOT EXISTS ft_execution_env (
  id                  SERIAL PRIMARY KEY,
  project_code        VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  name                VARCHAR(128) NOT NULL,
  config_env_id       VARCHAR(64),
  bff_coach_url       VARCHAR(512),
  bff_member_url      VARCHAR(512),
  bff_manager_url     VARCHAR(512),
  agent_chat_url      VARCHAR(512),
  cli_workspace_root  VARCHAR(512),
  auth_configured     JSONB NOT NULL DEFAULT '{}',
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 兼容 migration 003 创建的旧表（无 project_code / cli_workspace_root）
ALTER TABLE ft_execution_env
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(64);

ALTER TABLE ft_execution_env
  ADD COLUMN IF NOT EXISTS cli_workspace_root VARCHAR(512);

UPDATE ft_execution_env
SET project_code = 'fitness-agent'
WHERE project_code IS NULL OR TRIM(project_code) = '';

ALTER TABLE ft_execution_env
  ALTER COLUMN project_code SET DEFAULT 'fitness-agent';

ALTER TABLE ft_execution_env
  ALTER COLUMN project_code SET NOT NULL;

DROP INDEX IF EXISTS idx_ft_execution_env_name;

-- 创建「每项目至多一个 default」前先消解历史重复
UPDATE ft_execution_env e
SET is_default = FALSE
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_default
  ON ft_execution_env (project_code)
  WHERE is_default IS TRUE;
