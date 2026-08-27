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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novels_updated_at ON novels (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_novels_genre ON novels (genre);
CREATE INDEX IF NOT EXISTS idx_novels_progress_status ON novels (progress_status);
