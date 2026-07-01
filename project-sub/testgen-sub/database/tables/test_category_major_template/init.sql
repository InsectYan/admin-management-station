CREATE TABLE IF NOT EXISTS test_category_major_template (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  category_major_id VARCHAR(64) PRIMARY KEY REFERENCES test_category_major(category_major_id),
  template_code VARCHAR(32) NOT NULL REFERENCES config_template_enum(template_code),
  note TEXT
);

-- 混合 TS 大类 C1/C2/C3/C4 不挂载，用例级按 scheme_primary_id 解析模板

INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('A1', 'TPL-DET', '单元/契约') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('A2', 'TPL-DET', '站级集成') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('A3', 'TPL-DET', 'HTTP/服务') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('A4', 'TPL-CHAIN', '全栈 E2E') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('A5', 'TPL-LOAD', '压测/运维') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('A6', 'TPL-SET', 'Eval/UAT') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B1', 'TPL-DET', '前端') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B2', 'TPL-DET', '门禁') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B3', 'TPL-DET', '队列') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B4', 'TPL-BND', 'Pipeline') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B5', 'TPL-DET', 'Pi') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B6', 'TPL-CHAIN', '回传') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('B_REL', 'TPL-DET', '可靠性法则') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('D1', 'TPL-DET', '接口正常路径') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('D2', 'TPL-DET', '接口异常/错误码') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('D3', 'TPL-DET', '套壳联调') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('D4', 'TPL-DET', '202 载荷字段') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('D5', 'TPL-DET', 'SSE 事件类型') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E1', 'TPL-SET', '决策与路径') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E2', 'TPL-REP', '工具调用') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E3', 'TPL-REP', '记忆与上下文') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E4', 'TPL-REP', '稳定性') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E5', 'TPL-NEG', '安全与合规') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E6', 'TPL-SET', 'Eval/CI') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E_RISK', 'TPL-NEG', 'Agent高风险清单') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('E_SKILL', 'TPL-SET', 'Skill路由') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('F1', 'TPL-LOAD', '性能') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('F2', 'TPL-LOAD', '可靠性') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('F3', 'TPL-OBS', '可观测概要') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('F4', 'TPL-DET', '部署与环境') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('F5', 'TPL-DET', '症状→测试') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('F6', 'TPL-LOAD', '容量公式') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G1', 'TPL-REP', '等待与阶段反馈') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G2', 'TPL-DET', '排队感知') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G3', 'TPL-DET', '错误友好') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G4', 'TPL-CHAIN', '会话与续传') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G5', 'TPL-BND', '结构化 UI') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G6', 'TPL-PAIR', '三端差异') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G7', 'TPL-CHAIN', '流式与半截内容') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('G8', 'TPL-OBS', '耗时体验指标') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H1', 'TPL-OBS', '六站观测指标') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H2', 'TPL-OBS', 'PRD 日志字段') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H3', 'TPL-OBS', '会员端专用日志') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H4', 'TPL-OBS', '管理端专用日志') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H5', 'TPL-OBS', 'turn_journeys') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H6', 'TPL-OBS', 'SLS/接口监控') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H7', 'TPL-OBS', '排障速查') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES ('H8', 'TPL-OBS', '可观测缺口') ON CONFLICT (category_major_id) DO NOTHING;
