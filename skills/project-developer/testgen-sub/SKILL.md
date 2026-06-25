---
name: testgen-sub-developer
description: >-
  在 testgen-sub（app_key=testgen）上按设计文档迭代开发 AI智能测试平台。
  解析 agent-management-sub/design-docs/{project_key}/ 系列文档，
  实现文档/知识库/生成任务/用例管理等业务模块。通用子应用脚手架见 sub-app-developer。
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
| 设计文档 | [`agent-management-sub/design-docs/testgen/`](../../../agent-management-sub/design-docs/testgen/) |
| 端口 | [`docs-project/应用端口与命名注册表.md`](../../docs-project/应用端口与命名注册表.md) |

## 设计文档索引

| 文档 | 归属 |
|------|------|
| [README.md（索引）](../../../agent-management-sub/design-docs/testgen/README.md) | 总览 |
| [测试用例生成-前端层设计.md](../../../agent-management-sub/design-docs/testgen/测试用例生成-前端层设计.md) | `frontend/` |
| [测试用例生成-服务端层设计.md](../../../agent-management-sub/design-docs/testgen/测试用例生成-服务端层设计.md) | `backend/` |
| [测试用例生成-Agent与BFF层设计.md](../../../agent-management-sub/design-docs/testgen/测试用例生成-Agent与BFF层设计.md) | `agent-management-sub` |

## 执行流程

### 1. 分析设计文档

- 提取页面、API、数据表、路由
- 前端三页：`/scope`、`/jobs/:id`、`/suite`
- 后端 REST + Agent 代理（无 MCP）

### 2. 加载规范

| 层 | 通用 Skill | 规则 |
|----|-----------|------|
| 前端 | `sub-app-developer/vue-frontend.md` | `vue-web.mdc`、`vue-element-plus.mdc` |
| BFF | `sub-app-developer/egg-backend.md` | `egg-backend.mdc` |
| DB | `sub-app-developer/postgresql.md` | `postgresql.mdc` |
| 接入 | `sub-app-developer/onboarding.md` | `subapp-onboarding.mdc` |
| 部署 | `sub-app-developer/docker.md` | `docker-compose.mdc` |

### 3. 实现顺序

```
database → backend API → frontend views → Agent 联调（testgen-skill）
```

### 4. Agent 协作

- Skill 位于 `agent-management-sub/plugins/testgen-skill/`
- 业务 BFF 通过 `agentProxy` 调用 `POST /api/skills/testgen-skill/invoke`
- Skill `enrichContext` 可回拉 `GET /api/documents/:id`、`GET /api/tools/knowledge`

## 验收

- [ ] API 与设计文档端点一致
- [ ] 前端不直连 Agent 平台
- [ ] 独立运行与 Qiankun 嵌入均正常
- [ ] 生成任务可落库 test_cases

## 禁止

- 在 testgen-sub 内嵌 MCP / LLM 直连
- 硬编码端口
- 前端直连 Agent 平台
