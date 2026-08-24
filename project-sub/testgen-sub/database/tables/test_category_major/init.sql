CREATE TABLE IF NOT EXISTS test_category_major (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  category_major_id VARCHAR(64) PRIMARY KEY,
  dimension_id VARCHAR(64) REFERENCES test_dimension(dimension_id),
  name TEXT,
  description TEXT,
  item_count TEXT,
  default_scheme_id VARCHAR(64)
);

-- 数据导入（12 条 · 通用大类 T1–T12）
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T1', 'S', '契约与结构', 'Schema/契约/纯函数/静态守卫。Agent: outbox；传统: API contract；前端: 组件 props/类型。', 16, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T2', 'S', '权限与能力边界', '角色围栏、禁止能力、载荷不得项。Agent: scene/role；传统: ACL；前端: 路由守卫/权限指令。', 21, 'TS-02-BND') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T3', 'B', '工作流与状态', '多步任务与状态机。Agent: 计划/课时链路；传统: 审批流；前端: 多页向导。混合 TS（按用例 scheme）。', 30, 'TS-05-CHAIN') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T4', 'B', '决策与规则质量', '意图/规则/策略选择。Agent: skill 路由；传统: 业务规则引擎；前端: 条件渲染策略。', 6, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T5', 'B', '集成与外部依赖', 'Tool/第三方/检索/记忆路径。Agent: tools/wiki；传统: 外部 API/MQ；前端: mock 与网络层。', 6, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T6', 'Q', '安全与合规', '风险阻断、隐私脱敏、注入/医学边界。三类项目共用安全回归。', 11, 'TS-07-NEG') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T7', 'S', '接口协议', 'HTTP/SSE/错误码/探针。Agent: pipeline turn；传统: REST；前端: BFF/MSW。', 5, 'TS-01-DET') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T8', 'R', '可靠性', '【预留】幂等/重试/取消/恢复。Agent: turn 幂等；传统: 事务补偿；前端: 断网重试。', 0, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T9', 'R', '性能与容量', '【预留】延迟/吞吐/压测。Agent: TTFT/C_pi；传统: 接口 SLA；前端: LCP/INP。', 0, 'TS-09-LOAD') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T10', 'Q', '体验与呈现', '【预留】文案/组件渲染/流式体验。Agent: status 文案；传统: 报表展示；前端自动化主阵地。', 0, 'TS-03-REP') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T11', 'R', '可观测与排障', '【预留】日志/trace/journey。Agent: turn_journeys；传统: APM；前端: error boundary/RUM。', 0, 'TS-08-OBS') ON CONFLICT (category_major_id) DO NOTHING;
INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES ('T12', 'Q', '评测与回归', '【预留】Golden/Eval/UAT/视觉回归。Agent: judge；传统: 回归套件；前端: screenshot diff。', 0, 'TS-04-SET') ON CONFLICT (category_major_id) DO NOTHING;
