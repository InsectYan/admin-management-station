# admin-management-station — 部署与 CLI

对齐 [cartoon-agent/deploy](E:/AI Tools/projects/cartoon-agent/deploy)：**`deploy/` 目录 + 全局 CLI `ams`**。

## 日常入口

| 你想做什么 | 命令 |
|------------|------|
| 本地全栈 Docker | `cd deploy && npm link` → **`ams local`** |
| 仅 DB + Redis | **`ams local:infra`** |
| 仅前端容器 | **`ams local:frontend`** |
| 清库重建 | **`ams local:reset`** |
| 停止 | **`ams local:down`** |
| 环境变量分层 | [config/README.md](./config/README.md) |
| CLI 规范 | [`.cursor/rules/deploy-cli.mdc`](../.cursor/rules/deploy-cli.mdc) |

未 link：`node deploy/scripts/run.mjs local`

> **Windows**：走 PowerShell（`deploy/scripts/*.ps1`），与 cartoon-agent 一致。

## 目录结构

```
deploy/
├── docker-compose.yml       # 编排（profile: local / infra）
├── package.json + bin/ams.mjs
├── config/                  # .env.local、Dockerfile.agent
└── scripts/                 # run.mjs、compose.ps1、start-local.ps1
```

## 本地容器（profile local）

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:8080 | 主应用 React + Qiankun |
| `ams-novel-frontend` | http://localhost:8081 | 小说子应用 |
| `ams-api-main` | http://localhost:7001 | Egg.js 平台 BFF |
| `ams-api-novel` | http://localhost:7002 | Egg.js 小说 API |
| `ams-agent-server` | http://localhost:7003 | **Pi Agent**（BFF + Pi） |
| `ams-postgres` | localhost:5432 | PostgreSQL |
| `ams-redis` | localhost:6379 | Redis |

## Agent 运行时边界

```
前端 ──HTTP/SSE──► agent-server:7003（BFF + Pi）
                    ├─ PostgreSQL（元数据）
                    ├─ /data（artifacts）
                    └─ /workspaces（Pi 会话）
```

平台鉴权/菜单：`api-main:7001`（Egg.js），与 Agent 进程分离。

详细设计：[docs-project/Agent开发方案.md](../docs-project/Agent开发方案.md)
