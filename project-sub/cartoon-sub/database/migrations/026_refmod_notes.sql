ALTER TABLE cartoon_refmods ADD COLUMN IF NOT EXISTS image_notes TEXT NOT NULL DEFAULT '{}';
ALTER TABLE cartoon_shot_bindings ADD COLUMN IF NOT EXISTS refmod_files TEXT;
