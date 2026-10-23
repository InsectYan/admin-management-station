CREATE TABLE IF NOT EXISTS ops_model_gates (
  id SERIAL PRIMARY KEY,
  catalog VARCHAR(16) NOT NULL,
  profile_id VARCHAR(80) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog, profile_id)
);

ALTER TABLE ops_model_gates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE ops_model_gates ALTER COLUMN updated_at SET DEFAULT NOW();
