-- 项目管理 · 项目级默认请求头（全用例生效，用例配置 Headers 可覆盖）

CREATE TABLE IF NOT EXISTS project_request_header (
  id              SERIAL PRIMARY KEY,
  project_code    VARCHAR(64) NOT NULL REFERENCES test_project(project_code) ON DELETE CASCADE,
  header_key      VARCHAR(256) NOT NULL,
  header_value    TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_code, header_key)
);

CREATE INDEX IF NOT EXISTS idx_project_request_header_project
  ON project_request_header(project_code);
