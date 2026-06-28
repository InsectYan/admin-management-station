CREATE TABLE IF NOT EXISTS test_scheme_enum (
  scheme_id VARCHAR(64) PRIMARY KEY,
  name TEXT,
  description TEXT,
  sort_order SMALLINT
);

INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-01-DET', '确定性单次', '接口、HTTP 码、探针、单次 gate', 1) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-02-BND', '边界/等价类矩阵', '入参边界、状态机转移、多端载荷', 2) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-03-REP', '同用例重复抽样', 'Agent 意图、策略、Pass^k', 3) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-04-SET', '固定样本集批量', 'Golden Eval、咨询 skill 回归、对抗集', 4) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-05-CHAIN', '多步链路串联', '计划全链、课时 commit、E2E chain', 5) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-06-PAIR', '对照/跨端对比', '三端载荷边界、会员 vs 教练同句', 6) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-07-NEG', '异常/对抗专项', '注入、医学越界、恶意 tool', 7) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-08-OBS', '可观测稽核', 'journey、日志 19 项、SLS 字段', 8) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-09-LOAD', '压测/容量', '并发、队列硬顶、多实例幂等', 9) ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO test_scheme_enum (scheme_id, name, description, sort_order) VALUES ('TS-10-MAN', '人工评审', '专家按 rubric 打分', 10) ON CONFLICT (scheme_id) DO NOTHING;
