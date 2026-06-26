-- novel_db 初始化（app_key=novel）
CREATE TABLE IF NOT EXISTS novels (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author_name VARCHAR(128) NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  progress INT NOT NULL DEFAULT 0,
  word_count INT NOT NULL DEFAULT 0,
  plot JSONB,
  draft JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novel_title ON novels (title);
CREATE INDEX IF NOT EXISTS idx_novel_status ON novels (status);
