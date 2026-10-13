CREATE TABLE IF NOT EXISTS precheck_runtimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  expected_version VARCHAR(32) NOT NULL DEFAULT '0.39.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS precheck_workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'text_to_image',
  api_json JSONB NOT NULL,
  required_nodes JSONB NOT NULL DEFAULT '[]',
  required_models JSONB NOT NULL DEFAULT '[]',
  suggested_vram_gb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
