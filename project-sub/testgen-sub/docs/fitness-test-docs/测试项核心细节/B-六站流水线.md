# B · 六站流水线 — 核心细节表

> **架构图对照**：前台登记→门禁→排队→Worker→Pi→SSE；同 session 串行、跨 session 并行；Pi 不能自己抢队列、不能直接写业务表。

## B1 · ① 前端（s01）

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| B1-IDEM-001 | 幂等键 | 每条消息唯一 client_turn_id | 重试同 id | P0 | 架构 §11 | 代码审查 | — |
| B1-SSE-001 | SSE 解析 | status/thinking/message/done | UI 正确渲染 | P0 | B6 | E2E 部分 | — |
| B1-STREAM-001 | 防串流 | 切 session 后回调 | shouldApplyStream=false 不写 UI | P0 | 架构 §6 | E2E resume | — |
| B1-RESUME-001 | 断线续传 | 切回 in-flight session | resumeStream 回放 stream_events | P1 | pi-arch §2.1 | E2E resume | — |
| B1-LOADING-001 | 同 session | in-flight 时发送按钮 | disabled + 服务端 429 双保险 | P0 | PRD §4.12 | 部分 | — |
| B1-QUEUE-UX-001 | queue_meta | pending≥WARN | 展示排队提示 | P1 | B2 软限 | E2E 部分 | TURN_QUEUE_WARN_PENDING |
| **B1-OBS-001** | **站级观测** | **SSE 订流成功率** | submit 后 stream 连接成功 | P1 | **架构图 §5 站①** | 待建 | stream 错误率 |

## B2 · ② 门禁（s02）— P0

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| B2-KEY-001 | Internal Key | 缺/错 Key | 401，不调 LLM | P0 | D3 | agentrun 启动校验 | INTERNAL_API_KEY |
| B2-CIRCUIT-001 | DB 熔断 | RDS 连续失败 | 503 + circuit_breaker | P0 | 架构 §10 | 待建 | DB_CIRCUIT_* |
| B2-OWN-001 | session 归属 | 非己 session | 403/404 | P0 | PRD §6 权限 | 已有 s02 | — |
| B2-EMPTY-001 | 入参 | 空白 message | 400 | P0 | — | 已有 s02 | — |
| B2-LEN-001 | 入参 | 超 8000 字符 | 400 | P2 | — | 待建 | TURN_MESSAGE_MAX_LENGTH |
| B2-INFLIGHT-001 | 在途 | pending/processing 第二条 | 429 | P0 | 架构 §6 | 已有 s02 | TURN_SESSION_MAX_INFLIGHT |
| B2-IDEM-001 | 幂等豁免 | 同 client_turn_id 重试 | 202 放行 | P0 | PRD §4.11 | 已有 s02 | — |
| B2-RATE-001 | actor 限流 | 窗口内第 11 次 | 429 | P0 | — | 已有 s02 | TURN_COACH_SUBMIT_* |
| B2-DUP-001 | 重复文案 | 5s 内相同 message | 429 | P1 | — | 已有 s02 | TURN_DUPLICATE_MESSAGE_MS |
| B2-QUEUE-HARD-001 | 全店硬顶 | pending≥max | 503 | P0 | 架构 §10 | 待建 | TURN_QUEUE_MAX_PENDING |
| B2-JOURNEY-001 | 可观测 | guard 通过/拒 | recordSubmitGuardOutcome | P1 | H | s06 部分 | turn_journeys |
| **B2-OBS-001** | **站级观测** | **门禁拒绝率** | 非法请求不消耗 LLM | P1 | **架构图 §5 站②** | SLS 聚合 | api_label_zh |

## B3 · ③ 排队与 Worker（s03）

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| B3-ENQ-001 | 入队 | 合法 submit | turn_jobs pending + 202 | P0 | 架构 §4 | 已有 s03 | — |
| B3-IDEM-001 | 幂等 | 同 session+client_turn_id | 同一 turn_id | P0 | PRD §4.11 | 已有 s03 | — |
| B3-CLAIM-001 | 抢单 | SKIP LOCKED | 全店最早 pending | P0 | 架构 §2 | 代码+待压测 | COACH_TURN_POLL_MS |
| B3-CANCEL-001 | cancel | pending 划号 | cancelled 后可再 submit | P0 | 架构 §11 可取消 | s02 部分 | — |
| B3-RETRY-001 | 重试 | LLM 429 | failTurnJobWithRetry→pending | P1 | 架构 §10 | s02 部分 | TURN_JOB_RETRY_* |
| B3-STALE-001 | 僵尸回收 | processing 超时 | 回 pending | P1 | 架构 §11 可恢复 | 待建 | TURN_JOB_STALE_MINUTES |
| B3-W-001 | 并发 W | 单实例超 W 路 | 不超过 W 个 processing Pi | P1 | 架构 §2 | 待压测 | COACH_TURN_WORKER_CONCURRENCY |
| B3-CROSS-001 | 跨实例 | submit@1 claim@2 | 状态仅在 RDS | P0 | 架构 §2 | 待建 | — |
| **B3-OBS-001** | **站级观测** | **pending/processing 深度** | 队列积压可查 | P1 | **架构图 §5 站③** | RDS 查询 | turn_jobs.status |

## B4 · ④ Pipeline（s04）

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| B4-PREP-001 | prepare | enrich 拼 inbox | NAS inbox.md 正确 | P1 | pi-context | s04 bff | BFF_HISTORY_* |
| B4-PREP-002 | plan_form | 指标 current 无来源 | 必须空，不填 0 | P0 | PRD §4.4 | s04 + 人工 | — |
| B4-GATE-M-001 | macroPlan | 无 Active→生成 | plan_form 非正文 | P0 | C1 §4.4 | s04 macro | — |
| B4-GATE-M-002 | macroPlan | 待确认计划 | 不可作课时依据 | P0 | PRD §4.5 | s04 macro | — |
| B4-GATE-S-001 | classSession | 有草稿课时 | 不重复生成 | P0 | C1 §4.5 | s04 session | — |
| B4-GATE-D-001 | 删除 | 第一轮删除 | 待确认删除载荷 | P0 | C1 §4.11 | s04 bff | — |
| B4-PERSIST-001 | persist | 九种 message_type 落库矩阵 | chat_messages 行 + form_data | P0 | — | s04-persist 矩阵 | tpl_config_bnd |
| B4-MEM-001 | memory wake | memory_ops | 异步 merge 入队 | P1 | C4 | 部分 | COACH_MEMORY_* |
| B4-STREAM-W-001 | stream 写 | thinking 增量 | stream_events 节流追加 | P1 | B6 | 部分 | TURN_THINKING_APPEND_MS |
| **B4-OBS-001** | **站级观测** | **stages_ms 分段** | enrich/pi/gates/persist 可查 | P1 | **架构图 §5 站④** | ai_interaction_logs | debug_log.pipeline |

## B5 · ⑤ Pi（s05）

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| B5-CONTRACT-001 | outbox | 合法 plan_form | validate 通过 | P0 | — | s05 | — |
| B5-NO-DB-001 | 边界 | Pi 运行中 | 无直接 UPDATE 业务表 | P0 | 架构 Pi 不能 | 架构审查 | — |
| B5-TOOL-001 | 工具 | 知识库检索 | 只读、limit 生效 | P1 | C4 | E2E 部分 | KNOWLEDGE_SEARCH_* |
| B5-LOCK-001 | NAS 串行 | 同 session 并发 Pi 文件 | advisory lock 串行 | P1 | 架构 §4 | 代码 | — |
| **B5-OBS-001** | **站级观测** | **Pi 回合耗时** | pi_ms / pi.turn span | P1 | **架构图 §5 站⑤** | OTel/SLS | LLM_* |

## B6 · ⑥ 回传（s06）

| 测试项 ID | 子类 | 测试核心细节 | 预期 / 观测点 | 优先级 | PRD / 架构 | 自动化 | 关联配置 |
|-----------|------|--------------|---------------|--------|------------|--------|----------|
| B6-SSE-001 | SSE | completed 推 final | message event + [DONE] | P0 | — | E2E | — |
| B6-POLL-001 | 轮询兜底 | GET turn by id | stream_events + result_json | P1 | pi-shell | 待建 | COACH_TURN_STREAM_POLL_MS |
| B6-TIMEOUT-001 | 超时 | 超长计划 | stream max wait 断流 | P2 | PRD §4.12 | 待建 | TURN_STREAM_MAX_WAIT_MS |
| B6-JOURNEY-001 | journey | 完整 async 链 | S1–S6 站点标记 | P1 | H | s06 | turn_journeys |
| B6-HB-001 | heartbeat | SSE keepalive | 网关 idle 不断 | P2 | — | 待建 | SSE_HEARTBEAT_MS |
| **B6-OBS-001** | **站级观测** | **首次反馈 / 完整结果时间** | TTFT、总耗时 | P1 | **PRD §4.12、架构图 §5 站⑥** | stages_ms + UX | — |

## 架构可靠性法则（跨 B 站）

| 测试项 ID | 法则 | 测试核心细节 | 预期 | 优先级 |
|-----------|------|--------------|------|--------|
| B-REL-IDEM-001 | 幂等 | 重复 submit 同 id | 不双跑 Pi、不双写库 | P0 |
| B-REL-SER-001 | 同 session 串行 | 连发两条不同 id | 第二条 429 直至上条结束 | P0 |
| B-REL-PAR-001 | 跨 session 并行 | A/B session 同时 submit | 均可 202 | P0 |
| B-REL-CAN-001 | 可取消 | pending cancel | 状态 cancelled | P0 |
| B-REL-REC-001 | 可恢复 | 实例 crash | processing→pending | P1 |
