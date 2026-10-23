-- novel-sub 数据库初始化

CREATE TABLE IF NOT EXISTS novels (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  cover_url VARCHAR(500),
  genre VARCHAR(50),
  novel_type VARCHAR(50),
  progress_status VARCHAR(20) DEFAULT 'ongoing',
  progress_percent SMALLINT DEFAULT 0,
  summary TEXT,
  creative_intent TEXT,
  story_overview TEXT,
  target_audience VARCHAR(200),
  update_cadence VARCHAR(50),
  setting_json JSONB DEFAULT '{}',
  author_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'draft',
  genre_category_id INTEGER,
  genre_subcategory_id INTEGER,
  length_id INTEGER,
  audience_id INTEGER,
  update_pace_id INTEGER,
  style_preset VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novels_updated_at ON novels (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_novels_genre ON novels (genre);
CREATE INDEX IF NOT EXISTS idx_novels_progress_status ON novels (progress_status);

CREATE TABLE IF NOT EXISTS genre_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS genre_subcategories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER NOT NULL REFERENCES genre_categories(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_genre_subcategories_parent ON genre_subcategories (parent_id);

CREATE TABLE IF NOT EXISTS theme_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  heat_level SMALLINT NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_categories_heat ON theme_categories (heat_level DESC, sort_order);

CREATE TABLE IF NOT EXISTS audience_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS length_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  min_words INTEGER NOT NULL DEFAULT 0,
  max_words INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS update_paces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS novel_themes (
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES theme_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (novel_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_novel_themes_theme ON novel_themes (theme_id);

CREATE TABLE IF NOT EXISTS novel_ai_sessions (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
  feature_key VARCHAR(40) NOT NULL,
  title VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  bound_context_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novel_ai_sessions_novel_feature
  ON novel_ai_sessions (novel_id, feature_key, status);

CREATE TABLE IF NOT EXISTS novel_ai_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES novel_ai_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT,
  target_fields_json JSONB DEFAULT '[]',
  patch_json JSONB DEFAULT '{}',
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  trace_id VARCHAR(80),
  scene VARCHAR(80),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novel_ai_messages_session
  ON novel_ai_messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS novel_chapter_bodies (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id VARCHAR(80) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (novel_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_novel_chapter_bodies_novel
  ON novel_chapter_bodies (novel_id);

CREATE TABLE IF NOT EXISTS novel_anomaly_reports (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL DEFAULT 'rough',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  summary TEXT,
  issue_count INTEGER NOT NULL DEFAULT 0,
  word_floor INTEGER NOT NULL DEFAULT 0,
  findings_json JSONB NOT NULL DEFAULT '[]',
  tasks_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novel_anomaly_reports_novel
  ON novel_anomaly_reports (novel_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS plotlines (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'main',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  plant_chapter_id VARCHAR(80) NOT NULL DEFAULT '',
  payoff_chapter_id VARCHAR(80) NOT NULL DEFAULT '',
  events JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plotlines_novel ON plotlines (novel_id);

CREATE TABLE IF NOT EXISTS story_scripts (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  variant VARCHAR(32) NOT NULL DEFAULT 'comic',
  chapter_ids JSONB NOT NULL DEFAULT '[]',
  scenes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_scripts_novel ON story_scripts (novel_id);

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

CREATE TABLE IF NOT EXISTS story_members (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  username VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, username)
);

CREATE TABLE IF NOT EXISTS story_chapter_locks (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id VARCHAR(80) NOT NULL,
  holder VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (novel_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS story_activity (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  actor VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  chapter_id VARCHAR(80) NOT NULL DEFAULT '',
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE story_members ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_members ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE story_chapter_locks ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_chapter_locks ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE story_activity ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_activity ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS story_dialogues (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  speaker VARCHAR(80) NOT NULL,
  line TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_dialogues_chapter ON story_dialogues (novel_id, chapter_id, sort_order);

ALTER TABLE story_dialogues ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_dialogues ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS story_snapshots (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE story_snapshots ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE story_snapshots ALTER COLUMN updated_at SET DEFAULT NOW();

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
