CREATE TABLE IF NOT EXISTS tpl_config_api_ctx (
  item_id VARCHAR(64) PRIMARY KEY REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  config_json JSONB NOT NULL DEFAULT '{}',
  threshold_json JSONB NOT NULL DEFAULT '{}',
  config_source VARCHAR(16) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
