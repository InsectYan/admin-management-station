-- 项目管理 · 全局变量

CREATE TABLE IF NOT EXISTS project_env_variable (
  id              SERIAL PRIMARY KEY,
  project_code    VARCHAR(64) NOT NULL REFERENCES test_project(project_code) ON DELETE CASCADE,
  var_key         VARCHAR(128) NOT NULL,
  var_value       TEXT,
  source          VARCHAR(32) NOT NULL DEFAULT 'manual',
  extract_path    TEXT,
  from_step       VARCHAR(128),
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_code, var_key)
);

CREATE INDEX IF NOT EXISTS idx_project_env_variable_project ON project_env_variable(project_code);
