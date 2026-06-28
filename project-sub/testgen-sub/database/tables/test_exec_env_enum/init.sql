CREATE TABLE IF NOT EXISTS test_exec_env_enum (
  exec_env_id VARCHAR(32) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO test_exec_env_enum (exec_env_id, name, description, sort_order) VALUES ('EXEC_LOCAL', '仅本地', 'Docker/本机 Runner；不含 AgentRun 拟真', 1) ON CONFLICT (exec_env_id) DO NOTHING;
INSERT INTO test_exec_env_enum (exec_env_id, name, description, sort_order) VALUES ('EXEC_TEST', '仅测试', 'test AgentRun / 预发环境', 2) ON CONFLICT (exec_env_id) DO NOTHING;
INSERT INTO test_exec_env_enum (exec_env_id, name, description, sort_order) VALUES ('EXEC_BOTH', '双环境', '本地与测试环境均可执行', 3) ON CONFLICT (exec_env_id) DO NOTHING;
