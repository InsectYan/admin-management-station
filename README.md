# admin-management-station — 工作区说明

本仓库聚合多个**自包含应用**；每个应用可整目录复制出去独立运行。

**架构规则**：[`/.cursor/rules/app-self-contained.mdc`](.cursor/rules/app-self-contained.mdc)

**设计文档**：[`docs-project/README.md`](docs-project/README.md)

## 应用列表

| 应用 | 目录 | CLI | 说明 |
|------|------|-----|------|
| 主应用 | [`menu-master/`](menu-master/) | `ams-main` | 菜单 + Qiankun 基座 · `:7001` · PG `:5432` |
| 小说子应用 | [`novel-sub/`](novel-sub/) | `ams-novel` | 前端 + BFF · `:7002` · PG `:5433` |

每个应用 `deploy/docker-compose.yml` **自带 Postgres**；缓存默认 **memory**（见 `cache-local.mdc`），不共享根级 infra。

> **Agent 平台**：智能体能力由独立仓库 [`agent-management-master`](../agent-management-master) 提供，**不**内嵌于本仓库各应用。

## 快速启动

```bash
# 主应用
cd menu-master/deploy && npm link && ams-main local

# 小说子应用
cd novel-sub/deploy && npm link && ams-novel local
```

端口详情：[docs-project/应用端口与命名注册表.md](docs-project/应用端口与命名注册表.md)

## 目录

| 路径 | 说明 |
|------|------|
| `menu-master/` | 主应用完整项目 |
| `novel-sub/` | 小说子应用完整项目 |
| `docs-project/` | 设计文档 |
| `.cursor/rules/` | 开发规范 |
| `skills/` | 开发流程 Skills（见 [`skills/README.md`](../skills/README.md)） |
| `deploy/` | **已废弃** — 见 [`deploy/README.md`](deploy/README.md) |
| `apps/` | **已废弃** — 见 [`apps/README.md`](apps/README.md) |

## 开发规范

| 规则 | 说明 |
|-----|------|
| **`app-self-contained.mdc`** | **自包含应用（必读）** |
| `development-standards.mdc` | 通用约束 |
| `app-registry.mdc` | 端口与库名 |
| `subapp-onboarding.mdc` | 子应用接入主应用 |
| `deploy-cli.mdc` | 各应用 CLI |
