# A · 测试层级 — 核心细节表

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| A1-OUTBOX-001 | Pi outbox 契约 | plan_form 缺 user_id / steps | validateCoachOutbox 拒绝 | P0 | B5 | 已有 s05 | — |
| A1-OUTBOX-002 | Pi outbox 契约 | reply 为空 | 拒绝 persist | P0 | PRD §7 载荷 | 已有 s05 | — |
| A1-MEMORY-001 | memory_ops | junk 流水账 op | sanitize 拒绝 + 审计 | P1 | C4 记忆 | 已有 s05 | — |
| A1-GATE-MACRO-001 | gates 纯函数 | 无 Active 计划 + 生成意图 | macroPlan gate → plan_form | P0 | C1 §4.4 | 已有 s04 macro | — |
| A1-GATE-SESSION-001 | gates 纯函数 | 无 active 课时 + 生成课时 | require_form / 澄清 | P0 | C1 §4.5 | 已有 s04 session | — |
| A2-S02-001 | s02 门禁 | 越权 coach_id submit | 403/404，不入队 | P0 | B2、PRD §6 权限 | 已有 s02 | — |
| A2-S02-002 | s02 门禁 | 同 session 在途第二条 | 429 + retry_after_sec | P0 | B2、架构 §6 串行 | 已有 s02 | TURN_SESSION_MAX_INFLIGHT |
| A2-S02-003 | s02 门禁 | 相同 client_turn_id 重试 | 放行幂等 | P0 | 架构 §11 幂等 | 已有 s02 | — |
| A2-S02-004 | s02 门禁 | actor 超窗口刷量 | 429 | P0 | B2 | 已有 s02 | TURN_COACH_SUBMIT_* |
| A2-S03-001 | s03 入队 | 二次 enqueue 同 id | created=false，同 turn_id | P0 | B3、PRD §4.11 | 已有 s03 | — |
| A2-S04-BFF-001 | s04 BFF | 删除第一轮 | 仅待确认删除载荷 | P0 | C1 §4.11 | 已有 s04 bff | — |
| A2-S06-001 | s06 journey | guard 拒绝 | journey 记录拒绝站点 | P1 | H 可观测 | 已有 s06 | turn_journeys |
| A3-HTTP-SUBMIT-001 | HTTP submit | 三端 POST 缺字段 | 400 | P0 | D2 | 部分 | — |
| A3-HTTP-READY-001 | 探针 | 启动 5s 内 GET /ready | 503 → 200 | P1 | F4 | smoke 部分 | READY_DELAY_MS |
| A4-E2E-SMOKE-001 | E2E smoke | 三端各一条 async | 202 + stream final | P0 | PRD §2 三端 | 已有 smoke | LLM Key |
| A4-E2E-CHAIN-001 | E2E chain | 计划生成→修改→删除 | DB 状态与 UI 一致 | P0 | C1 主链 | 已有 chain | — |
| A4-E2E-SESSION-001 | E2E session | require_form→commit→mirror | 课时状态机正确 | P0 | C1 §4.5 | 已有 session | — |
| A4-E2E-RESUME-001 | E2E resume | 跨 session 并行 + SSE 续传 | 不串消息 | P1 | B1 | 已有 resume | — |
| A4-E2E-CONSULT-001 | E2E consultation | 三端咨询 skill | text outbox | P1 | C2/C3 | 已有 consultation | — |
| A5-CAP-001 | 容量压测 | pending 达 MAX | 503 + Retry-After | P2 | 架构 §10 | 待建 | TURN_QUEUE_MAX_PENDING |
| A5-MULTI-001 | 多实例 | 同 client_turn_id 跨实例 | 仅一次 Pi | P1 | 架构 §2 | 待建 | — |
| A5-STALE-001 | 故障 | kill 实例 processing 中 | stale → pending 回收 | P1 | 架构 §11 可恢复 | 待建 | TURN_JOB_STALE_* |
| A6-GOLDEN-001 | Golden eval | inbox+DB → message_type | 快照通过 | P2 | E6 | 待建 | mock LLM |
| A6-SAFETY-001 | 专家 UAT | 膝伤 +「生成练腿」 | 阻断/降级，非直接生成 | P0 | C1 §4.7/4.8 | 人工 | — |
| A6-MEDICAL-001 | medical-boundary | 会员描述胸闷 | 停止训练+就医提示 | P0 | C2 §5.7 | 人工/E2E | — |

**命令**：`npm run test:stations` · `npm run test:e2e` · `npm run typecheck`
