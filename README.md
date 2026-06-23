# admin-management-station — 私人管理平台

架构：**Qiankun 微前端 + Egg.js 多 BFF**；可选 **Pi Agent**（`apps/agent-server`，对齐 [cartoon-agent](../cartoon-agent/) 模式）。

**设计文档入口**：[`docs-project/README.md`](docs-project/README.md)

## 能力

- 私人管理主应用（菜单、微前端基座、鉴权）— `menu-master/`
- 小说管理子应用（规划中）— `apps/novel-*`
- Pi Agent 服务（规划中）— `apps/agent-server/`

## 本地 Docker（每应用独立 CLI）

部署结构对齐 [cartoon-agent/deploy](../cartoon-agent/deploy)：**每个应用在 `{app}/deploy/` 自管 compose、配置与 CLI**。仓库根 [`deploy/`](deploy/) 仅共享 PostgreSQL / Redis。

| app_key | 首次 link | 日常启动 |
|---------|-----------|----------|
| 主应用 | `cd menu-master/deploy && npm link` | **`ams-main local`** |
| 小说 | `cd apps/novel/deploy && npm link` | **`ams-novel local`** |
| Agent | `cd apps/agent-server/deploy && npm link` | **`ams-agent local`** |

命令详情见各应用 [`deploy/README.md`](menu-master/deploy/README.md)（主应用示例）。

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:5173 | 主应用 Vite dev（Docker 与宿主机同端口） |
| `ams-novel-frontend` | http://localhost:8081 | 小说子应用；dev Vite **5174** |
| `ams-api-main` | http://localhost:7001 | Egg.js · `admin_platform` |
| `ams-api-novel` | http://localhost:7002 | Egg.js · `novel_db` |
| `ams-agent-server` | http://localhost:7003 | Agent（profile `agent`） |
| `ams-postgres` | localhost:5432 | PostgreSQL（多库） |

端口注册表：[docs-project/应用端口与命名注册表.md](docs-project/应用端口与命名注册表.md)

共享 infra 索引：[deploy/README.md](deploy/README.md)

## 配置分层

| 场景 | 环境文件（可提交） | 密钥（gitignore） |
|------|-------------------|-------------------|
| **本地 Docker** | `{app}/deploy/config/.env.local` | 各应用 `backend/.env`、`src/.env` 等 |
| **生产** | `{app}/deploy/config/.env.prod`（按需） | 部署平台密钥 |

## 目录

| 目录 | 说明 |
|------|------|
| `menu-master/` | **主应用**（frontend :5173 · backend :7001 · [`deploy/`](menu-master/deploy/)） |
| `apps/novel/` | 小说子应用编排（[`deploy/`](apps/novel/deploy/)） |
| `apps/agent-server/` | Agent BFF + Pi（[`deploy/`](apps/agent-server/deploy/)） |
| `deploy/` | **仅**共享 `compose/infra.yml` |
| `docs-project/` | 设计文档 |
| `skills/` | 开发流程 Skills |

> **Pi 工作区**（`workspace-templates/`、`workspaces/`）在**子应用/Agent 域内**按需配置，不在仓库根目录。

## 开发规范

**无论人工或 AI 开发**，均须遵循 [`.cursor/rules/`](.cursor/rules/)：

| 规则 | 说明 |
|-----|------|
| `development-standards.mdc` | 通用约束 |
| `deploy-cli.mdc` | **各应用 `ams-{app_key}` CLI** |
| `docker-compose.mdc` | **每应用 `deploy/` 目录** |
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
