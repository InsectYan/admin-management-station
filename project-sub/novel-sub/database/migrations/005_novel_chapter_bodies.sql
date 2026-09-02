-- 章节正文独立存储：列表/设定接口不带正文，只在进入单章时按章拉取

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
