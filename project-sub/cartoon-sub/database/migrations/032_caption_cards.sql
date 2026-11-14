CREATE TABLE IF NOT EXISTS cartoon_caption_boards (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  shared_prompt TEXT NOT NULL DEFAULT '',
  workflow_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cartoon_caption_cards (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  media_kind VARCHAR(16) NOT NULL DEFAULT 'image',
  stored_name VARCHAR(240) NOT NULL DEFAULT '',
  original_name VARCHAR(240) NOT NULL DEFAULT '',
  extra_prompt TEXT NOT NULL DEFAULT '',
  result_prompt TEXT NOT NULL DEFAULT '',
  shared_extra TEXT NOT NULL DEFAULT '',
  workflow_id INTEGER,
  workflow_name VARCHAR(200) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'idle',
  prompt_id VARCHAR(64),
  phase VARCHAR(32) NOT NULL DEFAULT '',
  progress_value INTEGER NOT NULL DEFAULT 0,
  progress_max INTEGER NOT NULL DEFAULT 0,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  node VARCHAR(64) NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  saved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cartoon_caption_cards_project_id ON cartoon_caption_cards (project_id);
CREATE INDEX IF NOT EXISTS cartoon_caption_cards_status ON cartoon_caption_cards (status);
