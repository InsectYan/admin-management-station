ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS first_frame_path VARCHAR(500);
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS manual_frame_path VARCHAR(500);
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS stage_notes JSONB;
ALTER TABLE cartoon_shots ADD COLUMN IF NOT EXISTS dialogue_lines JSONB;
