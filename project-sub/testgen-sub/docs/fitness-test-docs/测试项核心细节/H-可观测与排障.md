# H · 可观测与排障 — 核心细节表

> **PRD §7.3**：测试不能只看前端，必须看日志。  
> **架构图 §5**：每站有「关键观测指标」。  
> **排障入口**：SLS · `turn_journeys` · `/ops` · `ai_interaction_logs` · OTel

## H1 · 六站观测指标（架构图 §5）

| 站 | 观测项 ID | 指标 | 数据来源 | 通过标准 | 优先级 |
|----|-----------|------|----------|----------|--------|
| ① 前端 | H1-S01-001 | SSE 订流成功率 | 前端+网关 | submit 后 stream 建立 | P1 |
| ② 门禁 | H1-S02-001 | 拒绝率 / 误放率 | SLS guard 事件 | 非法请求 0 Pi | P0 |
| ② 门禁 | H1-S02-002 | 熔断状态 | circuit_breaker 字段 | 503 时 circuit=true | P1 |
| ③ 队列 | H1-S03-001 | pending 深度 | RDS turn_jobs | 可告警阈值 | P1 |
| ③ 队列 | H1-S03-002 | 幂等命中率 | created=false 比例 | 重试不双 job | P0 |
| ③ 队列 | H1-S03-003 | stale 回收次数 | Worker 日志 | crash 后可恢复 | P1 |
| ④ Pipeline | H1-S04-001 | stages_ms 分段 | ai_interaction_logs | enrich/pi/gates/persist | P0 |
| ⑤ Pi | H1-S04-002 | pi_ms / tool span | OTel pi.turn/pi.tool | 可定位慢 tool | P2 |
| ⑥ 回传 | H1-S06-001 | TTFT / 总耗时 | stream 首事件时间 | PRD §4.12 | P1 |
| ⑥ 回传 | H1-S06-002 | SSE heartbeat | 连接存活 | 长轮不断 | P2 |

## H2 · PRD 必查日志字段（三端通用 §7.3）

| # | 字段 | 测试项 ID | 用途 | 存储/来源 |
|---|------|-----------|------|-----------|
| 1 | 用户输入原文 | H2-FLD-001 | 还原问题 | chat_messages / log |
| 2 | 当前端类型 | H2-FLD-002 | coach/member/manager | request_json.role |
| 3 | 当前用户身份 | H2-FLD-003 | 权限 | coach_id / member_id |
| 4 | message_type | H2-FLD-004 | 前端渲染 | outbox / result_json |
| 5 | intent | H2-FLD-005 | 任务识别 | outbox / log |
| 6 | agent_name | H2-FLD-006 | 承接 Agent | log |
| 7 | 会员对象识别 | H2-FLD-007 | 消歧结果 | debug_log |
| 8 | 权限校验结果 | H2-FLD-008 | 通过/拒 | journey / guard |
| 9 | 上下文引用摘要 | H2-FLD-009 | 用了哪些档案 | debug_log |
| 10 | skill 调用 | H2-FLD-010 | 命中哪些 skill | session.jsonl / trace |
| 11 | 安全审查结果 | H2-FLD-011 | 通过/阻断/降级 | 待产品字段 |
| 12 | 生成结果 | H2-FLD-012 | 最终 outbox | result_json |
| 13 | 教练修改差异 | H2-FLD-013 | AI 初稿 vs 终稿 | 业务表版本 |
| 14 | 确认结果 | H2-FLD-014 | 谁何时确认 | 确认留痕表 |
| 15 | 写库结果 | H2-FLD-015 | 成功/失败 | persist 日志 |
| 16 | 幂等命中 | H2-FLD-016 | client_turn_id 重放 | turn_jobs.created |
| 17 | 失败原因 | H2-FLD-017 | error_text | turn_jobs |
| 18 | 各阶段耗时 | H2-FLD-018 | stages_ms | ai_interaction_logs |
| 19 | interaction_log_id | H2-FLD-019 | 单轮回查 | GET /api/logs/:id |

## H3 · 会员端专用日志（PRD §5.11）

| 字段 | 测试项 ID | 场景 |
|------|-----------|------|
| 训练计划确认/拒绝 | H3-MEM-001 | 确认留痕 |
| 是否命中安全风险 | H3-MEM-002 | 医疗类输入 |
| 反馈提交记录 | H3-MEM-003 | 同步教练 |

## H4 · 管理端专用日志（PRD §6.10）

| 字段 | 测试项 ID | 场景 |
|------|-----------|------|
| 管理员身份 + 当前门店 | H4-MGR-001 | 权限审计 |
| 操作前/后状态 | H4-MGR-002 | 分配关系变更 |
| 对象识别结果 | H4-MGR-003 | 消歧 |

## H5 · turn_journeys 六站漫游

| 测试项 ID | 场景 | 预期 journey 标记 |
|-----------|------|---------------------|
| H5-JRN-001 | guard 拒绝 | S2 拒绝 recorded |
| H5-JRN-002 | async 主链 | S3 enqueued → S4 → S6 completed |
| H5-JRN-003 | 带 client_turn_id | GET /api/journeys/:session/:clientTurnId 可查 | P0 |

**前置**：submit 必须带 `client_turn_id`。

## H6 · SLS / 接口监控

| 测试项 ID | event | 聚合维度 | 用途 |
|-----------|-------|----------|------|
| H6-SLS-001 | http.request.end | api_label_zh | QPS、p95 |
| H6-SLS-002 | TURN_* | turn_id, instance_id | 单轮追踪 |
| H6-SLS-003 | trace_id | OTEL 开启时 | 跨 Worker 续链 |

## H7 · 排障速查（pi-ops / 成熟度）

| 要看什么 | 去哪看 | 测试项 ID |
|----------|--------|-----------|
| 单轮 stage 耗时 | ai_interaction_logs.debug_log.pipeline | H7-CHK-001 |
| 六站漫游 | turn_journeys / `/ops` | H7-CHK-002 |
| 全链路 trace | ARMS OTEL | H7-CHK-003 |
| 队列积压 | turn_jobs pending count | H7-CHK-004 |
| failed 原因 | turn_jobs.error_text | H7-CHK-005 |
| LLM 账单 | 厂商控制台（应用内无） | H7-CHK-006 |

## H8 · 可观测缺口（测试需标注「未实现」）

| 缺口 | 影响 | 测试项 ID |
|------|------|-----------|
| token/成本应用内账单 | 无法按 coach 控预算 | H8-GAP-001 |
| Prometheus 告警 | 无自动化 SLO | H8-GAP-002 |
| 安全审查结构化结果 | 难统计阻断率 | H8-GAP-003 |
| DLQ 回放 UI | failed 难批量处理 | H8-GAP-004 |
