CREATE TABLE IF NOT EXISTS cartoon_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  source_novel_id VARCHAR(64),
  visual_style VARCHAR(64) NOT NULL DEFAULT '',
  summary TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  template_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cartoon_projects ADD COLUMN IF NOT EXISTS template_id VARCHAR(64);

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

CREATE TABLE IF NOT EXISTS cartoon_copy_blocks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cartoon_copy_blocks DROP CONSTRAINT IF EXISTS cartoon_copy_blocks_project_id_fkey;
ALTER TABLE cartoon_copy_blocks
  ADD CONSTRAINT cartoon_copy_blocks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES cartoon_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

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

CREATE TABLE IF NOT EXISTS cartoon_pipeline_nodes (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(32) NOT NULL,
  node_key VARCHAR(64) NOT NULL,
  title VARCHAR(80) NOT NULL DEFAULT '',
  kind VARCHAR(16) NOT NULL DEFAULT 'custom',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  skill_name VARCHAR(80) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, node_key)
);

CREATE TABLE IF NOT EXISTS cartoon_agent_configs (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(32) NOT NULL,
  role VARCHAR(32) NOT NULL,
  input_text TEXT NOT NULL DEFAULT '',
  output_text TEXT NOT NULL DEFAULT '',
  model_profile VARCHAR(64) NOT NULL DEFAULT '',
  rule_text TEXT NOT NULL DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 1,
  human_confirm BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, role)
);

CREATE TABLE IF NOT EXISTS cartoon_batches (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  total INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  breakpoint_index INTEGER NOT NULL DEFAULT 0,
  rule_snapshot JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cartoon_batches ADD COLUMN IF NOT EXISTS rule_snapshot JSONB NOT NULL DEFAULT '[]';
ALTER TABLE cartoon_assets ADD COLUMN IF NOT EXISTS reference_path VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE cartoon_assets ADD COLUMN IF NOT EXISTS voice_key VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE cartoon_assets ADD COLUMN IF NOT EXISTS speech_rate VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE cartoon_assets ADD COLUMN IF NOT EXISTS emotion VARCHAR(64) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS cartoon_rules (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(32) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  cost_cap INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_reviews (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  video_task_id INTEGER,
  decision VARCHAR(16) NOT NULL,
  node VARCHAR(32) NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  issues TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_type_panels (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  conflict TEXT NOT NULL DEFAULT '',
  twist TEXT NOT NULL DEFAULT '',
  rhythm TEXT NOT NULL DEFAULT '',
  branches TEXT NOT NULL DEFAULT '',
  product_note TEXT NOT NULL DEFAULT '',
  selling_points TEXT NOT NULL DEFAULT '',
  comparison TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_batch_items (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES cartoon_batches(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(200) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
