-- D0：部署任务与日志行

CREATE TABLE IF NOT EXISTS ops_deploy_jobs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES ops_projects(id),
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  git_remote VARCHAR(500),
  git_tag VARCHAR(128) NOT NULL,
  git_sha VARCHAR(64),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by VARCHAR(128) NOT NULL,
  parent_job_id INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  agent_session_id VARCHAR(128),
  error_summary TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_deploy_jobs_project_created
  ON ops_deploy_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_deploy_jobs_status ON ops_deploy_jobs (status);
CREATE INDEX IF NOT EXISTS idx_ops_deploy_jobs_triggered_by ON ops_deploy_jobs (triggered_by);

CREATE TABLE IF NOT EXISTS ops_deploy_log_lines (
  id BIGSERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES ops_deploy_jobs(id) ON DELETE CASCADE,
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_deploy_log_lines_job_id
  ON ops_deploy_log_lines (job_id, id);
