ALTER TABLE cartoon_projects ADD COLUMN IF NOT EXISTS topics TEXT NOT NULL DEFAULT '[]';

UPDATE cartoon_projects
SET topics = '["av"]'
WHERE av_mode = true
  AND (topics IS NULL OR topics = '' OR topics = '[]');
