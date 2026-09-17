-- ops-sub 基线 Schema（幂等）
-- 运维项目管理：目录树、路由、功能流程图均以 JSONB 存储

CREATE TABLE IF NOT EXISTS ops_projects (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  project_type    VARCHAR(32)  NOT NULL DEFAULT 'frontend',
  description     TEXT,
  repo_url        VARCHAR(500),
  source_path     VARCHAR(1000),
  status          VARCHAR(32)  NOT NULL DEFAULT 'draft',
  directory_tree  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  routes          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  flows           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  extra_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  deploy_config   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_projects_type ON ops_projects (project_type);
CREATE INDEX IF NOT EXISTS idx_ops_projects_status ON ops_projects (status);
CREATE INDEX IF NOT EXISTS idx_ops_projects_name ON ops_projects (name);
CREATE INDEX IF NOT EXISTS idx_ops_projects_updated_at ON ops_projects (updated_at DESC);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_deploy_jobs_one_active
  ON ops_deploy_jobs (project_id)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS ops_deploy_log_lines (
  id BIGSERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES ops_deploy_jobs(id) ON DELETE CASCADE,
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_deploy_log_lines_job_id
  ON ops_deploy_log_lines (job_id, id);

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
