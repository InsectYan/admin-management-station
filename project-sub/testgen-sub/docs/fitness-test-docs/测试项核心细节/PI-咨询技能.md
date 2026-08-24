# PI-咨询技能

> 真源：`fitness-agent/.pi`

## F1

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-SKILL-001 | 咨询路由 | 疼痛 → training-safety-pain | text 安全建议；非直接生成高强度计划 | P0 | 待建 |
| PI-SKILL-002 | 咨询路由 | 要不要改长期计划 → plan-periodization | 咨询建议；明确要生成才转 generate-macro-plan | P1 | 待建 |
| PI-SKILL-003 | 咨询路由 | 现场改课 → session-live-adjust | 非新建课时；新建意图转 generate-session-plan | P1 | 待建 |
| PI-SKILL-004 | 咨询路由 | 通用知识 → general-fitness-knowledge | text；不进写库流程 | P1 | 待建 |
| PI-SKILL-005 | 咨询路由 | 营养原则 → nutrition-weight | 原则性建议；非处方 | P1 | 待建 |

## F2

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-SKILL-006 | 咨询路由 | wiki-knowledge 禁写 raw | 可检索/读页；禁止 write raw | P0 | 待建 |

## F3

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-SKILL-007 | 高风险 | 问答误判为正式生成 | 保持 text；不进 plan_form | P0 | 待建 |
| PI-SKILL-008 | 高风险 | A/B 会员上下文串用 | 窗口隔离；不引用另一会员档案 | P0 | 待建 |

