CREATE TABLE IF NOT EXISTS story_scripts (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  variant VARCHAR(32) NOT NULL DEFAULT 'comic',
  chapter_ids JSONB NOT NULL DEFAULT '[]',
  scenes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_scripts_novel ON story_scripts (novel_id);
