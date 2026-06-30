CREATE TABLE IF NOT EXISTS test_priority_enum (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  priority_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  sort_order SMALLINT
);

INSERT INTO test_priority_enum (priority_id, name, sort_order) VALUES ('P0', '阻塞发版', 0) ON CONFLICT (priority_id) DO NOTHING;
INSERT INTO test_priority_enum (priority_id, name, sort_order) VALUES ('P1', '高', 1) ON CONFLICT (priority_id) DO NOTHING;
INSERT INTO test_priority_enum (priority_id, name, sort_order) VALUES ('P2', '中', 2) ON CONFLICT (priority_id) DO NOTHING;
INSERT INTO test_priority_enum (priority_id, name, sort_order) VALUES ('P3', '低', 3) ON CONFLICT (priority_id) DO NOTHING;
