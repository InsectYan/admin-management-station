# testgen-sub 模块索引

> 设计文档：`agent-management-sub/design-docs/testgen/`

## 前端页面

| 路由 | 页面 | 设计章节 |
|------|------|----------|
| `/scope` | TestScopePage | 前端 §3 |
| `/jobs/:id` | GenerationProgressPage | 前端 §3 |
| `/suite` | TestSuitePage | 前端 §3 |

## 后端 API

| 模块 | 路径前缀 | 设计章节 |
|------|----------|----------|
| document | `/api/documents` | 服务端 §6.1 |
| knowledge | `/api/knowledge` | 服务端 §6.2 |
| module | `/api/modules` | 服务端 §4.5 |
| generationJob | `/api/generation-jobs` | 服务端 §6.4 |
| testCase | `/api/test-cases` | 服务端 §6.5 |
| tools | `/api/tools/*` | 服务端 §6.6 |

## 数据表

- `documents`、`knowledge_entries`、`modules`
- `generation_jobs`、`test_cases`

## Agent

- `testgen-skill`（loop 方案，4 phase）
- 主应用 BFF 挂载，业务子应用仅 HTTP 代理
