# docs-project — 设计文档

私人管理平台（admin-management-station）设计方案与部署说明。

**架构规则**：每个应用自包含（见 [`.cursor/rules/app-self-contained.mdc`](../.cursor/rules/app-self-contained.mdc)）。

## 一条命令

```bash
cd menu-master/deploy && npm link && ams-main local
cd project-sub/novel-sub/deploy && npm link && ams-novel local
cd project-sub/testgen-sub/deploy && npm link && ams-testgen local
```

| CLI | 说明 |
|-----|------|
| **`ams-main`** | 主应用：Postgres + 同步子应用 + API + 前端 |
| **`ams-novel`** | 小说子应用：Postgres + API + 前端 |
| **`ams-testgen`** | AI 测试平台：Postgres + API + 前端 |

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:5173 | 主应用 |
| `ams-main-postgres` | localhost:**5432** | `admin_platform` |
| `ams-api-main` | http://localhost:7001 | 平台 BFF |
| `ams-novel-frontend` | http://localhost:5174 / Docker 8081 | 小说 UI |
| `ams-novel-postgres` | localhost:**5433** | `novel_db` |
| `ams-api-novel` | http://localhost:7002 | 小说 BFF |

详见 [部署与Docker方案.md](./部署与Docker方案.md) · [应用端口与命名注册表.md](./应用端口与命名注册表.md)

## 文档清单

| 文档 | 说明 |
|-----|------|
| [应用端口与命名注册表.md](./应用端口与命名注册表.md) | 端口、库名 |
| [部署与Docker方案.md](./部署与Docker方案.md) | 自包含 compose |
| [私人管理平台主应用设计.md](./私人管理平台主应用设计.md) | 主应用 |
| [小说管理页面子应用设计.MD](./小说管理页面子应用设计.MD) | 子应用 |

## 架构概览

```
menu-master/                    ← 完整主应用
project-sub/
  novel-sub/                    ← 小说子应用
  testgen-sub/                  ← AI 测试平台子应用
```

两应用各自自带 Postgres，缓存默认 **memory**，**不共享**根级 infra。

**Agent / 智能体**：不在本仓库实现。如需 Skill 插件与 Loop 等 Agent 方案，见 [`agent-management-master`](../../agent-management-master) 与 [`agent-management-sub`](../../agent-management-sub)。

## 开发规范

| 规则 | 说明 |
|------|------|
| **`app-self-contained.mdc`** | **自包含架构（必读）** |
| `app-registry.mdc` | 端口与库名 |
| `subapp-onboarding.mdc` | 子应用接入 |
| `deploy-cli.mdc` | 各应用 CLI |

子应用开发工作流：[`skills/`](../skills/)（`main-app-developer` · `sub-app-developer` · `project-developer/{app_key}`）
