# 小说子应用（app_key=novel）— 自包含完整项目

脱离 monorepo 时，复制本目录即可独立开发与部署。

## 模块

| 模块 | 路径 | 端口（默认） |
|------|------|-------------|
| 前端 | `frontend/` | Vite **5174** |
| Egg.js BFF | `backend/` | API **7002** |
| Pi Agent | `agent/` | **7003** |
| 数据库 | `database/init.sql` | PG 宿主机 **5433** · `novel_db` |
| Pi 模板 | `workspace-templates/novel/` | — |
| 部署 | `deploy/` | `ams-novel` |

## 接入主应用（Qiankun）

主应用 `menu-master` 通过数据库注册本子应用：

| 表 | 字段 | 值 |
|----|------|-----|
| `subapp_registry` | `microapp_name` | `novel-app` |
| `menu_items` | `route_prefix` | `novel` |

主应用菜单 API 返回 `entry`（默认 `http://localhost:5174`），Qiankun `activeRule` 为 `/media/novel`。

**联调步骤**：

```bash
# 1. 主应用 DB 种子（含 subapp_registry）
cd menu-master/backend && npm run db:init

# 2. 启动主应用
cd menu-master/frontend && npm run dev    # :5173
cd menu-master/backend && npm run dev     # :7001

# 3. 启动本子应用
cd novel-sub/frontend && npm run dev      # :5174
cd novel-sub/backend && npm run dev       # :7002（业务 API）
cd novel-sub/agent && npm run dev         # :7003（可选，Agent 页）
```

浏览器打开 http://localhost:5173 ，点击「小说管理」即可加载本子应用。

## 一键 Docker

```bash
cd deploy && npm link
ams-novel local          # postgres + api + agent + frontend
ams-novel local:infra    # 仅 DB，宿主机 npm run dev
```

## 宿主机开发

```bash
cd backend && npm install && npm run db:init
cd backend && npm run dev      # :7002
cd frontend && npm run dev     # :5174
cd agent && npm install && npm run dev   # :7003
```

Agent 配置：`agent/.env.example`（DB 默认 `127.0.0.1:5433/novel_db`）

## 规范

- [app-self-contained.mdc](../.cursor/rules/app-self-contained.mdc)
- [cache-local.mdc](../.cursor/rules/cache-local.mdc)
- [qiankun-microfrontend.mdc](../.cursor/rules/qiankun-microfrontend.mdc)
- [Agent开发方案.md](../docs-project/Agent开发方案.md)
