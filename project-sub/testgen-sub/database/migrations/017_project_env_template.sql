-- 项目管理 · 环境模板

CREATE TABLE IF NOT EXISTS project_env_template (
  id              SERIAL PRIMARY KEY,
  project_code    VARCHAR(64) NOT NULL REFERENCES test_project(project_code) ON DELETE CASCADE,
  name            VARCHAR(128) NOT NULL,
  tier            VARCHAR(32) NOT NULL DEFAULT 'staging',
  base_url        VARCHAR(512),
  base_path       VARCHAR(256) NOT NULL DEFAULT '/',
  auth_type       VARCHAR(32) NOT NULL DEFAULT 'none',
  auth_secret     TEXT,
  db_host         VARCHAR(256),
  db_port         VARCHAR(16) DEFAULT '5432',
  db_name         VARCHAR(128),
  db_user         VARCHAR(128),
  db_password     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_code, name)
);

CREATE INDEX IF NOT EXISTS idx_project_env_template_project ON project_env_template(project_code);
