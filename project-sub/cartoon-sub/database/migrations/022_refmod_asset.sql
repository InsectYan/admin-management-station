ALTER TABLE cartoon_refmods ADD COLUMN IF NOT EXISTS asset_id INTEGER REFERENCES cartoon_assets(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS cartoon_refmods_asset_id_key ON cartoon_refmods (asset_id) WHERE asset_id IS NOT NULL;
