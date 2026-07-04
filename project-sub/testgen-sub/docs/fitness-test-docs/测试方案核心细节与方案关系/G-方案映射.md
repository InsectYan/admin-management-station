# G · 用户体验 — 方案映射

> 核心细节：[`../测试项核心细节/G-用户体验.md`](../测试项核心细节/G-用户体验.md)

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **G1-PHASE-001**～**007** | TS-03-REP + TS-08-OBS | VS-07-RATE-M | TS-10-MAN | 阶段文案允许措辞波动；**出现率**用 RATE |
| **G1-PHASE-006**（失败回执） | TS-01-DET | VS-01-EXACT | — | failed 必有 error |
| **G2-QUEUE-001** | TS-01-DET | VS-01-EXACT | — | queue_meta UI |
| **G2-QUEUE-002** / **G2-QUEUE-003** | TS-01-DET | VS-01-EXACT | TS-02-BND | 503/429 文案 |
| **G3-ERR-001**～**003** | TS-04-SET | VS-07-RATE-M | TS-10-MAN | 错误场景句集+人工读文案 |
| **G4-SESS-001**～**004** | TS-05-CHAIN | VS-04-CHAIN-OK | TS-06-PAIR | E2E resume |
| **G5-UI-001**～**003** | TS-05-CHAIN | VS-04-CHAIN-OK | — | 表单/卡片可操作 |
| **G5-UI-004** | TS-06-PAIR | VS-03-ZERO | — | 会员端无 coach 组件 |
| **G6-COACH-*** / **G6-MEM-*** / **G6-MGR-*** | TS-10-MAN | VS-11-MAJORITY | TS-03-REP | 分端 UX 评审 |
| **G7-STREAM-001** | TS-01-DET | VS-03-ZERO | — | 中断不写档 |
| **G7-STREAM-002** | TS-05-CHAIN | VS-04-CHAIN-OK | — | 慢任务可恢复 |
| **G8-T-001**～**005** | TS-08-OBS | VS-10-SLO-M | — | 耗时节点从 log 取 |

### G 维度：确定性 vs 主观

| 子类 | TS | VS |
|------|----|----|
| 错误码/loading 禁用 | TS-01-DET | VS-01-EXACT |
| 阶段文案/自然度 | TS-03-REP / TS-10-MAN | VS-07-RATE-M / VS-11-MAJORITY |
| 耗时 | TS-08-OBS | VS-10-SLO-M |
