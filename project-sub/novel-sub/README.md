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

## 规范

- [app-self-contained.mdc](../.cursor/rules/app-self-contained.mdc)
- [cache-local.mdc](../.cursor/rules/cache-local.mdc)
- [qiankun-microfrontend.mdc](../.cursor/rules/qiankun-microfrontend.mdc)
- [sub-app-developer 工作流](../skills/sub-app-developer/SKILL.md)
- [novel-sub 项目 Skill](../skills/project-developer/novel-sub/SKILL.md)
