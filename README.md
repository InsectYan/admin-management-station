# admin-management-station — 工作区说明

本仓库聚合多个**自包含应用**。每个应用自带前端、BFF、数据库和部署，可整目录复制出去独立运行。应用之间不共享根级 Postgres。

**架构规则**：[`/.cursor/rules/app-self-contained.mdc`](.cursor/rules/app-self-contained.mdc)

**设计文档**：[`docs-project/README.md`](docs-project/README.md)

**端口登记**：[`docs-project/应用端口与命名注册表.md`](docs-project/应用端口与命名注册表.md)

## 应用列表

| 应用 | 目录 | CLI | 菜单名 | 前端 | API | PG | 数据库 |
|------|------|-----|--------|------|-----|----|--------|
| 主应用 | [`menu-master/`](menu-master/) | `ams-main` | — | 5100 | 5200 | 5432 | `admin_platform` |
| 小说 | [`project-sub/novel-sub/`](project-sub/novel-sub/) | `ams-novel` | 叙事工作台 | 5101 | 5201 | 5301 | `novel_db` |
| AI 测试 | [`project-sub/testgen-sub/`](project-sub/testgen-sub/) | `ams-testgen` | AI智能测试平台 | 5102 | 5202 | 5302 | `testgen_db` |
| 运维 | [`project-sub/ops-sub/`](project-sub/ops-sub/) | `ams-ops` | 运维管理平台 | 5103 | 5203 | 5303 | `ops_db` |
| 预检 | [`project-sub/precheck-sub/`](project-sub/precheck-sub/) | `ams-precheck` | 预检 | 5104 | 5204 | 5304 | `precheck_db` |
| AI 视频 | [`project-sub/cartoon-sub/`](project-sub/cartoon-sub/) | `ams-cartoon` | AI 视频 | 5105 | 5205 | 5305 | `cartoon_db` |

主应用是菜单和 Qiankun 基座。五个子应用各自带 `subapp.manifest.json`，由主应用启动时扫描注册。

各应用做什么：

- **小说**：叙事工作台，创作与章节管理。
- **AI 测试**：测试文档、生成任务和用例展示。
- **运维**：运维管理；配置生成走独立仓库里的 `ops-project-skill`。
- **预检**：登记宿主机上的 ComfyUI，比对工作流缺的节点和模型。ComfyUI 不进本仓库，留在宿主机 `:8188`。
- **AI 视频**：项目、章节快照、分镜，以及先经预检再出图、出视频。容器内预检地址是 `host.docker.internal:5204`，出图地址是 `host.docker.internal:8188`。

每个应用的 `deploy/docker-compose.yml` **自带 Postgres**。缓存默认 **memory**（见 `cache-local.mdc`）。容器名是 `ams-{app_key}-postgres`、`ams-api-{app_key}`、`ams-{app_key}-frontend`；主应用的 `app_key` 是 `main`。

> **Agent 平台**：智能体能力由独立仓库 [`agent-management-master`](../agent-management-master) 提供，API `:4001`，Postgres `:5500`，**不**内嵌于本仓库。  
> **新 Skill、新 Scheme 直接写在该仓库**（`plugins/`、`app/lib/schemes/`）。规范见 [`.cursor/rules/agent-skill-development.mdc`](.cursor/rules/agent-skill-development.mdc)。

## 一个应用里有什么

子应用骨架相同：

```
project-sub/{name}-sub/
├── frontend/                 # Vue 3 + Vite + Element Plus
├── backend/                  # Egg.js BFF
├── database/                 # init.sql 与迁移
├── deploy/                   # compose + ams-* CLI
├── docs/                     # 该应用自己的说明
└── subapp.manifest.json      # 菜单、端口、Qiankun 入口
```

主应用是 `menu-master/`，目录为 `frontend/`、`backend/`、`database/`、`deploy/`、`docker/`，没有 manifest。

个别差异：`cartoon-sub/` 另有 `data/`；`testgen-sub/` 另有 `test-project/`（联调用的样例工程）。

## 快速启动

```bash
# 主应用（启动时扫描 project-sub/ 并注册子应用菜单）
cd menu-master/deploy && npm link && ams-main local

# 子应用（按需启动）
cd project-sub/novel-sub/deploy && npm link && ams-novel local
cd project-sub/testgen-sub/deploy && npm link && ams-testgen local
cd project-sub/ops-sub/deploy && npm link && ams-ops local
cd project-sub/precheck-sub/deploy && npm link && ams-precheck local
cd project-sub/cartoon-sub/deploy && npm link && ams-cartoon local
```

浏览器打开主应用 `http://localhost:5100`。开发态 Qiankun 从各子应用的 Vite 端口拉入口，可用 `SUBAPP_{KEY}_ENTRY` 覆盖。

## 目录

| 路径 | 说明 |
|------|------|
| `menu-master/` | 主应用完整项目 |
| `project-sub/` | 子应用聚合目录。说明见 [`project-sub/README.md`](project-sub/README.md) |
| `docs-project/` | 本仓库的设计文档与端口登记 |
| `skills/` | 开发流程 Skills：`main-app-developer`、`sub-app-developer`、`project-developer/`（目前有 novel、testgen、ops） |
| `.cursor/rules/` | 开发规范 |
| `deploy/` | **已废弃**的共享 infra。见 [`deploy/README.md`](deploy/README.md) |

## 子应用动态注册

主应用启动时执行 [`menu-master/deploy/scripts/sync-subapps.mjs`](menu-master/deploy/scripts/sync-subapps.mjs)，扫描 `project-sub/` 下所有含 `subapp.manifest.json` 的目录，注册或更新一级菜单。目录或 manifest 去掉后，再次启动会禁用对应菜单。以 `_` 或 `.` 开头的目录、以及没有 manifest 的目录会被跳过。

手动同步：`ams-main sync:subapps`

## 开发规范

| 规则 | 说明 |
|------|------|
| **`app-self-contained.mdc`** | **自包含应用（必读）** |
| `development-standards.mdc` | 通用约束 |
| `app-registry.mdc` | 端口与库名 |
| `subapp-onboarding.mdc` | 子应用接入主应用 |
| `subapp-development.mdc` | 已有子应用上的迭代 |
| `deploy-cli.mdc` | 各应用 CLI |
| `database-schema-sync.mdc` | 改表后的 schema 同步 |
| `qiankun-microfrontend.mdc` | 微前端接入 |

同目录还有 Egg、Vue、Postgres、Docker、缓存等专题规则。流程类步骤在 [`skills/README.md`](skills/README.md)，不在规则文件里重复。
