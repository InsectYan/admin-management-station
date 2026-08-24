-- 用例维度「最新主执行」指针（单用例 launch / 计划批量均在创建主 run 时写回）
-- 语义：该 item 最近一次主方案 ft_run.id；辅方案子 run 不写此列
-- 不回填历史；旧数据待下次执行后才有值

ALTER TABLE test_item_detail
  ADD COLUMN IF NOT EXISTS latest_ft_run_id INT;

CREATE INDEX IF NOT EXISTS idx_test_item_latest_ft_run
  ON test_item_detail(latest_ft_run_id)
  WHERE latest_ft_run_id IS NOT NULL;

COMMENT ON COLUMN test_item_detail.latest_ft_run_id IS
  '用例全局最新主执行 ft_run.id（非计划结果绑定；与 test_plan_item_result.ft_run_id 双轨）';
