# menu-master — 部署与 CLI

`app_key=main` · **自包含栈**：Postgres + Redis + API + 前端（见 `app-self-contained.mdc`）。

## 日常入口

| 你想做什么 | 命令 |
|------------|------|
| 本地全栈 Docker | **`ams-main local`** |
| 仅前端容器 | **`ams-main local:frontend`** |
| 仅 DB + Redis（宿主机热更新） | **`ams-main local:infra`** |
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
| `ams-main-redis` | localhost:6379 | 本应用专用 |

业务说明见 [../README.md](../README.md)。
