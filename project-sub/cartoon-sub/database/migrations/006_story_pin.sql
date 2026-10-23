ALTER TABLE cartoon_projects ADD COLUMN IF NOT EXISTS content_type VARCHAR(32) NOT NULL DEFAULT 'ai_comic';
ALTER TABLE cartoon_projects ADD COLUMN IF NOT EXISTS package_id VARCHAR(64);
ALTER TABLE cartoon_projects ADD COLUMN IF NOT EXISTS package_version INTEGER;
ALTER TABLE cartoon_projects ADD COLUMN IF NOT EXISTS pin_mode VARCHAR(16);
UPDATE cartoon_projects SET pin_mode = 'legacy' WHERE pin_mode IS NULL OR pin_mode = '';
ALTER TABLE cartoon_projects ALTER COLUMN pin_mode SET DEFAULT 'required';

ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS package_id VARCHAR(64);
ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS package_version INTEGER;
ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS chapter_id VARCHAR(80);
ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS body_hash VARCHAR(64);
ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS legacy_unpinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS overridden_fields JSONB NOT NULL DEFAULT '[]';

ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS video_task_id INTEGER;
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS dialogue TEXT;
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS emotion VARCHAR(64);
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS upstream_intent_id VARCHAR(80);
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS upstream_version INTEGER;
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS overridden_fields JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS cartoon_video_tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  episode_no INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL DEFAULT '',
  current_node VARCHAR(32) NOT NULL DEFAULT 'input',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cartoon_video_tasks_project
  ON cartoon_video_tasks (project_id, episode_no);
