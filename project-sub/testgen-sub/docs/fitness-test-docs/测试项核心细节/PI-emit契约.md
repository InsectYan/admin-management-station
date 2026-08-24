# PI-emit契约

> 真源：`fitness-agent/.pi`

## B1

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-EMIT-001 | 必填 | coach outbox reply 为空 | validateCoachOutbox / write 拒绝 | P0 | 已有 .pi 单测 |
| PI-EMIT-002 | 载荷 | plan_form 缺 steps/user_id | validateCoachOutbox 拒绝 | P0 | 已有 .pi 单测 |
| PI-EMIT-003 | 载荷 | training_plan 缺正文 | 拒写或校验失败 | P0 | 已有 .pi 单测 |

## B2

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-EMIT-004 | 角色归一 | member 非 text 载荷被归一 | 强制 message_type=text、intent=qa；剥教练载荷 | P0 | 已有 .pi 单测 |
| PI-EMIT-005 | 角色归一 | manager 非 text 载荷被归一 | 强制 message_type=text、intent=ops；无计划/课时 UI | P0 | 已有 .pi 单测 |

## B3

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-EMIT-006 | switch 纠偏 | 工作流意图下不完整 member_switch | 降级 text 或剥离；不得同轮带 plan_form_data | P0 | 已有 .pi 单测 |
| PI-EMIT-010 | 一轮一 UI | 同轮 member_switch + plan_form_data | 互斥剥离；一轮一种 message_type | P0 | 待建 |
| PI-EMIT-011 | 一轮一 UI | text 却声称已发表单 | 不得出现；话术与 message_type 一致 | P0 | 待建 |

## B4

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-EMIT-007 | draft 合并 | 长文 draft sidecar 合并 | outbox 正文由 draft_*.md 合并完整 | P1 | 已有 .pi 单测 |

## B5

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-EMIT-008 | 禁裸写 | 禁止 write outbox.json | Extension/guard 拦截裸写；须走 emit_outbox | P0 | 已有 .pi 单测 |
| PI-EMIT-009 | 缺 outbox 回退 | 回合结束无 outbox | 友好回退文案；不空回合裸结束 | P1 | 已有 .pi 单测 |

## B6

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | 自动化 |
| --- | --- | --- | --- | --- | --- |
| PI-EMIT-012 | memory sanitize | junk memory_ops | sanitizeMemoryOps 拒绝 + 审计 | P1 | 已有 .pi 单测 |

