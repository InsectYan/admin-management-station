# D · 接口与套壳 — 方案映射

> 核心细节：[`../测试项核心细节/D-接口与套壳.md`](../测试项核心细节/D-接口与套壳.md)  
> **本维度以确定性方案为主**：多数项 **TS-01-DET + VS-01-EXACT**，一次场景即可判定。

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **D1-COACH-SUB-001** / **D1-MEM-SUB-001** / **D1-ADM-SUB-001** | TS-01-DET | VS-01-EXACT | TS-05-CHAIN | 合法 POST→202；可延伸为链首 |
| **D1-COACH-STR-001** | TS-05-CHAIN | VS-04-CHAIN-OK | — | submit 后立即 stream 到 done |
| **D1-COACH-CFG-001** | TS-01-DET | VS-01-EXACT | — | GET config 字段 |
| **D1-CANCEL-001** | TS-01-DET | VS-01-EXACT | — | cancel pending |
| **D1-POLL-001** | TS-01-DET | VS-01-EXACT | — | GET turn 直到 completed |
| **D1-SESSION-001** | TS-01-DET | VS-01-EXACT | — | ensure session |
| **D1-HEALTH-001** / **D1-READY-001** | TS-01-DET | VS-01-EXACT | — | 探针 status/body |
| **D2-SUB-001**～**007** | TS-01-DET | VS-01-EXACT | TS-02-BND | **异常入参/错误码**：每码 1 请求 |
| **D2-SUB-004**（429 在途） | TS-02-BND | VS-01-EXACT | — | 先占 in-flight 再第二条 |
| **D2-SSE-001** | TS-01-DET | VS-01-EXACT | — | failed turn error 字段 |
| **D2-IDEM-001** | TS-03-REP | VS-01-EXACT | VS-08-PASSK | 同 id 多次 submit 均同 turn_id |
| **D2-OUT-001** | TS-01-DET | VS-02-CONTRACT | — | 202 body schema |
| **D3-JWT-001** | TS-06-PAIR | VS-01-EXACT | — | body 伪造 id vs 套壳注入 |
| **D3-KEY-001** | TS-01-DET | VS-01-EXACT | — | 无 Key→401 |
| **D3-NET-001** / **D3-CORS-001** | TS-01-DET | VS-01-EXACT | — | 架构/配置审查+spot |
| **D3-PASSTHR-001** | TS-05-CHAIN | VS-04-CHAIN-OK | — | 套壳透传 E2E |
| **D4-FLD-001**～**004** | TS-01-DET | VS-02-CONTRACT | — | 202 字段存在性 |
| **D5-EVT-001**～**005** | TS-05-CHAIN | VS-02-CONTRACT | — | SSE 各 event 类型 |

### D 维度默认（未列 ID）

| 场景 | TS | VS |
|------|----|----|
| 任意 HTTP 错误码 | TS-01-DET | VS-01-EXACT |
| 路径不存在 | TS-01-DET | VS-01-EXACT（404） |
