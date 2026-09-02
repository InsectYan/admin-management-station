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
