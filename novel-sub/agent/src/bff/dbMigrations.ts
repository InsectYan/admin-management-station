import { pool } from "./db.js";

export async function runDbMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL UNIQUE,
      user_id VARCHAR(64),
      creator_id VARCHAR(64),
      project_id VARCHAR(64),
      novel_id VARCHAR(64),
      panel_mode VARCHAR(32),
      title VARCHAR(256),
      status VARCHAR(32) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      role VARCHAR(16) NOT NULL,
      content TEXT,
      panel_mode VARCHAR(32),
      form_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions (user_id, updated_at DESC);
  `);
}
