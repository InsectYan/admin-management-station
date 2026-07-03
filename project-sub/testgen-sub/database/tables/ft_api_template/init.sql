CREATE TABLE IF NOT EXISTS ft_api_template (
  id              SERIAL PRIMARY KEY,
  template_code   VARCHAR(64) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  project_code    VARCHAR(64),
  http_method     VARCHAR(16) NOT NULL DEFAULT 'POST',
  url_path        VARCHAR(512) NOT NULL,
  headers_json    JSONB NOT NULL DEFAULT '{}',
  query_json      JSONB NOT NULL DEFAULT '{}',
  body_template   JSONB NOT NULL DEFAULT '{}',
  inject_schema   JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ft_api_template_project ON ft_api_template(project_code);
CREATE INDEX IF NOT EXISTS idx_ft_api_template_active ON ft_api_template(is_active);
