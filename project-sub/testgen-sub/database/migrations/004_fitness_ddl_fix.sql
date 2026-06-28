-- 已有库：对齐 generate-all-tables 注入与可空 scheme 字段

ALTER TABLE test_validation_enum ADD COLUMN IF NOT EXISTS rate_level TEXT;
ALTER TABLE test_validation_enum ADD COLUMN IF NOT EXISTS block_level TEXT;
ALTER TABLE test_validation_enum ADD COLUMN IF NOT EXISTS slo_level TEXT;

ALTER TABLE arch_reference ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE test_item_detail ALTER COLUMN scheme_primary_id DROP NOT NULL;
ALTER TABLE test_item_detail ALTER COLUMN validation_primary_id DROP NOT NULL;
ALTER TABLE test_item_detail ALTER COLUMN expected_observation DROP NOT NULL;

INSERT INTO test_validation_enum (validation_id, name, validation_group, description)
VALUES ('VS-04-CHAIN', '链路全过(别名)', 'DETERMINISTIC', '兼容 prefix_scheme 引用，同 VS-04-CHAIN-OK')
ON CONFLICT (validation_id) DO NOTHING;

-- 部分测试项使用 config 前缀占位（generate 脚本 wildcard），补 enum 别名以便 FK 通过
INSERT INTO config_env_enum (config_env_id, name, domain, default_value) VALUES
  ('TURN_COACH_SUBMIT_', '教练 submit 限流(前缀)', 'guard', '见 TURN_COACH_SUBMIT_MAX'),
  ('TURN_JOB_STALE_', '僵尸 job 回收(前缀)', 'worker', '见 TURN_JOB_STALE_MINUTES'),
  ('DB_CIRCUIT_', 'DB 熔断(前缀)', 'guard', '见 DB_CIRCUIT_FAILURE_THRESHOLD'),
  ('COACH_MEMORY_', '记忆 wake(前缀)', 'memory', '见 COACH_MEMORY_WAKE'),
  ('BFF_HISTORY_', 'BFF 历史轮数(前缀)', 'pipeline', '见 BFF_HISTORY_TURNS'),
  ('KNOWLEDGE_SEARCH_', '知识检索(前缀)', 'pi', '见 KNOWLEDGE_SEARCH_LIMIT')
ON CONFLICT (config_env_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_dimension' AND column_name = 'item_count'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE test_dimension
      ALTER COLUMN item_count TYPE SMALLINT USING NULLIF(item_count, '')::SMALLINT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'test_dimension.item_count cast skipped: %', SQLERRM;
END $$;
