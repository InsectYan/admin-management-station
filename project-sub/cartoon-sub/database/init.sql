CREATE TABLE IF NOT EXISTS cartoon_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  source_novel_id VARCHAR(64),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_outputs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES cartoon_tasks(id) ON DELETE CASCADE,
  file_path VARCHAR(500),
  media_kind VARCHAR(32) NOT NULL DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
