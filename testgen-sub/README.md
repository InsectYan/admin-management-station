# testgen-sub · AI智能测试平台

自包含子应用（`app_key=testgen`），提供测试用例生成平台的文档管理、生成任务编排与用例展示。

## 端口（见 docs-project/应用端口与命名注册表.md）

| 服务 | 端口 |
|------|------|
| API | 7003 |
| Vite | 5175 |
| Postgres 宿主机 | 5434 |

## 本地启动

```bash
cd testgen-sub/deploy && npm link && ams-testgen local
```

## 架构

- **frontend/** — Vue 3 + Element Plus + AntV（测试范围 / 进度 / 用例管理）
- **backend/** — Egg.js BFF，代理调用 Agent 平台 `testgen-skill`
- **database/** — PostgreSQL 初始化脚本

Agent 能力由 `agent-management-sub/plugins/testgen-skill` 提供，不在本子应用内嵌。
