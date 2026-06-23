# admin-management-station — 私人管理平台

架构：**Qiankun 微前端 + Egg.js 多 BFF**；可选 **Pi Agent**（`apps/agent-server`，对齐 [cartoon-agent](../cartoon-agent/) 模式）。

**设计文档入口**：[`docs-project/README.md`](docs-project/README.md)

## 能力

- 私人管理主应用（菜单、微前端基座、鉴权）— `menu-master/`
- 小说管理子应用（规划中）— `apps/novel-*`
- Pi Agent 服务（规划中）— `apps/agent-server/`

## 一条命令：本地 vs 开发

**全局 CLI**：`ams <命令>`（`deploy/` 目录 `npm link` 一次）

```bash
cd deploy && npm link          # 每台机器首次
ams help
ams local                      # 启动主应用 Docker 栈
```

| 命令 | 作用 |
|------|------|
| **`ams local`** | 启动主应用 Docker 栈（infra + menu-master） |
| **`ams local:all`** | 启动全栈（含 novel、agent profile） |
| **`ams local:main`** | 同 `ams local` |
| **`ams local:novel`** | 仅小说子应用栈 |
| **`ams local:agent`** | 仅 Agent 栈 |
| **`ams local:infra`** | 仅 DB + Redis（宿主机热更新业务代码） |
| **`ams local:frontend`** | 仅重建主应用前端容器 |
| **`ams local:reset`** | 清库重建（开发用） |
| **`ams local:down`** | 停止根编排栈 |

单应用目录内也可：`cd menu-master && docker compose up -d --build`

> **Windows**：`ams local` 内部走 PowerShell。未 link：`node deploy/scripts/run.mjs local`

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:8080 | 主应用；dev Vite **5173** |
| `ams-novel-frontend` | http://localhost:8081 | 小说子应用；dev Vite **5174** |
| `ams-api-main` | http://localhost:7001 | Egg.js · `admin_platform` |
| `ams-api-novel` | http://localhost:7002 | Egg.js · `novel_db` |
| `ams-agent-server` | http://localhost:7003 | Agent（profile `agent`） |
| `ams-postgres` | localhost:5432 | PostgreSQL（多库） |

端口注册表：[docs-project/应用端口与命名注册表.md](docs-project/应用端口与命名注册表.md)

部署详解：[`deploy/README.md`](deploy/README.md)

## 配置分层

| 场景 | 环境文件（可提交） | 密钥（gitignore） |
|------|-------------------|-------------------|
| **本地 Docker** | `deploy/config/.env.local` | 各应用目录下 `.env` |
| **生产** | `deploy/config/.env.prod`（待增） | 部署平台密钥 |

详见 [`deploy/config/README.md`](deploy/config/README.md)。

## 目录

| 目录 | 说明 |
|------|------|
| `menu-master/` | **主应用**（frontend :5173 · backend :7001） |
| `apps/novel/` | 小说子应用 Docker 编排（业务代码 `novel-*` 待建） |
| `apps/agent-server/` | Agent BFF + Pi（:7003，待实现） |
| `deploy/` | 共享 infra + 根 compose + **`ams` CLI** |
| `docs-project/` | 设计文档 |
| `skills/` | 开发流程 Skills |

> **Pi 工作区**（`workspace-templates/`、`workspaces/`）在**子应用/Agent 域内**按需配置，不在仓库根目录。

## 开发规范

**无论人工或 AI 开发**，均须遵循 [`.cursor/rules/`](.cursor/rules/)：

| 规则 | 说明 |
|-----|------|
| `development-standards.mdc` | 通用约束 |
| `deploy-cli.mdc` | **`ams` 指令与 deploy/** |
| `docker-compose.mdc` | 分层 Compose 编排 |
| `app-registry.mdc` | **多应用端口与数据库名** |
| `react-web.mdc` | 前端 SPA |
| `egg-backend.mdc` | Egg.js BFF |
| `qiankun-microfrontend.mdc` | 微前端 |
| `pi-v3-agent.mdc` | Pi Agent（实现 `agent-server` 时） |

## Agent Skills

- [project-developer](skills/project-developer/) — 按设计文档拆分并实现各模块

## 文档

- [`docs-project/README.md`](docs-project/README.md) — 设计文档索引
- [`docs-project/私人管理平台主应用设计.md`](docs-project/私人管理平台主应用设计.md) — 主应用
- [`docs-project/部署与Docker方案.md`](docs-project/部署与Docker方案.md) — 容器拓扑
