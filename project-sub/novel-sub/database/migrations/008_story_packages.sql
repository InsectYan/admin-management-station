ALTER TABLE novels ADD COLUMN IF NOT EXISTS project_kind VARCHAR(32) NOT NULL DEFAULT 'novel';

CREATE TABLE IF NOT EXISTS story_packages (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  package_id VARCHAR(64) NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, version)
);

CREATE INDEX IF NOT EXISTS idx_story_packages_novel
  ON story_packages (novel_id, version DESC);

CREATE TABLE IF NOT EXISTS novel_terms (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]',
  definition TEXT,
  category VARCHAR(32) NOT NULL DEFAULT 'term',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novel_terms_novel ON novel_terms (novel_id);

CREATE TABLE IF NOT EXISTS consistency_issues (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id VARCHAR(80) NOT NULL DEFAULT '',
  rule VARCHAR(64) NOT NULL,
  level VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'rule',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consistency_issues_novel
  ON consistency_issues (novel_id, status);

CREATE TABLE IF NOT EXISTS story_promotions (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  video_project_id VARCHAR(64) NOT NULL,
  shot_id VARCHAR(64) NOT NULL,
  chapter_id VARCHAR(80) NOT NULL,
  package_version INTEGER,
  field VARCHAR(32) NOT NULL DEFAULT 'dialogue',
  before_text TEXT NOT NULL,
  after_text TEXT NOT NULL,
  operator_id VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_promotions_novel
  ON story_promotions (novel_id, status);

CREATE TABLE IF NOT EXISTS story_downstreams (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  package_id VARCHAR(64) NOT NULL,
  version INTEGER NOT NULL,
  video_project_id VARCHAR(64) NOT NULL,
  content_type VARCHAR(32) NOT NULL DEFAULT 'ai_comic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_project_id)
);
