# admin-management-station — 私人管理平台

架构对齐 [cartoon-agent](../cartoon-agent/)：**Pi v3 Agent + 全局 CLI 部署**；本平台扩展 **Qiankun 微前端 + Egg.js 多 BFF**。

**设计文档入口**：[`docs-project/README.md`](docs-project/README.md)  
**Agent 方案**：[`docs-project/Agent开发方案.md`](docs-project/Agent开发方案.md)

## 能力

- 私人管理主应用（菜单、微前端基座、鉴权）
- 小说管理子应用（列表 / 详情 / 分步新建）
- **Pi Agent** 智能创作（对齐 cartoon-agent 单轮 + outbox 契约）

逻辑子能力通过 `agent_name`（见 `workspace-templates/novel/AGENTS.md`）在 Pi 单轮内完成，非独立 Python 子进程。

## 一条命令：本地 vs 开发

**全局 CLI**：`ams <命令>`（`deploy/` 目录 `npm link` 一次）

```bash
cd deploy && npm link          # 每台机器首次
ams help
ams local                      # 启动本地 Docker 全栈
```

| 命令 | 作用 |
|------|------|
| **`ams local`** | 启动本地 Docker 全栈（DB + API + 前端 + Agent） |
| **`ams local:infra`** | 仅 DB + Redis（宿主机热更新业务代码） |
| **`ams local:frontend`** | 仅前端容器 |
| **`ams local:reset`** | 清库重建（开发用） |
| **`ams local:down`** | 停止本地 Docker |

> **Windows**：`ams local` 内部走 PowerShell。未 link：`node deploy/scripts/run.mjs local`

首次本地：

```bash
cd deploy && npm link
ams local
```

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:8080 | 主应用；dev Vite **5173** |
| `ams-novel-frontend` | http://localhost:8081 | 小说子应用；dev Vite **5174** |
| `ams-api-main` | http://localhost:7001 | Egg.js · `admin_platform` |
| `ams-api-novel` | http://localhost:7002 | Egg.js · `novel_db` |
| `ams-agent-server` | http://localhost:7003 | **BFF + Pi Agent** |
| `ams-postgres` | localhost:5432 | PostgreSQL（多库） |

端口注册表：[docs-project/应用端口与命名注册表.md](docs-project/应用端口与命名注册表.md)

部署详解：[`deploy/README.md`](deploy/README.md)

## 配置分层

| 场景 | 环境文件（可提交） | 密钥（gitignore） |
|------|-------------------|-------------------|
| **本地 Docker** | `deploy/config/.env.local` | `apps/agent-server/.env` 等 |
| **生产** | `deploy/config/.env.prod`（待增） | 部署平台密钥 |

详见 [`deploy/config/README.md`](deploy/config/README.md)。

## 目录

| 目录 | 说明 |
|------|------|
| `menu-master/` | **主应用开发**（Vite :5173 · API :7001） |
| `apps/main-frontend/` | 主应用（可与 menu-master 对齐） |
| `apps/main-backend/` | Egg.js 平台 BFF |
| `apps/novel-frontend/` | 小说子应用 |
| `apps/novel-backend/` | Egg.js 小说 API |
| `apps/agent-server/` | **BFF + Pi**（对齐 cartoon-agent `server/`） |
| `workspace-templates/` | Pi 模板（SOUL / AGENTS / tools） |
| `workspaces/`、`data/` | 运行时（gitignore） |
| `deploy/` | Docker Compose + **`ams` CLI** |
| `docs-project/` | 设计文档 |
| `skills/` | Agent Skills（开发流程） |

## 开发规范

**无论人工或 AI 开发**，均须遵循 [`.cursor/rules/`](.cursor/rules/)：

| 规则 | 说明 |
|-----|------|
| `development-standards.mdc` | 通用约束 |
| `pi-v3-agent.mdc` | Pi Agent 漫游 |
| `pi-minimal-design.mdc` | Pi 极简原则 |
| `deploy-cli.mdc` | **`ams` 指令与 deploy/** |
| `react-web.mdc` | 前端 SPA |
| `docker.mdc` | 容器与镜像 |
| `app-registry.mdc` | **多应用端口与数据库名** |
| `egg-backend.mdc` | Egg.js BFF |
| `qiankun-microfrontend.mdc` | 微前端 |

Agent 架构漫游对照：[cartoon-agent/.cursor/rules/pi-v3.mdc](../cartoon-agent/.cursor/rules/pi-v3.mdc)

## Agent Skills

- [project-developer](skills/project-developer/) — 按设计文档拆分并实现各模块

## 文档

- [`docs-project/README.md`](docs-project/README.md) — 设计文档索引
- [`docs-project/Agent开发方案.md`](docs-project/Agent开发方案.md) — Pi v3 Agent
- [`docs-project/部署与Docker方案.md`](docs-project/部署与Docker方案.md) — 容器拓扑
