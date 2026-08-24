CREATE TABLE IF NOT EXISTS test_item_prd_ref_link (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  link_id VARCHAR(16) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES test_item_detail(item_id) ON DELETE CASCADE, prd_ref_id VARCHAR(32) NOT NULL REFERENCES prd_reference(prd_ref_id)
);
CREATE INDEX IF NOT EXISTS idx_test_item_prd_ref_link_item ON test_item_prd_ref_link(item_id);

-- 数据导入（0 条 · 仅 .pi 重建后清空）
