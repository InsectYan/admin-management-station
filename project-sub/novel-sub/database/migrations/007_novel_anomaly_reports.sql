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
