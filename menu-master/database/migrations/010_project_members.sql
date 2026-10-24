CREATE TABLE IF NOT EXISTS platform_project_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  app_key VARCHAR(32) NOT NULL,
  project_id INTEGER NOT NULL,
  role VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, app_key, project_id)
);
