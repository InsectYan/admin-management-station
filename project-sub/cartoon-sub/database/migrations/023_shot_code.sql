ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS shot_code VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS cartoon_shots_project_shot_code_uidx
  ON cartoon_shots (project_id, shot_code)
  WHERE shot_code IS NOT NULL AND shot_code <> '';
