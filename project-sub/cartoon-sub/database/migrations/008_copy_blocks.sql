CREATE TABLE IF NOT EXISTS cartoon_copy_blocks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES cartoon_projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cartoon_copy_blocks DROP CONSTRAINT IF EXISTS cartoon_copy_blocks_project_id_fkey;
ALTER TABLE cartoon_copy_blocks
  ADD CONSTRAINT cartoon_copy_blocks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES cartoon_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
