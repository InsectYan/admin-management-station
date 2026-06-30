-- test_item_detail 补 project_name 展示字段
ALTER TABLE test_item_detail
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(255) NOT NULL DEFAULT 'Fitness Agent 测试项目';

UPDATE test_item_detail t
SET project_name = tp.project_name
FROM test_project tp
WHERE t.project_code = tp.project_code
  AND (t.project_name IS NULL OR t.project_name = 'Fitness Agent 测试项目');
