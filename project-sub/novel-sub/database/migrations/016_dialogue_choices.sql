CREATE TABLE IF NOT EXISTS story_dialogue_choices (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  dialogue_id INTEGER NOT NULL REFERENCES story_dialogues(id) ON DELETE CASCADE,
  next_dialogue_id INTEGER NOT NULL REFERENCES story_dialogues(id) ON DELETE CASCADE,
  label VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE story_dialogue_choices ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_dialogue_choices ALTER COLUMN updated_at SET DEFAULT NOW();
