# Fitness 测试体系 — Agent 开发设计

> **版本**：v0.2 · 2026-06-30  
> **背景**：执行引擎 E1～E5（TS-01～TS-08 + VS-01～VS-09）已落地；本文定义 **testgen-sub 全链路** 所需的 Agent 能力、嵌入方式与协作关系。  
> **关联**：[nodes.md](./nodes.md) · [FITNESS_EXECUTION_TECH.md](./FITNESS_EXECUTION_TECH.md)

---

## 1. 设计原则（v0.2 修订）

### 1.1 取消的旧边界

以下 v0.1「互不侵犯」约束 **全部作废**：

| 旧原则 | 新策略 |
|--------|--------|
| Agent 不参与执行（不调 CLI / SUT） | Agent **可嵌入 TS 引擎**（规划步骤、生成样本、探索调用），经 BFF 白名单 Runner 落地 |
| testgen-skill 与 Fitness 执行隔离 | testgen-skill **可调用 Fitness BFF**（读测试项、写样本集、触发 dry-run / launch） |
| fitness-judge-skill 禁止 `call_fitness_api` | 各 Skill 经 **agentProxy / internal API** 访问 BFF，统一鉴权与审计 |
| Agent 生成链路（`/scope`、`/jobs`）本迭代不改 | **纳入同一 Agent 路线图**，与 E6/E7 联调 |
| 探索式 Agent（CH-ARCH-01）单独立项、延后 | 作为 **TS-05 可选 hook** 或独立 Skill，按场景启用 |
| BFF 内禁止内嵌 LLM SDK | 仍推荐走 Agent 平台；**应急降级**可保留，非架构禁令 |

### 1.2 新核心原则

1. **统一代理层**：testgen BFF 的 `agentProxy.js` 是唯一对外 Skill 网关；Skill 回写 BFF 走 internal token 路由。
2. **引擎可插 Agent**：TS / VS 引擎通过 `config_json.agent_hook` 声明嵌入点，Orchestrator 在固定步骤间调用 Agent，**不绕过 Runner**。
3. **Skill 可互调场景**：testgen-skill 在生成阶段可拉取 Fitness 资产（`ft_test_item`、`ft_sample_item`、scheme 元数据），必要时触发验证性执行。
4. **可观测与降级**：所有 Agent 调用携带 `run_id` / `job_id` / `item_id`；平台不可用时 **fail 或 pending**，禁止静默 pass。

---

## 2. Agent 全景（按 Skill 划分）

```
┌─────────────────────────────────────────────────────────────────┐
│                     testgen-sub BFF (agentProxy)                 │
├──────────────┬──────────────────┬───────────────────────────────┤
│ 生成链路      │ 执行链路          │ 分析与 UX                      │
│ /scope /jobs │ ft_run launch    │ 控制台 explain · 计划报告摘要   │
└──────┬───────┴────────┬─────────┴───────────────┬───────────────┘
       │                │                         │
       ▼                ▼                         ▼
 testgen-skill    fitness-judge-skill      fitness-sample-skill (新)
 (扩展 action)    (judge · explain)        (样本 · 矩阵 · 对抗集)
       │                │                         │
       └────────────────┴─────────────────────────┘
                        │
              Agent 平台 (agent-management-sub/plugins)
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
  读 BFF 资产      嵌入 TS/VS hook     可选：fitness-explore-skill
  写样本/用例      语义判定             (CH-ARCH-01 探索步骤)
```

### 2.1 Agent 清单

| ID | Skill | 优先级 | 变更 ID | 职责 | 嵌入 / 调用场景 |
|----|-------|--------|---------|------|-----------------|
| **A1** | `testgen-skill`（扩展） | P0 | CH-AG-02 | 文档 → 结构化用例；**新增** Fitness 场景联动 | `/scope` · `/jobs`；review 步可调 BFF 查 `ft_test_item`、写 `ft_sample_item` |
| **A2** | `fitness-judge-skill` | P0 | CH-AG-01 | rubric 语义判定 · 控制台解读 | VS hook（P-C）；TS-10 人审辅助；`explain` |
| **A3** | `fitness-sample-skill` | P1 | CH-AG-03 | 从 PRD / `test_input_example` 生成样本、矩阵行、对抗 case | 样本集页「AI 生成」；testgen-skill `enrich_samples` action |
| **A4** | `fitness-explore-skill` | P2 | CH-ARCH-01 | 探索式多步 HTTP/CLI 意图（逐步经 Runner） | TS-05 `agent_hook: explore`；长尾 E2E |
| **A5** | `perf-bottleneck-skill` | 已有 | — | 旧 suite 性能报告 | `/suite` 分析；**可选** 挂接 TS-09 结果解读 |

---

## 3. 各 Agent 详细设计

### 3.1 【A1 · P0】testgen-skill 扩展（CH-AG-02）

**仓库**：`agent-management-sub/plugins/testgen-skill`（在现有 Loop 上扩展，**不新建平行 Skill**）

#### 新增 / 扩展 Action

| action | 说明 | BFF 场景调用 |
|--------|------|--------------|
| `generate` | 现有 Loop 生成 | 不变 |
| `generate_for_fitness` | 指定 `module` + `scheme_id`，输出对齐 TS 配置的用例 | `POST /api/internal/fitness/items/suggest` |
| `enrich_samples` | 根据 `item_id` + `test_input_example` 批量生成 `ft_sample_item` | `POST /api/fitness/samples/bulk`（internal） |
| `validate_draft` | 对生成草案触发 **dry-run** 或单条 launch | `POST /api/fitness/run/:itemId/launch?dryRun=1` |
| `sync_to_item` | 将生成结果写入测试项备注 / 期望观测字段 | `PATCH /api/internal/fitness/items/:id` |

#### 与 Fitness 的协作链

```text
用户 /scope 提交 PRD
  → generationJob → agentProxy.invokeTestgen({ action: 'generate_for_fitness', module, scheme_id })
  → testgen-skill Loop (analyze → functional → edge → review)
       review 步可选: enrich_samples → BFF 写样本集
       review 步可选: validate_draft → dry-run 反馈写入 agent-context
  → BFF 落库 generation_job + 可选 ft_sample_item
  → 前端 /jobs/:id 展示 Agent 上下文与 Fitness 校验结果
```

#### BFF 交付物

| 路径 | 职责 |
|------|------|
| `service/generationJob.js` | 传入 `fitness_context: { scheme_id, item_ids, auto_sample }` |
| `router/internal/fitnessAgent.js` | internal 路由：样本 bulk、item suggest、dry-run 代理 |
| `service/agentProxy.js` | 统一 payload 字段，透传 `trace_id` |

---

### 3.2 【A2 · P0】fitness-judge-skill（CH-AG-01）

**仓库**：`agent-management-sub/plugins/fitness-judge-skill`（新建）

**定位**：语义判定 Agent；react 短步（maxSteps ≤ 2），输出结构化 JSON。

#### 目录骨架

```text
plugins/fitness-judge-skill/
├── index.js
├── SKILL.md
├── templates/judge-system.md
├── lib/rubricRegistry.js
└── lib/bffClient.js          # 可选：拉 item 元数据 / 历史 run 摘要
```

#### Action

| action | 入参 | 出参 | 调用方 |
|--------|------|------|--------|
| `judge` | `rubric_id`, `observations[]`, `threshold_json?` | `{ pass, score, reasons[] }` | `vsAgentJudge.js` · TS-10 |
| `explain` | `run_id`, `item_id`, `observations[]` | Markdown 摘要 | 控制台 · 计划报告 |
| `pre_review` | 同人审材料 | `{ score, checklist[] }` | TS-10 人工队列「AI 预审」 |

#### 引擎嵌入（VS hook）

| 场景 | TS | VS / 配置 | Agent 职责 |
|------|-----|-----------|------------|
| 样本语义回归 | TS-04-SET | VS-07 + `rubric_id` | 每条样本 response / journey 按 rubric 判 pass |
| 重复语义稳定 | TS-03-REP | VS-08 + rubric | 单次重复的语义满足度 |
| 对抗语义阻断 | TS-07-NEG | VS-09 + rubric | 补充 HTTP 层 zero/block 的语义边界 |
| 人工评审 | TS-10-MAN | VS-11 | AI 评审员分数与人审聚合 |
| E6 专项 | TS-04 + TS-10 | VS-11 | `sample_execution_note: "LLM-as-judge"` |

**配置开关**：`ft_run_config.config_json.use_agent_judge: true` 或 `validation_group ∈ { MANUAL, AGENT }`。

#### BFF 交付物

| 路径 | 职责 |
|------|------|
| `service/agentProxy.js` | `invokeFitnessJudge(payload)` |
| `service/execution/validators/vsAgentJudge.js` | SubRunResult → Agent → `assertion_detail.agent_judge` |
| `service/execution/vsRegistry.js` | 注册 AGENT / MANUAL 路由 |
| `service/execution/engines/ts10ManEngine.js` | 待评审 SubRunResult + 可选 AI 预审 |

---

### 3.3 【A3 · P1】fitness-sample-skill（CH-AG-03）

**定位**：专注 **执行层数据准备**，减轻 testgen-skill 在样本格式上的负担；可被 A1 **委托调用**（Skill 间 `POST /api/skills/.../invoke` 或 BFF 编排）。

#### Action

| action | 说明 | 产出 |
|--------|------|------|
| `from_example` | 输入 `test_input_example` + `scheme_id` | `ft_sample_item[]` 或矩阵行 JSON |
| `expand_matrix` | TS-02 边界维度描述 | HTTP/CLI 行数组 |
| `gen_adversarial` | TS-07 对抗目标描述 | cases + `forbidden_patterns` 建议 |

#### 嵌入场景

- 前端样本集页：「从 example AI 生成」「CSV 智能补全」
- testgen-skill review 步：`delegate_sample_skill: true` 时 BFF 链式调用
- TS-04 引擎 **pre-hook**：`config_json.agent_sample_expand: true` 在执行前补齐样本

---

### 3.4 【A4 · P2】fitness-explore-skill（CH-ARCH-01）

**定位**：固定 TS-05 无法覆盖的长尾探索；**Agent 只产出下一步意图**，BFF 逐步调用 HttpRunner / CliRunner。

#### 引擎嵌入（TS hook）

```text
Ts05ChainEngine.execute()
  → 固定 steps 执行完毕
  → 若 config_json.agent_hook === 'explore'
       → fitness-explore-skill.plan({ history, goal })
       → BFF 执行单步 Runner → 结果追加 history
       → 循环至 max_explore_steps 或 done
  → SubRunResult[] → VS
```

| 配置项 | 说明 |
|--------|------|
| `agent_hook: 'explore'` | 启用探索 |
| `max_explore_steps` | 默认 5 |
| `explore_goal` | 来自 `test_item_detail.expected_observation` |

安全：仅允许 `config_env` 白名单 host；须配合 CH-SUT-03（TEST_MODE mock）。

---

### 3.5 【A5 · 已有】perf-bottleneck-skill

保持现有 `agentProxy.invokePerfAnalysis`；E7 TS-09-LOAD 落地后可增加 `analyze_load_run` action，解读 k6 指标（数值判定仍走 VS-10，Agent 仅解读报告）。

---

## 4. 引擎嵌入机制（统一约定）

### 4.1 嵌入点枚举

| hook | 阶段 | 适用 TS | 典型 Agent |
|------|------|---------|------------|
| `pre_execute` | Runner 前 | TS-02/04/07 | A3 扩样本 / 矩阵 |
| `post_sub_run` | 单次 Runner 后 | TS-03/04/07 | A2 逐条 judge |
| `explore` | 链路扩展 | TS-05 | A4 探索步骤 |
| `vs_agent` | 判定 | 全 VS（配置驱动） | A2 judge |
| `explain` | 运行后 UX | — | A2 explain |

### 4.2 Orchestrator 伪代码

```text
RunOrchestrator.executeRun(ctx)
  if config.agent_hook.pre_execute → agentProxy.invoke(...)
  subResults = TsEngine.execute(ctx)    # 内部可含 explore 循环
  if config.agent_hook.post_sub_run → 逐条 agentProxy.invokeFitnessJudge
  verdict = VsEngine.judge(subResults)  # vsAgentJudge 或确定性 VS
  SSE progress + 可选 explain
```

### 4.3 `config_json` 示例

```json
{
  "use_agent_judge": true,
  "rubric_id": "consult_quality_v1",
  "agent_hook": {
    "pre_execute": "fitness-sample-skill:from_example",
    "post_sub_run": "fitness-judge-skill:judge",
    "explore": null
  }
}
```

---

## 5. BFF API 与 internal 路由（Agent 专用）

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/skills/*/invoke` | Agent 平台统一入口（BFF 代理） |
| POST | `/api/internal/generation-jobs/:id/agent-context` | 已有 · 生成进度 |
| POST | `/api/internal/fitness/samples/bulk` | A1/A3 写样本 |
| GET | `/api/internal/fitness/items/suggest` | A1 拉测试项模板 |
| POST | `/api/fitness/run/:itemId/launch?dryRun=1` | A1 草案校验 |
| POST | `/api/fitness/runs/:runId/explain` | A2 控制台解读 |

鉴权：`X-Internal-Token` + 审计日志（`run_id` / `job_id` / `skill` / `action`）。

---

## 6. 不需要单独新建的 Agent

| 名称 | 处理方式 |
|------|----------|
| 重复的执行型 Agent | 合并进 A4 explore hook + 现有 Runner |
| Fitness 内第二套用例生成 Skill | 扩展 A1，不复制 Loop |
| SLO / k6 数值判定 | VS-10 确定性比较；A5 只做报告解读 |
| 文档同步 | CH-DOC-01 脚本流水线；可选 A1 `sync_to_item` 轻量联动 |

---

## 7. 实施顺序

> 逐项任务与完成状态见 [AGENT_TASKS.md](./AGENT_TASKS.md)

```text
Phase 0 — 基础设施
  agentProxy 统一 invoke 方法 + internal 路由骨架 + 审计字段

Phase 1 — E6 判定闭环 (A2)
  fitness-judge-skill → vsAgentJudge → 1～2 条 rubric 用例联调

Phase 2 — 生成 × Fitness 联动 (A1)
  testgen-skill generate_for_fitness / enrich_samples
  /jobs 页展示 dry-run 反馈

Phase 3 — 样本 AI (A3)
  样本集页 + TS-04 pre_execute hook

Phase 4 — 人工流 (A2 + TS-10)
  ts10ManEngine + VS-11 + pre_review

Phase 5 — UX (A2 explain)
  控制台 + 计划报告 AI 摘要

Phase 6 — 探索 (A4)
  TS-05 explore hook + TEST_MODE 联调

Phase 7 — E7 (A5 + k6)
  TS-09 + 可选 perf 解读
```

### 验收标准（最小集）

1. `use_agent_judge: true` 的 `ft_run` 含 `assertion_detail.agent_judge`。  
2. `generate_for_fitness` 可从 PRD 生成用例并 **可选** 写入样本集 / dry-run。  
3. Agent 调用全链路可追溯 `run_id` / `job_id` / `item_id`。  
4. Agent 宕机时 verdict 为 **fail 或 pending_judge**，不静默 pass。  
5. 同一输入 judge 输出 schema 稳定，可回归。

---

## 8. 与 nodes.md 对照

| nodes.md 条目 | 本文 |
|---------------|------|
| LLM Judge（E6） | §3.2 A2 + §4 vs_agent hook |
| 样本集从 test_input_example 生成 | §3.3 A3 + §3.1 enrich_samples |
| Agent 平台 Skill · CH-AG-01 | §3.2 |
| testgen-skill 扩展 · CH-AG-02 | §3.1 |
| fitness-sample-skill · CH-AG-03 | §3.3 |
| CH-ARCH-01 探索式 TS | §3.4 A4 |
| 模块边界（原「本迭代不改」） | **已取消**，见 §1.1 |

---

## 9. 术语速查

| 术语 | 含义 |
|------|------|
| Agent hook | TS/VS 引擎内声明的 Agent 嵌入点 |
| P-C 路径 | Runner 出事实 → Agent 出 verdict（可与其他 hook 组合） |
| rubric_id | 评分量表，映射 judge prompt 与通过条件 |
| SubRunResult | 单次 HTTP/CLI/journey 执行结果 |
| internal API | Skill 回写 BFF 的 token 保护路由 |
| dry-run | 不持久化 verdict 或标记 `dry_run` 的 launch |

---

*执行引擎进度以 [nodes.md](./nodes.md) 为准；Agent 以 `agent-management-sub` PR + 本文 §7 验收为准。*
