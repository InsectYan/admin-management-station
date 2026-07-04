# E · Agent 智能质量 — 方案映射

> 核心细节：[`../测试项核心细节/E-Agent智能质量.md`](../测试项核心细节/E-Agent智能质量.md)  
> **本维度以统计/样本方案为主**：不与 D 维度共用「单次即过」标准（除 ZERO/EXACT 硬规则）。

| 测试项前缀/ID | 主方案 TS | 主验证 VS | 辅助方案 | 样本/执行说明 |
|---------------|-----------|-----------|----------|---------------|
| **E1-PATH-001**（意图） | TS-04-SET + TS-03-REP | VS-07-RATE-H | TS-02-BND | 意图样本集×每类多句；边界句单独 EXACT |
| **E1-PATH-002**（步骤顺序） | TS-05-CHAIN | VS-04-CHAIN-OK | TS-04-SET | 生成链不得跳步 |
| **E1-PATH-003**（删除） | TS-05-CHAIN | VS-04-CHAIN-OK | — | 两轮确认链 |
| **E1-PATH-004**（无效循环） | TS-03-REP | VS-08-PASSK | — | 长 tool 链重复 |
| **E1-PATH-005**（风险优先） | TS-07-NEG | VS-09-BLOCK-H | — | 疼痛+生成集 |
| **E2-TOOL-001**～**004** | TS-05-CHAIN + TS-08-OBS | VS-04-CHAIN-OK | TS-04-SET | trace/jsonl 查 tool 调用 |
| **E2-TOOL-003**（只读） | TS-07-NEG | VS-03-ZERO | — | 写库 tool 必须 0 次 |
| **E3-MEM-001** | TS-03-REP + TS-05-CHAIN | VS-07-RATE-M | — | 多轮后仍避禁忌 |
| **E3-MEM-002** | TS-01-DET | VS-02-CONTRACT | — | sanitize 单测 |
| **E3-MEM-003** | TS-06-PAIR | VS-03-ZERO | — | A/B session |
| **E3-MEM-004** | TS-08-OBS | VS-05-PRESENCE | — | 主链延迟不受睡梦阻塞 |
| **E4-STAB-001** | TS-03-REP | VS-08-PASSK | — | 同 prompt N 次 message_type |
| **E4-STAB-002** | TS-01-DET | VS-01-EXACT | — | LLM 429→failed/retry |
| **E4-STAB-003** | TS-05-CHAIN | VS-04-CHAIN-OK | VS-10-SLO-M | 长跑 completed |
| **E5-INJ-001**～**002** | TS-07-NEG | VS-09-BLOCK-H | TS-04-SET | 对抗 prompt 集 |
| **E5-MED-001** / **E5-PII-001** / **E5-TOOL-001** | TS-04-SET + TS-07-NEG | VS-09-BLOCK-H | TS-10-MAN | 负向+专家 |
| **E6-GOLD-001** | TS-04-SET | VS-07-RATE-M | — | Golden fixture |
| **E6-MOCK-001** | TS-01-DET | VS-02-CONTRACT | — | mock LLM gates |
| **E6-JUDGE-001** | TS-04-SET + TS-10-MAN | VS-11-MAJORITY | — | LLM-as-judge |
| **E6-SKILL-001** | TS-04-SET | VS-07-RATE-M | — | 改 skill 后回归集 |
| **E-RISK-001**～**010** | TS-04-SET | VS-07-RATE-H | TS-07-NEG | PRD §8 映射；硬规则用 VS-03-ZERO |
| **E-SKILL-*** | TS-04-SET | VS-07-RATE-M | TS-10-MAN | 按 skill 域样本 |

### E 维度分层建议

| 层级 | TS | VS | 用途 |
|------|----|----|------|
| 冒烟 | TS-04-SET（小子集） | VS-07-RATE-L | 开发 |
| 发版 | TS-04-SET（全量） | VS-07-RATE-M | CI |
| 验收 | TS-04-SET + TS-10-MAN | VS-07-RATE-H + VS-11-MAJORITY | UAT |
