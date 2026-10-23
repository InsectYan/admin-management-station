CREATE TABLE IF NOT EXISTS ops_compliance_rules (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_compliance_state (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ops_compliance_state ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE ops_compliance_state ALTER COLUMN updated_at SET DEFAULT NOW();

INSERT INTO ops_compliance_state (id, version, created_at, updated_at)
VALUES (1, 1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
