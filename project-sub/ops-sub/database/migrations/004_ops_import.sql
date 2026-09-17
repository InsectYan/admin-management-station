CREATE TABLE IF NOT EXISTS ops_import_jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  phase VARCHAR(32),
  error TEXT,
  result_project_id INTEGER REFERENCES ops_projects(id) ON DELETE SET NULL,
  result_name VARCHAR(200),
  triggered_by VARCHAR(128),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_import_jobs_created
  ON ops_import_jobs (created_at DESC);
