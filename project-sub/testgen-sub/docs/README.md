# testgen-sub 文档索引

> 更新：2026-07-14  
> 所有设计、架构、待办文档统一在本目录维护。

---

## 架构与评估

| 文档 | 说明 |
|------|------|
| [测试平台架构关系图.md](./测试平台架构关系图.md) | 系统分层、前端路由、DB、执行引擎、Agent 调用 |
| [项目评分与后续计划.md](./项目评分与后续计划.md) | 评分标准、模块完成度、P0/P1/P2 路线图 |

---

## 配置模板用法（操作手册）

| 文档 | 说明 |
|------|------|
| [配置模板用法/README.md](./配置模板用法/README.md) | 11 套 TPL 用法索引：环境变量、`{{key}}`、前置/接口模板接线与各模板举例 |
| [配置模板-缺失与卡点.md](./配置模板-缺失与卡点.md) | 各模板缺失、未完成与卡点（相对实现与待办的对照） |

---

## Fitness 测试文档（DB 真源副本）

| 文档 | 说明 |
|------|------|
| [fitness-test-docs/README.md](./fitness-test-docs/README.md) | 测试分类、核心细节、方案映射（自 `fitness-agent-test-docs` 引入） |
| [fitness-test-docs/文档与数据库字段对照.md](./fitness-test-docs/文档与数据库字段对照.md) | `source_doc` / `scheme_mapping_source` ↔ Markdown 对照 |

改映射或测试项时须联动 `database/` 并遵循 `.cursor/rules/fitness-test-docs-sync.mdc`。

---

## 计划文档

| 文档 | 说明 |
|------|------|
| [计划-执行期配置AI自动补齐.md](./计划-执行期配置AI自动补齐.md) | v2：单职责多 Agent + BFF 编排；前置必修 ENV-01/卡点；缺配置再 AI 补齐 |

---

## 设计文档

| 文档 | 说明 | 原文件名 |
|------|------|----------|
| [设计-配置模板与52大类.md](./设计-配置模板与52大类.md) | 10 套 TS 配置模板、52 大类映射、ConfigPanel 体系（字段描述可能滞后，操作以「配置模板用法」为准） | `CONFIG_PAGE_DESIGN.md` |
| [设计-接口模板与样本集.md](./设计-接口模板与样本集.md) | 接口模板 `ft_api_template`、样本集与 inject | — |
| [设计-Agent协作与Skill嵌入.md](./设计-Agent协作与Skill嵌入.md) | Agent 全景、Skill 清单、引擎 hook、实施顺序 | `FITNESS_AGENT_DIRECTION.md` |
| [设计-Agent联调配置.md](./设计-Agent联调配置.md) | 端口、环境变量、双向 API、验证脚本、缺口清单 | `AGENT_LINKAGE.md` |
| [Skill与执行引擎关系梳理.md](./Skill与执行引擎关系梳理.md) | TPL ↔ TS ↔ 引擎 ↔ Skill 绑定 | — |

**外部设计（agent 仓）**

| 文档 | 路径 |
|------|------|
| 用例生成总览 | `agent-management-sub/design-docs/testgen/README.md` |
| 前端层设计 | `agent-management-sub/design-docs/testgen/测试用例生成-前端层设计.md` |
| 服务端层设计 | `agent-management-sub/design-docs/testgen/测试用例生成-服务端层设计.md` |
| Agent 与 BFF 层 | `agent-management-sub/design-docs/testgen/测试用例生成-Agent与BFF层设计.md` |

---

## 待办与追踪

| 文档 | 说明 | 原文件名 |
|------|------|----------|
| [待办-开发节点追踪.md](./待办-开发节点追踪.md) | 执行引擎、前端缺口、DB、Agent 节点勾选 | `nodes.md` |
| [待办-Agent开发任务清单.md](./待办-Agent开发任务清单.md) | Agent Phase 0~7 任务与验收 | `AGENT_TASKS.md` |
| [FITNESS_EXECUTION_TECH.md](./FITNESS_EXECUTION_TECH.md) | 执行引擎技术说明、跨仓变更 ID、关键 API |

---

## 文档维护约定

开发完成后须同步更新（见 `.cursor/rules/subapp-development.mdc`）：

1. 有 DB / Skill / API / UI 变更 → 更新「待办」文档并登记
2. 架构变化 → 更新「测试平台架构关系图.md」
3. 完成度变化 → 更新「项目评分与后续计划.md」
