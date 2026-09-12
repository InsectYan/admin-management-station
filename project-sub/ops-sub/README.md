# ops-sub — 运维管理平台

`app_key=ops` · 自包含子应用（frontend + backend + database + deploy）

样式与页面方案对齐小说平台（清新森林风、PageShell / DataTablePanel、详情 Shell + Tab）。本期**不接入 Agent**：部署执行与 pi Agent 联调列为后续。

## 端口

| 服务 | 端口 |
|------|------|
| Vite dev | 5103 |
| BFF API | 5203 |
| Postgres 宿主机 | 5303 |
| 数据库 | `ops_db` |

## 快速启动

宿主机热更新（推荐联调）：

```bash
cd project-sub/ops-sub/deploy && npm link && ams-ops local:infra
cd project-sub/ops-sub/backend && npm install && npm run dev
cd project-sub/ops-sub/frontend && npm install && npm run dev
```

整栈 Docker：

```bash
cd project-sub/ops-sub/deploy && npm link && ams-ops local
```

独立访问（basename 与 Qiankun 一致）：

- 前端：http://localhost:5103/media/ops/projects
- BFF：http://localhost:5203/api/health

## 与主应用联调

```bash
cd ops-sub/frontend && npm run dev          # :5103
cd menu-master/deploy && ams-main local     # 自动 sync-subapps
```

浏览器访问主应用 → 侧栏「运维管理平台」→ `/media/ops/projects`

## 前端路由

| 路径 | 说明 |
|------|------|
| `/projects` | 项目列表（看板 / 表格）；导出模板、导入 JSON、导出配置 |
| `/projects/:id?tab=1..4` | 详情：基础信息 / 目录结构 / 路由 / 功能流程图（AntV X6） |

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/projects` | 列表（name / type / status / 分页 / 排序） |
| GET | `/api/projects/template` | 空白 JSON 模板（含 `_guide` 字段说明） |
| POST | `/api/projects/import` | 按模板导入创建项目 |
| GET | `/api/projects/:id/export` | 导出完整项目配置 |
| POST | `/api/projects` | 新建 |
| GET | `/api/projects/:id` | 详情 |
| PUT | `/api/projects/:id` | 更新 |
| DELETE | `/api/projects/:id` | 删除 |

模板字段约定见 [`docs/项目配置模板.md`](docs/项目配置模板.md)。

## 开发规范（必读）

迭代开发须遵守 monorepo 规则：

| 规则 | 说明 |
|------|------|
| [subapp-development.mdc](../../.cursor/rules/subapp-development.mdc) | **变更登记、DB 联动、docs 同步** |
| [subapp-onboarding.mdc](../../.cursor/rules/subapp-onboarding.mdc) | Qiankun 接入 |
| [database-schema-sync.mdc](../../.cursor/rules/database-schema-sync.mdc) | 启动 Schema 同步 |
| [ops-sub-style.mdc](../../.cursor/rules/ops-sub-style.mdc) | 森林风样式（对齐小说平台） |

### 本应用文档

| 文档 | 路径 |
|------|------|
| 架构与流程图 | `docs/架构关系图.md` |
| 评分与后续计划 | `docs/项目评分与后续计划.md` |
| 配置模板 | `docs/项目配置模板.md` |
| 变更记录 | `docs/变更记录.md` |

### 数据库 CLI（ams-ops）

| 命令 | 说明 |
|------|------|
| `ams-ops local:infra` | 仅启动 Postgres |
| `ams-ops db:init` | 空库执行 `database/init.sql` |
| `ams-ops local` | Postgres + API + 前端 |
| `ams-ops local:down` | 停止本栈 |
| `ams-ops local:reset` | 清库重建 |

日常开发依赖 BFF 启动时的 Schema 同步（`schemaSync.js`），空库会写入演示项目。
