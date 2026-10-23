CREATE TABLE IF NOT EXISTS cartoon_pipeline_nodes (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(32) NOT NULL,
  node_key VARCHAR(64) NOT NULL,
  title VARCHAR(80) NOT NULL DEFAULT '',
  kind VARCHAR(16) NOT NULL DEFAULT 'custom',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  skill_name VARCHAR(80) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, node_key)
);

CREATE TABLE IF NOT EXISTS cartoon_agent_configs (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(32) NOT NULL,
  role VARCHAR(32) NOT NULL,
  input_text TEXT NOT NULL DEFAULT '',
  output_text TEXT NOT NULL DEFAULT '',
  model_profile VARCHAR(64) NOT NULL DEFAULT '',
  rule_text TEXT NOT NULL DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 1,
  human_confirm BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, role)
);
