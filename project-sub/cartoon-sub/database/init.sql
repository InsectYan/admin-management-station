CREATE TABLE IF NOT EXISTS cartoon_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  source_novel_id VARCHAR(64),
  visual_style VARCHAR(64) NOT NULL DEFAULT '',
  summary TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_imports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  source_novel_id VARCHAR(64),
  chapter_title VARCHAR(200),
  body TEXT NOT NULL,
  characters JSONB NOT NULL DEFAULT '[]',
  script_data JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_assets (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL DEFAULT 'character',
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_shots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  import_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  shot_size VARCHAR(32),
  camera_move VARCHAR(32),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_prompts (
  id SERIAL PRIMARY KEY,
  shot_id INTEGER NOT NULL UNIQUE REFERENCES cartoon_shots(id) ON DELETE CASCADE,
  positive_zh TEXT,
  negative_zh TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  shot_id INTEGER,
  kind VARCHAR(32) NOT NULL DEFAULT 'image',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  prompt_id VARCHAR(64),
  error_message TEXT,
  workflow_snapshot JSONB,
  precheck_workflow_id INTEGER,
  precheck_gap JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_outputs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES cartoon_tasks(id) ON DELETE CASCADE,
  edit_job_id INTEGER,
  file_path VARCHAR(500),
  media_kind VARCHAR(32) NOT NULL DEFAULT 'image',
  duration_ms INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cartoon_outputs_source_chk CHECK (task_id IS NOT NULL OR edit_job_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS cartoon_edits (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 720,
  height INTEGER NOT NULL DEFAULT 1280,
  fps INTEGER NOT NULL DEFAULT 24,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_edit_tracks (
  id SERIAL PRIMARY KEY,
  edit_id INTEGER NOT NULL REFERENCES cartoon_edits(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL,
  volume NUMERIC(4, 2) NOT NULL DEFAULT 1,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (edit_id, kind)
);

CREATE TABLE IF NOT EXISTS cartoon_edit_clips (
  id SERIAL PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES cartoon_edit_tracks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_output_id INTEGER REFERENCES cartoon_outputs(id) ON DELETE SET NULL,
  start_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  trim_in_ms INTEGER NOT NULL DEFAULT 0,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_edit_jobs (
  id SERIAL PRIMARY KEY,
  edit_id INTEGER NOT NULL REFERENCES cartoon_edits(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  output_id INTEGER REFERENCES cartoon_outputs(id) ON DELETE SET NULL,
  args_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cartoon_imports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE cartoon_outputs ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE cartoon_outputs ADD COLUMN IF NOT EXISTS edit_job_id INTEGER;
ALTER TABLE cartoon_outputs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE cartoon_outputs ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE cartoon_outputs ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE cartoon_outputs DROP CONSTRAINT IF EXISTS cartoon_outputs_edit_job_id_fkey;
ALTER TABLE cartoon_outputs
  ADD CONSTRAINT cartoon_outputs_edit_job_id_fkey
  FOREIGN KEY (edit_job_id) REFERENCES cartoon_edit_jobs(id) ON DELETE SET NULL;
