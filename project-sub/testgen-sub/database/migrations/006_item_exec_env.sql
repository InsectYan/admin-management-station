-- 测试项：可执行环境 + 环境分层

CREATE TABLE IF NOT EXISTS test_exec_env_enum (
  exec_env_id VARCHAR(32) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO test_exec_env_enum (exec_env_id, name, description, sort_order) VALUES
  ('EXEC_LOCAL', '仅本地', 'Docker/本机 Runner；不含 AgentRun 拟真', 1),
  ('EXEC_TEST', '仅测试', 'test AgentRun / 预发环境', 2),
  ('EXEC_BOTH', '双环境', '本地与测试环境均可执行', 3)
ON CONFLICT (exec_env_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS test_env_tier_enum (
  env_tier_id VARCHAR(32) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO test_env_tier_enum (env_tier_id, name, description, sort_order) VALUES
  ('TIER_ANY', '随处等价', '站测/纯函数；CI、本地、测试环境结果一致', 1),
  ('TIER_LOCAL', '本地模拟', 'Docker/脚本可模拟；不必占用 test AgentRun', 2),
  ('TIER_STAGING', '测试预发', '需 AgentRun/RDS/NAS/SLS 等拟真环境', 3),
  ('TIER_PROD_ONLY', '生产/人工', '仅生产验证或专家 UAT，自动化受限', 4)
ON CONFLICT (env_tier_id) DO NOTHING;

ALTER TABLE test_item_detail
  ADD COLUMN IF NOT EXISTS exec_env_id VARCHAR(32) NOT NULL DEFAULT 'EXEC_BOTH'
    REFERENCES test_exec_env_enum(exec_env_id),
  ADD COLUMN IF NOT EXISTS env_tier_id VARCHAR(32) NOT NULL DEFAULT 'TIER_STAGING'
    REFERENCES test_env_tier_enum(env_tier_id);

CREATE INDEX IF NOT EXISTS idx_test_item_exec_env ON test_item_detail(exec_env_id);
CREATE INDEX IF NOT EXISTS idx_test_item_env_tier ON test_item_detail(env_tier_id);
