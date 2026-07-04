-- 辅方案串联执行：子 run 关联父 run
ALTER TABLE ft_run ADD COLUMN IF NOT EXISTS parent_run_id INT REFERENCES ft_run(id) ON DELETE CASCADE;
ALTER TABLE ft_run ADD COLUMN IF NOT EXISTS sequence_index INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ft_run_parent ON ft_run(parent_run_id);

COMMENT ON COLUMN ft_run.parent_run_id IS '辅方案 run 指向主方案 run；主方案为 NULL';
COMMENT ON COLUMN ft_run.sequence_index IS '0=主方案，1=辅方案（串联顺序）';
