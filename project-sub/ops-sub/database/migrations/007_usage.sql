CREATE TABLE IF NOT EXISTS ops_usage_events (
  id SERIAL PRIMARY KEY,
  actor VARCHAR(128) NOT NULL DEFAULT '',
  biz_app VARCHAR(32) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  model_profile VARCHAR(80) NOT NULL DEFAULT '',
  call_count INTEGER NOT NULL DEFAULT 0,
  media_seconds INTEGER NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_usage_events_project
  ON ops_usage_events (biz_app, project_id);
