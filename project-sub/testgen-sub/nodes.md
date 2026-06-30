# Fitness 测试体系 — 待开发节点



> 更新：2026-06-30  

> 范围：testgen-sub **全模块**（Fitness 执行 + Agent 生成链路 `/scope`、`/jobs` + Agent 嵌入引擎；旧 `/suite` 仍并行）  

> **Agent 设计**：[FITNESS_AGENT_DIRECTION.md](./FITNESS_AGENT_DIRECTION.md)（Skill 清单 / 引擎 hook / BFF 协作）  

> **详细技术方案**：[FITNESS_EXECUTION_TECH.md](./FITNESS_EXECUTION_TECH.md)（执行引擎 / Runner / 前后端目录 / API 契约）



---



## 一、执行引擎（E1～E5 部分已实现）



| 方案 ID | 引擎能力 | 状态 |

|---------|----------|------|

| TS-01-DET | HTTP/CLI 断言 | **E1 ✅** |

| TS-02-BND | 矩阵循环断言 | **E3 ✅** |

| TS-03-REP | 重复 + Pass^k | **E3 ✅** |

| TS-04-SET | 样本集 + 达标率 | **E2 ✅** |

| TS-05-CHAIN | 轻量编排 + 变量池 | **E4 ✅** |

| TS-06-PAIR | 三端对照 + 零违规 | **E5 ✅** |

| TS-07-NEG | 对抗集 + 阻断率 | **E5 ✅** |

| TS-08-OBS | Journey / 字段可观测 | **E4 ✅** |

| TS-09～10 | LOAD / 人工 | ❌ E6/E7 |



### 执行链路



- [x] `POST /api/fitness/run/:itemId/launch` 异步 Job（runInBackground）

- [x] SSE `/api/fitness/runs/:runId/stream`

- [x] VS-02-CONTRACT / VS-04-CHAIN-OK / VS-05-PRESENCE / VS-06-COMPLETE

- [x] VS-07-RATE-L/M/H · VS-08-PASSK

- [x] VS-03-ZERO · VS-09-BLOCK-L/M/H

- [x] TS-02-BND · TS-03-REP · TS-04-SET · TS-05-CHAIN · TS-06-PAIR · TS-07-NEG · TS-08-OBS

- [x] 计划批量执行 `POST /api/fitness/plans/:id/launch` + jobQueue 并发

- [x] JourneyCollector（`/api/journeys` 列表/单条）

- [x] `POST /api/fitness/environments/health-check`

- [ ] dry-run 单条（launch 页）

- [ ] 重跑失败项、导出 JSON 日志（控制台）

- [ ] LLM Judge（E6）→ 见 [FITNESS_AGENT_DIRECTION.md §3.2](./FITNESS_AGENT_DIRECTION.md#32-a2--p0fitness-judge-skillch-ag-01)



---



## 二、前端交互缺失



### P0 管理页



- [x] 测试项库：批量加入计划、导出 CSV/JSON、行内配置/执行快捷操作、筛选区一键清空

- [x] 测试项详情：关联项点击跳转图谱、风险 GUARD/DETECT 徽章色

- [ ] 计划向导：步骤 5 发版准则说明、PDF/Markdown 计划导出

- [ ] 完成报告：按 TS/VS/维度/PRD 聚合通过率、阈值对比图表



### P1 洞察页



- [ ] 指标中心：条形图/饼图/热力矩阵（当前为表格）

- [ ] 分析中心：P0 待建跳转 config 引导

- [ ] 风险中心：力导向关联图、反向查询输入框



### P2



- [ ] 架构专题页 `/topics/stations|business|observability`

- [ ] 六站×三端热力图可视化



### 执行层



- [x] 样本集：单条 CRUD（`ft_sample_item` API + 样本集库页）

- [x] 配置页 TS-04：样本集绑定 + rate_L/M/H 阈值

- [x] 配置页 TS-02：矩阵编辑器（HTTP/CLI 行）

- [x] 配置页 TS-03：重复 N + passk_M/N + HTTP/CLI 基线

- [x] 配置页 TS-05：链路 steps + extract 变量池

- [x] 配置页 TS-06：对照臂 pairs + forbidden_patterns

- [x] 配置页 TS-07：对抗 cases + block_rate_min

- [x] 配置页 TS-08：checks（HTTP 字段 / journey 列表/单条）

- [x] 计划详情：批量执行 + 进度轮询 + run 深链

- [x] 执行中心：进行中 Tab SSE/轮询 + 进度列

- [x] 控制台：达标率仪表 + pass/fail 图 + Journey/可观测 Tab

- [ ] 样本集 CSV/JSON 导入、从 test_input_example 生成（含 **A3 fitness-sample-skill** + A1 `enrich_samples`）

- [ ] 配置页：辅助方案折叠区（scheme_secondary_id）

- [ ] 控制台：写入计划报告



---



## 三、数据库与数据



- [x] 23 表 + 12 视图 DDL → `database/tables/`

- [x] 启动 schema 同步（DDL only，不含 INSERT）

- [x] `npm run db:seed` 全量/单表注入（需 init.sql + data.json）

- [ ] 视图 data.json 不参与 seed（仅表数据）；视图由 SQL 实时计算

- [ ] 文档更新后重新 copy tables 并 seed 的操作说明写入 README



---



## 四、后端待增强



- [ ] 测试项在线编辑（文档明确首版不做，保持只读）

- [x] ft_sample_item CRUD API

- [x] 计划删除 API

- [ ] 枚举表分组展示 config_env domain

- [x] 导出 test_item_detail CSV



---



## 五、Agent 待开发（与 Fitness 执行并列）

> 完整设计见 [FITNESS_AGENT_DIRECTION.md](./FITNESS_AGENT_DIRECTION.md) · 任务清单 [AGENT_TASKS.md](./AGENT_TASKS.md)

| ID | Skill | 优先级 | 变更 ID | 状态 | 说明 |
|----|-------|--------|---------|------|------|
| A1 | `testgen-skill` 扩展 | P0 | CH-AG-02 | 🔧 | `generate_for_fitness` · `enrich_samples` · `validate_draft`；联动 `/scope` `/jobs` |
| A2 | `fitness-judge-skill` | P0 | CH-AG-01 | 🔧 | `judge` · `explain` · VS hook + TS-10 |
| A3 | `fitness-sample-skill` | P1 | CH-AG-03 | 🔧 | 样本 / 矩阵 / 对抗集 AI 生成；TS pre_execute hook |
| A4 | `fitness-explore-skill` | P2 | CH-ARCH-01 | 🔧 | TS-05 `agent_hook: explore` |
| A5 | `perf-bottleneck-skill` | 已有 | — | ✅ | 旧 suite；E7 可扩展 load 解读 |

### BFF 基础设施（Agent 共用）

- [x] `agentProxy` 统一 invoke + `invokeFitnessJudge` / `invokeFitnessSample`
- [x] internal 路由：`/api/internal/fitness/*` · 审计字段 `run_id` / `job_id`
- [x] `vsAgentJudge.js` + `vsRegistry` AGENT 路由
- [x] `ts10ManEngine.js` + 人工评审 UI（引擎 ✅，UI 待做）
- [x] Orchestrator `agent_hook` 解析（pre_execute · post_sub_run · explore）

### 生成链路 × Fitness

- [ ] `generationJob` 传入 `fitness_context`（scheme_id · auto_sample）
- [ ] `/jobs/:id` 展示 dry-run / 样本写入结果
- [ ] 测试项库：从生成 job 一键导入样本集（可选）

---

## 六、模块边界与跨仓变更

> 原则：**为测试服务，全链路均可改**；跨 testgen-sub 的改动须登记 [FITNESS_EXECUTION_TECH.md §1.5](./FITNESS_EXECUTION_TECH.md#15-跨仓库--跨模块变更清单变更内容--计划) 变更 ID。  
> **v0.2**：Agent 与执行引擎 **可交叉改动**；testgen-skill 与 fitness-judge-skill **可互调 BFF 场景**。

| 模块 | 默认策略 | 变更 ID（若测试仍不满足） |
|------|----------|---------------------------|
| Agent 生成链路 (`/scope`, `/jobs`) | **与 Fitness 联调**（A1 CH-AG-02） | CH-AG-02 |
| 旧 suite / `test_runs` | 与 `ft_run` 并行 | CH-TG-01 |
| fitness-agent SUT | 可 mock + 探索 hook 联调 | CH-SUT-01～03 |
| fitness-agent-test-docs | 脚本 + A1 `sync_to_item` 可选 | CH-DOC-01 |
| agent 平台 Skill | judge + sample + explore + testgen 扩展 | CH-AG-01～03 · CH-ARCH-01 |
| Fitness 执行 (`ft_run`) | 引擎 hook 嵌入 Agent | CH-INFRA-02/03 |

---

## 七、建议开发顺序（参考文档 §9）



1. E0 环境 + 控制台壳层 ✅

2. **E1 TS-01 DET + Orchestrator + SSE ✅**

3. **E2 TS-04 SET + VS-07 ✅**（`C2-BOUND-004` + 009）

4. **E3 TS-02/03 + VS-08 ✅**（`B4-MEM-001` + 010）

5. **E4 TS-05 CHAIN + TS-08 OBS + Journey ✅**（`B6-HB-001` + `C3-ALERT-001` + 011）

6. **E5 TS-06/07 + 计划批量队列 ✅**（`C2-PAYLOAD-001` + `E5-INJ-001` + 013/014/015）

7. **E6 Agent** A2 judge + A1 生成联动 + TS-10 人工流 · 见 [FITNESS_AGENT_DIRECTION.md §7](./FITNESS_AGENT_DIRECTION.md#7-实施顺序)

8. E7 TS-09 LOAD + k6 · A5 perf 解读


