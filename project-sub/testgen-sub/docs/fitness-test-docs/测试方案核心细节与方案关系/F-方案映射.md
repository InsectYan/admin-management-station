# F · 非功能 — 方案映射

> 核心细节：[`../测试项核心细节/F-非功能.md`](../测试项核心细节/F-非功能.md)

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **F1-SUB-001** | TS-09-LOAD | VS-10-SLO-M | — | submit p99 |
| **F1-PLAN-001** | TS-05-CHAIN | VS-10-SLO-M | VS-04-CHAIN-OK | 计划 turn 总时长 |
| **F1-TTFT-001** | TS-08-OBS | VS-10-SLO-M | — | 首 SSE 事件时间 |
| **F1-CONC-001** / **F1-QUEUE-001** | TS-09-LOAD | VS-10-SLO-H | VS-01-EXACT | 并发+queue_meta |
| **F1-LONG-001** | TS-09-LOAD | VS-10-SLO-H | — | 72h 长稳 |
| **F2-MULTI-001** | TS-09-LOAD | VS-01-EXACT | TS-03-REP | 跨实例幂等 |
| **F2-STALE-001** | TS-01-DET | VS-01-EXACT | TS-09-LOAD | kill+reclaim |
| **F2-DRAIN-001** | TS-01-DET | VS-01-EXACT | — | SIGTERM drain |
| **F2-POOL-001** | TS-09-LOAD | VS-10-SLO-M | VS-01-EXACT | 连接数公式 |
| **F2-NAS-001** | TS-01-DET | VS-01-EXACT | — | 写 inbox 权限 |
| **F3-LOG-001** | TS-08-OBS | VS-05-PRESENCE | — | SLS 字段可查 |
| **F3-TRACE-001** | TS-08-OBS | VS-06-COMPLETE | — | trace 续链 |
| **F3-GAP-*** | — | — | — | **已知缺口**：不测通过，记为 N/A |
| **F4-LOCAL-001**～**003** | TS-01-DET | VS-01-EXACT | — | CLI 一次 |
| **F4-AR-SMOKE-001** | TS-05-CHAIN | VS-04-CHAIN-OK | — | smoke.sh |
| **F4-AR-READY-001** | TS-01-DET | VS-01-EXACT | — | /ready 时间窗 |
| **F4-MODE-001** | TS-02-BND | VS-01-EXACT | — | local/agentrun 配置 |
| **F5-SYM-001**～**009** | TS-09-LOAD | VS-10-SLO-* + VS-01-EXACT | TS-01-DET | 症状复现+错误码 |
| **F6-CAP-001**～**003** | TS-09-LOAD | VS-10-SLO-H | — | 容量公式压测 |

### F 维度说明

| 类型 | TS | VS |
|------|----|----|
| 错误码/状态（503/429） | TS-01-DET 或 TS-09-LOAD | VS-01-EXACT |
| 延迟/吞吐 | TS-09-LOAD | VS-10-SLO-L/M/H（阈值见 00-阈值配置说明） |
