# admin-management-station — 工作区说明

本仓库聚合多个**自包含应用**；每个应用可整目录复制出去独立运行。

**架构规则**：[`/.cursor/rules/app-self-contained.mdc`](.cursor/rules/app-self-contained.mdc)

**设计文档**：[`docs-project/README.md`](docs-project/README.md)

## 应用列表

| 应用 | 目录 | CLI | 说明 |
|------|------|-----|------|
| 主应用 | [`menu-master/`](menu-master/) | `ams-main` | 菜单 + Qiankun 基座 · `:7001` · PG `:5432` |
| 小说子应用 | [`novel-sub/`](novel-sub/) | `ams-novel` | 前端 + BFF + Agent · `:7002`/`:7003` · PG `:5433` |

每个应用 `deploy/docker-compose.yml` **自带 Postgres/Redis**，不共享根级 infra。

## 快速启动

```bash
# 主应用
cd menu-master/deploy && npm link && ams-main local

# 小说子应用（含 Agent）
cd novel-sub/deploy && npm link && ams-novel local
```

端口详情：[docs-project/应用端口与命名注册表.md](docs-project/应用端口与命名注册表.md)

## 目录

| 路径 | 说明 |
|------|------|
| `menu-master/` | 主应用完整项目 |
| `novel-sub/` | 小说子应用完整项目（含 `agent/`） |
| `docs-project/` | 设计文档 |
| `.cursor/rules/` | 开发规范 |
| `skills/` | 开发流程 Skills |
| `deploy/` | **已废弃** — 见 [`deploy/README.md`](deploy/README.md) |
| `apps/` | **已废弃** — 见 [`apps/README.md`](apps/README.md) |

## 开发规范

| 规则 | 说明 |
|-----|------|
| **`app-self-contained.mdc`** | **自包含应用（必读）** |
| `development-standards.mdc` | 通用约束 |
| `app-registry.mdc` | 端口与库名 |
| `deploy-cli.mdc` | 各应用 CLI |
