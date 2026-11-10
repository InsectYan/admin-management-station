CREATE TABLE IF NOT EXISTS cartoon_auto_jobs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_auto_job_items (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES cartoon_auto_jobs(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  shot_id INTEGER NOT NULL,
  shot_code VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  task_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cartoon_auto_jobs_project_idx ON cartoon_auto_jobs (project_id, id DESC);
CREATE INDEX IF NOT EXISTS cartoon_auto_job_items_job_idx ON cartoon_auto_job_items (job_id, sort_order);
