# Fitness 执行体系 — Agent 开发方向说明

> **版本**：v0.1 · 2026-06-30  
> **背景**：执行引擎 E1～E5（TS-01～TS-08 + VS-01～VS-09）已落地；本说明仅覆盖 **Fitness 执行链路** 尚缺的 Agent 能力。  
> **关联**：[nodes.md](./nodes.md) · [FITNESS_EXECUTION_TECH.md](./FITNESS_EXECUTION_TECH.md)

---

## 1. 现状与边界

### 1.1 已完成（不依赖 Agent）

| 层级 | 范围 | 说明 |
|------|------|------|
| TS 引擎 | TS-01～TS-08 | CliRunner / HttpRunner / JourneyCollector 确定性执行 |
| VS 判定 | VS-01～VS-09 | 契约、达标率、Pass^k、零违规、阻断率、可观测 |
| 编排 | RunOrchestrator · jobQueue · SSE | 单条 / 计划批量 launch |

主路径 **P-A（CLI）** 与 **P-B（HTTP/E2E）** 均不调用 LLM。

### 1.2 已有但不在本 Fitness 迭代范围的 Agent

| Skill | 用途 | 策略 |
|-------|------|------|
| `testgen-skill` | `/scope`、`/jobs` 测试用例文档生成 | 已存在；nodes.md 明确 **本迭代不改** |
| `perf-bottleneck-skill` | 旧 suite 性能分析报告 | 已接入 `agentProxy.invokePerfAnalysis`；与 `ft_run` 执行无关 |

### 1.3 缺口概览

```
Runner 产出 SubRunResult（事实）
        │
        ▼
  VsEngine.judge ──► 确定性 VS ✅
        │
        └──► 需 rubric / 语义 / 人工辅助时 ──► ❌ fitness-judge-skill 未建
                                              ❌ vsAgentJudge.js 未建
                                              ❌ agentProxy 无 judge 入口
```

**设计原则（不变）**：Agent **不参与执行**（不调 CLI、不调 SUT）；只在 **判定步（P-C）** 或 **控制台解读（explain）** 插入。

---

## 2. 需开发的 Agent（按优先级）

### 2.1 【P0 · E6】fitness-judge-skill（变更 ID：**CH-AG-01**）

**仓库**：`agent-management-sub/plugins/fitness-judge-skill`（新建，与 `testgen-skill` 分离）

**定位**：Fitness 专用 **语义判定 Agent**，react 短步（maxSteps ≤ 2），输出结构化 JSON。

#### 目录骨架

```text
plugins/fitness-judge-skill/
├── index.js                 # scheme: react
├── SKILL.md
├── templates/judge-system.md
└── lib/rubricRegistry.js    # rubric_id → 评分维度与通过条件
```

#### 对外 Action

| action | 入参 | 出参 | 调用方 |
|--------|------|------|--------|
| `judge` | `rubric_id`, `observations[]`, `threshold_json?` | `{ pass, score, reasons[] }` | `vsAgentJudge.js` |
| `explain` | `run_id`, `item_id`, `observations[]` | 自然语言摘要 | 控制台「AI 解读」按钮 |

**禁止能力**：`execute_test` · `spawn_cli` · `call_fitness_api`（执行仍走 Runner）。

#### 触发场景（与已实现的 TS/VS 配对）

| 场景 | TS 方案 | VS / 配置 | Agent 职责 |
|------|---------|-----------|------------|
| 样本语义回归 | TS-04-SET | VS-07 + `config_json.rubric_id` | 对每条样本的 response / journey 摘要按 rubric 判 pass |
| 重复抽样稳定性 | TS-03-REP | VS-08 + rubric | 单次重复结果的语义是否满足预期（非仅 HTTP 码） |
| 对抗语义阻断 | TS-07-NEG | VS-09 + rubric | 判定「应阻断」的语义边界（补充 HTTP 层 zero/block） |
| 人工评审辅助 | TS-10-MAN | VS-11-MAJORITY | 作为「AI 评审员」之一输出 score，与人审结果聚合 |
| E6 专项 | TS-04 + TS-10 组合 | VS-11 | 数据集中 `sample_execution_note: "LLM-as-judge"` 的用例 |

> **说明**：VS-10（SLO / p99 / TTFT）归属 **TS-09-LOAD** 压测指标，首版走 **确定性数值比较**，不经过本 Skill。Agent 聚焦 **无法写死规则** 的 rubric 判定。

#### rubric 数据来源（建议）

1. **短期**：`rubricRegistry.js` 内置 E6 文档中的标准 rubric（如咨询质量、安全拒绝、意图理解）。
2. **中期**：`ft_run_config.config_json.rubric_id` 指向 DB 或 registry；testgen BFF 只传 id + 观测摘要。

#### 观测入参 `observations[]` 建议字段

```json
{
  "sub_run_index": 0,
  "http_status": 200,
  "response_excerpt": "…≤2KB…",
  "journey_summary": { "stations": ["intent", "plan"], "latency_ms": 820 },
  "expected_hint": "来自 test_item_detail.expected_observation"
}
```

PII 与超长正文在 BFF 侧截断后再送 Agent（见 FITNESS_EXECUTION_TECH §8）。

---

### 2.2 【P0 · E6】testgen-sub BFF 侧 Judge 适配（非 Skill，但与 Agent 联调一体）

**仓库**：`testgen-sub/backend`

| 交付物 | 路径 | 职责 |
|--------|------|------|
| Judge 代理 | `service/agentProxy.js` | 新增 `invokeFitnessJudge(payload)` → `POST /api/skills/fitness-judge/invoke` |
| VS 引擎 | `service/execution/validators/vsAgentJudge.js` | 聚合 SubRunResult → 调 Agent → 写 `assertion_detail.agent_judge` |
| 注册 | `service/execution/vsRegistry.js` | 路由 `validation_group ∈ { MANUAL, AGENT }` 或 `config_json.use_agent_judge` |
| 配置 | `config.default.js` | `judgeInvokePath`、超时（建议 60～120s） |

**协作链**：

```text
RunOrchestrator.executeRun
  → TsEngine.execute()          # 仍 deterministic
  → vsAgentJudge.judge()
       → agentProxy.invokeFitnessJudge({ action: 'judge', ... })
       → ft_run_result.assertion_detail.agent_judge
  → SSE progress + 控制台展示
```

#### TS-10-MAN 引擎（与 Agent 配套，非 Agent 本体）

| 组件 | 说明 |
|------|------|
| `engines/ts10ManEngine.js` | 无自动 Runner；创建「待评审」SubRunResult，附 rubric 与原始材料 |
| 前端 | 人工打分 UI + 可选「请求 AI 预审」→ 调 `explain` / `judge` |
| VS-11 | 聚合人审 + Agent 分数 → majority 判定 |

---

### 2.3 【P1 · E6】控制台 Explain Agent（同一 Skill，不同 action）

**前端**：`FitnessRunConsolePage` 增加「AI 解读失败原因」

- 输入：当前 run 的 SubRunResult 摘要 + item 元数据  
- 调用：BFF `POST /api/fitness/runs/:runId/explain` → `fitness-judge-skill` · `explain`  
- 输出：只读 Markdown 区块，**不改变 verdict**

不影响 CI 确定性：explain 为可选 UX，不参与 pass/fail。

---

### 2.4 【P2 · 应急】平台降级（变更 ID：**CH-ARCH-02**）

**非新 Skill**：当 agent 平台不可用时

- BFF 将 judge 请求 **排队重试** 或标记 `verdict: pending_judge`  
- **禁止** 在 testgen BFF 内嵌 LLM SDK 作为长期方案  

仅运维应急，不在 E6 首版实现。

---

### 2.5 【P3 · E7+】探索式执行 Agent（变更 ID：**CH-ARCH-01**）

**暂不开发**。触发条件：固定 TS-05 链路无法覆盖长尾探索场景。

| 能力 | 说明 |
|------|------|
| Agent 规划步骤 | LLM 产出下一步 HTTP/CLI 意图 |
| BFF 逐步调 Runner | 每步仍经白名单 Runner，Agent 不直连 SUT |
| 安全 / 成本 | 需单独评审；与 CH-SUT-03（TEST_MODE mock）组合 |

与当前「执行引擎已完成」阶段 **无阻塞关系**，单独立项。

---

## 3. 不需要开发的 Agent

| 名称 | 原因 |
|------|------|
| 执行型 Agent（替 Runner 调 API） | 违反 Agent/引擎分离；TS 引擎已覆盖 |
| 用例生成 Agent（Fitness 内） | 已有 `testgen-skill`；Fitness 执行读 DB 用例，不 Loop 生成 |
| SLO / k6 判定 Agent | VS-10 走 TS-09 数值阈值；E7 再建 k6 集成即可 |
| 文档同步 Agent | 属 CH-DOC-01 脚本流水线，非对话 Agent |

---

## 4. 建议实施顺序

```text
E6-A  agent-management-sub  fitness-judge-skill（judge + rubricRegistry 最小集）
  ↓
E6-B  testgen  agentProxy + vsAgentJudge + vsRegistry 注册
  ↓
E6-C  选 1～2 条 E6 用例（如 LLM-as-judge / TS-04+VS-07+rubric）联调闭环
  ↓
E6-D  ts10ManEngine + 人工队列 UI + VS-11 聚合（可选 AI 预审）
  ↓
E6-E  控制台 explain action + BFF 路由
```

**验收标准（E6 Agent 最小集）**：

1. 单条 `ft_run` 在配置 `use_agent_judge: true` 时，verdict 含 `assertion_detail.agent_judge`。  
2. Agent 平台日志可追溯 `run_id` / `item_id`。  
3. Agent 宕机时 run 明确失败或 pending，**不静默 pass**。  
4. 同一 SubRunResult 输入，judge 输出 schema 稳定（便于回归）。

---

## 5. 与 nodes.md 对照

| nodes.md 条目 | 本说明对应 |
|---------------|------------|
| LLM Judge（E6） | §2.1 fitness-judge-skill + §2.2 vsAgentJudge |
| agent 平台 Skill · CH-AG-01 | §2.1 |
| E6 TS-10 人工 + judge 流 | §2.2 TS-10 引擎 + §2.3 explain |
| Agent 生成链路不改 | §1.2 testgen-skill 排除 |
| CH-ARCH-01 探索式 TS | §2.5 延后 |

---

## 6. 术语速查

| 术语 | 含义 |
|------|------|
| P-C 路径 | 语义判定路径：Runner 出事实 → Agent 出 verdict |
| rubric_id | 评分量表标识，映射到 judge prompt 与通过条件 |
| SubRunResult | 单次 HTTP/CLI/journey 执行的原始结果 |
| vsAgentJudge | testgen 侧调用 fitness-judge-skill 的 VS 引擎实现 |

---

*执行引擎进度以 [nodes.md](./nodes.md) 为准；Agent Skill 以 `agent-management-sub` 仓库 PR + 本文 §4 验收为准。*
