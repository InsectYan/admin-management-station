-- ENV-01: 执行环境按项目隔离，禁止跨项目落到 fitness 默认环境

ALTER TABLE ft_execution_env
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(64);

UPDATE ft_execution_env
SET project_code = 'fitness-agent'
WHERE project_code IS NULL OR project_code = '';

ALTER TABLE ft_execution_env
  ALTER COLUMN project_code SET DEFAULT 'fitness-agent';

ALTER TABLE ft_execution_env
  ALTER COLUMN project_code SET NOT NULL;

DROP INDEX IF EXISTS idx_ft_execution_env_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_name
  ON ft_execution_env (project_code, name);

CREATE INDEX IF NOT EXISTS idx_ft_execution_env_project
  ON ft_execution_env (project_code);

-- 每个项目至多一个 is_default=true
CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_execution_env_project_default
  ON ft_execution_env (project_code)
  WHERE is_default IS TRUE;
