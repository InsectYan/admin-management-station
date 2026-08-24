CREATE TABLE IF NOT EXISTS test_dimension (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  dimension_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  sort_order SMALLINT,
  doc TEXT,
  description TEXT,
  default_scheme_id VARCHAR(64),
  default_validation_id VARCHAR(64),
  item_count SMALLINT
);

-- 数据导入（4 条 · 通用维度 S/B/Q/R）
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('S', '结构验证', 1, 'T-结构验证.md', '契约、边界、协议形状。覆盖 Agent / 传统软件 / 前端自动化的结构断言。', 'TS-01-DET', 'VS-02-CONTRACT', 42) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('B', '行为验证', 2, 'T-行为验证.md', '工作流、决策、集成调用。覆盖 Agent 回合、传统业务流程、前端用户路径。', 'TS-05-CHAIN', 'VS-04-CHAIN-OK', 42) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('Q', '质量与风险', 3, 'T-质量与风险.md', '安全合规、体验呈现、评测回归。Agent 风险 / 传统缺陷 / 前端视觉与交互。', 'TS-04-SET', 'VS-07-RATE-H', 11) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('R', '运行保障', 4, 'T-运行保障.md', '可靠性、性能容量、可观测。三类项目共用运行态保障。', 'TS-09-LOAD', 'VS-10-SLO-M', 0) ON CONFLICT (dimension_id) DO NOTHING;
