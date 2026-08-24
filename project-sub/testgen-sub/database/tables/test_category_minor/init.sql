CREATE TABLE IF NOT EXISTS test_category_minor (
  project_code VARCHAR(64) NOT NULL DEFAULT 'fitness-agent',
  category_minor_id VARCHAR(64) PRIMARY KEY,
  category_major_id VARCHAR(64) REFERENCES test_category_major(category_major_id),
  name TEXT,
  sort_order SMALLINT
);

-- 数据导入（28 条 · 通用子类）
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T1_SCHEMA', 'T1', 'Schema/契约', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T1_STATIC', 'T1', '静态守卫', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T2_ROLE', 'T2', '角色围栏', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T2_CAPABILITY', 'T2', '能力边界', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T2_PAYLOAD', 'T2', '载荷不得项', 3) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T3_FLOW', 'T3', '多步工作流', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T3_STATE', 'T3', '状态机', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T3_CONFIRM', 'T3', '确认/两轮', 3) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T4_ROUTE', 'T4', '路由/策略', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T4_INTENT', 'T4', '意图/规则', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T5_TOOL', 'T5', '工具白名单', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T5_MEMORY', 'T5', '记忆/上下文', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T5_RETRIEVAL', 'T5', '检索/知识', 3) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T6_SAFETY', 'T6', '安全阻断', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T6_PRIVACY', 'T6', '隐私脱敏', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T6_BLOCK', 'T6', '高风险清单', 3) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T7_HTTP', 'T7', 'HTTP/探针', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T7_STREAM', 'T7', '流式协议', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T8_IDEM', 'T8', '幂等/重试', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T8_RECOVER', 'T8', '取消/恢复', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T9_LATENCY', 'T9', '延迟/TTFT', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T9_CAPACITY', 'T9', '容量/压测', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T10_COPY', 'T10', '文案/反馈', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T10_UI', 'T10', '组件/视觉', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T11_LOG', 'T11', '日志字段', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T11_TRACE', 'T11', 'Trace/Journey', 2) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T12_GOLDEN', 'T12', 'Golden/Eval', 1) ON CONFLICT (category_minor_id) DO NOTHING;
INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES ('T12_REGRESS', 'T12', '回归/UAT', 2) ON CONFLICT (category_minor_id) DO NOTHING;
