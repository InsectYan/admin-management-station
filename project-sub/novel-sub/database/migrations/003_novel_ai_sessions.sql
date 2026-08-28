-- AI 会话（业务真源在 novel_db，不在 Agent 库）

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
