# F · 非功能 — 核心细节表

## F1 · 性能

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 指标 | 优先级 | 关联配置 |
|-----------|------|--------------|-------------|--------|----------|
| F1-SUB-001 | submit 延迟 | 仅入队 | p99 百 ms 级 | P1 | — |
| F1-PLAN-001 | 计划生成 | 教练复杂 turn | 60–180s completed | P1 | LLM |
| F1-TTFT-001 | 首次反馈 | status/thinking 出现 | PRD §4.12 首次反馈时间 | P1 | stream_events |
| F1-CONC-001 | 并发 Pi | N×W 会话 | C_pi=min(N×W,C_llm) | P2 | COACH_TURN_WORKER_CONCURRENCY |
| F1-QUEUE-001 | 排队估算 | pending/C_pi×T_avg | queue_meta 合理 | P2 | TURN_QUEUE_AVG_TURN_SEC |
| F1-LONG-001 | 长稳 72h | 持续负载 | 内存/连接池稳定 | P3 | — |

## F2 · 可靠性

| 测试项 ID | 子类 | 测试核心细节 | 预期 | 优先级 | 关联配置 |
|-----------|------|--------------|------|--------|----------|
| F2-MULTI-001 | 多实例 | submit≠claim 实例 | RDS 一致 | P1 | — |
| F2-STALE-001 | 僵尸任务 | processing 超时 | reclaim→pending | P1 | TURN_JOB_STALE_* |
| F2-DRAIN-001 | 优雅停机 | SIGTERM | in-flight drain | P1 | SHUTDOWN_GRACE_MS |
| F2-POOL-001 | RDS 连接 | N×PG_POOL_MAX | ≤ RDS×0.7 | P1 | PG_POOL_MAX |
| F2-NAS-001 | NAS 写 | inbox/outbox | UID/GID 正确 | P1 | WORKSPACES_ROOT |

## F3 · 可观测（概要，详见 H）

| 测试项 ID | 子类 | 测试核心细节 | 预期 | 优先级 |
|-----------|------|--------------|------|--------|
| F3-LOG-001 | SLS | http.request.end | api_label_zh 可聚合 | P1 |
| F3-TRACE-001 | OTel | OTEL_ENABLED=1 | submit→Worker 续链 | P2 |
| F3-GAP-001 | 缺口 | token 成本 | 应用内不可见（已知） | P3 |
| F3-GAP-002 | 缺口 | Prometheus 告警 | 未实现 | P3 |

## F4 · 部署与环境

| 测试项 ID | 子类 | 测试核心细节 | 预期 | 优先级 |
|-----------|------|--------------|------|--------|
| F4-LOCAL-001 | local | fitness local 全栈 | :5173/:3001/:5433 | P0 |
| F4-RESET-001 | local:reset | 空 volume | init 种子+migrate | P1 |
| F4-CLEAN-001 | local:clean | 清运行时 | 保留种子人物 | P1 |
| F4-AR-SMOKE-001 | AgentRun | smoke.sh | health+三端一条 | P0 |
| F4-AR-READY-001 | AgentRun | /ready 5s 后 | 200 | P1 |
| F4-MODE-001 | DEPLOY_MODE | local vs agentrun | 配置隔离 | P0 |

## F5 · 症状 → 测试 / 调参（架构图 §10 + pi-arch §6）

| 症状 | 先查 | 测试项 ID | 可调 env / 动作 |
|------|------|-----------|-----------------|
| 排队久 | turn_jobs pending | F5-SYM-001 | 加 N、W；TURN_QUEUE_* |
| 503 系统繁忙 | pending≥max | F5-SYM-002 | TURN_QUEUE_MAX_PENDING |
| 503 熔断 | circuit open | F5-SYM-003 | DB_CIRCUIT_* |
| LLM 429/failed | error_text | F5-SYM-004 | 降 W；TURN_JOB_RETRY_* |
| RDS 连接耗尽 | 连接数 | F5-SYM-005 | PG_POOL_MAX；降 N |
| 前台 p99 慢 | BFF vs Pi | F5-SYM-006 | api/worker 分池（暂缓） |
| 冷启动误接流 | /ready | F5-SYM-007 | READY_DELAY_MS |
| stream 断 | 网关 SSE 超时 | F5-SYM-008 | ≥300s |
| 前端卡顿 | BFF/Worker 争 CPU | F5-SYM-009 | 升规格或调 W |

## F6 · 容量公式验证

| 公式 | 测试项 ID | 验证方法 |
|------|-----------|----------|
| C_pi = min(N×W, C_llm) | F6-CAP-001 | 压测饱和点 |
| N×PG_POOL_MAX ≤ RDS×0.7 | F6-CAP-002 | RDS 连接监控 |
| T_queue ≈ pending/C_pi×T_avg | F6-CAP-003 | queue_meta 估算 |
