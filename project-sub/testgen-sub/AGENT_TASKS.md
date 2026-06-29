# Fitness Agent 开发任务清单

> 对应 [FITNESS_AGENT_DIRECTION.md](./FITNESS_AGENT_DIRECTION.md) v0.2 · 2026-06-30  
> 状态：`✅` 已实现骨架 / `🔧` 部分 / `❌` 待做

---

## Phase 0 — BFF 基础设施

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 0.1 | `agentProxy.invokeSkill` 统一网关 + 审计 | `backend/app/service/agentProxy.js` | ✅ |
| 0.2 | `agentAudit.log` | `backend/app/service/agentAudit.js` | ✅ |
| 0.3 | internal token 工具 | `backend/app/lib/internalAuth.js` | ✅ |
| 0.4 | Skill 路径配置 | `backend/config/config.default.js` | ✅ |
| 0.5 | internal 路由：suggest / bulk / patch / dry-run | `router.js` + `internalFitness.*` | ✅ |
| 0.6 | `agentHook` 嵌入点解析 | `backend/app/service/execution/agentHook.js` | ✅ |
| 0.7 | Orchestrator 集成 pre/post hook | `runOrchestrator.js` | ✅ |

---

## Phase 1 — A2 fitness-judge-skill（CH-AG-01）

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 1.1 | Skill 插件 judge / explain / pre_review | `agent-management-sub/plugins/fitness-judge-skill/` | ✅ |
| 1.2 | rubricRegistry 最小集 | `lib/rubricRegistry.js` | ✅ |
| 1.3 | `vsAgentJudge.js` | `backend/.../validators/vsAgentJudge.js` | ✅ |
| 1.4 | vsRegistry `use_agent_judge` 路由 | `vsRegistry.js` | ✅ |
| 1.5 | Agent 平台注册插件 | agent 平台 plugins 配置 | ❌ 部署时 |
| 1.6 | E6 用例联调（rubric + TS-04） | 手工 / 集成测试 | ❌ |

---

## Phase 2 — A1 testgen-skill 扩展（CH-AG-02）

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 2.1 | `generate_for_fitness` Loop + Fitness 上下文 | `testgen-skill/index.js` | ✅ |
| 2.2 | bffClient Fitness API | `testgen-skill/lib/bffClient.js` | ✅ |
| 2.3 | `enrich_samples` / `validate_draft` / `sync_to_item` | `testgen-skill/index.js` | ✅ |
| 2.4 | `generationJob` fitness_context + 后处理 | `generationJob.js` | ✅ |
| 2.5 | `/scope` 提交 fitness_context 表单 | `TestScopePage.vue` | ❌ |
| 2.6 | `/jobs/:id` 展示 dry-run（AgentConfigPanel） | `AgentConfigPanel.vue` | ✅ |

---

## Phase 3 — A3 fitness-sample-skill（CH-AG-03）

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 3.1 | Skill 插件 from_example / expand_matrix / gen_adversarial | `plugins/fitness-sample-skill/` | ✅ |
| 3.2 | BFF `POST /api/fitness/samples/generate` | `fitnessExecution.js` | ✅ |
| 3.3 | TS-04 pre_execute hook | `agentHook.js` | ✅ |
| 3.4 | 样本集页「AI 生成」按钮 | `FitnessSamplesPage.vue` | ✅ |
| 3.5 | CSV/JSON 导入 + 智能补全 | 前端 + BFF | ❌ |

---

## Phase 4 — TS-10 人工流 + VS-11

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 4.1 | `ts10ManEngine.js` | `engines/ts10ManEngine.js` | ✅ |
| 4.2 | `vsMajority.js` | `validators/vsMajority.js` | ✅ |
| 4.3 | engineRegistry TS-10-MAN | `engineRegistry.js` | ✅ |
| 4.4 | 人工打分 UI | `ConfigManPanel.vue` 扩展 | ❌ |
| 4.5 | AI 预审 `pre_review` 按钮 | 人工队列页 | ❌ |

---

## Phase 5 — Explain UX

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 5.1 | `POST /api/fitness/runs/:id/explain` | BFF | ✅ |
| 5.2 | 控制台「AI 解读」 | `FitnessRunConsolePage.vue` | ✅ |
| 5.3 | 计划报告 AI 摘要 | `FitnessPlanReportPage.vue` | ❌ |

---

## Phase 6 — A4 探索式（CH-ARCH-01）

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 6.1 | `fitness-explore-skill` plan action | `plugins/fitness-explore-skill/` | ✅ |
| 6.2 | TS-05 explore hook 循环 | `ts05ChainEngine.js` | ✅ |
| 6.3 | TEST_MODE mock 联调 | SUT + 配置 | ❌ |

---

## Phase 7 — E7 / A5

| # | 任务 | 路径 | 状态 |
|---|------|------|------|
| 7.1 | TS-09-LOAD + k6 集成 | 执行引擎 | ❌ |
| 7.2 | perf `analyze_load_run` | perf-bottleneck-skill | ❌ |

---

## 验收检查表（§7 最小集）

- [ ] `use_agent_judge: true` → `assertion_detail.agent_judge`
- [ ] `generate_for_fitness` + 可选样本/dry-run
- [ ] 全链路 trace run_id / job_id / item_id
- [ ] Agent 宕机 → fail 或 pending，不静默 pass
- [ ] judge 输出 schema 稳定可回归

---

## 部署备注

1. 设置 `INTERNAL_API_TOKEN`，Skill 与 BFF 一致  
2. Agent 平台加载三个新插件目录  
3. `TESTGEN_BFF_URL` 指向 testgen BFF 端口（默认 5202）
