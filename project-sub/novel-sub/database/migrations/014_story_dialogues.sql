CREATE TABLE IF NOT EXISTS story_dialogues (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  speaker VARCHAR(80) NOT NULL,
  line TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_dialogues_chapter ON story_dialogues (novel_id, chapter_id, sort_order);

ALTER TABLE story_dialogues ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_dialogues ALTER COLUMN updated_at SET DEFAULT NOW();
