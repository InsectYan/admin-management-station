# B · 六站流水线 — 方案映射

> 核心细节：[`../测试项核心细节/B-六站流水线.md`](../测试项核心细节/B-六站流水线.md)

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **B1-IDEM-*** / **B1-SSE-*** | TS-01-DET | VS-01-EXACT | — | 前端协议单次或 E2E 一条 |
| **B1-STREAM-*** / **B1-RESUME-*** | TS-05-CHAIN | VS-04-CHAIN-OK | TS-06-PAIR | 切 session 前后 UI 对照 |
| **B1-LOADING-*** | TS-01-DET | VS-01-EXACT | — | 在途时 UI+429 双断言 |
| **B1-QUEUE-UX-*** | TS-01-DET | VS-01-EXACT | TS-08-OBS | queue_meta 字段存在 |
| **B1-OBS-*** | TS-08-OBS | VS-07-RATE-L | — | SSE 连接成功率统计 |
| **B2-KEY-*** / **B2-EMPTY-*** / **B2-OWN-*** | TS-01-DET | VS-01-EXACT | — | **典型接口式**：一次请求定成败 |
| **B2-CIRCUIT-*** | TS-01-DET | VS-01-EXACT | — | 模拟 DB 失败序列后 submit |
| **B2-INFLIGHT-*** / **B2-IDEM-*** | TS-01-DET | VS-01-EXACT | TS-02-BND | 在途+幂等豁免各 1 场景 |
| **B2-RATE-*** / **B2-DUP-*** | TS-02-BND | VS-01-EXACT | — | 窗口内第 N 次边界 |
| **B2-QUEUE-HARD-*** | TS-01-DET | VS-01-EXACT | TS-09-LOAD | 可压测顶满 pending |
| **B2-JOURNEY-*** | TS-08-OBS | VS-05-PRESENCE | — | guard 后查 journey |
| **B2-OBS-*** | TS-08-OBS | VS-07-RATE-L | — | SLS 聚合拒绝率 |
| **B3-ENQ-*** / **B3-IDEM-*** / **B3-CANCEL-*** | TS-01-DET | VS-01-EXACT | — | DB 层单次断言 |
| **B3-CLAIM-*** / **B3-W-*** | TS-09-LOAD | VS-10-SLO-M | VS-01-EXACT | 并发 claim |
| **B3-RETRY-*** / **B3-STALE-*** | TS-01-DET | VS-01-EXACT | — | 模拟 failed/超时 |
| **B3-CROSS-*** | TS-09-LOAD | VS-01-EXACT | — | 多实例幂等 |
| **B3-OBS-*** | TS-08-OBS | VS-05-PRESENCE | — | pending 深度可查 |
| **B4-PREP-002**（指标空） | TS-02-BND | VS-02-CONTRACT | — | 无来源 current 矩阵 |
| **B4-GATE-*** | TS-02-BND | VS-02-CONTRACT | — | macro/session 状态组合 |
| **B4-PERSIST-*** | TS-05-CHAIN | VS-04-CHAIN-OK | TS-08-OBS | 链末 chat_messages 行 |
| **B4-OBS-*** | TS-08-OBS | VS-05-PRESENCE | — | stages_ms 分段存在 |
| **B5-CONTRACT-*** | TS-01-DET | VS-02-CONTRACT | — | 纯函数 |
| **B5-NO-DB-*** | TS-01-DET | VS-03-ZERO | — | 架构审查+spot check |
| **B5-TOOL-*** | TS-05-CHAIN | VS-04-CHAIN-OK | — | E2E 带 tool 的 turn |
| **B5-OBS-*** | TS-08-OBS | VS-10-SLO-M | — | pi_ms 在 log 中 |
| **B6-SSE-*** / **B6-POLL-*** | TS-05-CHAIN | VS-04-CHAIN-OK | — | submit→stream 到 done |
| **B6-TIMEOUT-*** | TS-01-DET | VS-01-EXACT | — | 超长等待断流行为 |
| **B6-JOURNEY-*** | TS-08-OBS | VS-06-COMPLETE | — | S1–S6 站点齐全 |
| **B6-HB-*** | TS-01-DET | VS-01-EXACT | — | SSE 心跳事件 |
| **B6-OBS-*** | TS-08-OBS | VS-10-SLO-M | — | TTFT/总耗时 |
| **B-REL-IDEM-*** | TS-03-REP | VS-08-PASSK | TS-01-DET | 重复 submit 同 id |
| **B-REL-SER-*** | TS-02-BND | VS-01-EXACT | — | 同 session 第二条必 429 |
| **B-REL-PAR-*** | TS-02-BND | VS-01-EXACT | — | 两 session 各 202 |
| **B-REL-CAN-*** | TS-01-DET | VS-01-EXACT | — | cancel 后 status |
| **B-REL-REC-*** | TS-01-DET | VS-01-EXACT | TS-09-LOAD | kill 实例后 reclaim |
