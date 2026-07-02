# 小说子应用（app_key=novel）— 自包含完整项目

脱离 monorepo 时，复制本目录即可独立开发与部署。

## 模块

| 模块 | 路径 | 端口（默认） |
|------|------|-------------|
| 前端 | `frontend/` | Vue 3 + Element Plus · Vite **5101** |
| Egg.js BFF | `backend/` | API **5201** |
| 数据库 | `database/init.sql` | PG 宿主机 **5301** · `novel_db` |
| 部署 | `deploy/` | `ams-novel` |

## 接入主应用（Qiankun）

主应用 `menu-master` 通过数据库注册本子应用：

| 表 | 字段 | 值 |
|----|------|-----|
| `subapp_registry` | `microapp_name` | `novel-app` |
| `menu_items` | `route_prefix` | `novel` |

主应用菜单 API 返回 `entry`（默认 `http://localhost:5101`），Qiankun `activeRule` 为 `/media/novel`。

**联调步骤**：

```bash
# 1. 主应用 DB 种子（含 subapp_registry）
cd menu-master/backend && npm run db:init

# 2. 启动主应用
cd menu-master/frontend && npm run dev    # :5100
cd menu-master/backend && npm run dev     # :5200

# 3. 启动本子应用
cd novel-sub/frontend && npm run dev      # :5101
cd novel-sub/backend && npm run dev       # :5201（业务 API）
```

浏览器打开 http://localhost:5100 ，点击「小说管理」即可加载本子应用。

## 一键 Docker

```bash
cd deploy && npm link
ams-novel local          # postgres + api + frontend
ams-novel local:infra    # 仅 DB，宿主机 npm run dev
```

## 宿主机开发

```bash
cd backend && npm install && npm run db:init
cd backend && npm run dev      # :5201
cd frontend && npm run dev     # :5101
```

## 开发规范（必读）

迭代开发须遵守 monorepo 规则：

| 规则 | 说明 |
|------|------|
| [subapp-development.mdc](../../.cursor/rules/subapp-development.mdc) | **变更登记、DB 联动、docs 同步（主规范）** |
| [agent-skill-development.mdc](../../.cursor/rules/agent-skill-development.mdc) | **新 Skill 默认落点 agent-management-sub** |
| [subapp-onboarding.mdc](../../.cursor/rules/subapp-onboarding.mdc) | Qiankun 接入 |
| [database-schema-sync.mdc](../../.cursor/rules/database-schema-sync.mdc) | 启动 Schema 同步 |

### 变更须登记的文件

| 类型 | 文件 |
|------|------|
| 变更记录 | [docs/变更记录.md](./docs/变更记录.md)（DB / API / UI 变更） |

改表、新 API/页面时须登记（格式见 `subapp-development.mdc` §1）。

### 本应用文档（开发后须同步）

| 文档 | 路径 |
|------|------|
| 架构与流程图 | [docs/架构关系图.md](./docs/架构关系图.md) |
| 评分与后续计划 | [docs/项目评分与后续计划.md](./docs/项目评分与后续计划.md) |

文档缺失时按 `subapp-development.mdc` §3 创建并梳理。

### 数据库 CLI

| 命令 | 说明 |
|------|------|
| `cd backend && npm run db:init` | 空库初始化（`database/init.sql`） |
| BFF 启动 | 自动 schema 同步（`database-schema-sync.mdc`） |

**改表时须同步**：`database/init.sql`、`backend/app/model/`、必要时 `migrations/`；若引入 seed 体系应对齐 `testgen-sub` 的 `db:seed` / `db:reset` 命令集。

## 规范索引

- [app-self-contained.mdc](../../.cursor/rules/app-self-contained.mdc)
- [sub-app-developer 工作流](../../skills/sub-app-developer/SKILL.md)
- [novel-sub 项目 Skill](../../skills/project-developer/novel-sub/SKILL.md)
