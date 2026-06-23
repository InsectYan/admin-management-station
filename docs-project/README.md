# docs-project — 设计文档

私人管理平台（admin-management-station）设计方案与部署说明。

**架构对齐**：[cartoon-agent](E:/AI Tools/projects/cartoon-agent) 的 **Pi v3 Agent + 单 CLI 部署**；本平台在此基础上增加 **Qiankun 微前端 + Egg.js 平台 BFF**。

## 一条命令：本地 vs 开发

**全局 CLI**：`ams <命令>`（`deploy/` 目录 `npm link` 一次）

```bash
cd deploy && npm link          # 每台机器首次
ams help
ams local                      # Docker 全栈
ams local:infra                # 仅 DB + Redis，业务代码宿主机热更新
```

| 命令 | 作用 |
|------|------|
| **`ams local`** | 启动本地 Docker 全栈 |
| **`ams local:infra`** | 仅 PostgreSQL + Redis |
| **`ams local:frontend`** | 仅前端容器 |
| **`ams local:reset`** | 清库重建（开发） |
| **`ams local:down`** | 停止本地 Docker |

> **Windows**：`ams local` 走 PowerShell。未 link：`node deploy/scripts/run.mjs local`

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:8080 | 主应用 + Qiankun（dev Vite **5173**） |
| `ams-novel-frontend` | http://localhost:8081 | 小说子应用（dev Vite **5174**） |
| `ams-api-main` | http://localhost:7001 | Egg.js 平台 BFF · `admin_platform` |
| `ams-api-novel` | http://localhost:7002 | Egg.js 小说 API · `novel_db` |
| `ams-agent-server` | http://localhost:7003 | **Pi Agent** |
| `ams-postgres` | localhost:5432 | PostgreSQL（多库） |

部署细节：[deploy/README.md](../deploy/README.md) · [部署与Docker方案.md](./部署与Docker方案.md) · **[应用端口与命名注册表.md](./应用端口与命名注册表.md)**

## 文档清单

| 文档 | 类型 | 说明 |
|-----|------|------|
| [**应用端口与命名注册表.md**](./应用端口与命名注册表.md) | 注册表 | 各应用端口、库名、并行开发 |
| [Agent开发方案.md](./Agent开发方案.md) | Agent | **Pi v3** 智能体（对齐 cartoon-agent） |
| [部署与Docker方案.md](./部署与Docker方案.md) | 部署 | Compose 拓扑、Nginx、环境变量 |
| [私人管理平台主应用设计.md](./私人管理平台主应用设计.md) | 主应用 | React 基座 + Qiankun + 菜单 |
| [小说管理页面子应用设计.MD](./小说管理页面子应用设计.MD) | 子应用 | React + Ant Design 小说管理 |

## 架构概览

```
浏览器
  ├── 主应用 SPA（Docker :8080 · dev :5173）── Qiankun ── 子应用（:8081 / dev :5174）
  ├── Egg.js 平台 BFF（:7001）── admin_platform
  ├── Egg.js 小说 API（:7002）── novel_db
  └── Agent Server（:7003）── BFF + Pi · SSE 对话
           ├── PostgreSQL / Redis
           ├── workspaces/ · data/（Pi 工作区，对齐 cartoon-agent）
           └── workspace-templates/novel/
```

## 阅读顺序

1. 根目录 [README.md](../README.md) — 项目入口
2. **[Agent开发方案.md](./Agent开发方案.md)** — Agent 与 cartoon-agent 对齐点
3. **[部署与Docker方案.md](./部署与Docker方案.md)** — `ams` CLI 与容器
4. [私人管理平台主应用设计.md](./私人管理平台主应用设计.md) — 微前端基座
5. [小说管理页面子应用设计.MD](./小说管理页面子应用设计.MD) — 子应用业务

## 开发规范（Cursor）

| 规则 | 说明 |
|------|------|
| `.cursor/rules/app-registry.mdc` | **多应用端口与数据库名** |
| `.cursor/rules/pi-v3-agent.mdc` | Pi Agent 全链路 |
| `.cursor/rules/pi-minimal-design.mdc` | Pi 极简原则 |
| `.cursor/rules/deploy-cli.mdc` | **`ams` 指令与 deploy/** |
| `.cursor/rules/react-web.mdc` | 前端 SPA |
| `.cursor/rules/docker.mdc` | 镜像与 Compose |

Agent 漫游对照：[cartoon-agent/.cursor/rules/pi-v3.mdc](E:/AI Tools/projects/cartoon-agent/.cursor/rules/pi-v3.mdc)

## 与 cartoon-agent 一致的两点

### 1. Agent 开发方案

- 单 Node 进程：**BFF + Pi AgentManager**（`apps/agent-server`）
- 工作区：`workspace-templates/` → `workspaces/`，outbox 契约驱动 persist
- 逻辑子能力 via `agent_name`，**非**独立 Python 进程

### 2. 指令执行

- `deploy/` + 全局 CLI **`ams`**（对应 cartoon 的 `cartoon`）
- 配置分层：`deploy/config/.env.local` + `apps/*/.env`
- Windows 优先 PowerShell 脚本封装 docker compose
