# testgen-sub 模块索引

> 设计文档：[`testgen-sub/docs/README.md`](../../../project-sub/testgen-sub/docs/README.md)  
> 外部补充：[`agent-management-sub/design-docs/testgen/`](../../../agent-management-sub/design-docs/testgen/)

## 前端页面（主要路由）

| 路由 | 页面 | 文档 |
|------|------|------|
| `/projects` | ProjectListPage | 架构图 §3 |
| `/testgen/scope` | TestScopePage | 设计-配置 / 外部前端设计 |
| `/jobs/:id` | GenerationProgressPage | Agent 设计 |
| `/testgen/items` | FitnessItemsPage | 设计-配置模板 |
| `/fitness/dashboard` | FitnessDashboardPage | 架构图 §3 |
| `/fitness/plans/*` | FitnessPlansPage 等 | 待办-节点 §二 |
| `/fitness/execution/*` | 执行层各页 | 架构图 §3.3 |
| `/fitness/assets/items/:id/*` | FitnessItemLayout | 设计-配置模板 §3 |

## 后端 API（域）

| 模块 | 路径前缀 | 文档 |
|------|----------|------|
| testProject | `/api/projects` | 架构图 §5 |
| document | `/api/documents` | 外部服务端设计 |
| knowledge | `/api/knowledge` | 外部服务端设计 |
| generationJob | `/api/generation-jobs` | Agent 设计 §3.1 |
| fitnessAsset | `/api/fitness/items` 等 | 设计-配置模板 |
| fitnessPlan | `/api/fitness/plans` | 待办-节点 |
| fitnessExecution | `/api/fitness/run` 等 | 架构图 §5.2 |
| internalFitness | `/api/internal/fitness` | 设计-Agent联调 |
| agentProxy | → Agent :4001 | 设计-Agent协作 |

## 数据表（分层）

- **平台核心**：documents、knowledge_entries、modules、generation_jobs
- **Fitness 资产**：test_item_detail、test_category_*、枚举表（见 `database/tables/`）
- **运行时**：test_plan_*、ft_run_*、ft_sample_*
- **配置模板**：tpl_config_*

## Agent Skill

| Skill | 用途 | 文档 |
|-------|------|------|
| testgen-skill | 用例生成 | 设计-Agent协作 §3.1 |
| fitness-judge-skill | 语义判定 | §3.2 |
| fitness-sample-skill | 样本生成 | §3.3 |
| fitness-config-skill | 配置生成 | 设计-配置模板 |
| fitness-explore-skill | TS-05 探索 | §3.4 |
| perf-bottleneck-skill | 性能分析 | §3.5 |

## 待办追踪

- [待办-开发节点追踪.md](../../../project-sub/testgen-sub/docs/待办-开发节点追踪.md)
- [待办-Agent开发任务清单.md](../../../project-sub/testgen-sub/docs/待办-Agent开发任务清单.md)
- [项目评分与后续计划.md](../../../project-sub/testgen-sub/docs/项目评分与后续计划.md)
