CREATE TABLE IF NOT EXISTS story_intent_shots (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  script_id INTEGER REFERENCES story_scripts(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  scene_order INTEGER NOT NULL DEFAULT 0,
  intent TEXT NOT NULL DEFAULT '',
  dialogue TEXT NOT NULL DEFAULT '',
  emotion VARCHAR(40) NOT NULL DEFAULT '',
  location VARCHAR(120) NOT NULL DEFAULT '',
  character_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_intent_shots_novel ON story_intent_shots (novel_id, sort_order);
