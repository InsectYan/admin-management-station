# H · 可观测与排障 — 方案映射

> 核心细节：[`../测试项核心细节/H-可观测与排障.md`](../测试项核心细节/H-可观测与排障.md)  
> **本维度统一：先跑功能链（TS-05/01），再稽核（TS-08-OBS）**。

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **H1-S01-001**～**H1-S06-002** | TS-08-OBS | VS-07-RATE-L | TS-05-CHAIN | 功能通过后查指标；连接率等用 RATE-L |
| **H1-S04-001**（stages_ms） | TS-08-OBS | VS-05-PRESENCE | — | 每 turn 必有分段 |
| **H2-FLD-001**～**019** | TS-08-OBS | VS-06-COMPLETE | TS-05-CHAIN | 抽 N 条 turn 查 19 项字段 |
| **H3-MEM-001**～**003** | TS-08-OBS | VS-05-PRESENCE | TS-05-CHAIN | 会员确认/风险/反馈留痕 |
| **H4-MGR-001**～**003** | TS-08-OBS | VS-05-PRESENCE | TS-05-CHAIN | 管理操作审计字段 |
| **H5-JRN-001**～**003** | TS-08-OBS | VS-06-COMPLETE | TS-01-DET | journey 站点；须 client_turn_id |
| **H6-SLS-001**～**003** | TS-08-OBS | VS-05-PRESENCE | — | SLS 查询模板 |
| **H7-CHK-001**～**006** | TS-08-OBS | VS-05-PRESENCE | — | 排障路径 spot check |
| **H8-GAP-001**～**004** | — | — | — | **记录缺口**，不作为通过/失败 |

### H 维度执行模板

```text
1. TS-05-CHAIN 跑通业务（VS-04-CHAIN-OK）
2. TS-08-OBS 按 H2 清单逐项 VS-05/06
3. 发版门禁：H2 抽检样本达标 VS-07-RATE-M（字段完整率）
```

### 与 PRD §7.3 对应

| PRD 要求 | 映射 ID | VS |
|----------|---------|-----|
| 19 项日志 | H2-FLD-* | VS-06-COMPLETE |
| 六站漫游 | H5-JRN-* | VS-06-COMPLETE |
| interaction_log_id | H2-FLD-019 | VS-05-PRESENCE |
