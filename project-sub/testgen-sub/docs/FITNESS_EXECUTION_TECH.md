# Fitness 执行技术说明

> 更新：2026-07-02  
> 范围：testgen-sub 执行引擎、BFF、Agent 联调与跨仓变更

## 1. 架构概览

- **Orchestrator**：`backend/app/service/execution/orchestrator.js` — 统一 launch / SSE / 子引擎调度
- **TS 引擎**：`backend/app/service/execution/ts*.js` — DET/BND/REP/SET/CHAIN/PAIR/NEG/OBS/LOAD/MAN
- **VS 引擎**：`backend/app/service/execution/vs*.js` + `vsRegistry.js`
- **Agent Hook**：`agentHook.js` — pre_execute / post_sub_run / explore
- **BFF**：`agentProxy.js` — 唯一 Agent 调用入口

## 1.5 跨仓库 / 跨模块变更清单

| 变更 ID | 模块 | 说明 |
|---------|------|------|
| CH-AG-01 | fitness-judge-skill | judge / explain / pre_review / summary |
| CH-AG-02 | testgen-skill | generate_for_fitness / enrich_samples |
| CH-AG-03 | fitness-sample-skill | from_example / enrich_csv |
| CH-INFRA-02 | vsAgentJudge | VS 路由至 Agent 判定 |
| CH-INFRA-03 | ts10ManEngine | 人工评审队列 |
| CH-TG-01 | generationJob | fitness_context 后处理 / import-samples |
| CH-DB-023 | project_env_variable | 项目全局变量 |

Skill 默认落点：`agent-management-sub/plugins/`（见 `agent-skill-development.mdc`）。

## 2. 关键 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/fitness/run/:itemId/launch` | 单条执行 |
| GET | `/api/fitness/runs/:runId/stream` | SSE 进度 |
| POST | `/api/fitness/plans/:id/launch` | 计划批量 |
| POST | `/api/fitness/runs/:runId/pre-review` | AI 预审（TS-10） |
| POST | `/api/generation-jobs/:id/import-samples` | 生成结果导入样本集 |
| POST | `/api/fitness/samples/enrich-csv` | CSV 智能补全 |
| GET | `/api/fitness/run-config/:itemId/k6-script` | TS-09 k6 脚本导出 |

## 3.5 E6 自检

```bash
node backend/scripts/e6-smoke.js
```

覆盖：judge/summary 规则降级、enrich_csv/enrich_samples、k6 脚本生成。

## 3. 数据库

- Fitness 资产表：`database/tables/` + `tables-order.json`
- 运行时表：migrations `003+`（ft_run、project_env_template、project_env_variable 等）
- 启动：`schemaSync.js` 自动 DDL + Sequelize alter

## 4. 前端域

| 路由前缀 | 说明 |
|----------|------|
| `/fitness/execution/*` | 执行、样本、控制台 |
| `/fitness/plans/*` | 计划向导与报告 |
| `/fitness/insights/*` | 指标 / 分析 / 风险 |
| `/fitness/topics/*` | 架构专题 |
| `/testgen/scope` | 生成配置 + Fitness 联动 |

## 5. 文档索引

- [待办-开发节点追踪.md](./待办-开发节点追踪.md)
- [测试平台架构关系图.md](./测试平台架构关系图.md)
- [设计-Agent协作与Skill嵌入.md](./设计-Agent协作与Skill嵌入.md)
