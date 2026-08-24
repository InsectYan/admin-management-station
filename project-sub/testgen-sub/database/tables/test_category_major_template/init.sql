CREATE TABLE IF NOT EXISTS test_category_major_template (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  category_major_id VARCHAR(64) PRIMARY KEY REFERENCES test_category_major(category_major_id),
  template_code VARCHAR(32) NOT NULL REFERENCES config_template_enum(template_code),
  note TEXT
);

-- 数据导入（11 条 · 通用模板映射）
-- 混合 TS 大类 T3 不挂载，用例级按 scheme_primary_id 解析模板
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T1', 'TPL-DET', '契约与结构') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T2', 'TPL-BND', '权限与能力边界') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T4', 'TPL-SET', '决策与规则质量') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T5', 'TPL-DET', '集成与外部依赖') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T6', 'TPL-NEG', '安全与合规') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T7', 'TPL-DET', '接口协议') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T8', 'TPL-REP', '可靠性') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T9', 'TPL-LOAD', '性能与容量') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T10', 'TPL-REP', '体验与呈现') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T11', 'TPL-OBS', '可观测与排障') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('T12', 'TPL-SET', '评测与回归') ON CONFLICT (category_major_id) DO NOTHING;
