CREATE TABLE IF NOT EXISTS test_env_tier_enum (
  env_tier_id VARCHAR(32) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO test_env_tier_enum (env_tier_id, name, description, sort_order) VALUES ('TIER_ANY', '随处等价', '站测/纯函数；CI、本地、测试环境结果一致', 1) ON CONFLICT (env_tier_id) DO NOTHING;
INSERT INTO test_env_tier_enum (env_tier_id, name, description, sort_order) VALUES ('TIER_LOCAL', '本地模拟', 'Docker/脚本可模拟；不必占用 test AgentRun', 2) ON CONFLICT (env_tier_id) DO NOTHING;
INSERT INTO test_env_tier_enum (env_tier_id, name, description, sort_order) VALUES ('TIER_STAGING', '测试预发', '需 AgentRun/RDS/NAS/SLS 等拟真环境', 3) ON CONFLICT (env_tier_id) DO NOTHING;
INSERT INTO test_env_tier_enum (env_tier_id, name, description, sort_order) VALUES ('TIER_PROD_ONLY', '生产/人工', '仅生产验证或专家 UAT，自动化受限', 4) ON CONFLICT (env_tier_id) DO NOTHING;
