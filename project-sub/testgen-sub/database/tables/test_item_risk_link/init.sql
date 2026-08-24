CREATE TABLE IF NOT EXISTS test_item_risk_link (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  link_id VARCHAR(16) PRIMARY KEY,
  risk_item_id VARCHAR(64) NOT NULL REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  main_item_id VARCHAR(64) NOT NULL REFERENCES test_item_detail(item_id) ON DELETE CASCADE,
  relation_type_id VARCHAR(16) NOT NULL REFERENCES test_item_relation_type_enum(relation_type_id),
  risk_category VARCHAR(16) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_bidirectional BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  UNIQUE (risk_item_id, main_item_id, relation_type_id)
);
CREATE INDEX IF NOT EXISTS idx_risk_link_risk ON test_item_risk_link(risk_item_id);
CREATE INDEX IF NOT EXISTS idx_risk_link_main ON test_item_risk_link(main_item_id);

-- 数据导入（0 条 · 仅 .pi 重建后清空）
