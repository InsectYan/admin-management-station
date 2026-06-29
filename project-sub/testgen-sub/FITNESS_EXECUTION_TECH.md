# Fitness 测试执行体系 — 开发技术方案

> **版本**：v0.2 · 2026-06-28  
> **读者**：testgen-sub 前后端、agent-management-sub Skill 作者、fitness-agent 联调、文档/运维  
> **状态**：技术方案（待实现）；执行引擎当前返回 `501 ENGINE_NOT_IMPLEMENTED`  
> **关联**：[nodes.md](./nodes.md)（待办清单）· [README.md](./README.md) · [应用端口注册表](../docs-project/应用端口与命名注册表.md)

---

## 1. 目标、原则与边界

### 1.1 要解决什么

在 **Fitness 测试体系**（以 testgen-sub 为编排中枢）内，实现从「测试项库选中用例」到「可重复执行、可判定、可观测、可汇总」的闭环：

| 能力 | 说明 |
|------|------|
| 多环境执行 | `exec_env_id`（本地 / 测试 / 双环境）+ `env_tier_id`（随处等价 / 本地模拟 / 测试预发 / 生产人工） |
| 多方案执行 | TS-01～TS-10 对应不同执行形态（HTTP、CLI、重复抽样、链路、观测等） |
| 多标准判定 | VS-01～VS-17（精确、契约、达标率、Pass^k、SLO、人工等） |
| 链路可观测 | 对接 fitness-agent `turn_journeys` / `ai_interaction_logs`，不仅看最终 HTTP 回复 |
| 生成与执行分离 | 文档生成用 `testgen-skill`；Fitness **执行主路径不用 Loop 生成用例** |

**总原则**：为更好服务测试，**全链路任何仓库、任何模块均可变更**；但变更必须**单独登记**（见 §1.4），写明变更内容、触发条件与排期，不得隐式夹带在 testgen-sub 日常 PR 里。

---

### 1.2 设计约束（架构层，变更亦需登记 CH-ARCH-*）

下列为**当前推荐架构**，不是「永不可改」；若测试证明必须打破，走 §1.4 变更项评审，并更新本文档版本。

| 约束 | 目的 | 打破时的典型触发 |
|------|------|------------------|
| **Agent 与执行引擎分离** | 确定性可复现、CLI/HTTP 可 CI；LLM 仅作语义判定 | 需 Agent 直接驱动多步探索测试（见 CH-ARCH-01） |
| **最小原子化** | TS / VS / Runner / Collector 可单测、可替换 | 新 TS 需组合现有原子而非复制逻辑 |
| **BFF 编排 + Runner 执行面** | testgen 持久化与权限；执行可 sidecar | 高并发需独立 Worker 进程（见 CH-INFRA-02） |
| **前端 / BFF 不直连 LLM** | 密钥与审计集中在 agent 平台 | 平台不可用时临时降级（见 CH-ARCH-02） |
| **Skill 不 spawn CLI、不调 SUT** | 避免 LLM 路径不可控 | 不变；执行一律经 Runner |

---

### 1.3 本方案默认交付范围（首版迭代重心）

**默认在 testgen-sub 仓库内完成**，不阻塞 MVP：

| 交付物 | 路径/模块 |
|--------|-----------|
| 执行编排与子系统 | `backend/app/service/execution/*` |
| Fitness 执行 API / SSE | `fitnessExecution.js` + `router.js` |
| 执行相关前端页 | `frontend/src/views/fitness/execution/*` |
| 运行时表读写 | `ft_run*`、`ft_execution_env`、已有枚举 |
| Runner 适配 | CliRunner / HttpRunner / JourneyCollector（同进程或 env 配置 sidecar） |
| Agent 调用 | 经现有 `agentProxy` 调平台 Skill（Skill 本体在 agent-management-sub） |

**不在默认交付内、但不等于禁止**：见 §1.4 跨仓库变更清单。

---

### 1.4 默认迭代暂不展开的事项（及理由）

> 本节替代旧版「明确不包含」。  
> **含义**：当前 sprint **先不做**，是为降低并行改造面、优先打通闭环；**不是**说这些区域永远不能动。  
> 若 MVP 验收后仍无法满足测试目标，必须启用 §1.5 对应变更项。

| 事项 | 默认策略 | **暂不做的理由** | 测试仍不满足时 |
|------|----------|------------------|----------------|
| **fitness-agent BFF / Pi 改造** | 首版只**消费**现有 journey、logs、health API | 现有可观测面已可支撑 E1～E4（CLI + HTTP + journey 断言）；改 SUT 会拉长联调周期 | → **CH-SUT-01～03** |
| **fitness-agent-test-docs 编辑流程** | 不在 testgen 内做文档 CRUD | 383 条资产已通过 `database/tables` + seed 入库；执行读 DB 即可 | → **CH-DOC-01**（同步流水线） |
| **旧 `test_runs` / `/suite` 合并** | 新 `ft_run` 与旧体系**并行** | 避免影响仍在使用旧 suite 的流程；Fitness 执行模型不同（TS/VS/样本集） | → **CH-TG-01**（统一执行中心） |
| **testgen BFF 内嵌 LLM SDK** | 语义判定走 `agentProxy` | 符合 AMS / testgen-sub Skill 规范：密钥、配额、审计一处管理 | → **CH-ARCH-02**（仅平台故障降级） |
| **在 Skill 内执行测试** | Skill 只做 judge / explain | 与 §1.2 确定性约束一致；混用会导致不可复现 | 不打破；改 Runner 或 TS 引擎 |
| **生产环境全自动 launch** | `TIER_PROD_ONLY` 默认禁自动跑 | 合规与误操作风险 | → **CH-OPS-01**（审批流 + 只读 smoke） |
| **SLS / RDS / k6 深度集成** | E7 再开 | 依赖测试环境凭证与 infra；不阻塞 DET/SET/CHAIN | → **CH-INFRA-01～03** |

**小结**：上表每一项都是**排期与风险权衡**，不是产品边界。测试价值优先时，按 §1.5 单独立项、单独立项验收。

---

### 1.5 跨仓库 / 跨模块变更清单（变更内容 + 计划）

凡涉及 **testgen-sub 以外** 的改动，或 **打破 §1.2 架构约束** 的改动，在此登记；**不得**在未登记情况下合入。

| 变更 ID | 涉及仓库/模块 | 变更内容 | 触发条件（何时必须做） | 计划阶段 | 依赖 / 验收 |
|---------|---------------|----------|------------------------|----------|-------------|
| **CH-SUT-01** | `fitness-agent` BFF | `turn_journeys` / interaction log 的 metadata 写入 `test_run_id`、`test_item_id`、`client_turn_id`；可选 `GET /api/journeys` 按 run 筛选 | 控制台无法按 run 批量查 journey；SLS 关联困难 | **E4** | testgen launch 已注入 header；E2E `assertTurnJourney` 仍绿 |
| **CH-SUT-02** | `fitness-agent` BFF | 新增只读聚合 API，如 `GET /api/test/trace?client_turn_id=` → `{ journey, interaction_summary, latency }` | TS-08 需多次 HTTP 拼装；断言 flaky | **E4～E5** | 与 testgen `JourneyCollector` 契约评审 |
| **CH-SUT-03** | `fitness-agent` Pi / pipeline | 测试模式：`TEST_MODE=1` 时固定 seed、跳过外部 LLM 或走 mock profile；**不影响**默认生产路径 | TS-03/04 重复抽样需可复现；成本可控 | **E6** | 与 CH-ARCH-01 二选一或组合 |
| **CH-DOC-01** | `fitness-agent-test-docs` + testgen `database/` | 文档变更 → CI `copy-tables` → `classify-item-env.mjs` → `db:seed` 一键说明入 README | 文档与 DB 频繁漂移；手工 seed 易错 | **E2** | 已有 006 迁移与 classify 脚本 |
| **CH-TG-01** | testgen-sub | 执行中心只读聚合旧 `test_runs` + 新 `ft_run`；或迁移脚本 + 废弃时间表 | 用户需在单一界面看全量执行历史 | **E7+** | `ft_run` API 稳定 ≥1 版本 |
| **CH-AG-01** | `agent-management-sub` | 新建 `fitness-judge-skill`（react 短步 JSON）；路由 `/api/skills/fitness-judge` | VS-10 / TS-03/04/07 需 rubric 语义判定 | **E6** | testgen `vsAgentJudge.js` + agentProxy |
| **CH-AMS-01** | `admin-management-station` menu-master | Qiankun 菜单注册执行中心、RunConsole 深链 | 嵌入主应用后菜单不可达 | **E1** | 前端路由壳已存在 |
| **CH-INFRA-01** | 测试环境运维 | SLS 只读 AK 写入 `ft_execution_env.auth_configured`；testgen `slsCollector` | TS-08 需日志侧断言；journey 不足 | **E7** | 安全评审；不进前端 |
| **CH-INFRA-02** | testgen-sub / 部署 | Runner Worker 独立进程或容器（队列 Redis） | 并发 launch > `maxConcurrentRuns`；API 进程被 CLI 阻塞 | **E5～E7** | jobQueue 抽象已稳定 |
| **CH-INFRA-03** | 外部 | k6 Job 模板 + 结果 webhook 回写 `ft_run_result` | TS-09-LOAD 上线 | **E7** | CH-INFRA-02 可选 |
| **CH-ARCH-01** | testgen + agent | 探索式 TS（Agent 规划步骤，BFF 仍逐步调 Runner） | 固定 TS-05 无法覆盖长尾场景 | **E7+** | 需单独安全与成本评估 |
| **CH-ARCH-02** | testgen-sub | 平台不可用时 BFF 只读缓存 judge 或排队重试 | agent 平台 SLA 不达标 | **应急** | 禁止长期替代 agentProxy |
| **CH-OPS-01** | testgen-sub + 流程 | `TIER_PROD_ONLY` 人工审批 + smoke 白名单 | 生产发布门禁需要平台内一键 smoke | **E6** | 与 fitnessPlan 发版准则联动 |

**变更流程**：

1. 在 PR / 议题中引用变更 ID（如 `CH-SUT-01`）。  
2. 更新本节「计划阶段」与 [nodes.md](./nodes.md) 对应 checkbox。  
3. 跨仓 PR 需双方 README / 联调说明同步更新。  
4. 完成后回写本文档 §7 协作约定（若 API 契约变化）。

---

## 2. 总体架构

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  menu-master (Qiankun) + testgen-sub frontend (:5102)    [CH-AMS-01]   │
│  FitnessItemsPage / RunLaunch / RunConsole / ExecutionCenter            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST / SSE
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  testgen-sub BFF (:5202)  ← 默认交付重心                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ fitnessAsset │  │ fitnessPlan     │  │ fitnessExecution (编排层)   │  │
│  └──────────────┘  └─────────────────┘  └─────────────┬────────────┘  │
│  ┌─────────────────────────────────────────────────────▼──────────────┐  │
│  │ execution/  RunOrchestrator → TsEngine* / VsEngine* / Runner*     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  agentProxy → agent-management-master  [CH-AG-01: fitness-judge-skill]   │
└───────────────┬───────────────────────────────┬─────────────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐   ┌─────────────────────────────────────────┐
│ testgen PG (:5302)        │   │ agent-management-sub                      │
│ ft_run / ft_run_result …  │   │ testgen-skill（生成）| fitness-judge（判） │
└───────────────────────────┘   └─────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐   ┌─────────────────────────────────────────┐
│ Runner 执行面              │   │ SUT: fitness-agent  [CH-SUT-01～03 可选] │
│ CLI / HTTP / Journey      │   │ journey · logs · (SLS)                   │
└───────────────────────────┘   └─────────────────────────────────────────┘
```

### 2.1 三条执行路径

| 路径 | 触发条件 | 执行面 | Agent |
|------|----------|--------|-------|
| **P-A 站测/CLI** | `automation_entry_id` ∈ AUTO_S0x | CliRunner → fitness-agent 源码 | 否 |
| **P-B HTTP/E2E** | TS-01/05/06 + `ft_execution_env` | HttpRunner → fitness-agent BFF | 否 |
| **P-C 语义判定** | VS-10 或 TS-03/04/07 rubric | `fitness-judge-skill` via agentProxy | 是（仅判定步） |

主路径 deterministic；Agent 仅 `VsEngine` / 控制台 explain 插入。

---

## 3. 后端设计（testgen-sub）

### 3.1 目录结构（新增）

```text
backend/app/
├── service/
│   ├── fitnessExecution.js
│   └── execution/
│       ├── runOrchestrator.js
│       ├── engineRegistry.js
│       ├── vsRegistry.js
│       ├── runnerRegistry.js
│       ├── jobQueue.js              # → CH-INFRA-02 可外置 Worker
│       ├── engines/                   ts01DetEngine … ts10ManEngine
│       ├── validators/                vsExact … vsAgentJudge
│       ├── runners/                   cliRunner, httpRunner, journeyCollector
│       └── collectors/                slsCollector [CH-INFRA-01], rdsReadonly
├── controller/fitnessExecution.js
└── lib/fitnessRunEvents.js
```

规范：`egg-backend.md` — Model → Service → Controller → Router；Service 不写裸 SQL 字符串。

### 3.2 RunOrchestrator

```javascript
async launch(itemId, body) {
  // 读 item + ft_run_config + ft_execution_env
  // 校验 exec_env_id / env_tier_id vs RunnerRegistry
  // INSERT ft_run → jobQueue.enqueue(executeRun)
}

async executeRun(ftRunId) {
  // TsEngine.execute → SubRunResult[]
  // VsEngine.judge → verdict
  // UPDATE ft_run + SSE emitProgress
}
```

**原子化**：TsEngine 只产出事实；VsEngine 只判 verdict；TsEngine 禁止调 Agent。

### 3.3 TS 引擎契约与 MVP 范围

```typescript
interface TsEngine {
  schemeId: string;
  execute(ctx: ExecutionContext): Promise<SubRunResult[]>;
}
```

| TS | Runner | MVP |
|----|--------|-----|
| TS-01-DET | Http / Cli | 单次断言 |
| TS-02-BND | Http × matrix | config_json.matrix |
| TS-03-REP | Http/Cli × N | repeat → VS-07/08；可依赖 **CH-SUT-03** |
| TS-04-SET | Http × samples | ft_sample_item |
| TS-05-CHAIN | Http 顺序 | steps + 变量池 |
| TS-06-PAIR | Http 并行 | 多端 diff |
| TS-07-NEG | Http | 对抗集 + VS-09 |
| TS-08-OBS | Journey (+ SLS) | **CH-SUT-02** 可简化采集 |
| TS-09-LOAD | k6 Job | **CH-INFRA-03** |
| TS-10-MAN | 无自动 | 人工队列 + 可选 judge |

### 3.4 VS 判定引擎

| 分组 | 实现 | Agent |
|------|------|-------|
| DETERMINISTIC | vsExact / vsContract | 否 |
| STATISTICAL | vsRate / vsPassK | 否 |
| OBSERVABILITY | journey 站点 | 否 |
| MANUAL | ts10Man + UI | 可选 **CH-AG-01** |

VS-07：`current_rate = passCount / total * 100` vs `threshold_json`。

### 3.5 Runner 层

**CliRunner**：白名单 spawn，`FITNESS_AGENT_ROOT`，禁止任意 shell。

**HttpRunner**：`ft_execution_env` 基址 + `X-Test-Run-Id` / `X-Test-Item-Id` / body `client_turn_id`。

**JourneyCollector**：`GET …/api/journeys/{sessionId}/{clientTurnId}`；期望 **CH-SUT-02** 后改为单 trace API。

配置示例：

```javascript
exports.fitnessExecution = {
  fitnessAgentRoot: process.env.FITNESS_AGENT_ROOT || '',
  cliAllowlist: [ 'npm run test:stations', 'npm run test:e2e' ],
  maxConcurrentRuns: 3,
};
```

### 3.6 API 契约

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/fitness/run/:itemId/launch` | 创建 run + 入队 |
| POST | `/api/fitness/runs/:runId/cancel` | 取消 |
| GET | `/api/fitness/runs/:runId` | 详情 + results |
| GET | `/api/fitness/runs` | 列表 |
| GET | `/api/fitness/runs/:runId/stream` | SSE |
| POST | `/api/fitness/engines/:scheme/execute` | 单引擎调试 |
| POST | `/api/fitness/environments/health-check` | SUT 探活 |
| GET/POST | `/api/fitness/run-config/:itemId` | 已有 |

错误码：`ENGINE_NOT_IMPLEMENTED` 501 · `ENV_NOT_ALLOWED` 400 · `CLI_NOT_ALLOWLISTED` 403 · `RUNNER_TIMEOUT` 504。

### 3.7 异步与 SSE

首版：Egg `runInBackground` + 内存 EventEmitter。  
扩展：**CH-INFRA-02** Redis 队列 + Worker。

### 3.8 generationJob vs execution

| 模块 | Agent | 用途 |
|------|-------|------|
| `generationJob.js` | testgen-skill | 生成 test_cases |
| `vsAgentJudge.js` | fitness-judge-skill | 判定 SubRunResult |
| execution 主路径 | 无 | — |

---

## 4. Agent 设计（agent-management-sub）

### 4.1 fitness-judge-skill（**CH-AG-01**）

与 `testgen-skill` 分离；不替代 Runner。

```
plugins/fitness-judge-skill/
├── index.js          scheme: react, maxSteps: 2
├── SKILL.md
├── templates/judge-system.md
└── lib/rubricRegistry.js
```

| action | 入参 | 出参 |
|--------|------|------|
| `judge` | rubric_id, observations[] | pass, score, reasons |
| `explain` | run_id, observations[] | 自然语言报告 |

禁止：`execute_test` / `spawn_cli` / `call_fitness_api`。

### 4.2 协作链

```
testgen agentProxy → POST /api/skills/fitness-judge
→ RouteManager → react.executeTask → formatResponse
→ ft_run_result.assertion_detail.agent_judge
```

---

## 5. 前端设计（testgen-sub）

### 5.1 规范

Vue 3 + Element Plus + `apiConfig.js` 绝对 BFF URL；禁止直连 Agent。**CH-AMS-01** 补菜单。

### 5.2 执行相关路由

| 路由 | 组件 | 职责 |
|------|------|------|
| `/fitness/assets/items` | FitnessItemsPage | 列表 + 执行入口 |
| `/fitness/execution/run/:itemId/launch` | FitnessRunLaunchPage | 选 env、launch |
| `/fitness/execution/runs/:runId` | FitnessRunConsolePage | SSE、journey 摘要 |
| `/fitness/execution` | FitnessRunCenterPage | 队列 / 历史 |
| `/fitness/execution/run/:itemId/config/:schemeType` | FitnessRunConfigPage | threshold、journey_expect |

### 5.3 服务层

```javascript
export function launchFtRun(itemId, body) {
  return api.post(`/fitness/run/${encodeURIComponent(itemId)}/launch`, body);
}
```

### 5.4 执行 UX（时序）

用户 ItemsPage → launch → RunConsole SSE → 最终 verdict + 达标率 + journey（依赖 **CH-SUT-01** 时展示 run 级筛选）。

### 5.5 列表字段（已实现）

可执行环境 / 环境分层 / 执行状态 / 达标率 / 维度 Tag — 见 `fitnessItemTags.js`。

---

## 6. 数据模型

### 6.1 运行时表（`003_fitness_runtime.sql`）

`ft_execution_env` · `ft_run_config` · `ft_run` · `ft_run_result` · `ft_sample_*`

### 6.2 环境字段（`006_item_exec_env.sql`）

`exec_env_id` · `env_tier_id` — 与 RunnerRegistry 校验联动。

### 6.3 JSON 约定

**ft_run.progress**：phase、percent、pass_rate、client_turn_id、log_tail。  
**ft_run_result.assertion_detail**：http_status、journey_station、agent_judge 等 typed 条目。

---

## 7. 与 fitness-agent 协作（含变更演进）

### 7.1 测试关联键

| 键 | 生成方 | 用途 | 演进 |
|----|--------|------|------|
| `client_turn_id` | testgen launch | journey 关联 | 已有 |
| `X-Test-Run-Id` / `X-Test-Item-Id` | testgen HTTP 头 | 日志筛选 | **CH-SUT-01** 写入 journey metadata |
| trace 聚合 | fitness-agent | 一次拉 journey+log | **CH-SUT-02** 新 API |

### 7.2 观测面优先级

| 优先级 | 面 | 默认 | 增强变更 |
|--------|-----|------|----------|
| P0 | journey API | E4 MVP | CH-SUT-01 |
| P1 | interaction debug_log | E4+ | CH-SUT-02 |
| P2 | SLS | 可选 | CH-INFRA-01 |
| P3 | NAS 文件 | 人工排障 | 不进自动判定 |

### 7.3 环境映射

| ft_execution_env | bff_coach_url | exec_env |
|------------------|---------------|----------|
| local-docker | `http://127.0.0.1:3001` | LOCAL / BOTH |
| test-agentrun | AgentRun URL | TEST / BOTH |

---

## 8. 安全与合规

| 项 | 措施 | 变更 |
|----|------|------|
| CLI | 白名单 spawn | — |
| 密钥 | auth_configured JSONB | CH-INFRA-01 SLS AK |
| PII | Judge 入参摘要 | CH-AG-01 模板约束 |
| 生产 | TIER_PROD_ONLY 禁自动 | CH-OPS-01 审批 smoke |
| CORS | 主应用 origin | — |

---

## 9. 开发阶段（与 nodes.md 对齐）

| 阶段 | testgen 默认交付 | 跨仓变更 |
|------|------------------|----------|
| **E1** | Orchestrator + TS-01 + CliRunner + VS-02 + SSE | CH-AMS-01 |
| **E2** | TS-04 + VS-07 + 列表 run 态 | CH-DOC-01 |
| **E3** | TS-03 + VS-08 | — |
| **E4** | JourneyCollector + TS-08 + 控制台 journey | **CH-SUT-01**（建议同期） |
| **E5** | TS-05 CHAIN + 批量队列 | CH-SUT-02、CH-INFRA-02 评估 |
| **E6** | TS-10 人工 + judge 流 | **CH-AG-01**、CH-SUT-03、CH-OPS-01 |
| **E7** | SLS / k6 / 统一执行视图 | CH-INFRA-01/03、CH-TG-01 |

每阶段验收：`ams-testgen db` · `/api/health` · 前后端 Qiankun · ≥1 条 A 层 E2E。

**阶段闸门**：若 E4 验收时 journey 断言 flaky 且根因在 SUT 侧，**必须先合 CH-SUT-01/02**，不得仅在 testgen 侧加 retry 糊弄。

---

## 10. 测试策略

| 层级 | 范围 |
|------|------|
| 单元 | vsRate、journey parser、Runner mock |
| 集成 | executeRun 全链路 mock SUT |
| E2E | test 环境 fitness-agent + 单条 launch |
| 跨仓 | CH-SUT-* 合入后跑 fitness-agent `full-chain.suite` + testgen launch 联调 |

默认不在 testgen 内嵌 fitness-agent **全量** e2e 套件；smoke + 变更项联调为准。若 **CH-TG-01** 落地，可抽共享 smoke 流水线。

---

## 11. 参考文档

| 文档 | 路径 |
|------|------|
| AMS 自包含 | `.cursor/rules/app-self-contained.mdc` |
| Egg BFF | `skills/sub-app-developer/egg-backend.md` |
| Vue 前端 | `skills/sub-app-developer/vue-frontend.md` |
| testgen Skill | `skills/project-developer/testgen-sub/SKILL.md` |
| 子 Agent 指南 | `agent-management-sub/docs/子Agent开发指南.md` |
| Agent/BFF 设计 | `agent-management-sub/design-docs/testgen/测试用例生成-Agent与BFF层设计.md` |
| fitness 可观测 | `fitness-agent/docs/pi-observability.md` |
| 待办 | [nodes.md](./nodes.md) |

---

## 12. 术语表

| 术语 | 含义 |
|------|------|
| 默认交付 | 本方案 sprint 内在 testgen-sub 完成的范围 |
| 变更 ID | §1.5 跨仓改动唯一编号（CH-*） |
| SUT | 被测 fitness-agent 实例 |
| TS / VS | 测试方案 / 判定标准 |
| SubRunResult | 单次执行原始事实 |
| Runner | CLI/HTTP/Journey 适配器 |
| Engine | TS 编排，不调 LLM |

---

*实现进度以 [nodes.md](./nodes.md) 勾选为准；跨仓改动以 §1.5 变更 ID 跟踪。*
