-- 同一项目同时只允许一条 queued/running
CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_deploy_jobs_one_active
  ON ops_deploy_jobs (project_id)
  WHERE status IN ('queued', 'running');
