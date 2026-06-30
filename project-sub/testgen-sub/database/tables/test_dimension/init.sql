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

INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('A', '测试层级', 1, 'A-测试层级.md', '单元→站级→HTTP→E2E→压测→UAT 金字塔', 'TS-01-DET', 'VS-01-EXACT', 19) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('B', '六站流水线', 2, 'B-六站流水线.md', 'async 主链 S01–S06 + 可靠性法则', 'TS-01-DET', 'VS-01-EXACT', 38) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('C', '业务功能', 3, 'C1/C2/C3/C4', '三端业务+状态机+载荷矩阵', 'TS-05-CHAIN', 'VS-04-CHAIN-OK', 147) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('D', '接口与套壳', 4, 'D-接口与套壳.md', 'HTTP/SSE/套壳/JWT', 'TS-01-DET', 'VS-01-EXACT', 28) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('E', 'Agent智能质量', 5, 'E-Agent智能质量.md', '意图/工具/记忆/Eval/高风险', 'TS-04-SET', 'VS-07-RATE-H', 40) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('F', '非功能', 6, 'F-非功能.md', '性能/可靠性/部署/容量', 'TS-09-LOAD', 'VS-10-SLO-M', 30) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('G', '用户体验', 7, 'G-用户体验.md', '阶段文案/排队/续传/结构化UI', 'TS-03-REP', 'VS-07-RATE-M', 31) ON CONFLICT (dimension_id) DO NOTHING;
INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count) VALUES ('H', '可观测与排障', 8, 'H-可观测与排障.md', '六站指标/日志19项/journey/SLS', 'TS-08-OBS', 'VS-05-PRESENCE', 50) ON CONFLICT (dimension_id) DO NOTHING;
