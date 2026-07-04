# A · 测试层级 — 方案映射

> 核心细节：[`../测试项核心细节/A-测试层级.md`](../测试项核心细节/A-测试层级.md)

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **A1-OUTBOX-*** | TS-01-DET | VS-02-CONTRACT | — | 单次调用 validate，输入一组非法/合法 payload |
| **A1-MEMORY-*** | TS-01-DET | VS-02-CONTRACT | TS-02-BND | junk/合法 op 各至少 1 组 |
| **A1-GATE-MACRO-*** / **A1-GATE-SESSION-*** | TS-02-BND | VS-02-CONTRACT | — | mock DB 状态矩阵，每组独立断言 |
| **A2-S02-*** | TS-01-DET | VS-01-EXACT | TS-02-BND | 站级脚本每节独立 session；限流类需顺序执行 |
| **A2-S03-*** | TS-01-DET | VS-01-EXACT | — | 幂等：同一 id 连续 enqueue 两次 |
| **A2-S04-*** | TS-02-BND | VS-02-CONTRACT | — | bff/macro/session suite 矩阵 |
| **A2-S06-*** | TS-01-DET | VS-05-PRESENCE | TS-08-OBS | journey 记录存在 |
| **A3-HTTP-*** | TS-01-DET | VS-01-EXACT | TS-02-BND | HTTP 一次请求；探针 READY 测时间窗 |
| **A4-E2E-SMOKE-*** | TS-05-CHAIN | VS-04-CHAIN-OK | — | 三端各 1 条 submit→stream 全过 |
| **A4-E2E-CHAIN-*** | TS-05-CHAIN | VS-04-CHAIN-OK | TS-08-OBS | 主链多 HTTP 步 + 可选 DB 校验 |
| **A4-E2E-SESSION-*** | TS-05-CHAIN | VS-04-CHAIN-OK | — | 课时表单→commit 序列 |
| **A4-E2E-RESUME-*** | TS-05-CHAIN | VS-04-CHAIN-OK | TS-06-PAIR | 跨 session + 切 tab 对照 |
| **A4-E2E-CONSULT-*** | TS-04-SET | VS-07-RATE-M | — | 咨询 skill 固定句集，回归档达标率 |
| **A5-CAP-*** / **A5-MULTI-*** / **A5-STALE-*** | TS-09-LOAD | VS-10-SLO-M | VS-01-EXACT | 压测/杀实例；503 等用 EXACT |
| **A6-GOLDEN-*** | TS-04-SET | VS-07-RATE-M | — | Golden fixture 批量 |
| **A6-SAFETY-*** / **A6-MEDICAL-*** | TS-04-SET + TS-10-MAN | VS-09-BLOCK-H + VS-11-MAJORITY | TS-07-NEG | 风险 prompt 集 + 专家复核 |
