-- 010: 直接替换旧 A–H 大类 → 通用 T1–T12
-- 注意：会删除旧 taxonomy 行；请先备份。适用于可重建种子环境。

BEGIN;

-- 先解除用例外键占用：临时挂到将插入的 T1（若表空则跳过更新）
-- 实际重置推荐：DROP/重建或从 init.sql 全量导入。
-- 本迁移给出「可执行」路径：truncate 级联敏感，改为：

CREATE TEMP TABLE _item_remap AS
SELECT item_id,
  CASE
    WHEN item_id LIKE 'PI-EMIT-%' OR item_id LIKE 'PI-STATIC-%' THEN 'T1'
    WHEN item_id LIKE 'PI-SCENE-%' THEN 'T2'
    WHEN item_id LIKE 'PI-MEMB-%' AND category_minor_id = 'C2_MED' THEN 'T6'
    WHEN item_id LIKE 'PI-MEMB-%' THEN 'T2'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_RISK' THEN 'T6'
    WHEN item_id LIKE 'PI-MGR-%' THEN 'T2'
    WHEN item_id LIKE 'PI-SAFE-%' OR item_id LIKE 'PI-THINK-%' THEN 'T6'
    WHEN item_id LIKE 'PI-SKILL-007%' OR item_id LIKE 'PI-SKILL-008%' THEN 'T6'
    WHEN item_id LIKE 'PI-SKILL-%' THEN 'T4'
    WHEN item_id LIKE 'PI-TOOL-%' OR item_id LIKE 'PI-MEM-%' OR item_id LIKE 'PI-WIKI-%' THEN 'T5'
    WHEN item_id LIKE 'PI-HTTP-%' THEN 'T7'
    WHEN item_id LIKE 'PI-DEL-%' OR item_id LIKE 'PI-ARCH-%' OR item_id = 'PI-FOLLOW-002' THEN 'T3'
    WHEN item_id LIKE 'PI-MACRO-%' OR item_id LIKE 'PI-SESS-%' OR item_id LIKE 'PI-SUM-%'
      OR item_id LIKE 'PI-ENTRY-%' OR item_id LIKE 'PI-FOLLOW-%' THEN 'T3'
    ELSE 'T1'
  END AS new_major,
  CASE
    WHEN item_id LIKE 'PI-STATIC-%' THEN 'T1_STATIC'
    WHEN item_id LIKE 'PI-EMIT-%' THEN 'T1_SCHEMA'
    WHEN item_id LIKE 'PI-SCENE-%' THEN 'T2_ROLE'
    WHEN item_id LIKE 'PI-MEMB-%' AND category_minor_id = 'C2_PAYLOAD' THEN 'T2_PAYLOAD'
    WHEN item_id LIKE 'PI-MEMB-%' AND category_minor_id = 'C2_MED' THEN 'T6_SAFETY'
    WHEN item_id LIKE 'PI-MEMB-%' THEN 'T2_CAPABILITY'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_PAYLOAD' THEN 'T2_PAYLOAD'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_PERM' THEN 'T2_ROLE'
    WHEN item_id LIKE 'PI-MGR-%' AND category_minor_id = 'C3_RISK' THEN 'T6_BLOCK'
    WHEN item_id LIKE 'PI-MGR-%' THEN 'T2_CAPABILITY'
    WHEN item_id IN ('PI-MACRO-007','PI-MACRO-008','PI-MACRO-009') THEN 'T3_STATE'
    WHEN item_id LIKE 'PI-DEL-%' OR item_id LIKE 'PI-ARCH-%' OR item_id = 'PI-FOLLOW-002' THEN 'T3_CONFIRM'
    WHEN item_id LIKE 'PI-MACRO-%' OR item_id LIKE 'PI-SESS-%' OR item_id LIKE 'PI-SUM-%'
      OR item_id LIKE 'PI-ENTRY-%' OR item_id LIKE 'PI-FOLLOW-%' THEN 'T3_FLOW'
    WHEN item_id LIKE 'PI-SKILL-007%' OR item_id LIKE 'PI-SKILL-008%' THEN 'T6_BLOCK'
    WHEN item_id LIKE 'PI-SKILL-%' THEN 'T4_ROUTE'
    WHEN item_id LIKE 'PI-SAFE-%' THEN 'T6_SAFETY'
    WHEN item_id LIKE 'PI-THINK-%' THEN 'T6_PRIVACY'
    WHEN item_id LIKE 'PI-TOOL-%' THEN 'T5_TOOL'
    WHEN item_id LIKE 'PI-MEM-%' THEN 'T5_MEMORY'
    WHEN item_id LIKE 'PI-WIKI-%' THEN 'T5_RETRIEVAL'
    WHEN item_id LIKE 'PI-HTTP-%' THEN 'T7_HTTP'
    ELSE 'T1_SCHEMA'
  END AS new_minor
FROM test_item_detail;

-- 先插入新 taxonomy（与旧 ID 并存片刻），再改用例，最后删旧行
DELETE FROM test_category_major_template;

INSERT INTO test_dimension (dimension_id, name, sort_order, doc, description, default_scheme_id, default_validation_id, item_count)
VALUES
  ('S', '结构验证', 1, 'T-结构验证.md', '契约、边界、协议', 'TS-01-DET', 'VS-02-CONTRACT', 0),
  ('B', '行为验证', 2, 'T-行为验证.md', '工作流、决策、集成', 'TS-05-CHAIN', 'VS-04-CHAIN-OK', 0),
  ('Q', '质量与风险', 3, 'T-质量与风险.md', '安全、体验、评测', 'TS-04-SET', 'VS-07-RATE-H', 0),
  ('R', '运行保障', 4, 'T-运行保障.md', '可靠性、性能、可观测', 'TS-09-LOAD', 'VS-10-SLO-M', 0)
ON CONFLICT (dimension_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO test_category_major (category_major_id, dimension_id, name, description, item_count, default_scheme_id) VALUES
  ('T1', 'S', '契约与结构', 'Schema/契约/纯函数/静态守卫', 0, 'TS-01-DET'),
  ('T2', 'S', '权限与能力边界', '角色围栏、禁止能力、载荷不得项', 0, 'TS-02-BND'),
  ('T3', 'B', '工作流与状态', '多步任务与状态机（混合 TS）', 0, 'TS-05-CHAIN'),
  ('T4', 'B', '决策与规则质量', '意图/规则/策略选择', 0, 'TS-04-SET'),
  ('T5', 'B', '集成与外部依赖', 'Tool/第三方/检索/记忆', 0, 'TS-01-DET'),
  ('T6', 'Q', '安全与合规', '风险阻断、隐私、注入边界', 0, 'TS-07-NEG'),
  ('T7', 'S', '接口协议', 'HTTP/SSE/错误码/探针', 0, 'TS-01-DET'),
  ('T8', 'R', '可靠性', '【预留】幂等/重试/取消/恢复', 0, 'TS-03-REP'),
  ('T9', 'R', '性能与容量', '【预留】延迟/吞吐/压测', 0, 'TS-09-LOAD'),
  ('T10', 'Q', '体验与呈现', '【预留】文案/组件/流式体验', 0, 'TS-03-REP'),
  ('T11', 'R', '可观测与排障', '【预留】日志/trace/journey', 0, 'TS-08-OBS'),
  ('T12', 'Q', '评测与回归', '【预留】Golden/Eval/UAT/视觉回归', 0, 'TS-04-SET')
ON CONFLICT (category_major_id) DO UPDATE SET dimension_id = EXCLUDED.dimension_id, name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO test_category_minor (category_minor_id, category_major_id, name, sort_order) VALUES
  ('T1_SCHEMA', 'T1', 'Schema/契约', 1),
  ('T1_STATIC', 'T1', '静态守卫', 2),
  ('T2_ROLE', 'T2', '角色围栏', 1),
  ('T2_CAPABILITY', 'T2', '能力边界', 2),
  ('T2_PAYLOAD', 'T2', '载荷不得项', 3),
  ('T3_FLOW', 'T3', '多步工作流', 1),
  ('T3_STATE', 'T3', '状态机', 2),
  ('T3_CONFIRM', 'T3', '确认/两轮', 3),
  ('T4_ROUTE', 'T4', '路由/策略', 1),
  ('T4_INTENT', 'T4', '意图/规则', 2),
  ('T5_TOOL', 'T5', '工具白名单', 1),
  ('T5_MEMORY', 'T5', '记忆/上下文', 2),
  ('T5_RETRIEVAL', 'T5', '检索/知识', 3),
  ('T6_SAFETY', 'T6', '安全阻断', 1),
  ('T6_PRIVACY', 'T6', '隐私脱敏', 2),
  ('T6_BLOCK', 'T6', '高风险清单', 3),
  ('T7_HTTP', 'T7', 'HTTP/探针', 1),
  ('T7_STREAM', 'T7', '流式协议', 2),
  ('T8_IDEM', 'T8', '幂等/重试', 1),
  ('T8_RECOVER', 'T8', '取消/恢复', 2),
  ('T9_LATENCY', 'T9', '延迟/TTFT', 1),
  ('T9_CAPACITY', 'T9', '容量/压测', 2),
  ('T10_COPY', 'T10', '文案/反馈', 1),
  ('T10_UI', 'T10', '组件/视觉', 2),
  ('T11_LOG', 'T11', '日志字段', 1),
  ('T11_TRACE', 'T11', 'Trace/Journey', 2),
  ('T12_GOLDEN', 'T12', 'Golden/Eval', 1),
  ('T12_REGRESS', 'T12', '回归/UAT', 2)
ON CONFLICT (category_minor_id) DO UPDATE SET category_major_id = EXCLUDED.category_major_id, name = EXCLUDED.name;

UPDATE test_item_detail t
SET
  category_major_id = r.new_major,
  category_minor_id = r.new_minor,
  dimension_id = CASE r.new_major
    WHEN 'T1' THEN 'S' WHEN 'T2' THEN 'S' WHEN 'T7' THEN 'S'
    WHEN 'T3' THEN 'B' WHEN 'T4' THEN 'B' WHEN 'T5' THEN 'B'
    WHEN 'T6' THEN 'Q' WHEN 'T10' THEN 'Q' WHEN 'T12' THEN 'Q'
    ELSE 'R' END
FROM _item_remap r
WHERE t.item_id = r.item_id;

-- 删除旧大类/子类/维度（仅当无残留引用）
DELETE FROM test_category_minor WHERE category_major_id !~ '^T[0-9]+$';
DELETE FROM test_category_major_template WHERE category_major_id !~ '^T[0-9]+$';
DELETE FROM test_category_major WHERE category_major_id !~ '^T[0-9]+$';
DELETE FROM test_dimension WHERE dimension_id NOT IN ('S', 'B', 'Q', 'R');

-- 模板映射（T3 混合不挂）
INSERT INTO test_category_major_template (category_major_id, template_code, note) VALUES
  ('T1', 'TPL-DET', '契约与结构'),
  ('T2', 'TPL-BND', '权限与能力边界'),
  ('T4', 'TPL-SET', '决策与规则质量'),
  ('T5', 'TPL-DET', '集成与外部依赖'),
  ('T6', 'TPL-NEG', '安全与合规'),
  ('T7', 'TPL-DET', '接口协议'),
  ('T8', 'TPL-REP', '可靠性'),
  ('T9', 'TPL-LOAD', '性能与容量'),
  ('T10', 'TPL-REP', '体验与呈现'),
  ('T11', 'TPL-OBS', '可观测与排障'),
  ('T12', 'TPL-SET', '评测与回归')
ON CONFLICT (category_major_id) DO UPDATE SET template_code = EXCLUDED.template_code;

UPDATE test_category_major m SET item_count = COALESCE((
  SELECT COUNT(*)::text FROM test_item_detail i WHERE i.category_major_id = m.category_major_id AND i.is_active IS DISTINCT FROM FALSE
), '0');

COMMIT;
