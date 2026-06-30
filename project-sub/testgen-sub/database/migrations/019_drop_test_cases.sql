-- 废弃 test_cases，生成结果统一落 test_item_detail

ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_case_id_fkey;
ALTER TABLE test_runs DROP COLUMN IF EXISTS case_id;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS item_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_test_runs_item ON test_runs (item_id);

DROP TABLE IF EXISTS test_cases CASCADE;
