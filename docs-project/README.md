# docs-project — 设计文档

私人管理平台（admin-management-station）设计方案与部署说明。

**架构规则**：每个应用自包含（见 [`.cursor/rules/app-self-contained.mdc`](../.cursor/rules/app-self-contained.mdc)）。

## 一条命令

```bash
cd menu-master/deploy && npm link && ams-main local
cd novel-sub/deploy && npm link && ams-novel local   # 含 Agent
```

| CLI | 说明 |
|-----|------|
| **`ams-main`** | 主应用：Postgres + Redis + API + 前端 |
| **`ams-novel`** | 小说子应用：Postgres + Redis + API + **Agent** + 前端 |

**无 `ams-agent`** — Agent 内置于 `novel-sub/agent/`，随 `ams-novel local` 启动。

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:5173 | 主应用 |
| `ams-main-postgres` | localhost:**5432** | `admin_platform` |
| `ams-api-main` | http://localhost:7001 | 平台 BFF |
| `ams-novel-frontend` | http://localhost:5174 / Docker 8081 | 小说 UI |
| `ams-novel-postgres` | localhost:**5433** | `novel_db` |
| `ams-api-novel` | http://localhost:7002 | 小说 BFF |
| `ams-novel-agent` | http://localhost:7003 | Pi Agent |

详见 [部署与Docker方案.md](./部署与Docker方案.md) · [应用端口与命名注册表.md](./应用端口与命名注册表.md)

## 文档清单

| 文档 | 说明 |
|-----|------|
| [应用端口与命名注册表.md](./应用端口与命名注册表.md) | 端口、库名 |
| [Agent开发方案.md](./Agent开发方案.md) | Pi v3（`novel-sub/agent/`） |
| [部署与Docker方案.md](./部署与Docker方案.md) | 自包含 compose |
| [私人管理平台主应用设计.md](./私人管理平台主应用设计.md) | 主应用 |
| [小说管理页面子应用设计.MD](./小说管理页面子应用设计.MD) | 子应用 |

## 架构概览

```
menu-master/          ← 完整主应用（frontend + backend + database + deploy）
novel-sub/            ← 完整子应用（+ agent + workspace-templates + deploy）
```

两应用各自自带 Postgres/Redis，**不共享**根级 infra。

## 开发规范

| 规则 | 说明 |
|------|------|
| **`app-self-contained.mdc`** | **自包含架构（必读）** |
| `app-registry.mdc` | 端口与库名 |
| `pi-v3-agent.mdc` | 子应用内 Agent |
| `deploy-cli.mdc` | 各应用 CLI |
