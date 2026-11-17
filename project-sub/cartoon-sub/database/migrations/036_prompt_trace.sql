CREATE TABLE IF NOT EXISTS cartoon_prompt_traces (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  shot_id INTEGER NOT NULL,
  part VARCHAR(16) NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(32) NOT NULL DEFAULT '',
  skill VARCHAR(64) NOT NULL DEFAULT '',
  input_text TEXT NOT NULL DEFAULT '',
  output_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cartoon_prompt_traces_shot_idx ON cartoon_prompt_traces (shot_id, step, id);
