---
name: testgen-sub-developer
description: >-
  在 testgen-sub（app_key=testgen）上按设计文档迭代开发 AI智能测试平台。
  设计文档位于 testgen-sub/docs/ 与 agent-management-sub/design-docs/testgen/。
  实现文档/知识库/生成任务/Fitness 执行等业务模块。通用子应用脚手架见 sub-app-developer。
  当用户在 testgen-sub 目录开发、引用测试用例生成设计文档时使用。
---

# Testgen Sub — Project Developer

在 **`testgen-sub/`** 上按设计文档驱动业务开发。通用技术流程先读 [`../../sub-app-developer/SKILL.md`](../../sub-app-developer/SKILL.md)。

## 应用标识

| 项 | 值 |
|----|-----|
| `app_key` | `testgen` |
| 显示名 | AI智能测试平台 |
| 根目录 | `testgen-sub/` |
| CLI | `ams-testgen` |
| **本仓库文档** | [`testgen-sub/docs/README.md`](../../../project-sub/testgen-sub/docs/README.md) |
| 外部设计文档 | [`agent-management-sub/design-docs/testgen/`](../../../agent-management-sub/design-docs/testgen/) |
| 端口 | [`docs-project/应用端口与命名注册表.md`](../../docs-project/应用端口与命名注册表.md) |

## 设计文档索引

### 本仓库 docs/（优先）

| 文档 | 路径 | 用途 |
|------|------|------|
| [文档索引](../../../project-sub/testgen-sub/docs/README.md) | `docs/README.md` | 全部文档入口 |
| [架构关系图](../../../project-sub/testgen-sub/docs/测试平台架构关系图.md) | `docs/测试平台架构关系图.md` | 系统分层、流程、DB、Agent |
| [项目评分与计划](../../../project-sub/testgen-sub/docs/项目评分与后续计划.md) | `docs/项目评分与后续计划.md` | 评分 rubrics、P0/P1/P2 |
| [配置模板与52大类](../../../project-sub/testgen-sub/docs/设计-配置模板与52大类.md) | `docs/设计-配置模板与52大类.md` | TS 模板、ConfigPanel |
| [Agent协作设计](../../../project-sub/testgen-sub/docs/设计-Agent协作与Skill嵌入.md) | `docs/设计-Agent协作与Skill嵌入.md` | Skill 清单、引擎 hook |
| [Agent联调配置](../../../project-sub/testgen-sub/docs/设计-Agent联调配置.md) | `docs/设计-Agent联调配置.md` | 端口、Token、双向 API |
| [开发节点追踪](../../../project-sub/testgen-sub/docs/待办-开发节点追踪.md) | `docs/待办-开发节点追踪.md` | 执行/前端/DB 勾选 |
| [Agent任务清单](../../../project-sub/testgen-sub/docs/待办-Agent开发任务清单.md) | `docs/待办-Agent开发任务清单.md` | Phase 0~7 |

### 外部 agent 仓（用例生成原始设计）

| 文档 | 归属 |
|------|------|
| [README.md（索引）](../../../agent-management-sub/design-docs/testgen/README.md) | 总览 |
| [测试用例生成-前端层设计.md](../../../agent-management-sub/design-docs/testgen/测试用例生成-前端层设计.md) | `frontend/` |
| [测试用例生成-服务端层设计.md](../../../agent-management-sub/design-docs/testgen/测试用例生成-服务端层设计.md) | `backend/` |
| [测试用例生成-Agent与BFF层设计.md](../../../agent-management-sub/design-docs/testgen/测试用例生成-Agent与BFF层设计.md) | `agent-management-sub` |

## 执行流程

### 1. 分析设计文档

- 提取页面、API、数据表、路由
- 生成链路：`/testgen/scope` → `/jobs/:id` → `/testgen/items`
- Fitness 链路：配置 → launch → 控制台 SSE
- 后端 REST + Agent 代理（无 MCP）

### 2. 加载规范

| 层 | 通用 Skill | 规则 |
|----|-----------|------|
| 前端 | `sub-app-developer/vue-frontend.md` | `vue-web.mdc`、`vue-element-plus.mdc` |
| BFF | `sub-app-developer/egg-backend.md` | `egg-backend.mdc` |
| DB | `sub-app-developer/postgresql.md` | `postgresql.mdc`、`database-schema-sync.mdc` |
| 接入 | `sub-app-developer/onboarding.md` | `subapp-onboarding.mdc` |
| **迭代规范** | — | **`subapp-development.mdc`** |
| **Agent/Skill** | — | **`agent-skill-development.mdc`** |
| 部署 | `sub-app-developer/docker.md` | `docker-compose.mdc` |

### 3. 实现顺序

```
database → backend API → frontend views → Agent 联调（testgen-skill）
```

### 4. Agent 协作

- Skill 位于 `agent-management-sub/plugins/`（默认，见 `agent-skill-development.mdc`）
- BFF 通过 `agentProxy` 调用 `POST /api/skills/testgen-skill/invoke`
- 联调见 `docs/设计-Agent联调配置.md`

## 验收

- [ ] API 与设计文档端点一致
- [ ] 前端不直连 Agent 平台
- [ ] 独立运行与 Qiankun 嵌入均正常
- [ ] 生成任务可落库 `test_item_detail`
- [ ] `docs/待办-*` 已登记变更（`subapp-development.mdc` §1）
- [ ] 改表时 `db:seed` / `db:reset` 联动已验证（§2）
- [ ] `docs/测试平台架构关系图.md` 与 `docs/项目评分与后续计划.md` 已同步（§3）

## 禁止

- 在 testgen-sub 内嵌 MCP / LLM 直连
- 硬编码端口
- 前端直连 Agent 平台
- 新 Skill 仅写在 BFF 而不落 `agent-management-sub/plugins/`
