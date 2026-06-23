# menu-master — 部署与 CLI

`app_key=main` · **自包含栈**：Postgres + API + 前端（见 `app-self-contained.mdc`）。

缓存默认 **memory**，无需 Redis 容器（见 `cache-local.mdc`）。

## 日常入口

| 你想做什么 | 命令 |
|------------|------|
| 本地全栈 Docker | **`ams-main local`** |
| 仅前端容器 | **`ams-main local:frontend`** |
| 仅 DB（宿主机热更新） | **`ams-main local:infra`** |
| 清库重建 | **`ams-main local:reset`** |
| 停止 | **`ams-main local:down`** |

```bash
cd menu-master/deploy && npm link
ams-main local
```

## 本地容器

| 容器 | 地址 | 说明 |
|------|------|------|
| `ams-main-frontend` | http://localhost:5173 | Vite dev |
| `ams-api-main` | http://localhost:7001 | Egg.js · `admin_platform` |
| `ams-main-postgres` | localhost:5432 | 本应用专用 |

## 联调 novel-sub

1. 主库执行 `npm run db:init`（或 `ams-main local:reset`）写入 `subapp_registry` + 菜单种子
2. 启动 novel-sub：`cd novel-sub/frontend && npm run dev`（`:5174`）
3. 主应用访问 http://localhost:5173 → 侧栏「小说管理」加载 Qiankun 子应用

`SUBAPP_NOVEL_ENTRY` / `VITE_SUBAPP_NOVEL_ENTRY` 默认 `http://localhost:5174`（Docker 内为 `host.docker.internal:5174`）。

业务说明见 [../README.md](../README.md)。
